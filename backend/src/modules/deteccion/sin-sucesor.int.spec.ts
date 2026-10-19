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

describe('RF18: Puestos críticos sin sucesor preparado (integración)', () => {
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

  it('devuelve los 5 puestos críticos sin sucesor con sus motivos y conteos exactos, y excluye C4.jefe', async () => {
    const res = await servicio.puestosSinSucesor({}, sesionGlobal);

    expect(res.map((p) => p.denominacion)).toEqual([
      'C1.JTP',
      'C1.jefe',
      'C2.jefe',
      'C3.jefe',
      'C4.aux',
    ]);

    const porPuesto = Object.fromEntries(res.map((p) => [p.denominacion, p]));

    expect(porPuesto['C1.jefe']).toMatchObject({
      motivo: 'sin_plan',
      idPlan: null,
      candidatosTotal: 0,
      candidatosValidos: 0,
    });
    expect(porPuesto['C1.JTP']).toMatchObject({
      motivo: 'sin_plan',
      idPlan: null,
      candidatosTotal: 0,
      candidatosValidos: 0,
    });
    expect(porPuesto['C2.jefe']).toMatchObject({
      motivo: 'ningun_candidato_cubre',
      idPlan: datos.plan['C2.jefe'],
      candidatosTotal: 2,
      candidatosValidos: 2,
    });
    expect(porPuesto['C3.jefe']).toMatchObject({
      motivo: 'ningun_candidato_cubre',
      idPlan: datos.plan['C3.jefe'],
      candidatosTotal: 1,
      candidatosValidos: 0,
    });
    expect(porPuesto['C4.aux']).toMatchObject({
      motivo: 'plan_en_elaboracion',
      idPlan: datos.plan['C4.aux'],
      candidatosTotal: 0,
      candidatosValidos: 0,
    });
  });

  it('un excluyente no crítico sin acreditar bloquea al candidato (C4.jefe pasa a ningun_candidato_cubre sin K8)', async () => {
    await ds.query(
      `DELETE FROM conocimiento_persona WHERE id_persona = $1 AND id_conocimiento = $2`,
      [datos.persona.Eva, datos.conocimiento.K8],
    );

    const res = await servicio.puestosSinSucesor({}, sesionGlobal);
    const c4Jefe = res.find((p) => p.denominacion === 'C4.jefe');
    expect(c4Jefe).toBeDefined();
    expect(c4Jefe).toMatchObject({
      motivo: 'ningun_candidato_cubre',
      idPlan: datos.plan['C4.jefe'],
      candidatosTotal: 1,
      candidatosValidos: 1,
    });

    // Restauramos K8 de Eva (N1 = basico)
    await ds.query(
      `INSERT INTO conocimiento_persona (id_persona, id_conocimiento, id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador)
       VALUES (
         $1, $2,
         (SELECT id_nivel_dominio FROM nivel_dominio WHERE codigo = 'basico'),
         CURRENT_DATE,
         (SELECT id_tipo_evidencia FROM tipo_evidencia WHERE codigo = 'certificado'),
         $3
       )`,
      [datos.persona.Eva, datos.conocimiento.K8, datos.persona.Ana],
    );
  });

  it('un candidato que ocupa el puesto cuenta en candidatosTotal pero no en candidatosValidos', async () => {
    // Asignamos a Eva una ocupación vigente en C4.jefe
    await ds.query(
      `INSERT INTO ocupacion (id_persona, id_puesto, fecha_desde, id_caracter_ocupacion, id_dedicacion)
       VALUES (
         $1, $2, CURRENT_DATE - INTERVAL '1 month',
         (SELECT id_caracter_ocupacion FROM caracter_ocupacion WHERE codigo = 'interino'),
         (SELECT id_dedicacion FROM dedicacion WHERE codigo = 'simple')
       )`,
      [datos.persona.Eva, datos.puesto['C4.jefe']],
    );

    const res = await servicio.puestosSinSucesor({}, sesionGlobal);
    const c4Jefe = res.find((p) => p.denominacion === 'C4.jefe');
    expect(c4Jefe).toBeDefined();
    expect(c4Jefe).toMatchObject({
      motivo: 'ningun_candidato_cubre',
      candidatosTotal: 1,
      candidatosValidos: 0,
    });

    await ds.query(
      `DELETE FROM ocupacion WHERE id_persona = $1 AND id_puesto = $2`,
      [datos.persona.Eva, datos.puesto['C4.jefe']],
    );
  });

  it('bordes de fecha: ocupación terminada ayer invalida al candidato, pero retiro hoy lo mantiene válido', async () => {
    // 1. Cerramos ayer la ocupación de Eva en C4.aux -> Eva deja de tener ocupación vigente
    await ds.query(
      `UPDATE ocupacion SET fecha_hasta = CURRENT_DATE - INTERVAL '1 day' WHERE id_persona = $1 AND id_puesto = $2`,
      [datos.persona.Eva, datos.puesto['C4.aux']],
    );

    let res = await servicio.puestosSinSucesor({}, sesionGlobal);
    let c4Jefe = res.find((p) => p.denominacion === 'C4.jefe');
    expect(c4Jefe).toBeDefined();
    expect(c4Jefe!.candidatosValidos).toBe(0);

    // Restauramos ocupación vigente y ponemos retiro hoy a Eva
    await ds.query(
      `UPDATE ocupacion SET fecha_hasta = NULL WHERE id_persona = $1 AND id_puesto = $2`,
      [datos.persona.Eva, datos.puesto['C4.aux']],
    );
    await ds.query(
      `UPDATE persona SET fecha_prevista_retiro = CURRENT_DATE WHERE id_persona = $1`,
      [datos.persona.Eva],
    );

    res = await servicio.puestosSinSucesor({}, sesionGlobal);
    c4Jefe = res.find((p) => p.denominacion === 'C4.jefe');
    expect(c4Jefe).toBeUndefined(); // Sigue siendo sucesora preparada válida

    await ds.query(
      `UPDATE persona SET fecha_prevista_retiro = NULL WHERE id_persona = $1`,
      [datos.persona.Eva],
    );
  });

  it('un puesto dado de baja no figura y el filtro motivo filtra los resultados', async () => {
    const soloElaboracion = await servicio.puestosSinSucesor(
      { motivo: 'plan_en_elaboracion' },
      sesionGlobal,
    );
    expect(soloElaboracion.map((p) => p.denominacion)).toEqual(['C4.aux']);

    await ds.query(`UPDATE puesto SET activo = false WHERE id_puesto = $1`, [
      datos.puesto['C4.aux'],
    ]);
    const trasBaja = await servicio.puestosSinSucesor(
      { motivo: 'plan_en_elaboracion' },
      sesionGlobal,
    );
    expect(trasBaja).toEqual([]);

    await ds.query(`UPDATE puesto SET activo = true WHERE id_puesto = $1`, [
      datos.puesto['C4.aux'],
    ]);
  });
});
