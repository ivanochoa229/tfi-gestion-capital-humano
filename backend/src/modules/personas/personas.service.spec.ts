import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FindOperator, type Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { Usuario } from '../usuarios/entities/usuario.entity.js';
import type { Ocupacion } from './entities/ocupacion.entity.js';
import type { Persona } from './entities/persona.entity.js';
import { PersonasService } from './personas.service.js';

const HOY = '2026-06-15';

function persona(parcial: Partial<Persona> = {}): Persona {
  return {
    id: 1,
    legajo: 'L-1',
    apellido: 'Pérez',
    nombre: 'Ana',
    documento: '30111111',
    fechaNacimiento: '1980-01-01',
    fechaIngreso: '2005-03-01',
    idSituacionRevista: 1,
    fechaPrevistaRetiro: null,
    activo: true,
    ...parcial,
  } as Persona;
}

function ocupacion(parcial: Partial<Ocupacion> = {}): Ocupacion {
  return {
    idPersona: 1,
    idPuesto: 10,
    fechaDesde: '2020-01-01',
    fechaHasta: null,
    idCaracterOcupacion: 1,
    idDedicacion: 1,
    puesto: { codigo: 'P-0010', denominacion: 'Jefe de cátedra' },
    ...parcial,
  } as Ocupacion;
}

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

function crearEntorno(
  existentes: Persona[],
  config: { ocupaciones?: Ocupacion[]; conUsuario?: number[] } = {},
) {
  const filas = existentes.map((p) => ({ ...p }));
  let proximoId = 100;

  const coincide = (p: Persona, donde: unknown): boolean =>
    Array.isArray(donde)
      ? donde.some((d) => coincide(p, d))
      : Object.entries(donde as Record<string, unknown>).every(
          ([clave, valor]) =>
            valor instanceof FindOperator ||
            p[clave as keyof Persona] === valor,
        );

  const repo = {
    find: vi.fn(async ({ where }: { where: unknown }) =>
      filas.filter((p) => coincide(p, where)).map((p) => ({ ...p })),
    ),
    findOne: vi.fn(async ({ where }: { where: unknown }) => {
      const fila = filas.find((p) => coincide(p, where));
      return fila ? { ...fila } : null;
    }),
    create: vi.fn((datos: Partial<Persona>) => ({ ...datos })),
    save: vi.fn(async (p: Partial<Persona>) => {
      if (p.id === undefined) {
        const nueva = { ...p, id: proximoId++ } as Persona;
        filas.push(nueva);
        return { ...nueva };
      }
      const i = filas.findIndex((f) => f.id === p.id);
      filas[i] = { ...(p as Persona) };
      return { ...(p as Persona) };
    }),
  };
  const repoOcupaciones = {
    find: vi.fn(async ({ where }: { where: { idPersona?: number } }) =>
      (config.ocupaciones ?? [])
        .filter(
          (o) =>
            where.idPersona === undefined || o.idPersona === where.idPersona,
        )
        .map((o) => ({ ...o })),
    ),
  };
  const repoUsuarios = {
    find: vi.fn(async () =>
      (config.conUsuario ?? []).map((idPersona) => ({ idPersona })),
    ),
    count: vi.fn(
      async ({ where }: { where: { idPersona: number } }) =>
        (config.conUsuario ?? []).filter((id) => id === where.idPersona).length,
    ),
  };
  const consultas: string[] = [];
  const manager = {
    query: vi.fn(async (sql: string) => {
      consultas.push(sql);
      return sql.includes('CURRENT_DATE') ? [{ hoy: HOY }] : [];
    }),
    getRepository: (entidad: { name: string }) =>
      entidad.name === 'Ocupacion' ? repoOcupaciones : repo,
    transaction: async (trabajo: (m: unknown) => Promise<unknown>) =>
      trabajo(manager),
  };
  (repo as unknown as { manager: unknown }).manager = manager;
  (repoOcupaciones as unknown as { manager: unknown }).manager = manager;

  const referencia = { validarActivo: vi.fn(async () => undefined) };
  const servicio = new PersonasService(
    repo as unknown as Repository<Persona>,
    repoOcupaciones as unknown as Repository<Ocupacion>,
    repoUsuarios as unknown as Repository<Usuario>,
    referencia as unknown as ReferenciaService,
  );
  return { servicio, repo, referencia, filas, consultas };
}

const alta = {
  legajo: 'L-9',
  apellido: 'Gómez',
  nombre: 'Luis',
  documento: '28999999',
  fechaNacimiento: '1975-02-02',
  fechaIngreso: '2000-08-01',
  idSituacionRevista: 1,
};

