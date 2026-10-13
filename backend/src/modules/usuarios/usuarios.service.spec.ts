import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { Rol } from './entities/rol.entity.js';
import type { Usuario } from './entities/usuario.entity.js';
import { PasswordService } from './password.service.js';
import type { UnidadesService } from '../estructura/unidades.service.js';
import type { SesionesService } from './sesiones.service.js';
import { UsuariosService } from './usuarios.service.js';

const roles: Rol[] = [
  'administrador',
  'docente',
  'jefe_catedra',
  'jefatura_departamento',
  'recursos_humanos',
].map((codigo, i) => ({ id: i + 1, codigo, denominacion: codigo }));

const rolDe = (codigo: string) => roles.find((r) => r.codigo === codigo)!;

function usuario(
  parcial: Partial<Usuario> & { rolCodigo?: string } = {},
): Usuario {
  const { rolCodigo = 'recursos_humanos', ...resto } = parcial;
  return {
    id: 1,
    nombreUsuario: 'ana',
    claveHash: 'hash',
    rol: rolDe(rolCodigo),
    idPersona: null,
    activo: true,
    creadoEn: new Date(),
    unidades: [],
    ...resto,
  } as Usuario;
}

function crearServicio(existentes: Usuario[]) {
  const filas = existentes.map((u) => ({ ...u }));
  const usuarios = {
    find: vi.fn(async () => filas),
    // Devuelve copias, como la base: solo `save` modifica lo guardado.
    findOne: vi.fn(async ({ where }: { where: Partial<Usuario> }) => {
      const fila = filas.find((u) =>
        Object.entries(where).every(([k, v]) => u[k as keyof Usuario] === v),
      );
      return fila ? { ...fila } : null;
    }),
    count: vi.fn(
      async () =>
        filas.filter((u) => u.activo && u.rol.codigo === 'administrador')
          .length,
    ),
    create: vi.fn((datos: Partial<Usuario>) => ({ id: 99, ...datos })),
    save: vi.fn(async (u: Usuario) => {
      const i = filas.findIndex((f) => f.id === u.id);
      if (i >= 0) filas[i] = { ...u };
      return u;
    }),
    update: vi.fn(async () => undefined),
  } as unknown as Repository<Usuario>;
  const rolesRepo = {
    find: vi.fn(async () => roles),
    findOne: vi.fn(
      async ({ where }: { where: { codigo: string } }) =>
        roles.find((r) => r.codigo === where.codigo) ?? null,
    ),
  } as unknown as Repository<Rol>;
  const consultas: string[] = [];
  const manager = {
    query: vi.fn(async (sql: string) => consultas.push(sql)),
    getRepository: () => usuarios,
    transaction: async (trabajo: (m: unknown) => Promise<unknown>) =>
      trabajo(manager),
  };
  (usuarios as unknown as { manager: unknown }).manager = manager;
  const sesiones = { cerrarDe: vi.fn(async () => undefined) };
  const catedra = (id: number, denominacion: string, activo = true) => ({
    id,
    denominacion,
    activo,
    tipo: { codigo: 'catedra' },
  });
  const unidadesFake = [
    catedra(1, 'Cátedra A'),
    catedra(2, 'Cátedra B'),
    catedra(3, 'Cátedra inactiva', false),
    catedra(4, 'Cátedra C'),
    {
      id: 5,
      denominacion: 'Departamento de Sistemas',
      activo: true,
      tipo: { codigo: 'departamento' },
    },
  ];
  const unidadesEstructura = {
    buscarPorIds: vi.fn(async (ids: number[]) =>
      unidadesFake.filter((u) => ids.includes(u.id)),
    ),
  };
  return {
    servicio: new UsuariosService(
      usuarios,
      rolesRepo,
      new PasswordService(),
      sesiones as unknown as SesionesService,
      unidadesEstructura as unknown as UnidadesService,
    ),
    usuarios,
    sesiones,
    consultas,
    unidadesEstructura,
  };
}

const base = { nombreUsuario: 'nuevo', clave: 'clave-larga-123' };

