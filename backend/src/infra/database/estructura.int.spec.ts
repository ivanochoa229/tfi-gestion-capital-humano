import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';

describe('esquema de estructura', () => {
  let base: BaseTemporal;
  const sql = <T = unknown>(consulta: string, parametros?: unknown[]) =>
    base.dataSource.query(consulta, parametros) as Promise<T>;

  const idTipo = async (codigo: string) =>
    (
      await sql<{ id: number }[]>(
        'SELECT id_tipo_unidad AS id FROM tipo_unidad WHERE codigo = $1',
        [codigo],
      )
    )[0].id;
  const idNivel = async (codigo: string) =>
    (
      await sql<{ id: number }[]>(
        'SELECT id_nivel_jerarquico AS id FROM nivel_jerarquico WHERE codigo = $1',
        [codigo],
      )
    )[0].id;
  const unidad = async (
    denominacion: string,
    tipo: string,
    idSuperior: number | null = null,
    activo = true,
  ) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior, activo)
         VALUES ($1, $2, $3, $4) RETURNING id_unidad AS id`,
        [denominacion, await idTipo(tipo), idSuperior, activo],
      )
    )[0].id;
  const puesto = async (
    codigo: string,
    denominacion: string,
    idUnidad: number,
    activo = true,
  ) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico, activo)
         VALUES ($1, $2, $3, $4, $5) RETURNING id_puesto AS id`,
        [
          codigo,
          denominacion,
          idUnidad,
          await idNivel('operativo_docente'),
          activo,
        ],
      )
    )[0].id;

  let departamento: number;

  beforeAll(async () => {
    base = await crearBaseTemporal();
    departamento = (
      await sql<{ id: number }[]>(
        `SELECT id_unidad AS id FROM unidad_organizativa WHERE denominacion = 'Departamento de Sistemas'`,
      )
    )[0].id;
  });
  afterAll(async () => {
    await base.destruir();
  });

  describe('jerarquía de unidades', () => {
    it('carga el Departamento de Sistemas sin superior', async () => {
      const filas = await sql<{ superior: number | null; tipo: string }[]>(
        `SELECT u.id_unidad_superior AS superior, t.codigo AS tipo
         FROM unidad_organizativa u JOIN tipo_unidad t USING (id_tipo_unidad)
         WHERE u.id_unidad = $1`,
        [departamento],
      );
      expect(filas).toEqual([{ superior: null, tipo: 'departamento' }]);
    });

    it('rechaza un departamento con unidad superior', async () => {
      await expect(
        unidad('Otro dpto', 'departamento', departamento),
      ).rejects.toThrow(/no puede tener unidad superior/);
    });

    it('rechaza una cátedra sin unidad superior', async () => {
      await expect(unidad('Cátedra suelta', 'catedra')).rejects.toThrow(
        /debe tener un departamento/,
      );
    });

    it('rechaza una cátedra bajo otra cátedra', async () => {
      const a = await unidad('Cátedra A', 'catedra', departamento);
      await expect(unidad('Cátedra bajo A', 'catedra', a)).rejects.toThrow(
        /debe ser un departamento/,
      );
    });

    it('rechaza cambiar el superior de una cátedra a otra cátedra', async () => {
      const b = await unidad('Cátedra B', 'catedra', departamento);
      const c = await unidad('Cátedra C', 'catedra', departamento);
      await expect(
        sql(
          'UPDATE unidad_organizativa SET id_unidad_superior = $1 WHERE id_unidad = $2',
          [b, c],
        ),
      ).rejects.toThrow(/debe ser un departamento/);
    });

    it('no admite dos unidades activas con la misma denominación bajo el mismo superior', async () => {
      await unidad('Cátedra D', 'catedra', departamento);
      await expect(
        unidad('CÁTEDRA d', 'catedra', departamento),
      ).rejects.toThrow(/UQ_unidad_denominacion_superior/);
    });

    it('admite repetir la denominación si la otra unidad está inactiva', async () => {
      await unidad('Cátedra E', 'catedra', departamento, false);
      await expect(
        unidad('Cátedra E', 'catedra', departamento),
      ).resolves.toBeGreaterThan(0);
    });

    it('no admite dos departamentos activos con la misma denominación', async () => {
      await expect(
        unidad('departamento de sistemas', 'departamento'),
      ).rejects.toThrow(/UQ_unidad_denominacion_raiz/);
    });
  });

  describe('puestos', () => {
    let catedra: number;
    beforeAll(async () => {
      catedra = await unidad('Cátedra de puestos', 'catedra', departamento);
    });

    it('rechaza una dotación prevista menor a 1', async () => {
      await expect(
        sql(
          `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico, dotacion_prevista)
           VALUES ('P-9001', 'Dotación cero', $1, $2, 0)`,
          [catedra, await idNivel('operativo_docente')],
        ),
      ).rejects.toThrow(/CK_puesto_dotacion_prevista/);
    });

    it('rechaza que un puesto sea su propio superior', async () => {
      const id = await puesto('P-9002', 'Puesto propio', catedra);
      await expect(
        sql('UPDATE puesto SET id_puesto_superior = $1 WHERE id_puesto = $1', [
          id,
        ]),
      ).rejects.toThrow(/CK_puesto_superior_distinto/);
    });

    it('rechaza un código repetido', async () => {
      await puesto('P-9003', 'Con código', catedra);
      await expect(
        puesto('P-9003', 'Otro con el mismo código', catedra),
      ).rejects.toThrow(/duplicate key|unique/i);
    });

    it('rechaza dos puestos activos con la misma denominación en la unidad, sin distinguir mayúsculas', async () => {
      await puesto('P-9004', 'Auxiliar', catedra);
      await expect(puesto('P-9005', 'AUXILIAR', catedra)).rejects.toThrow(
        /UQ_puesto_unidad_denominacion/,
      );
    });

    it('admite repetir la denominación si el otro puesto está dado de baja', async () => {
      await puesto('P-9006', 'Suplente', catedra, false);
      await expect(
        puesto('P-9007', 'Suplente', catedra),
      ).resolves.toBeGreaterThan(0);
    });

    it('la secuencia de códigos empieza en 1 y falla al agotarse', async () => {
      const primero = await sql<{ n: string }[]>(
        `SELECT nextval('puesto_codigo_seq') AS n`,
      );
      expect(primero[0].n).toBe('1');
      await sql(`ALTER SEQUENCE puesto_codigo_seq RESTART WITH 9999`);
      const ultimo = await sql<{ n: string }[]>(
        `SELECT nextval('puesto_codigo_seq') AS n`,
      );
      expect(ultimo[0].n).toBe('9999');
      await expect(sql(`SELECT nextval('puesto_codigo_seq')`)).rejects.toThrow(
        /reached maximum value/,
      );
    });
  });

  describe('script de cátedras de ejemplo', () => {
    it('carga tres cátedras bajo el departamento y se puede correr dos veces', async () => {
      const script = readFileSync(
        join(
          import.meta.dirname,
          '..',
          '..',
          '..',
          'scripts',
          'catedras-ejemplo.sql',
        ),
        'utf8',
      );
      await sql(script);
      await sql(script);
      const filas = await sql<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM unidad_organizativa
         WHERE id_unidad_superior = $1 AND denominacion IN
           ('Algoritmos y Estructuras de Datos', 'Bases de Datos', 'Ingeniería de Software')`,
        [departamento],
      );
      expect(filas[0].n).toBe(3);
    });
  });
});
