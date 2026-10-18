import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { AccionesService } from './acciones.service.js';
import { AccionTransferencia } from './entities/accion-transferencia.entity.js';

describe('Acciones de transferencia (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let servicio: AccionesService;
  let tipo: number;
  let conocimiento: number;
  let unidadA: number;
  let unidadB: number;
  let puestoA: number;
  let puestoB: number;
  let planA: number;
  let planB: number;
  let personaSeq = 0;
  let rrhh: SesionUsuario;
  let autoridad: SesionUsuario;
  let jefaA: SesionUsuario;
  const docente = (idPersona: number): SesionUsuario => ({
    id: 99,
    nombreUsuario: 'doc',
    rol: 'docente',
    idPersona,
    unidades: [],
  });

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
  const nuevoPuesto = (codigo: string, unidad: number) =>
    id(
      `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
       SELECT $1, $1, $2, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
       RETURNING id_puesto AS id`,
      [codigo, unidad],
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
  const nuevoPlan = async (puesto: number, responsable: number) =>
    id(
      `INSERT INTO plan_sucesion (id_puesto, id_responsable, id_estado_plan)
       SELECT $1, $2, id_estado_plan FROM estado_plan WHERE codigo = 'borrador' RETURNING id_plan AS id`,
      [puesto, responsable],
    );
  const requisito = (puesto: number) =>
    sql(
      `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente)
       SELECT $1, $2, min(id_nivel_dominio), true FROM nivel_dominio`,
      [puesto, conocimiento],
    );
  const fila = async (accion: number) =>
    (
      await sql<
        {
          estado: string;
          fecha_cumplimiento: string | null;
          actualizada_en: Date;
          registrada_en: Date;
        }[]
      >(
        `SELECT e.codigo AS estado, a.fecha_cumplimiento::text, a.actualizada_en, a.registrada_en
         FROM accion_transferencia a JOIN estado_accion_transferencia e ON e.id_estado_accion_transferencia = a.id_estado_accion
         WHERE a.id_accion = $1`,
        [accion],
      )
    )[0];
  const alta = (
    responsable: number,
    extra: Partial<Parameters<AccionesService['crear']>[0]> = {},
  ) => ({
    idTipoAccion: tipo,
    idConocimiento: conocimiento,
    idResponsable: responsable,
    descripcion: 'Mentoría',
    fechaPrevista: '2999-01-01',
    ...extra,
  });

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    unidadA = await nuevaUnidad('Cátedra A');
    unidadB = await nuevaUnidad('Cátedra B');
    puestoA = await nuevoPuesto('PA-1', unidadA);
    puestoB = await nuevoPuesto('PB-1', unidadB);
    const resp = await nuevaPersona();
    planA = await nuevoPlan(puestoA, resp);
    planB = await nuevoPlan(puestoB, resp);
    conocimiento = await id(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT 'SQL', 'sql', t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
    );
    await requisito(puestoA);
    await requisito(puestoB);
    tipo = await id(
      `SELECT min(id_tipo_accion_transferencia) AS id FROM tipo_accion_transferencia`,
    );
    const sesion = async (
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
    rrhh = await sesion('rrhh', 'recursos_humanos', []);
    autoridad = await sesion('autoridad', 'autoridad', []);
    jefaA = await sesion('jefaa', 'jefatura_departamento', [unidadA]);
    servicio = new AccionesService(
      ds.getRepository(AccionTransferencia),
      new AlcanceService(ds),
    );
  });

  afterAll(async () => {
    await base.destruir();
  });

  it('ciclo de vida: pendiente, en curso y completada con fecha_cumplimiento en la base', async () => {
    const responsable = await nuevaPersona();
    const creada = await servicio.crear(
      alta(responsable, { idPlan: planA }),
      rrhh,
    );
    expect(creada.estado).toBe('pendiente');
    expect((await fila(creada.id)).fecha_cumplimiento).toBeNull();

    const sesion = docente(responsable);
    await servicio.avanzar(
      creada.id,
      { estado: 'en_curso', notaAvance: 'ya empecé' },
      sesion,
    );
    expect((await fila(creada.id)).estado).toBe('en_curso');

    const hecha = await servicio.avanzar(
      creada.id,
      { estado: 'completada' },
      sesion,
    );
    const [{ hoy }] = await sql<{ hoy: string }[]>(
      'SELECT CURRENT_DATE::text AS hoy',
    );
    const f = await fila(creada.id);
    expect(f.estado).toBe('completada');
    expect(f.fecha_cumplimiento).toBe(hoy);
    expect(hecha.fechaCumplimiento).toBe(hoy);
    expect(hecha.notaAvance).toBe('ya empecé');
    expect(f.actualizada_en.getTime()).toBeGreaterThanOrEqual(
      f.registrada_en.getTime(),
    );
    await expect(
      servicio.avanzar(creada.id, { estado: 'en_curso' }, rrhh),
    ).rejects.toThrow(ConflictException);
    await expect(
      servicio.editar(creada.id, { descripcion: 'x' }, rrhh),
    ).rejects.toThrow(ConflictException);
  });

  it('una fecha de cumplimiento futura se rechaza antes de llegar a la base', async () => {
    const responsable = await nuevaPersona();
    const creada = await servicio.crear(alta(responsable), rrhh);
    await servicio.avanzar(creada.id, { estado: 'en_curso' }, rrhh);
    await expect(
      servicio.avanzar(
        creada.id,
        { estado: 'completada', fechaCumplimiento: '2999-01-01' },
        rrhh,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('el CHECK de la base impide completar sin fecha de cumplimiento', async () => {
    const responsable = await nuevaPersona();
    const creada = await servicio.crear(alta(responsable), rrhh);
    await expect(
      sql(
        `UPDATE accion_transferencia SET id_estado_accion =
           (SELECT id_estado_accion_transferencia FROM estado_accion_transferencia WHERE codigo = 'completada')
         WHERE id_accion = $1`,
        [creada.id],
      ),
    ).rejects.toThrow(/CK_accion_cumplimiento_estado/);
  });

  it('cancelar desde pendiente deja la acción cancelada y sin fecha', async () => {
    const responsable = await nuevaPersona();
    const creada = await servicio.crear(alta(responsable), rrhh);
    const dto = await servicio.editar(creada.id, { cancelar: true }, rrhh);
    expect(dto.estado).toBe('cancelada');
    expect((await fila(creada.id)).fecha_cumplimiento).toBeNull();
  });

  it('la acción de un plan cerrado sigue visible para su responsable', async () => {
    const responsable = await nuevaPersona();
    const puesto = await nuevoPuesto('PC-1', unidadA);
    await requisito(puesto);
    const idPlan = await nuevoPlan(puesto, responsable);
    const creada = await servicio.crear(alta(responsable, { idPlan }), rrhh);
    await sql(
      `UPDATE plan_sucesion SET id_estado_plan = (SELECT id_estado_plan FROM estado_plan WHERE codigo = 'cerrado')
       WHERE id_plan = $1`,
      [idPlan],
    );
    const propias = await servicio.listar({}, docente(responsable));
    expect(propias.map((a) => a.id)).toEqual([creada.id]);
    await expect(
      servicio.crear(alta(responsable, { idPlan }), rrhh),
    ).rejects.toThrow(ConflictException);
  });

  it('el conocimiento debe ser requisito del puesto del plan', async () => {
    const responsable = await nuevaPersona();
    const otro = await id(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT 'Otro', 'otro', t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
    );
    await expect(
      servicio.crear(
        alta(responsable, { idPlan: planA, idConocimiento: otro }),
        rrhh,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('el filtro vencidas usa las fechas reales de la base', async () => {
    const responsable = await nuevaPersona();
    const vencida = await servicio.crear(
      alta(responsable, { fechaPrevista: '2000-01-01' }),
      rrhh,
    );
    const futura = await servicio.crear(alta(responsable), rrhh);
    const completada = await servicio.crear(
      alta(responsable, { fechaPrevista: '2000-01-01' }),
      rrhh,
    );
    await servicio.avanzar(completada.id, { estado: 'en_curso' }, rrhh);
    await servicio.avanzar(completada.id, { estado: 'completada' }, rrhh);

    const propias = docente(responsable);
    const vencidas = await servicio.listar({ vencidas: true }, propias);
    expect(vencidas.map((a) => a.id)).toEqual([vencida.id]);
    expect(vencidas[0].vencida).toBe(true);

    const noVencidas = await servicio.listar({ vencidas: false }, propias);
    expect(noVencidas.map((a) => a.id).sort()).toEqual(
      [futura.id, completada.id].sort(),
    );
    expect(noVencidas.every((a) => !a.vencida)).toBe(true);
  });

  it('el alcance de la jefatura usa la consulta recursiva sobre el plan', async () => {
    const responsable = await nuevaPersona();
    const deA = await servicio.crear(
      alta(responsable, { idPlan: planA }),
      rrhh,
    );
    const deB = await servicio.crear(
      alta(responsable, { idPlan: planB }),
      rrhh,
    );
    const sinPlan = await servicio.crear(alta(responsable), rrhh);

    const ids = (await servicio.listar({}, jefaA)).map((a) => a.id);
    expect(ids).toContain(deA.id);
    expect(ids).not.toContain(deB.id);
    expect(ids).not.toContain(sinPlan.id);

    const todas = (await servicio.listar({}, autoridad)).map((a) => a.id);
    expect(todas).toEqual(expect.arrayContaining([deA.id, deB.id, sinPlan.id]));
    const delPlan = await servicio.listarDePlan(planB);
    expect(delPlan.map((a) => a.id)).toContain(deB.id);
  });

  it('un docente ve las acciones donde es destinatario y no avanza las ajenas', async () => {
    const responsable = await nuevaPersona();
    const destinatario = await nuevaPersona();
    const creada = await servicio.crear(
      alta(responsable, { idDestinatario: destinatario }),
      rrhh,
    );
    const vistas = await servicio.listar({}, docente(destinatario));
    expect(vistas.map((a) => a.id)).toEqual([creada.id]);
    await expect(
      servicio.avanzar(
        creada.id,
        { estado: 'en_curso' },
        docente(destinatario),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('el responsable reescribe la nota mientras la acción está en curso, sin cambiar el estado', async () => {
    const responsable = await nuevaPersona();
    const creada = await servicio.crear(alta(responsable), rrhh);
    const sesion = docente(responsable);
    await servicio.avanzar(
      creada.id,
      { estado: 'en_curso', notaAvance: 'arrancó' },
      sesion,
    );
    const nueva = await servicio.avanzar(
      creada.id,
      { estado: 'en_curso', notaAvance: 'a mitad de camino' },
      sesion,
    );
    expect(nueva).toMatchObject({
      estado: 'en_curso',
      notaAvance: 'a mitad de camino',
    });
    expect((await fila(creada.id)).estado).toBe('en_curso');
    await expect(
      servicio.avanzar(
        creada.id,
        { estado: 'en_curso', fechaCumplimiento: '2000-01-01' },
        sesion,
      ),
    ).rejects.toThrow(BadRequestException);
    // Una pendiente no salta a completada, y una completada no vuelve a en_curso.
    const pendiente = await servicio.crear(alta(responsable), rrhh);
    await expect(
      servicio.avanzar(pendiente.id, { estado: 'completada' }, sesion),
    ).rejects.toThrow(ConflictException);
    await servicio.avanzar(creada.id, { estado: 'completada' }, sesion);
    await expect(
      servicio.avanzar(creada.id, { estado: 'en_curso' }, sesion),
    ).rejects.toThrow(ConflictException);
  });

  it('un jefe ve sin duplicados las acciones sin plan donde es responsable o destinatario, y no las de otro', async () => {
    const yo = await nuevaPersona();
    const otro = await nuevaPersona();
    const jefe: SesionUsuario = {
      ...jefaA,
      rol: 'jefe_catedra',
      idPersona: yo,
    };
    const propia = await servicio.crear(alta(yo), rrhh);
    const comoDestinatario = await servicio.crear(
      alta(otro, { idDestinatario: yo }),
      rrhh,
    );
    const ajena = await servicio.crear(alta(otro), rrhh);
    const delAlcance = await servicio.crear(alta(yo, { idPlan: planA }), rrhh);
    const ids = (await servicio.listar({}, jefe)).map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining([propia.id, comoDestinatario.id, delAlcance.id]),
    );
    expect(ids).not.toContain(ajena.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Ver como destinatario no es poder avanzar.
    await expect(
      servicio.avanzar(comoDestinatario.id, { estado: 'en_curso' }, jefe),
    ).rejects.toThrow(ForbiddenException);
    // El responsable jefe sí avanza la suya.
    await expect(
      servicio.avanzar(propia.id, { estado: 'en_curso' }, jefe),
    ).resolves.toMatchObject({ estado: 'en_curso' });
  });
});
