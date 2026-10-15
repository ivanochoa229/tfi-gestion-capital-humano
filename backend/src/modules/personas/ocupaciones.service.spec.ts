import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { Puesto } from '../estructura/entities/puesto.entity.js';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { Ocupacion } from './entities/ocupacion.entity.js';
import type { Persona } from './entities/persona.entity.js';
import { OcupacionesService } from './ocupaciones.service.js';

const HOY = '2026-06-15';

const ocupacion = (parcial: Partial<Ocupacion> = {}): Ocupacion =>
  ({
    idPersona: 1,
    idPuesto: 10,
    fechaDesde: '2024-01-01',
    fechaHasta: null,
    idCaracterOcupacion: 1,
    idDedicacion: 1,
    ...parcial,
  }) as Ocupacion;

const sesion = (
  rol: SesionUsuario['rol'],
  idPersona: number | null = null,
): SesionUsuario => ({
  id: 1,
  nombreUsuario: 'u',
  rol,
  idPersona,
  unidades: [],
});

interface Config {
  personas?: Partial<Persona>[];
  puestos?: Partial<Puesto>[];
}

function crearEntorno(existentes: Ocupacion[], config: Config = {}) {
  const filas = existentes.map((o) => ({ ...o }));
  const personas = config.personas ?? [
    { id: 1, activo: true, apellido: 'Pérez', nombre: 'Ana', legajo: 'L-1' },
  ];
  const puestos = config.puestos ?? [
    { id: 10, codigo: 'P-0010', activo: true },
    { id: 11, codigo: 'P-0011', activo: true },
  ];

  const mismaClave = (o: Ocupacion, k: Partial<Ocupacion>) =>
    o.idPersona === k.idPersona &&
    o.idPuesto === k.idPuesto &&
    o.fechaDesde === k.fechaDesde;

  const repoOcupaciones = {
    find: vi.fn(async ({ where }: { where: Partial<Ocupacion> }) =>
      filas
        .filter((o) =>
          Object.entries(where).every(
            ([k, v]) => o[k as keyof Ocupacion] === v,
          ),
        )
        .map((o) => ({
          ...o,
          persona: personas.find((p) => p.id === o.idPersona),
        })),
    ),
    findOne: vi.fn(async ({ where }: { where: Partial<Ocupacion> }) => {
      const fila = filas.find((o) => mismaClave(o, where));
      return fila ? { ...fila } : null;
    }),
    create: vi.fn((datos: Partial<Ocupacion>) => ({ ...datos })),
    save: vi.fn(async (o: Ocupacion) => {
      const i = filas.findIndex((f) => mismaClave(f, o));
      if (i >= 0) filas[i] = { ...o };
      else filas.push({ ...o });
      return { ...o };
    }),
    delete: vi.fn(async (k: Partial<Ocupacion>) => {
      const i = filas.findIndex((f) => mismaClave(f, k));
      if (i >= 0) filas.splice(i, 1);
    }),
  };
  const repoPersonas = {
    findOne: vi.fn(async ({ where }: { where: { id: number } }) => {
      const p = personas.find((x) => x.id === where.id);
      return p ? { ...p } : null;
    }),
  };
  const repoPuestos = {
    findOne: vi.fn(async ({ where }: { where: { id: number } }) => {
      const p = puestos.find((x) => x.id === where.id);
      return p ? { ...p } : null;
    }),
  };
  const consultas: string[] = [];
  const manager = {
    query: vi.fn(async (sql: string) => {
      consultas.push(sql);
      return sql.includes('CURRENT_DATE') ? [{ hoy: HOY }] : [];
    }),
    getRepository: (entidad: { name: string }) =>
      entidad.name === 'Ocupacion'
        ? repoOcupaciones
        : entidad.name === 'Persona'
          ? repoPersonas
          : repoPuestos,
    transaction: async (trabajo: (m: unknown) => Promise<unknown>) =>
      trabajo(manager),
  };
  (repoOcupaciones as unknown as { manager: unknown }).manager = manager;

  const referencia = { validarActivo: vi.fn(async () => undefined) };
  const servicio = new OcupacionesService(
    repoOcupaciones as unknown as Repository<Ocupacion>,
    repoPersonas as unknown as Repository<Persona>,
    repoPuestos as unknown as Repository<Puesto>,
    referencia as unknown as ReferenciaService,
  );
  return { servicio, repoOcupaciones, referencia, filas, consultas };
}

