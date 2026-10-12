import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AuthService } from './auth.service.js';

/** Guarda solo el id en la sesión y recarga el usuario en cada petición. */
@Injectable()
export class SesionSerializer extends PassportSerializer {
  constructor(private readonly auth: AuthService) {
    super();
  }

  serializeUser(
    usuario: SesionUsuario,
    done: (error: Error | null, id?: number) => void,
  ): void {
    done(null, usuario.id);
  }

  async deserializeUser(
    id: number,
    done: (error: Error | null, usuario?: SesionUsuario | false) => void,
  ): Promise<void> {
    try {
      done(null, (await this.auth.cargarSesionUsuario(id)) ?? false);
    } catch (error) {
      done(error as Error);
    }
  }
}
