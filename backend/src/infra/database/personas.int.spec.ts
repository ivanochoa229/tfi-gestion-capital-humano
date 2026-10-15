import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';

interface ErrorDeBase {
  code: string;
  constraint?: string;
  detail?: string;
}

describe('esquema de personas y ocupaciones', () => {
  let base: BaseTemporal;
  let revista: number;
  let caracter: number;
  let dedicacion: number;
  let puestoA: number;
  let puestoB: number;

  const sql = <T = unknown>(consulta: string, parametros?: unknown[]) =>
    base.dataSource.query(consulta, parametros) as Promise<T>;

  /** Código, restricción y detalle del error de PostgreSQL (no dependen del idioma). */
  const fallo = async (promesa: Promise<unknown>): Promise<ErrorDeBase> => {
    try {
      await promesa;
    } catch (e) {
      return (e as { driverError: ErrorDeBase }).driverError;
    }
    throw new Error('Se esperaba que la base rechazara la operación');
  };

  const persona = async (
    legajo: string,
    documento: string,
    extra: {
      nacimiento?: string;
      ingreso?: string;
      retiro?: string | null;
    } = {},
  ) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista, fecha_prevista_retiro)
         VALUES ($1, 'Pérez', 'Ana', $2, $3, $4, $5, $6) RETURNING id_persona AS id`,
        [
          legajo,
          documento,
          extra.nacimiento ?? '1980-01-01',
          extra.ingreso ?? '2005-03-01',
          revista,
          extra.retiro ?? null,
        ],
      )
    )[0].id;

  const ocupar = (
    idPersona: number,
    idPuesto: number,
    desde: string,
    hasta: string | null = null,
  ) =>
    sql(
      `INSERT INTO ocupacion (id_persona, id_puesto, fecha_desde, fecha_hasta, id_caracter_ocupacion, id_dedicacion)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [idPersona, idPuesto, desde, hasta, caracter, dedicacion],
    );

  const puesto = async (codigo: string, idUnidad: number) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
         SELECT $1, $1, $2, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
         RETURNING id_puesto AS id`,
        [codigo, idUnidad],
      )
    )[0].id;

  beforeAll(async () => {
    base = await crearBaseTemporal();
    revista = (
      await sql<{ id: number }[]>(
        `SELECT id_situacion_revista AS id FROM situacion_revista WHERE codigo = 'planta_permanente'`,
      )
    )[0].id;
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
    const [{ id: departamento }] = await sql<{ id: number }[]>(
      `SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
    );
    puestoA = await puesto('T-A', departamento);
    puestoB = await puesto('T-B', departamento);
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('carga los valores iniciales de los dominios nuevos', async () => {
    const revistas = await sql<{ codigo: string }[]>(
      'SELECT codigo FROM situacion_revista ORDER BY codigo',
    );
    expect(revistas.map((r) => r.codigo)).toEqual([
      'ad_honorem',
      'contratado',
      'licencia',
      'planta_permanente',
    ]);
    const dedicaciones = await sql<{ codigo: string; orden: number }[]>(
      'SELECT codigo, orden FROM dedicacion ORDER BY orden',
    );
    expect(dedicaciones.map((d) => [d.codigo, d.orden])).toEqual([
      ['simple', 1],
      ['semiexclusiva', 2],
      ['exclusiva', 3],
    ]);
  });

  describe('persona', () => {
    it('acepta una persona completa y una sin fecha de retiro', async () => {
      await persona('L-1', '30111111');
      await persona('L-2', '3011112', { retiro: '2040-12-31' });
    });

    it('rechaza un documento que no tiene 7 u 8 dígitos', async () => {
      // Los de más de 8 caracteres ni llegan al CHECK: la columna es varchar(8).
      for (const documento of ['123456', '3011A111', '30.1111']) {
        const error = await fallo(persona(`L-${documento}`, documento));
        expect(error).toMatchObject({
          code: '23514',
          constraint: 'CK_persona_documento',
        });
      }
    });

    it('rechaza legajo y documento repetidos', async () => {
      await persona('L-3', '30333333');
      const legajo = await fallo(persona('L-3', '30333334'));
      expect(legajo.code).toBe('23505');
      expect(legajo.detail).toContain('(legajo)');
      const documento = await fallo(persona('L-4', '30333333'));
      expect(documento.code).toBe('23505');
      expect(documento.detail).toContain('(documento)');
    });

    it('rechaza un ingreso que no es posterior al nacimiento', async () => {
      const error = await fallo(
        persona('L-5', '30555555', {
          nacimiento: '2000-01-01',
          ingreso: '2000-01-01',
        }),
      );
      expect(error.constraint).toBe(
        'CK_persona_ingreso_posterior_a_nacimiento',
      );
    });

    it('rechaza un retiro anterior al ingreso pero acepta el mismo día', async () => {
      const error = await fallo(
        persona('L-6', '30666666', {
          ingreso: '2010-05-01',
          retiro: '2010-04-30',
        }),
      );
      expect(error.constraint).toBe('CK_persona_retiro_desde_ingreso');
      await persona('L-7', '30777777', {
        ingreso: '2010-05-01',
        retiro: '2010-05-01',
      });
    });
  });

  describe('ocupacion', () => {
    it('rechaza una fecha de fin anterior a la de inicio', async () => {
      const id = await persona('O-1', '40111111');
      const error = await fallo(
        ocupar(id, puestoA, '2024-05-10', '2024-05-09'),
      );
      expect(error.constraint).toBe('CK_ocupacion_fechas');
    });

    it('rechaza el solape de la misma persona en el mismo puesto', async () => {
      const id = await persona('O-2', '40222222');
      await ocupar(id, puestoA, '2024-01-01', '2024-06-30');
      const error = await fallo(
        ocupar(id, puestoA, '2024-06-30', '2024-12-31'),
      );
      expect(error).toMatchObject({
        code: '23P01',
        constraint: 'EX_ocupacion_sin_solape',
      });
    });

    it('permite fechas adyacentes: se cierra un día y se abre al siguiente', async () => {
      const id = await persona('O-3', '40333333');
      await ocupar(id, puestoA, '2024-01-01', '2024-06-30');
      await ocupar(id, puestoA, '2024-07-01');
    });

    it('trata el fin nulo como abierto: solapa con cualquier ocupación posterior', async () => {
      const id = await persona('O-4', '40444444');
      await ocupar(id, puestoA, '2024-01-01');
      const error = await fallo(
        ocupar(id, puestoA, '2030-01-01', '2030-02-01'),
      );
      expect(error.code).toBe('23P01');
    });

    it('permite ocupaciones simultáneas en puestos distintos', async () => {
      const id = await persona('O-5', '40555555');
      await ocupar(id, puestoA, '2024-01-01');
      await ocupar(id, puestoB, '2024-01-01');
    });

    it('permite que otra persona ocupe el mismo puesto en las mismas fechas', async () => {
      const uno = await persona('O-6', '40666666');
      const otro = await persona('O-7', '40777777');
      await ocupar(uno, puestoA, '2024-01-01');
      await ocupar(otro, puestoA, '2024-01-01');
    });

    it('rechaza dos ocupaciones que empiezan el mismo día', async () => {
      const id = await persona('O-8', '40888888');
      await ocupar(id, puestoA, '2024-01-01', '2024-01-31');
      const error = await fallo(
        ocupar(id, puestoA, '2024-01-01', '2024-01-15'),
      );
      expect(['23505', '23P01']).toContain(error.code);
    });

    it('no permite borrar una persona ni un puesto con ocupaciones', async () => {
      const id = await persona('O-9', '40999999');
      await ocupar(id, puestoB, '2020-01-01', '2020-12-31');
      expect(
        (await fallo(sql('DELETE FROM persona WHERE id_persona = $1', [id])))
          .code,
      ).toBe('23503');
      expect(
        (await fallo(sql('DELETE FROM puesto WHERE id_puesto = $1', [puestoB])))
          .code,
      ).toBe('23503');
    });
  });
});
