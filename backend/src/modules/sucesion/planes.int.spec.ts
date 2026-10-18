import { ConflictException, ForbiddenException } from '@nestjs/common';
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

describe('Planes de sucesión (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let servicio: PlanesService;
  let responsable: number;
  let preparacion: number;
  let unidadA: number;
  let unidadB: number;
  let jefa: SesionUsuario;
  let jefaDeB: SesionUsuario;
  let decana: SesionUsuario;
  let puestoSeq = 0;
  let personaSeq = 0;
  let correr: <T>(
    sesion: SesionUsuario,
    trabajo: () => Promise<T>,
  ) => Promise<T>;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const id = async (consulta: string, parametros?: unknown[]) =>
    (await sql<{ id: number }[]>(consulta, parametros))[0].id;
  const nuevaUnidad = (nombre: string) =>
    id(
      `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
       SELECT $1::text, t.id_tipo_unidad, (SELECT id_unidad FROM unidad_organizativa WHERE id_unidad_superior IS NULL)
       FROM tipo_unidad t WHERE t.codigo = 'catedra' RETURNING id_unidad AS id`,
      [nombre],
    );
  const nuevoPuesto = (unidad: number) =>
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
  const nuevoUsuario = (nombre: string, rol: string) =>
    id(
      `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol)
       SELECT $1, 'x', id_rol FROM rol WHERE codigo = $2 RETURNING id_usuario AS id`,
      [nombre, rol],
    );
  const agregarCandidato = async (plan: number) => {
    const persona = await nuevaPersona();
    await sql(
      `INSERT INTO candidato_sucesion (id_plan, id_persona, id_estado_preparacion, prioridad)
       VALUES ($1, $2, $3, 1)`,
      [plan, persona, preparacion],
    );
  };
  const estadoDe = async (plan: number) =>
    (
      await sql<{ codigo: string }[]>(
        `SELECT e.codigo FROM plan_sucesion p JOIN estado_plan e USING (id_estado_plan) WHERE p.id_plan = $1`,
        [plan],
      )
    )[0].codigo;
  const auditoria = (plan: number) =>
    sql<{ operacion: string; id_usuario: number }[]>(
      `SELECT operacion, id_usuario FROM auditoria WHERE entidad = 'plan_sucesion' AND id_registro = $1 ORDER BY id_auditoria`,
      [String(plan)],
    );
  const aprobado = async (puesto: number) => {
    const p = await correr(jefa, () =>
      servicio.crear({ idPuesto: puesto, idResponsable: responsable }, jefa),
    );
    await agregarCandidato(p.id);
    await correr(jefa, () => servicio.presentar(p.id, jefa));
    await correr(decana, () =>
      servicio.resolver(p.id, { decision: 'aprobar' }, decana),
    );
    return p.id;
  };

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    unidadA = await nuevaUnidad('Cátedra A');
    unidadB = await nuevaUnidad('Cátedra B');
    responsable = await nuevaPersona();
    preparacion = await id(
      `SELECT min(id_estado_preparacion) AS id FROM estado_preparacion`,
    );
    const sesionDe = async (
      nombre: string,
      rol: SesionUsuario['rol'],
      unidades: number[],
    ): Promise<SesionUsuario> => ({
      id: await nuevoUsuario(nombre, rol),
      nombreUsuario: nombre,
      rol,
      idPersona: null,
      unidades,
    });
    jefa = await sesionDe('jefa', 'jefatura_departamento', [unidadA]);
    jefaDeB = await sesionDe('jefab', 'jefatura_departamento', [unidadB]);
    decana = await sesionDe('decana', 'autoridad', []);
    const alcance = new AlcanceService(ds);
    servicio = new PlanesService(
      ds.getRepository(PlanSucesion),
      alcance,
      new CandidatosService(ds.getRepository(CandidatoSucesion), alcance),
      new AccionesService(ds.getRepository(AccionTransferencia), alcance),
    );
    // El subscriber de auditoría exige usuario en el contexto de cada escritura.
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

  it('circuito completo: crear, candidato, presentar y aprobar, con una fila de auditoría por paso', async () => {
    const puesto = await nuevoPuesto(unidadA);
    const creado = await correr(jefa, () =>
      servicio.crear(
        { idPuesto: puesto, idResponsable: responsable, observaciones: 'o' },
        jefa,
      ),
    );
    expect(creado).toMatchObject({
      estado: 'borrador',
      idUnidad: unidadA,
      cantidadCandidatos: 0,
    });
    await expect(
      correr(jefa, () => servicio.presentar(creado.id, jefa)),
    ).rejects.toThrow(ConflictException);
    await agregarCandidato(creado.id);
    const presentado = await correr(jefa, () =>
      servicio.presentar(creado.id, jefa),
    );
    expect(presentado).toMatchObject({
      estado: 'pendiente_aprobacion',
      cantidadCandidatos: 1,
    });
    const resuelto = await correr(decana, () =>
      servicio.resolver(creado.id, { decision: 'aprobar' }, decana),
    );
    expect(resuelto).toMatchObject({
      estado: 'aprobado',
      nombreUsuarioResolucion: 'decana',
    });
    expect(resuelto.fechaResolucion).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(await auditoria(creado.id)).toEqual([
      { operacion: 'alta', id_usuario: jefa.id },
      { operacion: 'modificacion', id_usuario: jefa.id },
      { operacion: 'modificacion', id_usuario: decana.id },
    ]);
  });

  it('una versión nueva aprobada cierra la anterior', async () => {
    const puesto = await nuevoPuesto(unidadA);
    const v1 = await aprobado(puesto);
    const v2 = await correr(jefa, () => servicio.nuevaVersion(v1, jefa));
    expect(v2).toMatchObject({
      estado: 'borrador',
      idPlanAnterior: v1,
      cantidadCandidatos: 1,
    });
    await correr(jefa, () => servicio.presentar(v2.id, jefa));
    await correr(decana, () =>
      servicio.resolver(v2.id, { decision: 'aprobar' }, decana),
    );
    expect(await estadoDe(v1)).toBe('cerrado');
    expect(await estadoDe(v2.id)).toBe('aprobado');
  });

  it('una versión nueva rechazada deja la anterior aprobada', async () => {
    const puesto = await nuevoPuesto(unidadA);
    const v1 = await aprobado(puesto);
    const v2 = await correr(jefa, () => servicio.nuevaVersion(v1, jefa));
    await correr(jefa, () => servicio.presentar(v2.id, jefa));
    const rechazado = await correr(decana, () =>
      servicio.resolver(v2.id, { decision: 'rechazar', motivo: 'no' }, decana),
    );
    expect(rechazado).toMatchObject({
      estado: 'rechazado',
      motivoResolucion: 'no',
    });
    expect(await estadoDe(v1)).toBe('aprobado');
    expect(await estadoDe(v2.id)).toBe('rechazado');
    const reabierto = await correr(jefa, () => servicio.reabrir(v2.id, jefa));
    expect(reabierto).toMatchObject({
      estado: 'borrador',
      fechaResolucion: null,
      nombreUsuarioResolucion: null,
      motivoResolucion: 'no',
    });
  });

  it('reabrir se niega si el puesto ya tiene un aprobado más reciente (escenarios A y B)', async () => {
    const presentarYRechazar = async (plan: number) => {
      await correr(jefa, () => servicio.presentar(plan, jefa));
      await correr(decana, () =>
        servicio.resolver(plan, { decision: 'rechazar', motivo: 'no' }, decana),
      );
    };
    const aprobar = async (plan: number) => {
      await correr(jefa, () => servicio.presentar(plan, jefa));
      await correr(decana, () =>
        servicio.resolver(plan, { decision: 'aprobar' }, decana),
      );
    };
    // A: V1 aprobado, V2 rechazado, V3 (desde V1) aprobado: V2 ya no se puede reabrir.
    const puestoA = await nuevoPuesto(unidadA);
    const v1 = await aprobado(puestoA);
    const v2 = await correr(jefa, () => servicio.nuevaVersion(v1, jefa));
    await presentarYRechazar(v2.id);
    const v3 = await correr(jefa, () => servicio.nuevaVersion(v1, jefa));
    await aprobar(v3.id);
    expect(await estadoDe(v1)).toBe('cerrado');
    await expect(
      correr(jefa, () => servicio.reabrir(v2.id, jefa)),
    ).rejects.toThrow(/aprobado más reciente/);
    expect(await estadoDe(v2.id)).toBe('rechazado');

    // B: R rechazado sin aprobado previo; se crea y aprueba B; R no se puede reabrir.
    const puestoB = await nuevoPuesto(unidadA);
    const r = await correr(jefa, () =>
      servicio.crear({ idPuesto: puestoB, idResponsable: responsable }, jefa),
    );
    await agregarCandidato(r.id);
    await presentarYRechazar(r.id);
    const b = await aprobado(puestoB);
    await expect(
      correr(jefa, () => servicio.reabrir(r.id, jefa)),
    ).rejects.toThrow(ConflictException);
    expect(await estadoDe(r.id)).toBe('rechazado');
    expect(await estadoDe(b)).toBe('aprobado');
  });

  it('dos crear simultáneos para el mismo puesto: uno cumple y el otro es conflicto', async () => {
    const puesto = await nuevoPuesto(unidadA);
    const resultados = await Promise.allSettled([
      correr(jefa, () =>
        servicio.crear({ idPuesto: puesto, idResponsable: responsable }, jefa),
      ),
      correr(jefa, () =>
        servicio.crear({ idPuesto: puesto, idResponsable: responsable }, jefa),
      ),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rechazados = resultados.filter((r) => r.status === 'rejected');
    expect(rechazados).toHaveLength(1);
    expect(rechazados[0].reason).toBeInstanceOf(ConflictException);
  });

  it('dos resolver simultáneos sobre el mismo plan: uno cumple y el otro es conflicto', async () => {
    const puesto = await nuevoPuesto(unidadA);
    const p = await correr(jefa, () =>
      servicio.crear({ idPuesto: puesto, idResponsable: responsable }, jefa),
    );
    await agregarCandidato(p.id);
    await correr(jefa, () => servicio.presentar(p.id, jefa));
    const resultados = await Promise.allSettled([
      correr(decana, () =>
        servicio.resolver(p.id, { decision: 'aprobar' }, decana),
      ),
      correr(decana, () =>
        servicio.resolver(p.id, { decision: 'aprobar' }, decana),
      ),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rechazados = resultados.filter((r) => r.status === 'rejected');
    expect(rechazados).toHaveLength(1);
    expect(rechazados[0].reason).toBeInstanceOf(ConflictException);
  });

  it('la jefatura de otra unidad recibe 403 al crear, leer y operar; el listado respeta el alcance', async () => {
    const puesto = await nuevoPuesto(unidadA);
    await expect(
      correr(jefaDeB, () =>
        servicio.crear(
          { idPuesto: puesto, idResponsable: responsable },
          jefaDeB,
        ),
      ),
    ).rejects.toThrow(ForbiddenException);
    const p = await correr(jefa, () =>
      servicio.crear({ idPuesto: puesto, idResponsable: responsable }, jefa),
    );
    await expect(servicio.buscar(p.id, jefaDeB)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      correr(jefaDeB, () => servicio.cerrar(p.id, jefaDeB)),
    ).rejects.toThrow(ForbiddenException);
    const deB = await servicio.listar({}, jefaDeB);
    expect(deB.every((x) => x.idUnidad === unidadB)).toBe(true);
    const deA = await servicio.listar({ idPuesto: puesto }, jefa);
    expect(deA.map((x) => x.id)).toEqual([p.id]);
    expect(await servicio.listar({ idUnidad: unidadA }, jefaDeB)).toEqual([]);
    const todos = await servicio.listar({ estado: 'borrador' }, decana);
    expect(todos.map((x) => x.id)).toContain(p.id);
  });

  it('el filtro idUnidad incluye las subunidades y nunca sale del alcance', async () => {
    // Las cátedras A y B cuelgan del mismo departamento raíz.
    const raiz = await id(
      `SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
    );
    const planA = await correr(jefa, async () =>
      servicio.crear(
        { idPuesto: await nuevoPuesto(unidadA), idResponsable: responsable },
        jefa,
      ),
    );
    const planB = await correr(jefaDeB, async () =>
      servicio.crear(
        { idPuesto: await nuevoPuesto(unidadB), idResponsable: responsable },
        jefaDeB,
      ),
    );

    // Filtrar por el padre trae los planes de las unidades hijas dentro del alcance.
    const idsDe = async (idUnidad: number, sesion: SesionUsuario) =>
      (await servicio.listar({ idUnidad }, sesion)).map((x) => x.id);
    const deAdmin = await idsDe(raiz, decana);
    expect(deAdmin).toContain(planA.id);
    expect(deAdmin).toContain(planB.id);
    const deJefa = await idsDe(raiz, jefa);
    expect(deJefa).toContain(planA.id);
    expect(deJefa).not.toContain(planB.id);
    expect(await idsDe(unidadA, decana)).toEqual(
      expect.not.arrayContaining([planB.id]),
    );
    // Un plan fuera del alcance nunca aparece, filtre como filtre.
    expect(await idsDe(unidadB, jefa)).toEqual([]);
  });
});
