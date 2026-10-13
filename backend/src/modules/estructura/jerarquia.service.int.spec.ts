import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { JerarquiaService } from './jerarquia.service.js';

describe('JerarquiaService (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let servicio: JerarquiaService;
  let departamento: number;
  let catedra: number;
  let otraCatedra: number;
  let a: number;
  let b: number;
  let c: number;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    base.dataSource.query(consulta, parametros) as Promise<T>;
  const unidad = async (denominacion: string, tipo: string, superior: number) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
         SELECT $1, id_tipo_unidad, $3 FROM tipo_unidad WHERE codigo = $2
         RETURNING id_unidad AS id`,
        [denominacion, tipo, superior],
      )
    )[0].id;
  const puesto = async (
    codigo: string,
    idUnidad: number,
    superior: number | null,
  ) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico, id_puesto_superior)
         SELECT $1, $1, $2, id_nivel_jerarquico, $3 FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
         RETURNING id_puesto AS id`,
        [codigo, idUnidad, superior],
      )
    )[0].id;

  beforeAll(async () => {
    base = await crearBaseTemporal();
    servicio = new JerarquiaService(base.dataSource);
    departamento = (
      await sql<{ id: number }[]>(
        `SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
      )
    )[0].id;
    catedra = await unidad('Cátedra 1', 'catedra', departamento);
    otraCatedra = await unidad('Cátedra 2', 'catedra', departamento);
    a = await puesto('A', catedra, null);
    b = await puesto('B', catedra, a);
    c = await puesto('C', catedra, b);
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('devuelve la unidad y sus ancestras hasta el departamento', async () => {
    expect((await servicio.unidadesHastaRaiz(catedra)).sort()).toEqual(
      [catedra, departamento].sort(),
    );
    expect(await servicio.unidadesHastaRaiz(departamento)).toEqual([
      departamento,
    ]);
  });

  it('no incluye unidades hermanas', async () => {
    expect(await servicio.unidadesHastaRaiz(otraCatedra)).not.toContain(
      catedra,
    );
  });

  it('devuelve el puesto y toda su cadena de superiores', async () => {
    expect((await servicio.cadenaDeSuperiores(c)).sort()).toEqual(
      [a, b, c].sort(),
    );
    expect(await servicio.cadenaDeSuperiores(a)).toEqual([a]);
  });

  it('termina aunque la cadena tenga un ciclo escrito directo en la base', async () => {
    await sql(
      'UPDATE puesto SET id_puesto_superior = $1 WHERE id_puesto = $2',
      [c, a],
    );
    expect((await servicio.cadenaDeSuperiores(c)).sort()).toEqual(
      [a, b, c].sort(),
    );
    await sql(
      'UPDATE puesto SET id_puesto_superior = NULL WHERE id_puesto = $1',
      [a],
    );
  });
});
