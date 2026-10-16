import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

describe('Activos de conocimiento: esquema (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let tipoDocumento: number;
  let unidad: number;
  let conocimiento: number;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const id = async (consulta: string) =>
    (await sql<{ id: number }[]>(consulta))[0].id;

  const archivo = (
    hash: string | null,
    activo = true,
    mime = 'application/pdf',
  ) =>
    sql<{ id: number }[]>(
      `INSERT INTO activo_conocimiento
         (titulo, id_tipo_documento, id_unidad, origen, ubicacion, nombre_original, tipo_mime, tamanio, hash, activo)
       VALUES ('Manual', $1, $2, 'archivo', 'activos/1/x-manual.pdf', 'manual.pdf', $3, 10, $4, $5)
       RETURNING id_activo AS id`,
      [tipoDocumento, unidad, mime, hash, activo],
    );
  const enlace = (hash: string | null = null) =>
    sql<{ id: number }[]>(
      `INSERT INTO activo_conocimiento
         (titulo, id_tipo_documento, id_unidad, origen, ubicacion, hash)
       VALUES ('Wiki', $1, $2, 'enlace', 'https://wiki.example/x', $3)
       RETURNING id_activo AS id`,
      [tipoDocumento, unidad, hash],
    );

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    tipoDocumento = await id(
      `SELECT id_tipo_documento AS id FROM tipo_documento WHERE codigo = 'manual'`,
    );
    unidad = await id(`SELECT min(id_unidad) AS id FROM unidad_organizativa`);
    conocimiento = await id(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT 'SQL', 'sql', t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica'
       RETURNING id_conocimiento AS id`,
    );
  });
  afterAll(async () => {
    await base.destruir();
  });
  afterEach(async () => {
    await sql('DELETE FROM activo_conocimiento_conocimiento');
    await sql('DELETE FROM activo_conocimiento');
  });

  it('rechaza un archivo sin hash', async () => {
    await expect(archivo(null)).rejects.toThrow(/CK_activo_origen_coherente/);
  });

  it('rechaza un enlace con hash', async () => {
    await expect(enlace(HASH_A)).rejects.toThrow(/CK_activo_origen_coherente/);
  });

  it('acepta un enlace sin metadatos de archivo', async () => {
    await expect(enlace()).resolves.toHaveLength(1);
    await expect(enlace()).resolves.toHaveLength(1);
  });

  it('rechaza dos archivos activos con el mismo hash', async () => {
    await archivo(HASH_A);
    await expect(archivo(HASH_A)).rejects.toThrow(/UQ_activo_hash_activo/);
  });

  it('permite repetir el hash de un activo dado de baja', async () => {
    await archivo(HASH_A, false);
    await expect(archivo(HASH_A)).resolves.toHaveLength(1);
  });

  it('con dos altas simultáneas del mismo hash queda una sola', async () => {
    const resultados = await Promise.allSettled([
      archivo(HASH_B),
      archivo(HASH_B),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(resultados.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('no repite el vínculo de un activo con un conocimiento', async () => {
    const [{ id: activo }] = await archivo(HASH_A);
    const vincular = () =>
      sql(
        `INSERT INTO activo_conocimiento_conocimiento (id_activo, id_conocimiento) VALUES ($1, $2)`,
        [activo, conocimiento],
      );
    await vincular();
    await expect(vincular()).rejects.toThrow();
  });

  it('rechaza un vínculo con un conocimiento inexistente', async () => {
    const [{ id: activo }] = await archivo(HASH_A);
    await expect(
      sql(
        `INSERT INTO activo_conocimiento_conocimiento (id_activo, id_conocimiento) VALUES ($1, 999999)`,
        [activo],
      ),
    ).rejects.toThrow();
  });
});
