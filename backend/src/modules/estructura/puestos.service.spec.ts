import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FindOperator, type Repository } from 'typeorm';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import { Ocupacion } from '../personas/entities/ocupacion.entity.js';
import type { Puesto } from './entities/puesto.entity.js';
import type { JerarquiaService } from './jerarquia.service.js';
import { escaparLike, PuestosService } from './puestos.service.js';
import type { UnidadesService } from './unidades.service.js';

function puesto(parcial: Partial<Puesto> = {}): Puesto {
  return {
    id: 1,
    codigo: 'P-0001',
    denominacion: 'Jefe de cátedra',
    proposito: null,
    condicionesTrabajo: null,
    rangoRetributivo: null,
    dotacionPrevista: 1,
    idUnidad: 10,
    idNivelJerarquico: 2,
    idTipoRelacionContractual: null,
    idPuestoSuperior: null,
    activo: true,
    ...parcial,
  } as Puesto;
}

interface Config {
  /** Unidades que devuelve `unidadesHastaRaiz`: la del puesto y sus ancestras. */
  ascendentes?: number[];
  /** Cadena de superiores por id de puesto (incluye el propio id). */
  cadenas?: Record<number, number[]>;
  /** Ocupaciones de los puestos, para la baja. */
  ocupaciones?: Partial<Ocupacion>[];
  /** "Hoy" de la base (por defecto 2026-06-15). */
  hoy?: string;
}

function crearEntorno(existentes: Puesto[], config: Config = {}) {
  const filas = existentes.map((p) => ({ ...p }));
  let proximoId = 100;
  let secuencia = 0;

  const coincide = (p: Puesto, donde: unknown): boolean =>
    Array.isArray(donde)
      ? donde.some((d) => coincide(p, d))
      : Object.entries(donde as Record<string, unknown>).every(
          ([clave, valor]) =>
            valor instanceof FindOperator || p[clave as keyof Puesto] === valor,
        );

  const repo = {
    find: vi.fn(async ({ where }: { where: unknown }) =>
      filas.filter((p) => coincide(p, where)).map((p) => ({ ...p })),
    ),
    findOne: vi.fn(async ({ where }: { where: unknown }) => {
      const fila = filas.find((p) => coincide(p, where));
      return fila ? { ...fila } : null;
    }),
    create: vi.fn((datos: Partial<Puesto>) => ({ ...datos })),
    save: vi.fn(async (p: Partial<Puesto>) => {
      if (p.id === undefined) {
        const nuevo = { ...p, id: proximoId++ } as Puesto;
        filas.push(nuevo);
        return { ...nuevo };
      }
      const i = filas.findIndex((f) => f.id === p.id);
      filas[i] = { ...(p as Puesto) };
      return { ...(p as Puesto) };
    }),
  };
  const repoOcupaciones = {
    find: vi.fn(async ({ where }: { where: { idPuesto?: number } }) =>
      (config.ocupaciones ?? [])
        .filter((o) => o.idPuesto === where.idPuesto)
        .map((o) => ({ ...o })),
    ),
  };
  const consultas: string[] = [];
  const manager = {
    query: vi.fn(async (sql: string) => {
      consultas.push(sql);
      if (sql.includes('CURRENT_DATE'))
        return [{ hoy: config.hoy ?? '2026-06-15' }];
      return sql.includes('nextval') ? [{ n: String(++secuencia) }] : [];
    }),
    getRepository: (entidad: unknown) =>
      entidad === Ocupacion ? repoOcupaciones : repo,
    transaction: async (trabajo: (m: unknown) => Promise<unknown>) =>
      trabajo(manager),
  };
  (repo as unknown as { manager: unknown }).manager = manager;

  const unidades = {
    exigirActiva: vi.fn(async (id: number) => ({ id, activo: true })),
    obtener: vi.fn(async (id: number) => ({ id, activo: true })),
  };
  const jerarquia = {
    unidadesHastaRaiz: vi.fn(async () => config.ascendentes ?? [10]),
    cadenaDeSuperiores: vi.fn(
      async (id: number) => config.cadenas?.[id] ?? [id],
    ),
  };
  const referencia = { validarActivo: vi.fn(async () => undefined) };

  const servicio = new PuestosService(
    repo as unknown as Repository<Puesto>,
    unidades as unknown as UnidadesService,
    jerarquia as unknown as JerarquiaService,
    referencia as unknown as ReferenciaService,
  );
  return { servicio, repo, consultas, unidades, jerarquia, referencia, filas };
}

const alta = {
  denominacion: 'Auxiliar de TP',
  idUnidad: 10,
  idNivelJerarquico: 4,
};

