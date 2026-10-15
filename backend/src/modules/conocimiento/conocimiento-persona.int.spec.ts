import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { SQL_ASEGURAR_FILA, SQL_REFLEJAR_VIGENTE } from './sql.js';

describe('Conocimiento de las personas (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let persona: number;
  let evaluador: number;
  let conocimiento: number;
  let basico: number;
  let avanzado: number;
  let evidencia: number;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const id = async (consulta: string) =>
    (await sql<{ id: number }[]>(consulta))[0].id;
  const dia = async (delta: number) =>
    (
      await sql<{ f: string }[]>(`SELECT (CURRENT_DATE + $1::int)::text AS f`, [
        delta,
      ])
    )[0].f;

  const nuevaPersona = async (legajo: string, documento: string) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
         SELECT $1, 'Pérez', 'Ana', $2, '1980-01-01', '2005-03-01', id_situacion_revista
         FROM situacion_revista WHERE codigo = 'planta_permanente'
         RETURNING id_persona AS id`,
        [legajo, documento],
      )
    )[0].id;

  const acreditacion = (fecha: string, nivel: number) =>
    sql(
      `INSERT INTO acreditacion (id_persona, id_conocimiento, id_nivel_acreditado, id_tipo_evidencia, fecha_evaluacion, id_evaluador)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [persona, conocimiento, nivel, evidencia, fecha, evaluador],
    );

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    persona = await nuevaPersona('L-1', '30111111');
    evaluador = await nuevaPersona('L-2', '30222222');
    basico = await id(
      `SELECT id_nivel_dominio AS id FROM nivel_dominio WHERE codigo = 'basico'`,
    );
    avanzado = await id(
      `SELECT id_nivel_dominio AS id FROM nivel_dominio WHERE codigo = 'avanzado'`,
    );
    evidencia = await id(
      `SELECT id_tipo_evidencia AS id FROM tipo_evidencia WHERE codigo = 'titulo'`,
    );
    conocimiento = (
      await sql<{ id: number }[]>(
        `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
         SELECT 'SQL', 'sql', t.id_tipo_conocimiento, a.id_area_tematica
         FROM tipo_conocimiento t, area_tematica a
         WHERE t.codigo = 'competencia_tecnica' ORDER BY a.id_area_tematica LIMIT 1
         RETURNING id_conocimiento AS id`,
      )
    )[0].id;
  });
  afterAll(async () => {
    await base.destruir();
  });
  afterEach(async () => {
    await sql('DELETE FROM acreditacion');
    await sql('DELETE FROM conocimiento_persona');
  });

  const fila = (campos: string, valores: unknown[]) =>
    sql(
      `INSERT INTO conocimiento_persona (id_persona, id_conocimiento, ${campos})
       VALUES ($1, $2, ${valores.map((_, i) => `$${i + 3}`).join(', ')})`,
      [persona, conocimiento, ...valores],
    );

  it('rechaza una fila sin ningún nivel', async () => {
    await expect(
      sql(
        `INSERT INTO conocimiento_persona (id_persona, id_conocimiento) VALUES ($1, $2)`,
        [persona, conocimiento],
      ),
    ).rejects.toThrow(/CK_conocimiento_persona_algun_nivel/);
  });

  it('exige que el nivel declarado y su fecha estén juntos', async () => {
    await expect(fila('id_nivel_declarado', [basico])).rejects.toThrow(
      /CK_conocimiento_persona_declaracion_completa/,
    );
  });

  it('exige que los cuatro campos de acreditación estén juntos', async () => {
    await expect(
      fila('id_nivel_acreditado, fecha_evaluacion', [basico, await dia(-1)]),
    ).rejects.toThrow(/CK_conocimiento_persona_acreditacion_completa/);
  });

  it('una acreditación necesita su fila de conocimiento_persona', async () => {
    await expect(acreditacion(await dia(-1), basico)).rejects.toThrow(
      /foreign key/,
    );
  });

  it('rechaza una acreditación con fecha futura', async () => {
    await sql(SQL_ASEGURAR_FILA, [
      persona,
      conocimiento,
      basico,
      await dia(-5),
      evidencia,
      evaluador,
    ]);
    await expect(acreditacion(await dia(1), basico)).rejects.toThrow(
      /CK_acreditacion_fecha_no_futura/,
    );
  });

  it('asegurar la fila crea una vez; repetirlo no cambia nada', async () => {
    const parametros = [persona, conocimiento, basico, await dia(-5), evidencia, evaluador];
    await sql(SQL_ASEGURAR_FILA, parametros);
    await sql(SQL_ASEGURAR_FILA, [persona, conocimiento, avanzado, await dia(-1), evidencia, evaluador]);
    const filas = await sql<{ n: number }[]>(
      `SELECT id_nivel_acreditado AS n FROM conocimiento_persona`,
    );
    expect(filas).toEqual([{ n: basico }]);
  });

  describe('reflejo de la acreditación vigente', () => {
    const reflejado = async () =>
      (
        await sql<{ n: number; f: string }[]>(
          `SELECT id_nivel_acreditado AS n, fecha_evaluacion::text AS f FROM conocimiento_persona`,
        )
      )[0];

    beforeEach(async () => {
      await sql(SQL_ASEGURAR_FILA, [persona, conocimiento, basico, await dia(-10), evidencia, evaluador]);
      await acreditacion(await dia(-10), basico);
    });

    it('una acreditación más reciente reemplaza el reflejo', async () => {
      await acreditacion(await dia(-2), avanzado);
      await sql(SQL_REFLEJAR_VIGENTE, [persona, conocimiento]);
      expect(await reflejado()).toEqual({ n: avanzado, f: await dia(-2) });
    });

    it('una acreditación anterior queda en el historial y no cambia el reflejo', async () => {
      await acreditacion(await dia(-30), avanzado);
      await sql(SQL_REFLEJAR_VIGENTE, [persona, conocimiento]);
      expect(await reflejado()).toEqual({ n: basico, f: await dia(-10) });
      expect(await sql('SELECT 1 FROM acreditacion')).toHaveLength(2);
    });

    it('con la misma fecha gana la de mayor id', async () => {
      await acreditacion(await dia(-10), avanzado);
      await sql(SQL_REFLEJAR_VIGENTE, [persona, conocimiento]);
      expect((await reflejado()).n).toBe(avanzado);
    });
  });
});
