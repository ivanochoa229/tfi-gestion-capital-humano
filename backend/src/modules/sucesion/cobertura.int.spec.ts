import type { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { AccionesService } from './acciones.service.js';
import { CandidatosService } from './candidatos.service.js';
import { CoberturaService } from './cobertura.service.js';
import { AccionTransferencia } from './entities/accion-transferencia.entity.js';
import { CandidatoSucesion } from './entities/candidato-sucesion.entity.js';
import { PlanSucesion } from './entities/plan-sucesion.entity.js';
import { PlanesService } from './planes.service.js';

describe('Cobertura de OE7 y «mis planes» (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let planes: PlanesService;
  let cobertura: CoberturaService;
  let unidad: number;
  let unidadHija: number;
  let unidadAjena: number;
  let responsable: number;
  let preparacion: number;
  let usuarioEvaluador: number;
  let jefa: SesionUsuario;
  let decana: SesionUsuario;
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
  /** Sin superior es un departamento; con superior, una cátedra de él. */
  const nuevaUnidad = (nombre: string, superior: number | null) =>
    id(
      `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
       SELECT $1::text, t.id_tipo_unidad, $2::int
       FROM tipo_unidad t WHERE t.codigo = CASE WHEN $2::int IS NULL THEN 'departamento' ELSE 'catedra' END
       RETURNING id_unidad AS id`,
      [nombre, superior],
    );
  const nuevoPuesto = (en: number) =>
    id(
      `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
       SELECT $1, $1, $2, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
       RETURNING id_puesto AS id`,
      [`P-${String(++puestoSeq).padStart(4, '0')}`, en],
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
    excluyente: boolean,
  ) =>
    sql(
      `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente)
       SELECT $1, $2, min(id_nivel_dominio), $3 FROM nivel_dominio`,
      [puesto, conocimiento, excluyente],
    );
  const evaluar = (puesto: number, conocimiento: number, nivel: string) =>
    sql(
      `INSERT INTO evaluacion_criticidad (id_puesto, id_conocimiento, id_nivel_impacto, id_nivel_dificultad, id_nivel_criticidad, fecha_evaluacion, id_usuario)
       SELECT $1, $2, (SELECT min(id_nivel_impacto) FROM nivel_impacto), (SELECT min(id_nivel_dificultad) FROM nivel_dificultad),
              n.id_nivel_criticidad, CURRENT_DATE, $4
       FROM nivel_criticidad n WHERE n.codigo = $3`,
      [puesto, conocimiento, nivel, usuarioEvaluador],
    );
  /** Puesto crítico: un requisito excluyente con criticidad vigente alta. */
  const puestoCritico = async (en: number) => {
    const puesto = await nuevoPuesto(en);
    const k = await nuevoConocimiento();
    await requisito(puesto, k, true);
    await evaluar(puesto, k, 'alta');
    return puesto;
  };
  const agregarCandidato = async (plan: number, persona?: number) => {
    const p = persona ?? (await nuevaPersona());
    await sql(
      `INSERT INTO candidato_sucesion (id_plan, id_persona, id_estado_preparacion, prioridad)
       VALUES ($1, $2, $3, COALESCE((SELECT max(prioridad) FROM candidato_sucesion WHERE id_plan = $1), 0) + 1)`,
      [plan, p, preparacion],
    );
    return p;
  };
  const crearPlan = (puesto: number) =>
    correr(jefa, () =>
      planes.crear({ idPuesto: puesto, idResponsable: responsable }, jefa),
    );
  const presentar = async (plan: number) => {
    await agregarCandidato(plan);
    await correr(jefa, () => planes.presentar(plan, jefa));
  };
  const aprobar = async (plan: number) => {
    await correr(decana, () =>
      planes.resolver(plan, { decision: 'aprobar' }, decana),
    );
  };
  const aprobado = async (puesto: number) => {
    const p = await crearPlan(puesto);
    await presentar(p.id);
    await aprobar(p.id);
    return p.id;
  };
  const cob = (filtro: { idUnidad?: number } = {}) =>
    cobertura.cobertura(filtro, decana);

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    unidad = await nuevaUnidad('Departamento A', null);
    unidadHija = await nuevaUnidad('Cátedra A.1', unidad);
    unidadAjena = await nuevaUnidad('Departamento B', null);
    responsable = await nuevaPersona();
    preparacion = await id(
      `SELECT id_estado_preparacion AS id FROM estado_preparacion WHERE codigo = 'listo_ahora'`,
    );
    const usuario = (nombre: string, rol: string) =>
      id(
        `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol)
         SELECT $1, 'x', id_rol FROM rol WHERE codigo = $2 RETURNING id_usuario AS id`,
        [nombre, rol],
      );
    usuarioEvaluador = await usuario('analista', 'analista_puestos');
    jefa = {
      id: await usuario('jefa', 'jefatura_departamento'),
      nombreUsuario: 'jefa',
      rol: 'jefatura_departamento',
      idPersona: null,
      unidades: [unidad],
    };
    decana = {
      id: await usuario('decana', 'autoridad'),
      nombreUsuario: 'decana',
      rol: 'autoridad',
      idPersona: null,
      unidades: [],
    };
    const alcance = new AlcanceService(ds);
    planes = new PlanesService(
      ds.getRepository(PlanSucesion),
      alcance,
      new CandidatosService(ds.getRepository(CandidatoSucesion), alcance),
      new AccionesService(ds.getRepository(AccionTransferencia), alcance),
    );
    cobertura = new CoberturaService(ds, alcance);
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

  it('crítico es solo el puesto con un requisito excluyente de criticidad vigente alta', async () => {
    const aislada = await nuevaUnidad('Aislada 1', unidad);
    const critico = await puestoCritico(aislada);
    // Deseable alta: no hace crítico.
    const deseable = await nuevoPuesto(aislada);
    const k1 = await nuevoConocimiento();
    await requisito(deseable, k1, false);
    await evaluar(deseable, k1, 'alta');
    // Excluyente media: tampoco.
    const media = await nuevoPuesto(aislada);
    const k2 = await nuevoConocimiento();
    await requisito(media, k2, true);
    await evaluar(media, k2, 'media');
    // Sin evaluaciones: no figura (ni crítico ni no crítico).
    const sinEvaluar = await nuevoPuesto(aislada);
    await requisito(sinEvaluar, await nuevoConocimiento(), true);

    const r = await cob({ idUnidad: aislada });
    expect(r.criticos).toBe(1);
    expect(r.conPlan).toBe(0);
    expect(r.sinPlan.map((p) => p.idPuesto)).toEqual([critico]);
    expect(r.sinPlan[0]).toMatchObject({
      idUnidad: aislada,
      idPlanEnElaboracion: null,
      estadoPlanEnElaboracion: null,
    });
  });

  it('usa la evaluación vigente: una nueva evaluación no alta saca al puesto de los críticos', async () => {
    const aislada = await nuevaUnidad('Aislada 2', unidad);
    const puesto = await nuevoPuesto(aislada);
    const k = await nuevoConocimiento();
    await requisito(puesto, k, true);
    await evaluar(puesto, k, 'alta');
    expect((await cob({ idUnidad: aislada })).criticos).toBe(1);
    await sql(
      `UPDATE evaluacion_criticidad SET fecha_evaluacion = CURRENT_DATE - 5 WHERE id_puesto = $1`,
      [puesto],
    );
    await evaluar(puesto, k, 'baja');
    expect((await cob({ idUnidad: aislada })).criticos).toBe(0);
  });

  it('conPlan cuenta solo planes aprobados; un borrador o pendiente figura en sinPlan con su estado', async () => {
    const aislada = await nuevaUnidad('Aislada 3', unidad);
    const conAprobado = await puestoCritico(aislada);
    await aprobado(conAprobado);
    const conBorrador = await puestoCritico(aislada);
    const borrador = await crearPlan(conBorrador);
    const conPendiente = await puestoCritico(aislada);
    const pendiente = await crearPlan(conPendiente);
    await presentar(pendiente.id);
    const sinNada = await puestoCritico(aislada);

    const r = await cob({ idUnidad: aislada });
    expect(r.criticos).toBe(4);
    expect(r.conPlan).toBe(1);
    const porPuesto = new Map(r.sinPlan.map((p) => [p.idPuesto, p]));
    expect([...porPuesto.keys()].sort()).toEqual(
      [conBorrador, conPendiente, sinNada].sort(),
    );
    expect(porPuesto.get(conBorrador)).toMatchObject({
      idPlanEnElaboracion: borrador.id,
      estadoPlanEnElaboracion: 'borrador',
    });
    expect(porPuesto.get(conPendiente)).toMatchObject({
      idPlanEnElaboracion: pendiente.id,
      estadoPlanEnElaboracion: 'pendiente_aprobacion',
    });
    expect(porPuesto.get(sinNada)).toMatchObject({
      idPlanEnElaboracion: null,
      estadoPlanEnElaboracion: null,
    });
  });

  it('un puesto dado de baja no cuenta', async () => {
    const aislada = await nuevaUnidad('Aislada 4', unidad);
    const puesto = await puestoCritico(aislada);
    expect((await cob({ idUnidad: aislada })).criticos).toBe(1);
    await sql(`UPDATE puesto SET activo = false WHERE id_puesto = $1`, [
      puesto,
    ]);
    expect((await cob({ idUnidad: aislada })).criticos).toBe(0);
  });

  it('una versión nueva aprobada no cambia la cobertura; cerrar el aprobado sin reemplazo devuelve el puesto a sinPlan', async () => {
    const aislada = await nuevaUnidad('Aislada 5', unidad);
    const puesto = await puestoCritico(aislada);
    const v1 = await aprobado(puesto);
    expect((await cob({ idUnidad: aislada })).conPlan).toBe(1);

    const v2 = await correr(jefa, () => planes.nuevaVersion(v1, jefa));
    // Mientras la v2 se elabora el puesto sigue cubierto por la v1.
    let r = await cob({ idUnidad: aislada });
    expect(r.conPlan).toBe(1);
    expect(r.sinPlan).toEqual([]);
    await correr(jefa, () => planes.presentar(v2.id, jefa));
    await aprobar(v2.id);
    r = await cob({ idUnidad: aislada });
    expect([r.criticos, r.conPlan, r.sinPlan.length]).toEqual([1, 1, 0]);

    await correr(jefa, () => planes.cerrar(v2.id, jefa));
    r = await cob({ idUnidad: aislada });
    expect([r.criticos, r.conPlan]).toEqual([1, 0]);
    expect(r.sinPlan.map((p) => p.idPuesto)).toEqual([puesto]);
  });

  it('el filtro por unidad incluye descendientes y el alcance limita el resultado', async () => {
    const padre = await nuevaUnidad('Aislada 6', null);
    const hija = await nuevaUnidad('Aislada 6.1', padre);
    const enHija = await puestoCritico(hija);
    const enPadre = await puestoCritico(padre);
    const r = await cob({ idUnidad: padre });
    expect(r.sinPlan.map((p) => p.idPuesto).sort()).toEqual(
      [enHija, enPadre].sort(),
    );
    const soloHija = await cob({ idUnidad: hija });
    expect(soloHija.sinPlan.map((p) => p.idPuesto)).toEqual([enHija]);

    // La jefa solo ve la unidad A y sus descendientes.
    await puestoCritico(unidadHija);
    const ajeno = await puestoCritico(unidadAjena);
    const deJefa = await cobertura.cobertura({}, jefa);
    expect(deJefa.sinPlan.every((p) => p.idPuesto !== ajeno)).toBe(true);
    expect(deJefa.sinPlan.some((p) => p.idUnidad === unidadHija)).toBe(true);
    const fuera = await cobertura.cobertura({ idUnidad: unidadAjena }, jefa);
    expect(fuera).toEqual({ criticos: 0, conPlan: 0, sinPlan: [] });
  });

  describe('misPlanes', () => {
    it('una fila por cada plan aprobado en que figura, con su preparación, sin prioridad ni otros candidatos', async () => {
      const aislada = await nuevaUnidad('Aislada 7', unidad);
      const docente = await nuevaPersona();
      const otra = await nuevaPersona();
      const sesionDocente: SesionUsuario = {
        id: 1,
        nombreUsuario: 'doc',
        rol: 'docente',
        idPersona: docente,
        unidades: [],
      };

      const p1 = await puestoCritico(aislada);
      const plan1 = await crearPlan(p1);
      await agregarCandidato(plan1.id, otra);
      await agregarCandidato(plan1.id, docente);
      await correr(jefa, () => planes.presentar(plan1.id, jefa));
      await aprobar(plan1.id);
      await sql(
        `UPDATE candidato_sucesion SET fecha_disponibilidad_estimada = '2030-03-01' WHERE id_plan = $1 AND id_persona = $2`,
        [plan1.id, docente],
      );

      const p2 = await puestoCritico(aislada);
      const plan2 = await crearPlan(p2);
      await agregarCandidato(plan2.id, docente);
      await correr(jefa, () => planes.presentar(plan2.id, jefa));
      await aprobar(plan2.id);

      // Borrador y pendiente: no aparecen.
      const p3 = await puestoCritico(aislada);
      const plan3 = await crearPlan(p3);
      await agregarCandidato(plan3.id, docente);
      const p4 = await puestoCritico(aislada);
      const plan4 = await crearPlan(p4);
      await agregarCandidato(plan4.id, docente);
      await correr(jefa, () => planes.presentar(plan4.id, jefa));

      const filas = await cobertura.misPlanes(sesionDocente);
      expect(filas.map((f) => f.idPlan).sort()).toEqual(
        [plan1.id, plan2.id].sort(),
      );
      const f1 = filas.find((f) => f.idPlan === plan1.id)!;
      expect(f1).toEqual({
        idPlan: plan1.id,
        idPuesto: p1,
        denominacionPuesto: expect.any(String),
        estadoPlan: 'aprobado',
        estadoPreparacion: 'listo_ahora',
        fechaDisponibilidadEstimada: '2030-03-01',
      });
      expect(Object.keys(f1)).not.toContain('prioridad');
      expect(
        await cobertura.misPlanes({ ...sesionDocente, idPersona: null }),
      ).toEqual([]);
    });
  });
});