describe('PuestosService.crear', () => {
  it('genera el código con la secuencia y valida unidad y nivel', async () => {
    const { servicio, unidades, referencia } = crearEntorno([]);
    const creado = await servicio.crear(alta);
    expect(creado).toMatchObject({
      codigo: 'P-0001',
      denominacion: 'Auxiliar de TP',
      dotacionPrevista: 1,
      idPuestoSuperior: null,
      activo: true,
      subordinados: [],
    });
    expect(unidades.exigirActiva).toHaveBeenCalledWith(10);
    expect(referencia.validarActivo).toHaveBeenCalledWith(
      'nivel-jerarquico',
      4,
    );
  });

  it('toma el bloqueo consultivo de estructura', async () => {
    const { servicio, consultas } = crearEntorno([]);
    await servicio.crear(alta);
    expect(consultas[0]).toContain('pg_advisory_xact_lock');
  });

  it('valida el tipo de relación contractual solo si viene', async () => {
    const { servicio, referencia } = crearEntorno([]);
    await servicio.crear(alta);
    expect(referencia.validarActivo).toHaveBeenCalledTimes(1);
    await servicio.crear({
      ...alta,
      denominacion: 'Otro',
      idTipoRelacionContractual: 2,
    });
    expect(referencia.validarActivo).toHaveBeenCalledWith(
      'tipo-relacion-contractual',
      2,
    );
  });

  it('acepta un superior de la misma unidad', async () => {
    const { servicio } = crearEntorno([puesto({ id: 5, idUnidad: 10 })]);
    const creado = await servicio.crear({ ...alta, idPuestoSuperior: 5 });
    expect(creado.idPuestoSuperior).toBe(5);
    expect(creado.superior).toMatchObject({ id: 5 });
  });

  it('acepta un superior de una unidad ancestra', async () => {
    const { servicio } = crearEntorno([puesto({ id: 5, idUnidad: 1 })], {
      ascendentes: [10, 1],
    });
    await expect(
      servicio.crear({ ...alta, idPuestoSuperior: 5 }),
    ).resolves.toMatchObject({ idPuestoSuperior: 5 });
  });

  it('rechaza un superior de una unidad que no es la misma ni una ancestra', async () => {
    const { servicio } = crearEntorno([puesto({ id: 5, idUnidad: 20 })], {
      ascendentes: [10, 1],
    });
    await expect(
      servicio.crear({ ...alta, idPuestoSuperior: 5 }),
    ).rejects.toThrow(/misma unidad o en una unidad superior/);
  });

  it('rechaza un superior inexistente o dado de baja', async () => {
    const { servicio } = crearEntorno([puesto({ id: 5, activo: false })]);
    await expect(
      servicio.crear({ ...alta, idPuestoSuperior: 5 }),
    ).rejects.toThrow(/dado de baja/);
    await expect(
      servicio.crear({ ...alta, idPuestoSuperior: 77 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza una denominación repetida en la unidad, sin distinguir mayúsculas ni espacios', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 5, denominacion: 'Auxiliar de TP' }),
    ]);
    await expect(
      servicio.crear({ ...alta, denominacion: '  auxiliar DE tp ' }),
    ).rejects.toThrow(ConflictException);
  });

  it('permite la misma denominación si el otro puesto está dado de baja', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 5, denominacion: 'Auxiliar de TP', activo: false }),
    ]);
    await expect(servicio.crear(alta)).resolves.toMatchObject({
      codigo: 'P-0001',
    });
  });
});

