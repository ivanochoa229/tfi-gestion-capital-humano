import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { COLUMNAS } from './tipos.js';
import { ImportacionService } from './importacion.service.js';

const CABECERA = COLUMNAS.join(';');
const fila = (v: Partial<Record<(typeof COLUMNAS)[number], string>>) =>
  COLUMNAS.map((c) => v[c] ?? '').join(';');
const csv = (...lineas: string[]) =>
  Buffer.from([CABECERA, ...lineas].join('\n'), 'utf8');

const persona = (legajo: string, extra = {}) => ({
  legajo,
  apellido: 'Pérez',
  nombre: 'Ana',
  documento: `3011${legajo.replace(/\D/g, '').padStart(4, '0')}`,
  fecha_nacimiento: '1980-05-20',
  fecha_ingreso: '2005-03-01',
  situacion_revista: 'Planta permanente',
  unidad: 'Cátedra de Física',
  puesto: 'Titular',
  fecha_desde: '2020-03-01',
  caracter: 'Titular',
  dedicacion: 'Simple',
  ...extra,
});

function crearServicio() {
  const manager: {
    query: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  } = {
    query: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(async (trabajo: (m: unknown) => unknown) =>
      trabajo(manager),
    ),
  };
  const personasRepo = { manager };
  const unidades = {
    find: vi.fn().mockResolvedValue([
      {
        id: 1,
        denominacion: 'Cátedra de Física',
        idUnidadSuperior: null,
        activo: true,
      },
    ]),
  };
  const puestos = {
    find: vi.fn().mockResolvedValue([
      { id: 10, denominacion: 'Titular', idUnidad: 1 },
      { id: 11, denominacion: 'Jefe', idUnidad: 1 },
    ]),
  };
  const valores: Record<string, { id: number; denominacion: string }[]> = {
    'situacion-revista': [{ id: 1, denominacion: 'Planta permanente' }],
    'caracter-ocupacion': [{ id: 1, denominacion: 'Titular' }],
    dedicacion: [{ id: 1, denominacion: 'Simple' }],
  };
  const referencia = {
    listarValores: vi.fn(async (slug: string) => valores[slug]),
  };
  let siguienteId = 100;
  const personas = {
    validarAlta: vi.fn().mockResolvedValue(undefined),
    crearCon: vi.fn(async () => siguienteId++),
  };
  const ocupaciones = {
    validarAlta: vi.fn().mockResolvedValue(undefined),
    crearCon: vi.fn().mockResolvedValue({}),
  };
  const servicio = new ImportacionService(
    personasRepo as never,
    unidades as never,
    puestos as never,
    referencia as never,
    personas as never,
    ocupaciones as never,
  );
  return { servicio, manager, personas, ocupaciones, referencia };
}