describe('UsuariosService.crear', () => {
  it('crea un usuario con la clave hasheada y devuelve el DTO sin la clave', async () => {
    const { servicio, usuarios } = crearServicio([]);
    const dto = await servicio.crear({ ...base, rol: 'recursos_humanos' });
    expect(dto).toMatchObject({
      nombreUsuario: 'nuevo',
      rol: 'recursos_humanos',
      activo: true,
    });
    expect(JSON.stringify(dto)).not.toContain('hash');
    const guardado = (usuarios.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(guardado.claveHash).toMatch(/^\$argon2id\$/);
  });

  it('rechaza un nombre de usuario repetido con 409, sin distinguir mayúsculas', async () => {
    const { servicio } = crearServicio([usuario({ nombreUsuario: 'admin' })]);
    await expect(
      servicio.crear({
        ...base,
        nombreUsuario: 'Admin ',
        rol: 'recursos_humanos',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('exige persona para el rol docente', async () => {
    const { servicio } = crearServicio([]);
    await expect(servicio.crear({ ...base, rol: 'docente' })).rejects.toThrow(
      /persona/,
    );
  });

  it('rechaza una persona ya vinculada a otro usuario con 409', async () => {
    const { servicio } = crearServicio([usuario({ idPersona: 5 })]);
    await expect(
      servicio.crear({ ...base, rol: 'docente', idPersona: 5 }),
    ).rejects.toThrow(ConflictException);
  });

  it('solo admite unidades para jefatura y jefe de cátedra', async () => {
    const { servicio } = crearServicio([]);
    await expect(
      servicio.crear({ ...base, rol: 'recursos_humanos', idUnidades: [1] }),
    ).rejects.toThrow(BadRequestException);
    const dto = await servicio.crear({
      ...base,
      rol: 'jefe_catedra',
      idUnidades: [1, 2],
    });
    expect(dto.idUnidades).toEqual([1, 2]);
  });

  it('rechaza una unidad inexistente', async () => {
    const { servicio } = crearServicio([]);
    await expect(
      servicio.crear({ ...base, rol: 'jefe_catedra', idUnidades: [99] }),
    ).rejects.toThrow(/La unidad 99 no existe/);
  });

  it('rechaza una unidad inactiva', async () => {
    const { servicio } = crearServicio([]);
    await expect(
      servicio.crear({ ...base, rol: 'jefe_catedra', idUnidades: [3] }),
    ).rejects.toThrow(/inactiva/);
  });

  it('el jefe de cátedra solo admite cátedras', async () => {
    const { servicio } = crearServicio([]);
    await expect(
      servicio.crear({ ...base, rol: 'jefe_catedra', idUnidades: [5] }),
    ).rejects.toThrow(/solo admite/);
  });

  it('la jefatura de departamento solo admite departamentos', async () => {
    const { servicio } = crearServicio([]);
    await expect(
      servicio.crear({
        ...base,
        rol: 'jefatura_departamento',
        idUnidades: [1],
      }),
    ).rejects.toThrow(/solo admite/);
    const dto = await servicio.crear({
      ...base,
      rol: 'jefatura_departamento',
      idUnidades: [5],
    });
    expect(dto.idUnidades).toEqual([5]);
  });

  it('no consulta las unidades si no se asigna ninguna', async () => {
    const { servicio, unidadesEstructura } = crearServicio([]);
    await servicio.crear({ ...base, rol: 'recursos_humanos' });
    expect(unidadesEstructura.buscarPorIds).not.toHaveBeenCalled();
  });
});

describe('UsuariosService.actualizar', () => {
  it('modifica el rol y las unidades', async () => {
    const { servicio } = crearServicio([
      usuario({ id: 2, nombreUsuario: 'bea' }),
    ]);
    const dto = await servicio.actualizar(2, {
      rol: 'jefe_catedra',
      idUnidades: [4],
    });
    expect(dto).toMatchObject({ rol: 'jefe_catedra', idUnidades: [4] });
  });

  it('rechaza asignar una unidad inactiva al modificar', async () => {
    const { servicio } = crearServicio([
      usuario({ id: 2, nombreUsuario: 'bea', rolCodigo: 'jefe_catedra' }),
    ]);
    await expect(servicio.actualizar(2, { idUnidades: [3] })).rejects.toThrow(
      /inactiva/,
    );
  });

  it('revalida las unidades actuales cuando cambia el rol', async () => {
    const { servicio } = crearServicio([
      usuario({
        id: 2,
        nombreUsuario: 'bea',
        rolCodigo: 'jefe_catedra',
        unidades: [{ idUsuario: 2, idUnidad: 1 } as never],
      }),
    ]);
    await expect(
      servicio.actualizar(2, { rol: 'jefatura_departamento' }),
    ).rejects.toThrow(/solo admite/);
  });

  it('no consulta las unidades si solo cambia otro dato', async () => {
    const { servicio, unidadesEstructura } = crearServicio([
      usuario({ id: 2, nombreUsuario: 'bea' }),
    ]);
    await servicio.actualizar(2, { activo: false });
    expect(unidadesEstructura.buscarPorIds).not.toHaveBeenCalled();
  });

  it('responde 404 si el usuario no existe', async () => {
    const { servicio } = crearServicio([]);
    await expect(servicio.actualizar(9, { activo: false })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('no deja desactivar al último administrador activo', async () => {
    const { servicio } = crearServicio([
      usuario({ id: 1, rolCodigo: 'administrador' }),
    ]);
    await expect(servicio.actualizar(1, { activo: false })).rejects.toThrow(
      /último administrador/,
    );
  });

  it('no deja cambiar de rol al último administrador activo', async () => {
    const { servicio } = crearServicio([
      usuario({ id: 1, rolCodigo: 'administrador' }),
    ]);
    await expect(
      servicio.actualizar(1, { rol: 'recursos_humanos' }),
    ).rejects.toThrow(/último administrador/);
  });

  it('permite desactivar a un administrador si queda otro activo', async () => {
    const { servicio } = crearServicio([
      usuario({ id: 1, nombreUsuario: 'a', rolCodigo: 'administrador' }),
      usuario({ id: 2, nombreUsuario: 'b', rolCodigo: 'administrador' }),
    ]);
    expect((await servicio.actualizar(1, { activo: false })).activo).toBe(
      false,
    );
  });
});

describe('UsuariosService (bloqueo de administradores)', () => {
  it('toma el bloqueo antes de comprobar si queda otro administrador', async () => {
    const { servicio, consultas } = crearServicio([
      usuario({ id: 1, nombreUsuario: 'a', rolCodigo: 'administrador' }),
      usuario({ id: 2, nombreUsuario: 'b', rolCodigo: 'administrador' }),
    ]);
    await servicio.actualizar(1, { activo: false });
    expect(consultas).toEqual(['SELECT pg_advisory_xact_lock($1)']);
  });

  it('no usa el bloqueo si el cambio no afecta a un administrador', async () => {
    const { servicio, consultas } = crearServicio([usuario({ id: 3 })]);
    await servicio.actualizar(3, { activo: false });
    expect(consultas).toEqual([]);
  });
});

describe('UsuariosService.restablecerClave', () => {
  it('cierra todas las sesiones del usuario', async () => {
    const { servicio, sesiones } = crearServicio([usuario({ id: 3 })]);
    await servicio.restablecerClave(3, 'otra-clave-larga');
    expect(sesiones.cerrarDe).toHaveBeenCalledWith(3);
  });

  it('guarda el hash de la clave nueva', async () => {
    const { servicio, usuarios } = crearServicio([usuario({ id: 3 })]);
    await servicio.restablecerClave(3, 'otra-clave-larga');
    const [id, cambios] = (usuarios.update as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(id).toBe(3);
    expect(cambios.claveHash).toMatch(/^\$argon2id\$/);
  });

  it('responde 404 si el usuario no existe', async () => {
    const { servicio } = crearServicio([]);
    await expect(
      servicio.restablecerClave(9, 'otra-clave-larga'),
    ).rejects.toThrow(NotFoundException);
  });
});