describe('PuestosService.actualizar', () => {
  it('modifica los campos enviados y deja el resto', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 1, rangoRetributivo: 'Cat. 5' }),
    ]);
    const actualizado = await servicio.actualizar(1, {
      proposito: 'Conducir la cátedra',
      dotacionPrevista: 2,
    });
    expect(actualizado).toMatchObject({
      proposito: 'Conducir la cátedra',
      dotacionPrevista: 2,
      rangoRetributivo: 'Cat. 5',
      codigo: 'P-0001',
    });
  });

  it('responde 404 si el puesto no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(servicio.actualizar(9, { proposito: 'x' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('no revalida el superior si no cambia', async () => {
    const { servicio, jerarquia } = crearEntorno([
      puesto({ id: 1, idPuestoSuperior: 5 }),
      puesto({ id: 5, codigo: 'P-0005', denominacion: 'Jefe' }),
    ]);
    await servicio.actualizar(1, { idPuestoSuperior: 5, proposito: 'x' });
    expect(jerarquia.cadenaDeSuperiores).not.toHaveBeenCalled();
  });

  it('rechaza que el puesto sea su propio superior', async () => {
    const { servicio } = crearEntorno([puesto({ id: 1 })]);
    await expect(
      servicio.actualizar(1, { idPuestoSuperior: 1 }),
    ).rejects.toThrow(/propio superior/);
  });

  it('rechaza un ciclo indirecto: el superior elegido depende del puesto', async () => {
    // 1 es superior de 2 y 2 de 3; se intenta que 3 sea superior de 1.
    const { servicio } = crearEntorno(
      [
        puesto({ id: 1, codigo: 'P-0001', denominacion: 'A' }),
        puesto({
          id: 2,
          codigo: 'P-0002',
          denominacion: 'B',
          idPuestoSuperior: 1,
        }),
        puesto({
          id: 3,
          codigo: 'P-0003',
          denominacion: 'C',
          idPuestoSuperior: 2,
        }),
      ],
      { cadenas: { 3: [3, 2, 1] } },
    );
    await expect(
      servicio.actualizar(1, { idPuestoSuperior: 3 }),
    ).rejects.toThrow(/ciclo/);
  });

  it('permite quitar el superior con null', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 1, idPuestoSuperior: 5 }),
      puesto({ id: 5, codigo: 'P-0005', denominacion: 'Jefe' }),
    ]);
    const actualizado = await servicio.actualizar(1, {
      idPuestoSuperior: null,
    });
    expect(actualizado.idPuestoSuperior).toBeNull();
    expect(actualizado.superior).toBeNull();
  });

  it('rechaza null en un campo obligatorio sin modificar nada', async () => {
    const { servicio, repo } = crearEntorno([puesto({ id: 1 })]);
    await expect(
      servicio.actualizar(1, { denominacion: null as unknown as string }),
    ).rejects.toThrow(/no admite null/);
    await expect(
      servicio.actualizar(1, { idNivelJerarquico: null as unknown as number }),
    ).rejects.toThrow(/no admite null/);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('revalida nivel y tipo contractual solo si cambian', async () => {
    const { servicio, referencia } = crearEntorno([
      puesto({ id: 1, idNivelJerarquico: 2 }),
    ]);
    await servicio.actualizar(1, { idNivelJerarquico: 2, proposito: 'x' });
    expect(referencia.validarActivo).not.toHaveBeenCalled();
    await servicio.actualizar(1, { idNivelJerarquico: 3 });
    expect(referencia.validarActivo).toHaveBeenCalledWith(
      'nivel-jerarquico',
      3,
    );
  });

  it('rechaza renombrar a una denominación que ya usa otro puesto activo de la unidad', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 1, denominacion: 'A' }),
      puesto({ id: 2, codigo: 'P-0002', denominacion: 'B' }),
    ]);
    await expect(servicio.actualizar(1, { denominacion: 'b' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('permite conservar la propia denominación con otras mayúsculas', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 1, denominacion: 'Jefe' }),
    ]);
    await expect(
      servicio.actualizar(1, { denominacion: 'JEFE' }),
    ).resolves.toMatchObject({ denominacion: 'JEFE' });
  });
});

describe('PuestosService.listar', () => {
  it('filtra por unidad y estado', async () => {
    const { servicio, repo } = crearEntorno([]);
    await servicio.listar({ idUnidad: 10, activo: true });
    expect(repo.find).toHaveBeenCalledWith({
      where: { idUnidad: 10, activo: true },
      order: { codigo: 'ASC' },
    });
  });

  it('busca el texto en código o denominación con ILIKE', async () => {
    const { servicio, repo } = crearEntorno([]);
    await servicio.listar({ q: ' jefe ' });
    const { where } = repo.find.mock.calls[0][0] as {
      where: Record<string, unknown>[];
    };
    expect(where).toHaveLength(2);
    expect((where[0].codigo as FindOperator<string>).value).toBe('%jefe%');
    expect((where[1].denominacion as FindOperator<string>).value).toBe(
      '%jefe%',
    );
  });

  it('escapa % y _ para que no actúen como comodines', async () => {
    expect(escaparLike('50%_\\')).toBe('50\\%\\_\\\\');
    const { servicio, repo } = crearEntorno([]);
    await servicio.listar({ q: '%' });
    const { where } = repo.find.mock.calls[0][0] as {
      where: Record<string, unknown>[];
    };
    expect((where[0].codigo as FindOperator<string>).value).toBe('%\\%%');
  });
});

describe('PuestosService.obtener', () => {
  it('devuelve el superior y los subordinados directos', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 1, codigo: 'P-0001', denominacion: 'Jefe' }),
      puesto({
        id: 2,
        codigo: 'P-0002',
        denominacion: 'JTP',
        idPuestoSuperior: 1,
      }),
      puesto({
        id: 3,
        codigo: 'P-0003',
        denominacion: 'ATP',
        idPuestoSuperior: 2,
      }),
    ]);
    const detalle = await servicio.obtener(2);
    expect(detalle.superior).toMatchObject({ id: 1, codigo: 'P-0001' });
    expect(detalle.subordinados.map((s) => s.id)).toEqual([3]);
  });

  it('responde 404 si no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(servicio.obtener(9)).rejects.toThrow(NotFoundException);
  });
});

