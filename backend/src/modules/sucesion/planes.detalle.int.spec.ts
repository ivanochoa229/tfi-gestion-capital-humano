import type { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { AccionesService } from './acciones.service.js';
import { CandidatosService } from './candidatos.service.js';
import { AccionTransferencia } from './entities/accion-transferencia.entity.js';
import { CandidatoSucesion } from './entities/candidato-sucesion.entity.js';
import { PlanSucesion } from './entities/plan-sucesion.entity.js';
import { PlanesService } from './planes.service.js';

describe('Detalle del plan de sucesión (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let servicio: PlanesService;
  let unidad: number;
  let jefa: SesionUsuario;
  let ajena: SesionUsuario;
  let correr: <T>(
    sesion: SesionUsuario,
    trabajo: () => Promise<T>,
  ) => Promise<T>;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const id = async (consulta: string, parametros?: unknown[]) =>
    (await sql<{ id: number }[]>(consulta, parametros))[0].id;
  const persona = (n: number) =>
    id(
      `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
       SELECT $1, 'Apellido', 'Nombre', $2, '1980-01-01', '2010-01-01', min(id_situacion_revista)
       FROM situacion_revista RETURNING id_persona AS id`,
      [`L${n}`, String(20000000 + n)],
    );

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    const unidadDe = (nombre: string) =>
      id(
        `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
         SELECT $1::text, t.id_tipo_unidad, (SELECT id_unidad FROM unidad_organizativa WHERE id_unidad_superior IS NULL)
         FROM tipo_unidad t WHERE t.codigo = 'catedra' RETURNING id_unidad AS id`,
        [nombre],
      );
    unidad = await unidadDe('Cátedra A');
    const otra = await unidadDe('Cátedra B');
    const usuario = (nombre: string, unidades: number[]) =>
      id(
        `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol)
         SELECT $1, 'x', id_rol FROM rol WHERE codigo = 'jefatura_departamento' RETURNING id_usuario AS id`,
        [nombre],
      ).then((idUsuario): SesionUsuario => ({
        id: idUsuario,
        nombreUsuario: nombre,
        rol: 'jefatura_departamento',
        idPersona: null,
        unidades,
      }));
    jefa = await usuario('jefa', [unidad]);
    ajena = await usuario('ajena', [otra]);
    const alcance = new AlcanceService(ds);
    servicio = new PlanesService(
      ds.getRepository(PlanSucesion),
      alcance,
      new CandidatosService(ds.getRepository(CandidatoSucesion), alcance),
      new AccionesService(ds.getRepository(AccionTransferencia), alcance),
    );
    const { AuditoriaSubscriber } =
      await import('../../infra/auditoria/auditoria.subscriber.js');
    new AuditoriaSubscriber(ds);
    const { contextoUsuario } =
      await import('../../infra/auditoria/contexto-usuario.js');
    correr = (sesion, trabajo) =>
      contextoUsuario.run({ idUsuario: sesion.id }, trabajo);
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('trae el plan con sus candidatos (con discrepancia) y sus acciones', async () => {
    const responsable = await persona(1);
    const candidata = await persona(2);
    const puesto = await id(
      `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
       SELECT 'P-0001', 'P-0001', $1, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
       RETURNING id_puesto AS id`,
      [unidad],
    );
    const conocimiento = await id(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT 'Tema', 'tema', t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
    );
    await sql(
      `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente)
       SELECT $1, $2, min(id_nivel_dominio), true FROM nivel_dominio`,
      [puesto, conocimiento],
    );
    const plan = await correr(jefa, () =>
      servicio.crear({ idPuesto: puesto, idResponsable: responsable }, jefa),
    );
    // «listo_ahora» a mano, pero sin acreditar el excluyente: discrepancia.
    await sql(
      `INSERT INTO candidato_sucesion (id_plan, id_persona, id_estado_preparacion, prioridad)
       SELECT $1, $2, id_estado_preparacion, 1 FROM estado_preparacion WHERE codigo = 'listo_ahora'`,
      [plan.id, candidata],
    );
    await sql(
      `INSERT INTO accion_transferencia (id_tipo_accion, id_conocimiento, id_plan, id_responsable, descripcion, fecha_prevista, id_estado_accion)
       SELECT t.id_tipo_accion_transferencia, $1, $2, $3, 'Mentoría', CURRENT_DATE + 30, e.id_estado_accion_transferencia
       FROM tipo_accion_transferencia t, estado_accion_transferencia e
       WHERE e.codigo = 'pendiente' ORDER BY t.id_tipo_accion_transferencia LIMIT 1`,
      [conocimiento, plan.id, responsable],
    );

    const detalle = await servicio.detalle(plan.id, jefa);
    expect(detalle.id).toBe(plan.id);
    expect(detalle.cantidadCandidatos).toBe(1);
    expect(detalle.candidatos).toHaveLength(1);
    expect(detalle.candidatos[0]).toMatchObject({
      idPersona: candidata,
      estadoPreparacion: 'listo_ahora',
      excluyentesSinCubrir: 1,
      discrepancia: true,
    });
    expect(detalle.acciones).toHaveLength(1);
    expect(detalle.acciones[0]).toMatchObject({
      idPlan: plan.id,
      descripcion: 'Mentoría',
      estado: 'pendiente',
    });
  });

  it('exige el alcance del puesto del plan', async () => {
    const [{ id_plan }] = await sql<{ id_plan: number }[]>(
      `SELECT id_plan FROM plan_sucesion LIMIT 1`,
    );
    await expect(servicio.detalle(id_plan, ajena)).rejects.toThrow(/alcance/);
  });
});
