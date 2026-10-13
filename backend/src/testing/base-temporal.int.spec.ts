import { crearBaseTemporal, type BaseTemporal } from './base-temporal.js';

describe('crearBaseTemporal', () => {
  let base: BaseTemporal;

  beforeAll(async () => {
    base = await crearBaseTemporal();
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('aplica las migraciones en una base propia', async () => {
    const filas: { codigo: string }[] = await base.dataSource.query(
      'SELECT codigo FROM tipo_unidad ORDER BY codigo',
    );
    expect(filas.map((f) => f.codigo)).toEqual(['catedra', 'departamento']);
  });

  it('carga los niveles jerárquicos como escala ordinal', async () => {
    const filas: { codigo: string; orden: number }[] =
      await base.dataSource.query(
        'SELECT codigo, orden FROM nivel_jerarquico ORDER BY orden',
      );
    expect(filas.map((f) => [f.codigo, f.orden])).toEqual([
      ['conduccion_departamento', 1],
      ['conduccion_catedra', 2],
      ['coordinacion_docente', 3],
      ['operativo_docente', 4],
    ]);
  });

  it('permite dejar migraciones fuera y aplicarlas después', async () => {
    const parcial = await crearBaseTemporal({
      sin: ['CargarValoresReferencia'],
    });
    try {
      const antes = await parcial.dataSource.query(
        'SELECT count(*)::int AS n FROM nivel_dominio',
      );
      expect(antes[0].n).toBe(0);

      await parcial.aplicarTodas();

      const despues = await parcial.dataSource.query(
        'SELECT count(*)::int AS n FROM nivel_dominio',
      );
      expect(despues[0].n).toBe(4);
    } finally {
      await parcial.destruir();
    }
  });
});
