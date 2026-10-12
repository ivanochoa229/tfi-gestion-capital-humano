import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { AuthService, normalizarNombreUsuario } from './auth.service.js';
import type { Usuario } from './entities/usuario.entity.js';
import { PasswordService } from './password.service.js';
import type { SesionesService } from './sesiones.service.js';

const passwords = new PasswordService();

async function usuarioDe(parcial: Partial<Usuario> = {}): Promise<Usuario> {
  return {
    id: 7,
    nombreUsuario: 'ana',
    claveHash: await passwords.hashear('clave-correcta-1'),
    rol: { id: 1, codigo: 'jefe_catedra', denominacion: 'Jefe de cátedra' },
    idPersona: 42,
    activo: true,
    creadoEn: new Date(),
    unidades: [{ idUsuario: 7, idUnidad: 3 } as never],
    ...parcial,
  } as Usuario;
}

function crearServicio(usuario: Usuario | null) {
  const repo = {
    findOne: vi.fn(async () => usuario),
    update: vi.fn(async () => undefined),
  } as unknown as Repository<Usuario>;
  const sesiones = { cerrarDe: vi.fn(async () => undefined) };
  return {
    servicio: new AuthService(
      repo,
      passwords,
      sesiones as unknown as SesionesService,
    ),
    repo,
    sesiones,
  };
}

describe('normalizarNombreUsuario', () => {
  it('pasa a minúsculas y quita espacios', () => {
    expect(normalizarNombreUsuario('  Ana.Perez ')).toBe('ana.perez');
  });
});

describe('AuthService.validarCredenciales', () => {
  it('devuelve la sesión con rol, persona y unidades si las credenciales son correctas', async () => {
    const { servicio } = crearServicio(await usuarioDe());
    expect(
      await servicio.validarCredenciales('Ana', 'clave-correcta-1'),
    ).toEqual({
      id: 7,
      nombreUsuario: 'ana',
      rol: 'jefe_catedra',
      idPersona: 42,
      unidades: [3],
    });
  });

  it('devuelve null con clave incorrecta', async () => {
    const { servicio } = crearServicio(await usuarioDe());
    expect(
      await servicio.validarCredenciales('ana', 'otra-clave-123'),
    ).toBeNull();
  });

  it('devuelve null si el usuario no existe', async () => {
    const { servicio } = crearServicio(null);
    expect(
      await servicio.validarCredenciales('nadie', 'clave-correcta-1'),
    ).toBeNull();
  });

  it('devuelve null para un usuario desactivado aunque la clave sea correcta', async () => {
    const { servicio } = crearServicio(await usuarioDe({ activo: false }));
    expect(
      await servicio.validarCredenciales('ana', 'clave-correcta-1'),
    ).toBeNull();
  });
});

describe('AuthService.validarCredenciales (tiempo de respuesta)', () => {
  it('verifica una clave falsa si el usuario no existe o está desactivado', async () => {
    const espia = vi.spyOn(passwords, 'verificarFalso');
    await crearServicio(null).servicio.validarCredenciales('nadie', 'x');
    await crearServicio(
      await usuarioDe({ activo: false }),
    ).servicio.validarCredenciales('ana', 'x');
    expect(espia).toHaveBeenCalledTimes(2);
    espia.mockRestore();
  });
});

describe('AuthService.cargarSesionUsuario', () => {
  it('devuelve la sesión de un usuario activo', async () => {
    const { servicio } = crearServicio(await usuarioDe());
    expect((await servicio.cargarSesionUsuario(7))?.nombreUsuario).toBe('ana');
  });

  it('invalida la sesión de un usuario desactivado', async () => {
    const { servicio } = crearServicio(await usuarioDe({ activo: false }));
    expect(await servicio.cargarSesionUsuario(7)).toBeNull();
  });

  it('invalida la sesión de un usuario inexistente', async () => {
    const { servicio } = crearServicio(null);
    expect(await servicio.cargarSesionUsuario(7)).toBeNull();
  });
});

describe('AuthService.cambiarClave', () => {
  it('guarda el hash de la clave nueva si la actual es correcta', async () => {
    const { servicio, repo } = crearServicio(await usuarioDe());
    await servicio.cambiarClave(7, 'clave-correcta-1', 'clave-nueva-1234');
    const [, cambios] = (repo.update as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(
      await passwords.verificar(cambios.claveHash, 'clave-nueva-1234'),
    ).toBe(true);
  });

  it('cierra las otras sesiones del usuario y conserva la actual', async () => {
    const { servicio, sesiones } = crearServicio(await usuarioDe());
    await servicio.cambiarClave(
      7,
      'clave-correcta-1',
      'clave-nueva-1234',
      'sid-actual',
    );
    expect(sesiones.cerrarDe).toHaveBeenCalledWith(7, 'sid-actual');
  });

  it('rechaza una clave actual incorrecta sin modificar nada', async () => {
    const { servicio, repo } = crearServicio(await usuarioDe());
    await expect(
      servicio.cambiarClave(7, 'incorrecta-123', 'clave-nueva-1234'),
    ).rejects.toThrow(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('rechaza una clave nueva de menos de 10 caracteres sin modificar nada', async () => {
    const { servicio, repo } = crearServicio(await usuarioDe());
    await expect(
      servicio.cambiarClave(7, 'clave-correcta-1', 'corta'),
    ).rejects.toThrow(/10 caracteres/);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