describe('ImportacionService.importar', () => {
  afterEach(() => vi.restoreAllMocks());

  it('vista previa: cuenta lo que se crearía, no confirma', async () => {
    const { servicio, personas, ocupaciones } = crearServicio();
    const r = await servicio.importar(
      csv(
        fila(persona('L-1')),
        fila(persona('L-1', { puesto: 'Jefe', fecha_desde: '2021-03-01' })),
        fila(persona('L-2')),
      ),
      false,
    );
    expect(r).toEqual({
      importado: false,
      filas: 3,
      personas: 2,
      ocupaciones: 3,
      errores: [],
    });
    expect(personas.crearCon).toHaveBeenCalledTimes(2);
    expect(ocupaciones.crearCon).toHaveBeenCalledTimes(3);
  });

  it('confirmar sin errores: el resultado informa importado = true', async () => {
    const { servicio } = crearServicio();
    const r = await servicio.importar(csv(fila(persona('L-1'))), true);
    expect(r.importado).toBe(true);
    expect(r.errores).toEqual([]);
  });

  it('toma el bloqueo de estructura una sola vez', async () => {
    const { servicio, manager } = crearServicio();
    await servicio.importar(
      csv(fila(persona('L-1')), fila(persona('L-2'))),
      true,
    );
    const bloqueos = manager.query.mock.calls.filter(([sql]) =>
      String(sql).includes('pg_advisory_xact_lock'),
    );
    expect(bloqueos).toHaveLength(1);
  });

  it('junta los errores de varias filas y no confirma aunque se pida', async () => {
    const { servicio, personas } = crearServicio();
    personas.crearCon
      .mockRejectedValueOnce(
        new ConflictException('El legajo L-1 ya lo tiene Gómez, Ana'),
      )
      .mockResolvedValue(101);
    const r = await servicio.importar(
      csv(
        fila(persona('L-1')),
        fila(persona('L-2', { unidad: 'Cátedra de Arte' })),
        fila(persona('L-3')),
      ),
      true,
    );
    expect(r.importado).toBe(false);
    expect(r.errores.map((e) => e.fila)).toEqual([2, 3]);
    expect(r.errores[0].mensaje).toMatch(/L-1 ya lo tiene/);
    expect(r.errores[1]).toMatchObject({ columna: 'puesto' });
    expect(r.errores[1].mensaje).toMatch(/Cátedra de Arte/);
  });

  it('si la persona falla, se omiten sus ocupaciones', async () => {
    const { servicio, personas, ocupaciones } = crearServicio();
    personas.crearCon.mockRejectedValueOnce(
      new ConflictException(
        'El documento 30110001 ya lo tiene Gómez, Ana (legajo L-9)',
      ),
    );
    const r = await servicio.importar(csv(fila(persona('L-1'))), false);
    expect(ocupaciones.crearCon).not.toHaveBeenCalled();
    expect(r.ocupaciones).toBe(0);
    expect(r.errores).toHaveLength(1);
  });

  it('un solape que rechaza el ABM se reporta con su fila y el resto sigue', async () => {
    const { servicio, ocupaciones } = crearServicio();
    ocupaciones.crearCon
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(
        new ConflictException(
          'La persona ya ocupa ese puesto desde 2020-03-01, sin fecha de fin: las fechas no pueden superponerse',
        ),
      )
      .mockResolvedValue({});
    const r = await servicio.importar(
      csv(
        fila(persona('L-1')),
        fila(persona('L-1', { fecha_desde: '2021-01-01' })),
        fila(persona('L-1', { puesto: 'Jefe' })),
      ),
      true,
    );
    expect(r.importado).toBe(false);
    expect(r.errores.map((e) => e.fila)).toEqual([3]);
    expect(r.ocupaciones).toBe(2);
  });

  it('un error inesperado (no HTTP) no se reporta como error de fila: la importación falla', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { servicio, personas } = crearServicio();
    personas.crearCon.mockRejectedValueOnce(new Error('conexión caída'));
    await expect(
      servicio.importar(csv(fila(persona('L-1'))), true),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  const errorDeBase = (code: string, detail: string) =>
    new QueryFailedError(
      'INSERT INTO persona ...',
      [],
      Object.assign(new Error('dup'), { code, detail }),
    );

  it('un error de base traducible (documento duplicado) es error de fila y sigue con la próxima persona', async () => {
    const { servicio, personas } = crearServicio();
    personas.crearCon
      .mockRejectedValueOnce(
        errorDeBase('23505', 'Key (documento)=(30110001) already exists.'),
      )
      .mockResolvedValue(101);
    const r = await servicio.importar(
      csv(fila(persona('L-1')), fila(persona('L-2'))),
      true,
    );
    expect(r.importado).toBe(false);
    expect(r.errores).toEqual([
      { fila: 2, mensaje: 'Ya existe una persona con ese documento' },
    ]);
    expect(r.personas).toBe(1);
    expect(personas.crearCon).toHaveBeenCalledTimes(2);
  });

  it('un solape detectado por la base (23P01) es error de fila', async () => {
    const { servicio, ocupaciones } = crearServicio();
    ocupaciones.crearCon.mockRejectedValueOnce(
      errorDeBase('23P01', 'Key conflicts with existing key'),
    );
    const r = await servicio.importar(csv(fila(persona('L-1'))), true);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0].fila).toBe(2);
    expect(r.errores[0].mensaje).toMatch(/ya ocupa ese puesto/);
  });

  describe('errores inesperados', () => {
    it.each([
      ['Error genérico', () => new Error('conexión caída L-SECRETO')],
      [
        'QueryFailedError 23514',
        () => errorDeBase('23514', 'Key (legajo)=(L-SECRETO) viola el CHECK'),
      ],
    ])('%s: 500 genérico y sin datos en el log', async (_n, crear) => {
      const registro = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const { servicio, personas } = crearServicio();
      personas.crearCon.mockRejectedValueOnce(crear());
      const promesa = servicio.importar(csv(fila(persona('L-1'))), true);
      await expect(promesa).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      await promesa.catch((e: Error) => {
        expect(e.message).not.toMatch(/SECRETO|conexión|legajo/);
      });
      const registrado = JSON.stringify(registro.mock.calls);
      expect(registrado).not.toMatch(/SECRETO|conexión|legajo|INSERT/);
      expect(registro).toHaveBeenCalledTimes(1);
    });

    it('el log del QueryFailedError incluye la clase y el SQLSTATE', async () => {
      const registro = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const { servicio, personas } = crearServicio();
      personas.crearCon.mockRejectedValueOnce(errorDeBase('23514', 'x'));
      await servicio.importar(csv(fila(persona('L-1'))), true).catch(() => {});
      expect(String(registro.mock.calls[0][0])).toMatch(
        /QueryFailedError.*23514/,
      );
    });

    it('una excepción HTTP fuera de las filas (CSV vacío) se propaga como 400', async () => {
      const { servicio } = crearServicio();
      await expect(
        servicio.importar(Buffer.from(''), true),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('errores de forma y de referencia no abren la transacción si no queda nada válido', async () => {
    const { servicio, manager } = crearServicio();
    const r = await servicio.importar(
      csv(fila(persona('L-1', { situacion_revista: 'Jubilado' }))),
      true,
    );
    expect(r.importado).toBe(false);
    expect(r.errores[0]).toMatchObject({
      fila: 2,
      columna: 'situacion_revista',
    });
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('ordena los errores por fila', async () => {
    const { servicio } = crearServicio();
    const r = await servicio.importar(
      csv(
        fila(persona('L-1', { dedicacion: 'Mágica' })),
        fila(persona('L-2', { legajo: '' })),
      ),
      false,
    );
    const filas = r.errores.map((e) => e.fila);
    expect(filas).toEqual([...filas].sort((a, b) => a - b));
  });
});
