import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';

describe('Conocimiento: catálogo y requisitos (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let tipoTecnica: number;
  let tipoFormacion: number;
  let area: number;
  let nivel: number;
  let idPuesto: number;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const id = async (consulta: string) =>
    (await sql<{ id: number }[]>(consulta))[0].id;

  const insertar = (
    denominacion: string,
    normalizada: string,
    tipo = tipoTecnica,
    activo = true,
  ) =>
    sql(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica, activo)
       VALUES ($1, $2, $3, $4, $5) RETURNING id_conocimiento AS id`,
      [denominacion, normalizada, tipo, area, activo],
    );

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    tipoTecnica = await id(
      `SELECT id_tipo_conocimiento AS id FROM tipo_conocimiento WHERE codigo = 'competencia_tecnica'`,
    );
    tipoFormacion = await id(
      `SELECT id_tipo_conocimiento AS id FROM tipo_conocimiento WHERE codigo = 'formacion'`,
    );
    area = await id(
      `SELECT id_area_tematica AS id FROM area_tematica ORDER BY id_area_tematica LIMIT 1`,
    );
    nivel = await id(
      `SELECT id_nivel_dominio AS id FROM nivel_dominio WHERE codigo = 'basico'`,
    );
    const departamento = await id(
      `SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
    );
    idPuesto = (
      await sql<{ id: number }[]>(
        `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
         SELECT 'P-0001', 'Jefe', $1, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
         RETURNING id_puesto AS id`,
        [departamento],
      )
    )[0].id;
  });
  afterAll(async () => {
    await base.destruir();
  });
  afterEach(async () => {
    await sql('DELETE FROM requisito_puesto');
    await sql('DELETE FROM conocimiento');
  });

  it('rechaza dos conocimientos activos con la misma clave y el mismo tipo', async () => {
    await insertar('Programación', 'programacion');
    await expect(insertar('PROGRAMACION', 'programacion')).rejects.toThrow(
      /UQ_conocimiento_tipo_denominacion_activo/,
    );
  });

  it('permite la misma clave en otro tipo', async () => {
    await insertar('Estadística', 'estadistica');
    await expect(
      insertar('Estadística', 'estadistica', tipoFormacion),
    ).resolves.toBeDefined();
  });

  it('un conocimiento inactivo no bloquea un alta igual, ni a varios inactivos entre sí', async () => {
    await insertar('Redes', 'redes', tipoTecnica, false);
    await insertar('Redes', 'redes', tipoTecnica, false);
    await expect(insertar('Redes', 'redes')).resolves.toBeDefined();
  });

  it('no admite fusionarse consigo mismo', async () => {
    const [{ id: a }] = await insertar('Python', 'python');
    await expect(
      sql(
        `UPDATE conocimiento SET id_fusionado_en = id_conocimiento WHERE id_conocimiento = $1`,
        [a],
      ),
    ).rejects.toThrow(/CK_conocimiento_fusion_distinta/);
  });

  it('un puesto no repite el mismo requisito', async () => {
    const [{ id: a }] = await insertar('Python', 'python');
    const alta = () =>
      sql(
        `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente) VALUES ($1, $2, $3, true)`,
        [idPuesto, a, nivel],
      );
    await alta();
    await expect(alta()).rejects.toThrow(/duplicate key|PK_/);
  });

  it('no se borra un conocimiento que un puesto requiere', async () => {
    const [{ id: a }] = await insertar('Python', 'python');
    await sql(
      `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente) VALUES ($1, $2, $3, false)`,
      [idPuesto, a, nivel],
    );
    await expect(
      sql(`DELETE FROM conocimiento WHERE id_conocimiento = $1`, [a]),
    ).rejects.toThrow(/foreign key/);
  });
});
