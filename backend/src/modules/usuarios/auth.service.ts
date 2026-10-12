import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CodigoRol } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { Usuario } from './entities/usuario.entity.js';
import { LARGO_MINIMO_CLAVE, PasswordService } from './password.service.js';
import { SesionesService } from './sesiones.service.js';

/** Los nombres de usuario no distinguen mayúsculas ni espacios en los extremos. */
export function normalizarNombreUsuario(nombre: string): string {
  return nombre.trim().toLowerCase();
}

export function aSesionUsuario(usuario: Usuario): SesionUsuario {
  return {
    id: usuario.id,
    nombreUsuario: usuario.nombreUsuario,
    rol: usuario.rol.codigo as CodigoRol,
    idPersona: usuario.idPersona,
    unidades: (usuario.unidades ?? []).map((u) => u.idUnidad),
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly passwords: PasswordService,
    private readonly sesiones: SesionesService,
  ) {}

  /** null ante usuario inexistente, desactivado o clave incorrecta (mismo resultado). */
  async validarCredenciales(
    nombreUsuario: string,
    clave: string,
  ): Promise<SesionUsuario | null> {
    const usuario = await this.usuarios.findOne({
      where: { nombreUsuario: normalizarNombreUsuario(nombreUsuario) },
      relations: { rol: true, unidades: true },
    });
    if (!usuario || !usuario.activo) {
      await this.passwords.verificarFalso(clave);
      return null;
    }
    if (!(await this.passwords.verificar(usuario.claveHash, clave)))
      return null;
    return aSesionUsuario(usuario);
  }

  /** Se consulta en cada petición: desactivar un usuario corta su sesión de inmediato. */
  async cargarSesionUsuario(id: number): Promise<SesionUsuario | null> {
    const usuario = await this.usuarios.findOne({
      where: { id },
      relations: { rol: true, unidades: true },
    });
    return usuario?.activo ? aSesionUsuario(usuario) : null;
  }

  async cambiarClave(
    idUsuario: number,
    claveActual: string,
    claveNueva: string,
    sesionActual?: string,
  ): Promise<void> {
    const usuario = await this.usuarios.findOne({ where: { id: idUsuario } });
    if (
      !usuario ||
      !(await this.passwords.verificar(usuario.claveHash, claveActual))
    ) {
      throw new BadRequestException('La clave actual es incorrecta');
    }
    if (claveNueva.length < LARGO_MINIMO_CLAVE) {
      throw new BadRequestException(
        `La clave nueva debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres`,
      );
    }
    await this.usuarios.update(idUsuario, {
      claveHash: await this.passwords.hashear(claveNueva),
    });
    await this.sesiones.cerrarDe(idUsuario, sesionActual);
  }
}
