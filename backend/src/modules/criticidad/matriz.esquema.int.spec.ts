import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';

describe('Escalas y matriz de criticidad (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('carga tres niveles por eje, ordenados y con criterio', async () => {
    for (const tabla of ['nivel_impacto', 'nivel_dificultad']) {
      const filas = await sql<
        { codigo: string; orden: number; criterio: string }[]
      >(`SELECT codigo, orden, criterio FROM ${tabla} ORDER BY orden`);
      expect(filas).toHaveLength(3);
      expect(filas.map((f) => f.orden)).toEqual([1, 2, 3]);
      expect(filas.every((f) => f.criterio.length > 10)).toBe(true);
    }
  });

  it('carga las nueve celdas con los resultados acordados', async () => {
    const filas = await sql<{ i: string; d: string; n: string }[]>(
      `SELECT i.codigo AS i, d.codigo AS d, n.codigo AS n
       FROM matriz_criticidad m
       JOIN nivel_impacto i ON i.id_nivel_impacto = m.id_nivel_impacto
       JOIN nivel_dificultad d ON d.id_nivel_dificultad = m.id_nivel_dificultad
       JOIN nivel_criticidad n ON n.id_nivel_criticidad = m.id_nivel_criticidad
       ORDER BY i.orden DESC, d.orden`,
    );
    expect(filas.map((f) => `${f.i}/${f.d}=${f.n}`)).toEqual([
      'alto/facil=media',
      'alto/moderada=alta',
      'alto/dificil=alta',
      'medio/facil=baja',
      'medio/moderada=media',
      'medio/dificil=alta',
      'bajo/facil=baja',
      'bajo/moderada=baja',
      'bajo/dificil=media',
    ]);
  });

  it('no admite una celda repetida', async () => {
    await expect(
      sql(
        `INSERT INTO matriz_criticidad (id_nivel_impacto, id_nivel_dificultad, id_nivel_criticidad)
         SELECT m.id_nivel_impacto, m.id_nivel_dificultad, m.id_nivel_criticidad
         FROM matriz_criticidad m LIMIT 1`,
      ),
    ).rejects.toThrow(/duplicate key|llave duplicada/i);
  });

  it('no deja borrar una escala que la matriz usa', async () => {
    await expect(sql(`DELETE FROM nivel_impacto`)).rejects.toThrow(
      /foreign key|llave foránea/i,
    );
  });
});
