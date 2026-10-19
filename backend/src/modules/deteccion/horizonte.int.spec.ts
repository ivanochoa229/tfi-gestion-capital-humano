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

describe('RF20: Horizonte de riesgo (integración)', () => {
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

  it('con 24 meses por defecto devuelve solo K1 (quedan = 1) y con incluirConDosOMas suma K6 (quedan = 2)', async () => {
    const porDefecto = await servicio.horizonteRiesgo({}, sesionGlobal);
    expect(porDefecto.meses).toBe(24);
    expect(porDefecto.conocimientos.map((k) => k.denominacion)).toEqual([
      'Conocimiento K1',
    ]);
    const k1 = porDefecto.conocimientos[0];
    expect(k1.cantidadPoseedores).toBe(2);
    expect(k1.quedan).toBe(1);
    expect(k1.retiros).toHaveLength(1);
    expect(k1.retiros[0]).toMatchObject({
      idPersona: datos.persona.Beto,
      apellido: 'García',
      nombre: 'Beto',
    });
    expect(k1.retiros[0].fechaPrevistaRetiro).toBeTruthy();

    // Con incluirConDosOMas = true
    const conTodos = await servicio.horizonteRiesgo(
      { incluirConDosOMas: true },
      sesionGlobal,
    );
    expect(conTodos.conocimientos.map((k) => k.denominacion)).toEqual([
      'Conocimiento K1',
      'Conocimiento K6',
    ]);
    const k6 = conTodos.conocimientos[1];
    expect(k6.cantidadPoseedores).toBe(3);
    expect(k6.quedan).toBe(2);
  });

  it('con 36 meses suma K3 con quedan = 1 (retira Diego, queda Eva)', async () => {
    const res = await servicio.horizonteRiesgo({ meses: 36 }, sesionGlobal);
    expect(res.meses).toBe(36);
    expect(res.conocimientos.map((k) => k.denominacion)).toEqual([
      'Conocimiento K1',
      'Conocimiento K3',
    ]);
    const k3 = res.conocimientos.find(
      (k) => k.denominacion === 'Conocimiento K3',
    )!;
    expect(k3.cantidadPoseedores).toBe(2);
    expect(k3.quedan).toBe(1);
    expect(k3.retiros[0].idPersona).toBe(datos.persona.Diego);
  });

  it('enmascara persona y fecha cuando la jefatura no ve la ocupación del poseedor que se retira, pero conserva quedan', async () => {
    // Desde C4: K1 es crítico en C4.aux, pero Beto (quien se retira) está en C2
    const sesionJefeC4: SesionUsuario = {
      id: 3,
      nombreUsuario: 'jefe_c4',
      rol: 'jefe_catedra',
      idPersona: datos.persona.Diego,
      unidades: [datos.catedra.C4],
    };

    const res = await servicio.horizonteRiesgo({}, sesionJefeC4);
    const k1 = res.conocimientos.find(
      (k) => k.denominacion === 'Conocimiento K1',
    )!;
    expect(k1).toBeDefined();
    expect(k1.quedan).toBe(1);
    expect(k1.retiros).toEqual([
      {
        idPersona: null,
        apellido: null,
        nombre: null,
        fechaPrevistaRetiro: null,
      },
    ]);
    expect(k1.puestosCriticos.map((p) => p.denominacion)).toEqual(['C4.aux']);
    expect(k1.puestosFueraDeAlcance).toBe(1);
  });

  it('borde de fecha: retiro exactamente en hoy + meses cuenta, pero un día después no', async () => {
    // Ponemos a Ana retiro exactamente en hoy + 12 meses
    await ds.query(
      `UPDATE persona SET fecha_prevista_retiro = (CURRENT_DATE + INTERVAL '12 months')::date WHERE id_persona = $1`,
      [datos.persona.Ana],
    );

    let res = await servicio.horizonteRiesgo({ meses: 12 }, sesionGlobal);
    expect(res.conocimientos.map((k) => k.denominacion)).toContain(
      'Conocimiento K2',
    );
    const k2 = res.conocimientos.find(
      (k) => k.denominacion === 'Conocimiento K2',
    )!;
    expect(k2.quedan).toBe(0);

    // Ponemos retiro un día después de 12 meses
    await ds.query(
      `UPDATE persona SET fecha_prevista_retiro = (CURRENT_DATE + INTERVAL '12 months' + INTERVAL '1 day')::date WHERE id_persona = $1`,
      [datos.persona.Ana],
    );

    res = await servicio.horizonteRiesgo({ meses: 12 }, sesionGlobal);
    expect(
      res.conocimientos.find((k) => k.denominacion === 'Conocimiento K2'),
    ).toBeUndefined();

    // Restauramos Ana
    await ds.query(
      `UPDATE persona SET fecha_prevista_retiro = NULL WHERE id_persona = $1`,
      [datos.persona.Ana],
    );
  });
});
