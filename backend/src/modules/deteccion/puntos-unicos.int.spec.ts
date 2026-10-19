import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import {
  cargarDatosDeDeteccion,
  type DatosDeteccion,
} from '../../testing/datos-deteccion.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { DeteccionService } from './deteccion.service.js';

describe('RF16: Puntos únicos de falla (integración)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let datos: DatosDeteccion;
  let servicio: DeteccionService;

  const sesionGlobal: SesionUsuario = {
    id: 1,
    nombreUsuario: 'rrhh',
    rol: 'recursos_humanos',
    idPersona: null,
    unidades: [],
  };

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    datos = await cargarDatosDeDeteccion(ds);
    const alcance = new AlcanceService(ds);
    servicio = new DeteccionService(ds, alcance);
  }, 60000);

  afterAll(async () => {
    await base?.destruir();
  });

  it('devuelve K2 como único poseedor y K4, K5 sin poseedor en consulta global, y K1 calcula el nivel requerido más exigente (orden 3)', async () => {
    const res = await servicio.puntosUnicosFalla({}, sesionGlobal);

    // K2 (Ana)
    expect(res.unicoPoseedor.map((p) => p.denominacion)).toEqual([
      'Conocimiento K2',
    ]);
    const k2 = res.unicoPoseedor[0];
    expect(k2.cantidadPoseedores).toBe(1);
    expect(k2.poseedor).toEqual({
      idPersona: datos.persona.Ana,
      apellido: 'Pérez',
      nombre: 'Ana',
    });
    expect(k2.nivelRequerido).toBe('Avanzado');
    expect(k2.puestosCriticos.map((p) => p.denominacion).sort()).toEqual([
      'C1.JTP',
      'C1.jefe',
    ]);
    expect(k2.puestosFueraDeAlcance).toBe(0);

    // K4 y K5 sin poseedor
    expect(res.sinPoseedor.map((p) => p.denominacion).sort()).toEqual([
      'Conocimiento K4',
      'Conocimiento K5',
    ]);
    for (const sp of res.sinPoseedor) {
      expect(sp.cantidadPoseedores).toBe(0);
      expect(sp.poseedor).toBeNull();
    }

    // K1 en la vista calcula orden_requerido_max = 3 y cantidad_poseedores = 2 (Beto y Carla)
    const [vistaK1] = await ds.query(
      `SELECT orden_requerido_max, cantidad_poseedores FROM deteccion_punto_unico_falla WHERE id_conocimiento = $1`,
      [datos.conocimiento.K1],
    );
    expect(vistaK1.orden_requerido_max).toBe(3);
    expect(vistaK1.cantidad_poseedores).toBe(2);
  });

  it('aplica alcance de jefatura acotada y enmascara al poseedor fuera de su alcance', async () => {
    // Quitamos temporalmente la acreditación de Carla en K1 para que K1 quede con 1 único poseedor (Beto, de C2)
    await ds.query(
      `DELETE FROM conocimiento_persona WHERE id_persona = $1 AND id_conocimiento = $2`,
      [datos.persona.Carla, datos.conocimiento.K1],
    );

    const sesionJefeC2: SesionUsuario = {
      id: 2,
      nombreUsuario: 'jefe_c2',
      rol: 'jefe_catedra',
      idPersona: datos.persona.Beto,
      unidades: [datos.catedra.C2],
    };

    const resC2 = await servicio.puntosUnicosFalla({}, sesionJefeC2);
    // K2 no tiene pares en C2
    expect(
      resC2.unicoPoseedor.find((p) => p.denominacion === 'Conocimiento K2'),
    ).toBeUndefined();
    // K1 sí se ve en C2 (Beto está en C2: poseedor visible, y C4.aux queda como puesto fuera de alcance)
    const k1EnC2 = resC2.unicoPoseedor.find(
      (p) => p.denominacion === 'Conocimiento K1',
    );
    expect(k1EnC2).toBeDefined();
    expect(k1EnC2!.poseedor?.idPersona).toBe(datos.persona.Beto);
    expect(k1EnC2!.puestosFueraDeAlcance).toBe(1);
    expect(resC2.sinPoseedor.map((p) => p.denominacion)).toContain(
      'Conocimiento K4',
    );

    // Desde C4: K1 también se ve porque es crítico en C4.aux, pero Beto (su poseedor) está en C2 -> enmascarado
    const sesionJefeC4: SesionUsuario = {
      id: 3,
      nombreUsuario: 'jefe_c4',
      rol: 'jefe_catedra',
      idPersona: datos.persona.Diego,
      unidades: [datos.catedra.C4],
    };

    const resC4 = await servicio.puntosUnicosFalla({}, sesionJefeC4);
    const k1EnC4 = resC4.unicoPoseedor.find(
      (p) => p.denominacion === 'Conocimiento K1',
    );
    expect(k1EnC4).toBeDefined();
    expect(k1EnC4!.poseedor).toBeNull();
    expect(k1EnC4!.puestosCriticos.map((p) => p.denominacion)).toEqual([
      'C4.aux',
    ]);
    expect(k1EnC4!.puestosFueraDeAlcance).toBe(1);

    // Restauramos la acreditación de Carla en K1 (N3 = avanzado)
    await ds.query(
      `INSERT INTO conocimiento_persona (id_persona, id_conocimiento, id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador)
       VALUES (
         $1, $2,
         (SELECT id_nivel_dominio FROM nivel_dominio WHERE codigo = 'avanzado'),
         CURRENT_DATE,
         (SELECT id_tipo_evidencia FROM tipo_evidencia WHERE codigo = 'certificado'),
         $3
       )`,
      [datos.persona.Carla, datos.conocimiento.K1, datos.persona.Ana],
    );
  });

  it('si un conocimiento pierde todos sus pares críticos deja de figurar', async () => {
    await ds.query(
      `UPDATE puesto SET activo = false WHERE id_puesto IN ($1, $2)`,
      [datos.puesto['C1.jefe'], datos.puesto['C1.JTP']],
    );

    const res = await servicio.puntosUnicosFalla({}, sesionGlobal);
    expect(
      res.unicoPoseedor.find((p) => p.denominacion === 'Conocimiento K2'),
    ).toBeUndefined();

    await ds.query(
      `UPDATE puesto SET activo = true WHERE id_puesto IN ($1, $2)`,
      [datos.puesto['C1.jefe'], datos.puesto['C1.JTP']],
    );
  });

  it('un poseedor con fecha de retiro hoy sigue contando como poseedor', async () => {
    await ds.query(
      `UPDATE persona SET fecha_prevista_retiro = CURRENT_DATE WHERE id_persona = $1`,
      [datos.persona.Ana],
    );

    const res = await servicio.puntosUnicosFalla({}, sesionGlobal);
    expect(res.unicoPoseedor.map((p) => p.denominacion)).toContain(
      'Conocimiento K2',
    );

    await ds.query(
      `UPDATE persona SET fecha_prevista_retiro = NULL WHERE id_persona = $1`,
      [datos.persona.Ana],
    );
  });
});