const alta = {
  idPuesto: 10,
  fechaDesde: '2024-01-01',
  idCaracterOcupacion: 1,
  idDedicacion: 2,
};

describe('OcupacionesService.crear', () => {
  it('crea la ocupación, valida carácter y dedicación y toma el bloqueo', async () => {
    const { servicio, referencia, consultas, filas } = crearEntorno([]);
    const creada = await servicio.crear(1, alta);
    expect(creada).toEqual({
      idPersona: 1,
      idPuesto: 10,
      fechaDesde: '2024-01-01',
      fechaHasta: null,
      idCaracterOcupacion: 1,
      idDedicacion: 2,
      estado: 'vigente',
    });
    expect(filas).toHaveLength(1);
    expect(referencia.validarActivo).toHaveBeenCalledWith(
      'caracter-ocupacion',
      1,
    );
    expect(referencia.validarActivo).toHaveBeenCalledWith('dedicacion', 2);
    expect(consultas[0]).toContain('pg_advisory_xact_lock');
  });

  it('rechaza con 400 una fecha de fin anterior a la de inicio, sin tocar la base', async () => {
    const { servicio, filas } = crearEntorno([]);
    await expect(
      servicio.crear(1, { ...alta, fechaHasta: '2023-12-31' }),
    ).rejects.toThrow(BadRequestException);
    expect(filas).toHaveLength(0);
  });

  it('acepta una ocupación ya terminada (carga de historial) con estado pasada', async () => {
    const { servicio } = crearEntorno([]);
    const creada = await servicio.crear(1, {
      ...alta,
      fechaDesde: '2020-01-01',
      fechaHasta: '2020-12-31',
    });
    expect(creada.estado).toBe('pasada');
  });

  it('rechaza con 409 un solape en el mismo puesto y nombra el período', async () => {
    const { servicio, filas } = crearEntorno([
      ocupacion({ fechaDesde: '2024-01-01', fechaHasta: '2024-06-30' }),
    ]);
    const error = await servicio
      .crear(1, { ...alta, fechaDesde: '2024-06-30', fechaHasta: '2024-12-31' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toContain('2024-01-01');
    expect(filas).toHaveLength(1);
  });

  it('permite fechas adyacentes y ocupaciones simultáneas en otro puesto', async () => {
    const { servicio, filas } = crearEntorno([
      ocupacion({ fechaDesde: '2024-01-01', fechaHasta: '2024-06-30' }),
    ]);
    await servicio.crear(1, { ...alta, fechaDesde: '2024-07-01' });
    await servicio.crear(1, {
      ...alta,
      idPuesto: 11,
      fechaDesde: '2024-01-01',
    });
    expect(filas).toHaveLength(3);
  });

  it('rechaza con 400 una persona dada de baja o un puesto dado de baja', async () => {
    const baja = crearEntorno([], {
      personas: [{ id: 1, activo: false, apellido: 'P', nombre: 'A' }],
    });
    await expect(baja.servicio.crear(1, alta)).rejects.toThrow(/dada de baja/);
    const puestoBaja = crearEntorno([], {
      puestos: [{ id: 10, codigo: 'P-0010', activo: false }],
    });
    await expect(puestoBaja.servicio.crear(1, alta)).rejects.toThrow(/P-0010/);
  });

  it('responde 404 si la persona no existe y 400 si el puesto no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(servicio.crear(9, alta)).rejects.toThrow(NotFoundException);
    await expect(servicio.crear(1, { ...alta, idPuesto: 99 })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('OcupacionesService.actualizar', () => {
  it('modifica carácter y dedicación de una ocupación vigente', async () => {
    const { servicio, referencia } = crearEntorno([ocupacion()]);
    const actualizada = await servicio.actualizar(1, 10, '2024-01-01', {
      idCaracterOcupacion: 2,
      idDedicacion: 3,
    });
    expect(actualizada).toMatchObject({
      idCaracterOcupacion: 2,
      idDedicacion: 3,
    });
    expect(referencia.validarActivo).toHaveBeenCalledTimes(2);
  });

  it('no valida de nuevo los valores que no cambian', async () => {
    const { servicio, referencia } = crearEntorno([ocupacion()]);
    await servicio.actualizar(1, 10, '2024-01-01', { idCaracterOcupacion: 1 });
    expect(referencia.validarActivo).not.toHaveBeenCalled();
  });

  it('rechaza con 409 modificar una ocupación pasada', async () => {
    const { servicio } = crearEntorno([
      ocupacion({ fechaHasta: '2026-06-14' }),
    ]);
    await expect(
      servicio.actualizar(1, 10, '2024-01-01', { idDedicacion: 2 }),
    ).rejects.toThrow(/historial/);
  });

  it('modifica una ocupación que vence hoy', async () => {
    const { servicio } = crearEntorno([ocupacion({ fechaHasta: HOY })]);
    await expect(
      servicio.actualizar(1, 10, '2024-01-01', { idDedicacion: 2 }),
    ).resolves.toMatchObject({ idDedicacion: 2 });
  });

  it('rechaza con 400 un fin anterior al inicio y con 409 un fin que provoca solape', async () => {
    const { servicio } = crearEntorno([
      ocupacion({ fechaDesde: '2024-01-01', fechaHasta: '2026-06-30' }),
      ocupacion({ fechaDesde: '2026-07-01', fechaHasta: null }),
    ]);
    await expect(
      servicio.actualizar(1, 10, '2024-01-01', { fechaHasta: '2023-12-31' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      servicio.actualizar(1, 10, '2024-01-01', { fechaHasta: '2026-07-15' }),
    ).rejects.toThrow(ConflictException);
  });

  it('no se solapa consigo misma al ampliar su propio fin', async () => {
    const { servicio } = crearEntorno([
      ocupacion({ fechaHasta: '2026-12-31' }),
    ]);
    await expect(
      servicio.actualizar(1, 10, '2024-01-01', { fechaHasta: '2027-12-31' }),
    ).resolves.toMatchObject({ fechaHasta: '2027-12-31' });
  });

  it('permite reabrir una ocupación vigente con fechaHasta null', async () => {
    const { servicio } = crearEntorno([
      ocupacion({ fechaHasta: '2026-12-31' }),
    ]);
    await expect(
      servicio.actualizar(1, 10, '2024-01-01', { fechaHasta: null }),
    ).resolves.toMatchObject({ fechaHasta: null });
  });

  it('rechaza con 400 poner null en carácter o dedicación', async () => {
    const { servicio } = crearEntorno([ocupacion()]);
    await expect(
      servicio.actualizar(1, 10, '2024-01-01', {
        idDedicacion: null as unknown as number,
      }),
    ).rejects.toThrow(/idDedicacion no admite null/);
  });

  it('responde 404 si la ocupación no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(
      servicio.actualizar(1, 10, '2024-01-01', { idDedicacion: 2 }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('OcupacionesService.cerrar', () => {
  it('fija la fecha de fin', async () => {
    const { servicio, filas } = crearEntorno([ocupacion()]);
    const cerrada = await servicio.cerrar(1, 10, '2024-01-01', {
      fechaHasta: HOY,
    });
    expect(cerrada).toMatchObject({ fechaHasta: HOY, estado: 'vigente' });
    expect(filas[0].fechaHasta).toBe(HOY);
  });

  it('con un fin pasado, la ocupación queda como historial', async () => {
    const { servicio } = crearEntorno([ocupacion()]);
    expect(
      (await servicio.cerrar(1, 10, '2024-01-01', { fechaHasta: '2025-12-31' }))
        .estado,
    ).toBe('pasada');
  });

  it('rechaza con 400 un fin anterior al inicio', async () => {
    const { servicio, filas } = crearEntorno([ocupacion()]);
    await expect(
      servicio.cerrar(1, 10, '2024-01-01', { fechaHasta: '2023-01-01' }),
    ).rejects.toThrow(BadRequestException);
    expect(filas[0].fechaHasta).toBeNull();
  });

  it('rechaza con 409 cerrar una ocupación que ya es historial', async () => {
    const { servicio } = crearEntorno([
      ocupacion({ fechaHasta: '2025-01-31' }),
    ]);
    await expect(
      servicio.cerrar(1, 10, '2024-01-01', { fechaHasta: '2025-02-28' }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('OcupacionesService.anular', () => {
  it('elimina una ocupación que todavía no empezó', async () => {
    const { servicio, filas } = crearEntorno([
      ocupacion({ fechaDesde: '2026-07-01' }),
    ]);
    await servicio.anular(1, 10, '2026-07-01');
    expect(filas).toHaveLength(0);
  });

  it.each([
    ['vigente', { fechaDesde: '2024-01-01' }],
    ['que empieza hoy', { fechaDesde: HOY }],
    ['pasada', { fechaDesde: '2020-01-01', fechaHasta: '2020-12-31' }],
  ])('rechaza con 409 anular una ocupación %s', async (_titulo, parcial) => {
    const { servicio, filas } = crearEntorno([ocupacion(parcial)]);
    await expect(
      servicio.anular(1, 10, parcial.fechaDesde as string),
    ).rejects.toThrow(/cerrala/);
    expect(filas).toHaveLength(1);
  });

  it('responde 404 si no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(servicio.anular(1, 10, '2026-07-01')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('OcupacionesService.listarDePersona', () => {
  it('devuelve el historial por fecha de inicio descendente, con su estado', async () => {
    const { servicio, repoOcupaciones } = crearEntorno([
      ocupacion({ fechaDesde: '2020-01-01', fechaHasta: '2021-12-31' }),
      ocupacion({ fechaDesde: '2024-01-01' }),
    ]);
    const lista = await servicio.listarDePersona(1, sesion('recursos_humanos'));
    expect(repoOcupaciones.find).toHaveBeenCalledWith(
      expect.objectContaining({ order: { fechaDesde: 'DESC' } }),
    );
    expect(lista.map((o) => o.estado).sort()).toEqual(['pasada', 'vigente']);
  });

  it('el docente solo lee las suyas', async () => {
    const { servicio } = crearEntorno([ocupacion()]);
    await expect(
      servicio.listarDePersona(1, sesion('docente', 1)),
    ).resolves.toHaveLength(1);
    await expect(
      servicio.listarDePersona(1, sesion('docente', 2)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('responde 404 si la persona no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(
      servicio.listarDePersona(9, sesion('recursos_humanos')),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('OcupacionesService.listarDePuesto', () => {
  it('devuelve solo los ocupantes vigentes, con los datos mínimos de la persona', async () => {
    const { servicio } = crearEntorno([
      ocupacion(),
      ocupacion({ fechaDesde: '2010-01-01', fechaHasta: '2012-01-01' }),
      ocupacion({ fechaDesde: '2027-01-01' }),
    ]);
    const ocupantes = await servicio.listarDePuesto(10);
    expect(ocupantes).toHaveLength(1);
    expect(ocupantes[0]).toMatchObject({
      legajo: 'L-1',
      apellido: 'Pérez',
      estado: 'vigente',
    });
    expect(ocupantes[0]).not.toHaveProperty('documento');
  });

  it('responde 404 si el puesto no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(servicio.listarDePuesto(99)).rejects.toThrow(
      NotFoundException,
    );
  });
});