describe('PuestosService.darDeBaja', () => {
  it('desactiva el puesto y lo devuelve', async () => {
    const { servicio, filas } = crearEntorno([puesto({ id: 1 })]);
    const detalle = await servicio.darDeBaja(1);
    expect(detalle.activo).toBe(false);
    expect(filas[0].activo).toBe(false);
  });

  it('rechaza con 409 si tiene subordinados activos y los lista', async () => {
    const { servicio, filas } = crearEntorno([
      puesto({ id: 1, codigo: 'P-0001', denominacion: 'Jefe' }),
      puesto({
        id: 2,
        codigo: 'P-0002',
        denominacion: 'JTP',
        idPuestoSuperior: 1,
      }),
      puesto({
        id: 3,
        codigo: 'P-0003',
        denominacion: 'ATP',
        idPuestoSuperior: 1,
        activo: false,
      }),
    ]);
    const error = await servicio.darDeBaja(1).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toContain('P-0002 JTP');
    expect((error as Error).message).not.toContain('P-0003');
    expect(filas[0].activo).toBe(true);
  });

  it('es idempotente con un puesto ya dado de baja', async () => {
    const { servicio, repo } = crearEntorno([puesto({ id: 1, activo: false })]);
    await expect(servicio.darDeBaja(1)).resolves.toMatchObject({
      activo: false,
    });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('responde 404 si no existe y toma el bloqueo consultivo', async () => {
    const { servicio, consultas } = crearEntorno([]);
    await expect(servicio.darDeBaja(9)).rejects.toThrow(NotFoundException);
    expect(consultas[0]).toContain('pg_advisory_xact_lock');
  });

  const ocupante = (parcial: Partial<Ocupacion> = {}): Partial<Ocupacion> => ({
    idPuesto: 1,
    idPersona: 7,
    fechaDesde: '2025-01-01',
    fechaHasta: null,
    persona: { apellido: 'Pérez', nombre: 'Ana' } as never,
    ...parcial,
  });

  it.each([
    ['vigente sin fin', {}],
    ['que vence hoy', { fechaHasta: '2026-06-15' }],
    ['futura', { fechaDesde: '2026-09-01' }],
  ])(
    'rechaza con 409 si tiene una ocupación %s y nombra a la persona',
    async (_t, parcial) => {
      const { servicio, filas } = crearEntorno([puesto({ id: 1 })], {
        ocupaciones: [ocupante(parcial)],
      });
      const error = await servicio.darDeBaja(1).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as Error).message).toContain('Pérez, Ana');
      expect(filas[0].activo).toBe(true);
    },
  );

  it('no se bloquea por una ocupación que terminó ayer', async () => {
    const { servicio, filas } = crearEntorno([puesto({ id: 1 })], {
      ocupaciones: [ocupante({ fechaHasta: '2026-06-14' })],
    });
    await servicio.darDeBaja(1);
    expect(filas[0].activo).toBe(false);
  });
});

describe('PuestosService.reactivar', () => {
  it('reactiva un puesto dado de baja', async () => {
    const { servicio } = crearEntorno([puesto({ id: 1, activo: false })]);
    await expect(servicio.reactivar(1)).resolves.toMatchObject({
      activo: true,
    });
  });

  it('rechaza con 409 si la unidad está inactiva', async () => {
    const { servicio, unidades } = crearEntorno([
      puesto({ id: 1, activo: false }),
    ]);
    unidades.obtener.mockResolvedValueOnce({ id: 10, activo: false });
    await expect(servicio.reactivar(1)).rejects.toThrow(/unidad.*inactiva/);
  });

  it('rechaza con 409 si el superior está dado de baja', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 1, activo: false, idPuestoSuperior: 5 }),
      puesto({ id: 5, codigo: 'P-0005', denominacion: 'Jefe', activo: false }),
    ]);
    await expect(servicio.reactivar(1)).rejects.toThrow(ConflictException);
  });

  it('rechaza con 409 si otro puesto activo ya usa la denominación', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 1, denominacion: 'Auxiliar', activo: false }),
      puesto({ id: 2, codigo: 'P-0002', denominacion: 'auxiliar' }),
    ]);
    await expect(servicio.reactivar(1)).rejects.toThrow(ConflictException);
  });

  it('es idempotente con un puesto ya activo', async () => {
    const { servicio, repo } = crearEntorno([puesto({ id: 1 })]);
    await expect(servicio.reactivar(1)).resolves.toMatchObject({
      activo: true,
    });
    expect(repo.save).not.toHaveBeenCalled();
  });
});
