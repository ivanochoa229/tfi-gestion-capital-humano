import type { DataSource, EntityManager } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../../testing/base-temporal.js';

/**
 * La importación depende de que un error de la base dentro de un savepoint
 * (por ejemplo la exclusión de solapes, 23P01) no deje abortada la
 * transacción externa.
 */
describe('Savepoints anidados de TypeORM (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let idPuesto: number;
  let caracter: number;
  let dedicacion: number;
  let personaA: number;
  let personaB: number;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;

  const insertarOcupacion = (
    m: EntityManager,
    idPersona: number,
    desde: string,
    hasta: string | null,
  ) =>
    m.query(
      `INSERT INTO ocupacion (id_persona, id_puesto, fecha_desde, fecha_hasta, id_caracter_ocupacion, id_dedicacion)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [idPersona, idPuesto, desde, hasta, caracter, dedicacion],
    );

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    caracter = (
      await sql<{ id: number }[]>(
        `SELECT id_caracter_ocupacion AS id FROM caracter_ocupacion WHERE codigo = 'titular'`,
      )
    )[0].id;
    dedicacion = (
      await sql<{ id: number }[]>(
        `SELECT id_dedicacion AS id FROM dedicacion WHERE codigo = 'simple'`,
      )
    )[0].id;
    const revista = (
      await sql<{ id: number }[]>(
        `SELECT id_situacion_revista AS id FROM situacion_revista WHERE codigo = 'planta_permanente'`,
      )
    )[0].id;
    const insertarPersona = async (legajo: string, documento: string) =>
      (
        await sql<{ id: number }[]>(
          `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
           VALUES ($1, 'Pérez', 'Ana', $2, '1980-01-01', '2005-03-01', $3) RETURNING id_persona AS id`,
          [legajo, documento, revista],
        )
      )[0].id;
    personaA = await insertarPersona('L-1', '30111111');
    personaB = await insertarPersona('L-2', '30222222');
    const [{ id: unidad }] = await sql<{ id: number }[]>(
      `SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
    );
    idPuesto = (
      await sql<{ id: number }[]>(
        `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
         SELECT 'P-0001', 'Jefe', $1, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
         RETURNING id_puesto AS id`,
        [unidad],
      )
    )[0].id;
  });
  afterAll(async () => {
    await base.destruir();
  });
  afterEach(async () => {
    await sql('DELETE FROM ocupacion');
  });

  it('un 23P01 dentro de un savepoint no aborta la transacción externa', async () => {
    await ds.transaction(async (manager) => {
      await insertarOcupacion(manager, personaA, '2024-01-01', null);

      await expect(
        manager.transaction((m) =>
          insertarOcupacion(m, personaA, '2025-01-01', null),
        ),
      ).rejects.toMatchObject({ driverError: { code: '23P01' } });

      // La transacción externa sigue viva y la primera ocupación sigue ahí.
      await insertarOcupacion(manager, personaB, '2024-01-01', null);
      const [{ n }] = await manager.query<{ n: number }[]>(
        'SELECT count(*)::int AS n FROM ocupacion',
      );
      expect(n).toBe(2);
    });
    expect(await sql('SELECT 1 FROM ocupacion')).toHaveLength(2);
  });

  it('lo escrito en savepoints exitosos se descarta si la transacción externa revierte', async () => {
    class Revertir extends Error {}
    await expect(
      ds.transaction(async (manager) => {
        await manager.transaction((m) =>
          insertarOcupacion(m, personaA, '2024-01-01', null),
        );
        throw new Revertir();
      }),
    ).rejects.toBeInstanceOf(Revertir);
    expect(await sql('SELECT 1 FROM ocupacion')).toHaveLength(0);
  });
});
