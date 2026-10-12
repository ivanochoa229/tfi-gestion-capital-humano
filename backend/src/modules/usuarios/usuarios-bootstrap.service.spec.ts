import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { Rol } from './entities/rol.entity.js';
import type { Usuario } from './entities/usuario.entity.js';
import { PasswordService } from './password.service.js';
import { UsuariosBootstrapService } from './usuarios-bootstrap.service.js';

function crear(cantidad: number, env: Record<string, string | undefined>) {
  const usuarios = {
    count: vi.fn(async () => cantidad),
    save: vi.fn(async (u: unknown) => u),
    create: vi.fn((u: unknown) => u),
  } as unknown as Repository<Usuario>;
  const roles = {
    findOneByOrFail: vi.fn(
      async () => ({ id: 6, codigo: 'administrador' }) as Rol,
    ),
  } as unknown as Repository<Rol>;
  const config = { get: (k: string) => env[k] } as unknown as ConfigService<
    never,
    true
  >;
  return {
    servicio: new UsuariosBootstrapService(
      usuarios,
      roles,
      new PasswordService(),
      config,
    ),
    usuarios,
  };
}

describe('UsuariosBootstrapService', () => {
  it('crea el administrador si no hay usuarios', async () => {
    const { servicio, usuarios } = crear(0, {
      ADMIN_USUARIO: 'Admin',
      ADMIN_CLAVE: 'clave-larga-123',
    });
    await servicio.onApplicationBootstrap();
    const creado = (usuarios.save as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(creado.nombreUsuario).toBe('admin');
    expect(creado.activo).toBe(true);
    expect(creado.idPersona).toBeNull();
    expect(creado.claveHash).toMatch(/^\$argon2id\$/);
  });

  it('no hace nada si ya hay usuarios, aunque falten las variables', async () => {
    const { servicio, usuarios } = crear(2, {});
    await servicio.onApplicationBootstrap();
    expect(usuarios.save).not.toHaveBeenCalled();
  });

  it('falla y lo informa si no hay usuarios y faltan las variables', async () => {
    const { servicio } = crear(0, {});
    await expect(servicio.onApplicationBootstrap()).rejects.toThrow(
      /ADMIN_USUARIO y ADMIN_CLAVE/,
    );
  });

  it('falla si la clave tiene menos de 10 caracteres', async () => {
    const { servicio } = crear(0, {
      ADMIN_USUARIO: 'admin',
      ADMIN_CLAVE: 'corta',
    });
    await expect(servicio.onApplicationBootstrap()).rejects.toThrow(
      /10 caracteres/,
    );
  });
});
