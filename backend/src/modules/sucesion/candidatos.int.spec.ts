import { ConflictException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { CandidatosService } from './candidatos.service.js';
import { AccionesService } from './acciones.service.js';
import { AccionTransferencia } from './entities/accion-transferencia.entity.js';
import { CandidatoSucesion } from './entities/candidato-sucesion.entity.js';
import { PlanSucesion } from './entities/plan-sucesion.entity.js';
import { PlanesService } from './planes.service.js';

describe('Candidatos de sucesión (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let servicio: CandidatosService;
  let planes: PlanesService;
  let unidad: number;
  let responsable: number;
  let preparacion: number;
  let jefa: SesionUsuario;
  let puestoSeq = 0;
  let personaSeq = 0;
  let conocimientoSeq = 0;
  let correr: <T>(
    sesion: SesionUsuario,
    trabajo: () => Promise<T>,
  ) => Promise<T>;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const id = async (consulta: string, parametros?: unknown[]) =>
    (await sql<{ id: number }[]>(consulta, parametros))[0].id;
  const nuevoPuesto = () =>
    id(
      `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
       SELECT $1, $1, $2, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
       RETURNING id_puesto AS id`,
      [`P-${String(++puestoSeq).padStart(4, '0')}`, unidad],
    );
  const nuevaPersona = () => {
    const n = ++personaSeq;
    return id(
      `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
       SELECT $1, 'Apellido', 'Nombre', $2, '1980-01-01', '2010-01-01', min(id_situacion_revista)
       FROM situacion_revista RETURNING id_persona AS id`,
      [`L${n}`, String(20000000 + n)],
    );
  };
  /** Ocupación con desde/hasta relativos a hoy, en días (null = sin fin). */
  const ocupar = (
    persona: number,
    puesto: number,
    desde: number,
    hasta: number | null,
  ) =>
    sql(
      `INSERT INTO ocupacion (id_persona, id_puesto, fecha_desde, fecha_hasta, id_caracter_ocupacion, id_dedicacion)
       SELECT $1, $2, CURRENT_DATE + $3::int, CASE WHEN $4::int IS NULL THEN NULL ELSE CURRENT_DATE + $4::int END,
              (SELECT min(id_caracter_ocupacion) FROM caracter_ocupacion), (SELECT min(id_dedicacion) FROM dedicacion)`,
      [persona, puesto, desde, hasta],
    );
  const nuevoConocimiento = () => {
    const n = `Tema ${++conocimientoSeq}`;
    return id(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT $1::text, lower($1::text), t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
      [n],
    );
  };
  const requisito = (
    puesto: number,
    conocimiento: number,
    nivel: string,
    excluyente: boolean,
  ) =>
    sql(
      `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente)
       SELECT $1, $2, id_nivel_dominio, $4 FROM nivel_dominio WHERE codigo = $3`,
      [puesto, conocimiento, nivel, excluyente],
    );
  const acreditar = (persona: number, conocimiento: number, nivel: string) =>
    sql(
      `INSERT INTO conocimiento_persona (id_persona, id_conocimiento, id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador)
       SELECT $1, $2, n.id_nivel_dominio, CURRENT_DATE,
              (SELECT min(id_tipo_evidencia) FROM tipo_evidencia), $4
       FROM nivel_dominio n WHERE n.codigo = $3`,
      [persona, conocimiento, nivel, responsable],
    );
  const auditoria = (plan: number, persona: number) =>
    sql<{ operacion: string; id_usuario: number }[]>(
      `SELECT operacion, id_usuario FROM auditoria
       WHERE entidad = 'candidato_sucesion' AND id_registro = $1 ORDER BY id_auditoria`,
      [`${plan}-${persona}`],
    );

  /** Puesto con un plan en borrador; la persona candidata ocupa otro puesto. */
  const nuevoPlan = async () => {
    const puesto = await nuevoPuesto();
    const plan = await correr(jefa, () =>
      planes.crear({ idPuesto: puesto, idResponsable: responsable }, jefa),
    );
    return { puesto, plan: plan.id };
  };
  const candidata = async (plan: number, prioridad: number) => {
    const persona = await nuevaPersona();
    await ocupar(persona, await nuevoPuesto(), -30, null);
    await correr(jefa, () =>
      servicio.agregar(
        plan,
        { idPersona: persona, prioridad, idEstadoPreparacion: preparacion },
        jefa,
      ),
    );
    return persona;
  };

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    unidad = await id(
      `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
       SELECT 'Cátedra A', t.id_tipo_unidad, (SELECT id_unidad FROM unidad_organizativa WHERE id_unidad_superior IS NULL)
       FROM tipo_unidad t WHERE t.codigo = 'catedra' RETURNING id_unidad AS id`,
    );
    responsable = await nuevaPersona();
    preparacion = await id(
      `SELECT id_estado_preparacion AS id FROM estado_preparacion WHERE codigo = 'listo_ahora'`,
    );
    const idUsuario = await id(
      `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol)
       SELECT 'jefa', 'x', id_rol FROM rol WHERE codigo = 'jefatura_departamento' RETURNING id_usuario AS id`,
    );
    jefa = {
      id: idUsuario,
      nombreUsuario: 'jefa',
      rol: 'jefatura_departamento',
      idPersona: null,
      unidades: [unidad],
    };
    const alcance = new AlcanceService(ds);
    servicio = new CandidatosService(
      ds.getRepository(CandidatoSucesion),
      alcance,
    );
    planes = new PlanesService(
      ds.getRepository(PlanSucesion),
      alcance,
      servicio,
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

  it('intercambiar 1 y 2 con reordenar cruza las prioridades y audita cada cambio', async () => {
    const { plan } = await nuevoPlan();
    const a = await candidata(plan, 1);
    const b = await candidata(plan, 2);
    const c = await candidata(plan, 3);
    const resultado = await correr(jefa, () =>
      servicio.reordenar(plan, { orden: [b, a, c] }, jefa),
    );
    expect(resultado.map((x) => [x.idPersona, x.prioridad])).toEqual([
      [b, 1],
      [a, 2],
      [c, 3],
    ]);
    expect((await auditoria(plan, a)).map((x) => x.operacion)).toEqual([
      'alta',
      'modificacion',
    ]);
    expect((await auditoria(plan, b)).map((x) => x.operacion)).toEqual([
      'alta',
      'modificacion',
    ]);
    expect((await auditoria(plan, c)).map((x) => x.operacion)).toEqual([
      'alta',
    ]);
    expect((await auditoria(plan, a))[1].id_usuario).toBe(jefa.id);
  });

  it('una prioridad repetida al agregar es conflicto', async () => {
    const { plan } = await nuevoPlan();
    await candidata(plan, 1);
    await expect(candidata(plan, 1)).rejects.toThrow(ConflictException);
  });

  it('excluyentesSinCubrir: sin acreditar, igual nivel, nivel menor y deseable', async () => {
    const { puesto, plan } = await nuevoPlan();
    const sql1 = await nuevoConocimiento();
    const redes = await nuevoConocimiento();
    const extra = await nuevoConocimiento();
    await requisito(puesto, sql1, 'avanzado', true);
    await requisito(puesto, redes, 'intermedio', true);
    await requisito(puesto, extra, 'experto', false);

    const nada = await candidata(plan, 1);
    const justo = await candidata(plan, 2);
    const menor = await candidata(plan, 3);
    await acreditar(justo, sql1, 'avanzado');
    await acreditar(justo, redes, 'experto');
    await acreditar(menor, sql1, 'intermedio');
    await acreditar(menor, redes, 'intermedio');

    const lista = await servicio.listarDePlan(plan);
    const de = (p: number) => lista.find((x) => x.idPersona === p)!;
    expect(de(nada)).toMatchObject({
      excluyentesSinCubrir: 2,
      totalExcluyentes: 2,
      discrepancia: true,
    });
    expect(de(justo)).toMatchObject({
      excluyentesSinCubrir: 0,
      totalExcluyentes: 2,
      discrepancia: false,
    });
    expect(de(menor)).toMatchObject({
      excluyentesSinCubrir: 1,
      totalExcluyentes: 2,
    });
    expect(lista.map((x) => x.prioridad)).toEqual([1, 2, 3]);
  });

  it('aRevisar: la persona pasa a ocupar el puesto o su ocupación termina', async () => {
    const { puesto, plan } = await nuevoPlan();
    const estable = await candidata(plan, 1);
    const ocupante = await candidata(plan, 2);
    const sinOcupacion = await candidata(plan, 3);
    const aRevisar = async () =>
      Object.fromEntries(
        (await servicio.listarDePlan(plan)).map((x) => [
          x.idPersona,
          x.aRevisar,
        ]),
      );
    expect(await aRevisar()).toEqual({
      [estable]: false,
      [ocupante]: false,
      [sinOcupacion]: false,
    });

    await ocupar(ocupante, puesto, -1, null);
    await sql(
      `UPDATE ocupacion SET fecha_desde = CURRENT_DATE - 60, fecha_hasta = CURRENT_DATE - 1 WHERE id_persona = $1 AND fecha_hasta IS NULL AND id_puesto <> $2`,
      [sinOcupacion, puesto],
    );
    expect(await aRevisar()).toEqual({
      [estable]: false,
      [ocupante]: true,
      [sinOcupacion]: true,
    });
  });

  it('quitar y agregar dejan alta y baja en la auditoría', async () => {
    const { plan } = await nuevoPlan();
    const persona = await candidata(plan, 1);
    await correr(jefa, () => servicio.quitar(plan, persona, jefa));
    expect((await auditoria(plan, persona)).map((x) => x.operacion)).toEqual([
      'alta',
      'baja',
    ]);
    expect(await servicio.listarDePlan(plan)).toEqual([]);
  });

  it('el seguimiento cambia estado, fecha y observaciones', async () => {
    const { plan } = await nuevoPlan();
    const persona = await candidata(plan, 1);
    const dto = await correr(jefa, () =>
      servicio.seguimiento(
        plan,
        persona,
        { fechaDisponibilidadEstimada: '2030-01-31', observaciones: 'ok' },
        jefa,
      ),
    );
    expect(dto).toMatchObject({
      fechaDisponibilidadEstimada: '2030-01-31',
      observaciones: 'ok',
      estadoPreparacion: 'listo_ahora',
    });
  });
});