describe('PersonasService.crear', () => {
  it('crea la persona activa, valida la situación y toma el bloqueo', async () => {
    const { servicio, referencia, consultas } = crearEntorno([]);
    const creada = await servicio.crear(alta);
    expect(creada).toMatchObject({
      legajo: 'L-9',
      documento: '28999999',
      activo: true,
      tieneUsuario: false,
      ocupacionesVigentes: [],
    });
    expect(referencia.validarActivo).toHaveBeenCalledWith(
      'situacion-revista',
      1,
    );
    expect(consultas[0]).toContain('pg_advisory_xact_lock');
  });

  it('rechaza con 409 un legajo repetido, nombrando a quien lo tiene', async () => {
    const { servicio } = crearEntorno([persona()]);
    const error = await servicio
      .crear({ ...alta, legajo: 'L-1' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toContain('Pérez');
  });

  it('rechaza con 409 un documento repetido', async () => {
    const { servicio } = crearEntorno([persona()]);
    await expect(
      servicio.crear({ ...alta, documento: '30111111' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rechaza con 400 un ingreso que no es posterior al nacimiento', async () => {
    const { servicio, repo } = crearEntorno([]);
    await expect(
      servicio.crear({ ...alta, fechaIngreso: alta.fechaNacimiento }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rechaza con 400 un retiro anterior al ingreso', async () => {
    const { servicio } = crearEntorno([]);
    await expect(
      servicio.crear({ ...alta, fechaPrevistaRetiro: '1999-12-31' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('propaga el 400 de una situación de revista inactiva', async () => {
    const { servicio, referencia } = crearEntorno([]);
    referencia.validarActivo.mockRejectedValueOnce(
      new BadRequestException('inactivo'),
    );
    await expect(servicio.crear(alta)).rejects.toThrow(BadRequestException);
  });
});

describe('PersonasService.actualizar', () => {
  it('modifica solo lo enviado y valida las fechas con los valores finales', async () => {
    const { servicio, filas } = crearEntorno([persona()]);
    const actualizada = await servicio.actualizar(1, { apellido: 'Gómez' });
    expect(actualizada.apellido).toBe('Gómez');
    expect(filas[0].legajo).toBe('L-1');
    await expect(
      servicio.actualizar(1, { fechaPrevistaRetiro: '2001-01-01' }),
    ).rejects.toThrow(/retiro no puede ser anterior/);
  });

  it('permite borrar la fecha de retiro con null pero no otros campos', async () => {
    const { servicio } = crearEntorno([
      persona({ fechaPrevistaRetiro: '2040-01-01' }),
    ]);
    expect(
      (await servicio.actualizar(1, { fechaPrevistaRetiro: null }))
        .fechaPrevistaRetiro,
    ).toBeNull();
    await expect(
      servicio.actualizar(1, { apellido: null as unknown as string }),
    ).rejects.toThrow(/apellido no admite null/);
  });

  it('permite conservar su propio legajo y rechaza el de otra persona', async () => {
    const { servicio } = crearEntorno([
      persona(),
      persona({ id: 2, legajo: 'L-2', documento: '30222222' }),
    ]);
    await expect(
      servicio.actualizar(1, { legajo: 'L-1' }),
    ).resolves.toBeDefined();
    await expect(servicio.actualizar(1, { legajo: 'L-2' })).rejects.toThrow(
      ConflictException,
    );
    await expect(
      servicio.actualizar(1, { documento: '30222222' }),
    ).rejects.toThrow(ConflictException);
  });

  it('valida la situación de revista solo si cambia', async () => {
    const { servicio, referencia } = crearEntorno([
      persona({ idSituacionRevista: 1 }),
    ]);
    await servicio.actualizar(1, { idSituacionRevista: 1 });
    expect(referencia.validarActivo).not.toHaveBeenCalled();
    await servicio.actualizar(1, { idSituacionRevista: 3 });
    expect(referencia.validarActivo).toHaveBeenCalledWith(
      'situacion-revista',
      3,
    );
  });

  it('responde 404 si no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(servicio.actualizar(9, { apellido: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('PersonasService.listar y obtener', () => {
  const personas = [
    persona({ id: 1, apellido: 'Pérez', nombre: 'Ana' }),
    persona({
      id: 2,
      legajo: 'L-2',
      documento: '30222222',
      apellido: 'Gómez',
      nombre: 'Luis',
    }),
  ];

  it('RR. HH. ve documento y nacimiento; otro rol no', async () => {
    const { servicio } = crearEntorno(personas);
    const [rrhh] = await servicio.listar({}, sesion('recursos_humanos'));
    expect(rrhh).toHaveProperty('documento', '30111111');
    const [jefe] = await servicio.listar({}, sesion('jefe_catedra'));
    expect(jefe).not.toHaveProperty('documento');
    expect(jefe).not.toHaveProperty('fechaNacimiento');
  });

  it('marca quién tiene usuario y filtra con sinUsuario', async () => {
    const { servicio } = crearEntorno(personas, { conUsuario: [2] });
    const todas = await servicio.listar({}, sesion('recursos_humanos'));
    expect(todas.map((p) => [p.id, p.tieneUsuario])).toEqual([
      [1, false],
      [2, true],
    ]);
    const libres = await servicio.listar(
      { sinUsuario: true },
      sesion('recursos_humanos'),
    );
    expect(libres.map((p) => p.id)).toEqual([1]);
  });

  it('obtener incluye solo las ocupaciones vigentes, con su estado', async () => {
    const { servicio } = crearEntorno(personas, {
      ocupaciones: [
        ocupacion({ idPuesto: 10 }),
        ocupacion({ idPuesto: 11, fechaHasta: HOY }),
        ocupacion({ idPuesto: 12, fechaHasta: '2026-06-14' }),
        ocupacion({ idPuesto: 13, fechaDesde: '2026-07-01' }),
      ],
    });
    const detalle = await servicio.obtener(1, sesion('autoridad'));
    expect(detalle.ocupacionesVigentes.map((o) => o.idPuesto)).toEqual([
      10, 11,
    ]);
    expect(
      detalle.ocupacionesVigentes.every((o) => o.estado === 'vigente'),
    ).toBe(true);
  });

  it('el docente solo obtiene la suya', async () => {
    const { servicio } = crearEntorno(personas);
    await expect(
      servicio.obtener(1, sesion('docente', 1)),
    ).resolves.toMatchObject({ id: 1 });
    await expect(servicio.obtener(2, sesion('docente', 1))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('el docente ve su ficha sin documento ni nacimiento', async () => {
    const { servicio } = crearEntorno(personas);
    const propia = await servicio.obtener(1, sesion('docente', 1));
    expect(propia).not.toHaveProperty('documento');
  });

  it('responde 404 si no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(
      servicio.obtener(9, sesion('recursos_humanos')),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('PersonasService.darDeBaja', () => {
  it('da de baja a una persona sin ocupaciones abiertas', async () => {
    const { servicio, filas } = crearEntorno([persona()], {
      ocupaciones: [ocupacion({ fechaHasta: '2026-06-14' })],
    });
    const resultado = await servicio.darDeBaja(1);
    expect(resultado.persona.activo).toBe(false);
    expect(resultado.advertencias).toEqual([]);
    expect(filas[0].activo).toBe(false);
  });

  it.each([
    ['vigente sin fin', { fechaHasta: null }],
    ['que vence hoy', { fechaHasta: HOY }],
    ['futura', { fechaDesde: '2026-09-01' }],
  ])(
    'rechaza con 409 si tiene una ocupación %s, y la nombra',
    async (_titulo, parcial) => {
      const { servicio, filas } = crearEntorno([persona()], {
        ocupaciones: [ocupacion(parcial)],
      });
      const error = await servicio.darDeBaja(1).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as Error).message).toContain('P-0010');
      expect(filas[0].activo).toBe(true);
    },
  );

  it('advierte que el usuario vinculado sigue activo', async () => {
    const { servicio } = crearEntorno([persona()], { conUsuario: [1] });
    const resultado = await servicio.darDeBaja(1);
    expect(resultado.persona.activo).toBe(false);
    expect(resultado.advertencias).toHaveLength(1);
    expect(resultado.advertencias[0]).toMatch(/usuario/);
  });

  it('es idempotente con una persona ya dada de baja', async () => {
    const { servicio, repo } = crearEntorno([persona({ activo: false })]);
    await expect(servicio.darDeBaja(1)).resolves.toMatchObject({
      persona: { activo: false },
    });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('responde 404 y toma el bloqueo consultivo', async () => {
    const { servicio, consultas } = crearEntorno([]);
    await expect(servicio.darDeBaja(9)).rejects.toThrow(NotFoundException);
    expect(consultas[0]).toContain('pg_advisory_xact_lock');
  });
});

describe('PersonasService.reactivar', () => {
  it('reactiva una persona dada de baja', async () => {
    const { servicio, filas } = crearEntorno([persona({ activo: false })]);
    const detalle = await servicio.reactivar(1);
    expect(detalle.activo).toBe(true);
    expect(filas[0].activo).toBe(true);
  });
});

describe('PersonasService.exigirActiva', () => {
  it('acepta una persona activa', async () => {
    const { servicio } = crearEntorno([persona()]);
    await expect(servicio.exigirActiva(1)).resolves.toBeUndefined();
  });
  it('rechaza con 400 una persona inexistente o dada de baja', async () => {
    const { servicio } = crearEntorno([persona({ id: 2, activo: false })]);
    await expect(servicio.exigirActiva(1)).rejects.toThrow(BadRequestException);
    await expect(servicio.exigirActiva(2)).rejects.toThrow(/dada de baja/);
  });
});
