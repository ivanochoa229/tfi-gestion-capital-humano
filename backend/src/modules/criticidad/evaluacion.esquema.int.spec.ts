import type { DataSource } from 'typeorm';
import { AuditoriaSubscriber } from '../../infra/auditoria/auditoria.subscriber.js';
import { contextoUsuario } from '../../infra/auditoria/contexto-usuario.js';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { EvaluacionCriticidad } from './entities/evaluacion-criticidad.entity.js';

describe('Evaluaciones de criticidad: esquema y vista (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let puesto: number;
  let conocimiento: number;
  let usuario: number;
  let escalas: {
    alto: number;
    bajo: number;
    facil: number;
    dificil: number;
    alta: number;
    baja: number;
  };

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const dia = async (delta: number) =>
    (
      await sql<{ f: string }[]>(`SELECT (CURRENT_DATE + $1::int)::text AS f`, [
        delta,
      ])
    )[0].f;
  const id = async (consulta: string, parametros?: unknown[]) =>
    (await sql<{ id: number }[]>(consulta, parametros))[0].id;
  const evaluar = (
    fecha: string,
    nivel: number,
    p = puesto,
    c = conocimiento,
  ) =>
    sql<{ id: number }[]>(
      `INSERT INTO evaluacion_criticidad
         (id_puesto, id_conocimiento, id_nivel_impacto, id_nivel_dificultad, id_nivel_criticidad, fecha_evaluacion, id_usuario)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_evaluacion AS id`,
      [p, c, escalas.alto, escalas.dificil, nivel, fecha, usuario],
    );
  const vigente = async (p = puesto, c = conocimiento) =>
    (
      await sql<{ id: number; n: number; f: string }[]>(
        `SELECT id_evaluacion AS id, id_nivel_criticidad AS n, fecha_evaluacion::text AS f
         FROM criticidad_vigente WHERE id_puesto = $1 AND id_conocimiento = $2`,
        [p, c],
      )
    )[0];

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    puesto = await id(
      `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
       SELECT 'P-0001', 'Jefe de cátedra', (SELECT id_unidad FROM unidad_organizativa WHERE id_unidad_superior IS NULL),
              id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
       RETURNING id_puesto AS id`,
    );
    conocimiento = await id(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT 'SQL', 'sql', t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
    );
    usuario = await id(
      `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol)
       SELECT 'evaluador', 'x', id_rol FROM rol WHERE codigo = 'recursos_humanos' RETURNING id_usuario AS id`,
    );
    const porCodigo = async (tabla: string, columna: string, codigo: string) =>
      id(`SELECT ${columna} AS id FROM ${tabla} WHERE codigo = $1`, [codigo]);
    escalas = {
      alto: await porCodigo('nivel_impacto', 'id_nivel_impacto', 'alto'),
      bajo: await porCodigo('nivel_impacto', 'id_nivel_impacto', 'bajo'),
      facil: await porCodigo(
        'nivel_dificultad',
        'id_nivel_dificultad',
        'facil',
      ),
      dificil: await porCodigo(
        'nivel_dificultad',
        'id_nivel_dificultad',
        'dificil',
      ),
      alta: await porCodigo('nivel_criticidad', 'id_nivel_criticidad', 'alta'),
      baja: await porCodigo('nivel_criticidad', 'id_nivel_criticidad', 'baja'),
    };
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('rechaza una fecha de evaluación futura', async () => {
    await expect(evaluar(await dia(1), escalas.alta)).rejects.toThrow(
      /CK_evaluacion_criticidad_fecha_no_futura/,
    );
  });

  it('la vigente es la más reciente por fecha', async () => {
    await evaluar(await dia(-10), escalas.baja);
    const nueva = await evaluar(await dia(-2), escalas.alta);
    expect((await vigente()).id).toBe(nueva[0].id);
  });

  it('con la misma fecha gana el mayor id', async () => {
    const otro = await id(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT 'Redes', 'redes', t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
    );
    const hoy = await dia(0);
    await evaluar(hoy, escalas.baja, puesto, otro);
    const segunda = await evaluar(hoy, escalas.alta, puesto, otro);
    const v = await vigente(puesto, otro);
    expect(v.id).toBe(segunda[0].id);
    expect(v.n).toBe(escalas.alta);
  });

  it('una evaluación con fecha anterior a la vigente queda en el historial y no la reemplaza', async () => {
    const otro = await id(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT 'Java', 'java', t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
    );
    const reciente = await evaluar(await dia(-1), escalas.alta, puesto, otro);
    await evaluar(await dia(-30), escalas.baja, puesto, otro);
    expect((await vigente(puesto, otro)).id).toBe(reciente[0].id);
    const [{ n }] = await sql<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM evaluacion_criticidad WHERE id_puesto = $1 AND id_conocimiento = $2`,
      [puesto, otro],
    );
    expect(n).toBe(2);
  });

  it('un par sin evaluaciones no aparece en la vista', async () => {
    expect(await vigente(puesto, 999999)).toBeUndefined();
  });

  it('el alta con save() queda en la auditoría con el usuario', async () => {
    new AuditoriaSubscriber(ds);
    const repo = ds.getRepository(EvaluacionCriticidad);
    const creada = await contextoUsuario.run({ idUsuario: usuario }, () =>
      repo.save(
        repo.create({
          idPuesto: puesto,
          idConocimiento: conocimiento,
          idNivelImpacto: escalas.bajo,
          idNivelDificultad: escalas.facil,
          idNivelCriticidad: escalas.baja,
          fechaEvaluacion: '2026-01-01',
          idUsuario: usuario,
          observaciones: null,
        }),
      ),
    );
    const filas = await sql<{ operacion: string; id_usuario: number }[]>(
      `SELECT operacion, id_usuario FROM auditoria WHERE entidad = 'evaluacion_criticidad' AND id_registro = $1`,
      [String(creada.id)],
    );
    expect(filas).toEqual([{ operacion: 'alta', id_usuario: usuario }]);
  });
});
