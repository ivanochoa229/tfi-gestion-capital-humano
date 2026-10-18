import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';

describe('Sucesión: esquema (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let puestoSeq = 0;
  let personaSeq = 0;
  let usuario: number;
  let conocimiento: number;
  let preparacion: number;
  let tipoAccion: number;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const id = async (consulta: string, parametros?: unknown[]) =>
    (await sql<{ id: number }[]>(consulta, parametros))[0].id;
  const dia = async (delta: number) =>
    (
      await sql<{ f: string }[]>(`SELECT (CURRENT_DATE + $1::int)::text AS f`, [
        delta,
      ])
    )[0].f;
  const estado = (codigo: string) =>
    id(`SELECT id_estado_plan AS id FROM estado_plan WHERE codigo = $1`, [
      codigo,
    ]);
  const estadoAccion = (codigo: string) =>
    id(
      `SELECT id_estado_accion_transferencia AS id FROM estado_accion_transferencia WHERE codigo = $1`,
      [codigo],
    );
  const crearPuesto = () =>
    id(
      `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
       SELECT $1::varchar, 'Puesto ' || $1::varchar, (SELECT id_unidad FROM unidad_organizativa WHERE id_unidad_superior IS NULL),
              id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
       RETURNING id_puesto AS id`,
      [`P-${String(++puestoSeq).padStart(4, '0')}`],
    );
  const crearPersona = () => {
    const n = ++personaSeq;
    return id(
      `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
       SELECT $1, 'Apellido', 'Nombre', $2, '1980-01-01', '2010-01-01', min(id_situacion_revista)
       FROM situacion_revista RETURNING id_persona AS id`,
      [`L${n}`, String(20000000 + n)],
    );
  };
  const crearPlan = async (
    codigoEstado: string,
    puesto: number,
    responsable: number,
    extra: { usuario?: number | null; fecha?: string | null } = {},
  ) =>
    id(
      `INSERT INTO plan_sucesion (id_puesto, id_responsable, id_estado_plan, id_usuario_resolucion, fecha_resolucion)
       VALUES ($1, $2, $3, $4, $5) RETURNING id_plan AS id`,
      [
        puesto,
        responsable,
        await estado(codigoEstado),
        extra.usuario ?? null,
        extra.fecha ?? null,
      ],
    );
  const candidato = (plan: number, persona: number, prioridad: number) =>
    sql(
      `INSERT INTO candidato_sucesion (id_plan, id_persona, id_estado_preparacion, prioridad)
       VALUES ($1, $2, $3, $4)`,
      [plan, persona, preparacion, prioridad],
    );
  const accion = async (
    codigoEstado: string,
    fechaCumplimiento: string | null,
    responsable: number,
    destinatario: number | null = null,
    plan: number | null = null,
  ) =>
    sql(
      `INSERT INTO accion_transferencia
         (id_tipo_accion, id_conocimiento, id_plan, id_responsable, id_destinatario, descripcion,
          fecha_prevista, fecha_cumplimiento, id_estado_accion)
       VALUES ($1, $2, $3, $4, $5, 'x', CURRENT_DATE, $6, $7)`,
      [
        tipoAccion,
        conocimiento,
        plan,
        responsable,
        destinatario,
        fechaCumplimiento,
        await estadoAccion(codigoEstado),
      ],
    );

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    usuario = await id(
      `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol)
       SELECT 'autoridad', 'x', id_rol FROM rol WHERE codigo = 'autoridad' RETURNING id_usuario AS id`,
    );
    conocimiento = await id(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT 'SQL', 'sql', t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
    );
    preparacion = await id(
      `SELECT min(id_estado_preparacion) AS id FROM estado_preparacion`,
    );
    tipoAccion = await id(
      `SELECT min(id_tipo_accion_transferencia) AS id FROM tipo_accion_transferencia`,
    );
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('estado_plan tiene el valor cerrado', async () => {
    const filas = await sql<unknown[]>(
      `SELECT 1 FROM estado_plan WHERE codigo = 'cerrado'`,
    );
    expect(filas).toHaveLength(1);
  });

  it('rechaza dos planes aprobados del mismo puesto', async () => {
    const puesto = await crearPuesto();
    const resp = await crearPersona();
    await crearPlan('aprobado', puesto, resp);
    await expect(crearPlan('aprobado', puesto, resp)).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('rechaza dos planes en elaboración del mismo puesto', async () => {
    const puesto = await crearPuesto();
    const resp = await crearPersona();
    await crearPlan('borrador', puesto, resp);
    await expect(crearPlan('borrador', puesto, resp)).rejects.toMatchObject({
      code: '23505',
    });
    await expect(
      crearPlan('pendiente_aprobacion', puesto, resp),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('permite un aprobado más uno en elaboración, y cerrados o rechazados extra', async () => {
    const puesto = await crearPuesto();
    const resp = await crearPersona();
    await crearPlan('aprobado', puesto, resp);
    await crearPlan('borrador', puesto, resp);
    await crearPlan('cerrado', puesto, resp);
    await crearPlan('cerrado', puesto, resp);
    await crearPlan('rechazado', puesto, resp);
    await crearPlan('rechazado', puesto, resp);
  });

  it('exige usuario y fecha de resolución juntos', async () => {
    const puesto = await crearPuesto();
    const resp = await crearPersona();
    await expect(
      crearPlan('rechazado', puesto, resp, { usuario }),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      crearPlan('rechazado', puesto, resp, { fecha: await dia(0) }),
    ).rejects.toMatchObject({ code: '23514' });
    await crearPlan('rechazado', puesto, resp, {
      usuario,
      fecha: await dia(0),
    });
  });

  it('la prioridad es única por plan pero permite intercambiar dentro de una transacción', async () => {
    const puesto = await crearPuesto();
    const resp = await crearPersona();
    const plan = await crearPlan('borrador', puesto, resp);
    const a = await crearPersona();
    const b = await crearPersona();
    await candidato(plan, a, 1);
    await expect(candidato(plan, b, 1)).rejects.toMatchObject({
      code: '23505',
    });
    await candidato(plan, b, 2);

    const qr = ds.createQueryRunner();
    await qr.connect();
    try {
      await qr.startTransaction();
      await qr.query('SET CONSTRAINTS ALL DEFERRED');
      await qr.query(
        `UPDATE candidato_sucesion SET prioridad = 2 WHERE id_plan = $1 AND id_persona = $2`,
        [plan, a],
      );
      await qr.query(
        `UPDATE candidato_sucesion SET prioridad = 1 WHERE id_plan = $1 AND id_persona = $2`,
        [plan, b],
      );
      await qr.commitTransaction();
    } finally {
      await qr.release();
    }
    const filas = await sql<{ id_persona: number; prioridad: number }[]>(
      `SELECT id_persona, prioridad FROM candidato_sucesion WHERE id_plan = $1`,
      [plan],
    );
    expect(filas.find((f) => f.id_persona === a)?.prioridad).toBe(2);
    expect(filas.find((f) => f.id_persona === b)?.prioridad).toBe(1);
  });

  it('prioridad mínima 1', async () => {
    const puesto = await crearPuesto();
    const plan = await crearPlan('borrador', puesto, await crearPersona());
    await expect(
      candidato(plan, await crearPersona(), 0),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('fecha_cumplimiento solo con estado completada', async () => {
    const resp = await crearPersona();
    await expect(accion('completada', null, resp)).rejects.toMatchObject({
      code: '23514',
    });
    await expect(accion('pendiente', await dia(0), resp)).rejects.toMatchObject(
      { code: '23514' },
    );
    await accion('completada', await dia(0), resp);
    await expect(
      accion('completada', await dia(1), resp),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('el destinatario no puede ser el responsable', async () => {
    const resp = await crearPersona();
    await expect(accion('pendiente', null, resp, resp)).rejects.toMatchObject({
      code: '23514',
    });
    await accion('pendiente', null, resp, await crearPersona());
  });

  it('una acción puede existir sin plan', async () => {
    await accion('pendiente', null, await crearPersona(), null, null);
  });
});
