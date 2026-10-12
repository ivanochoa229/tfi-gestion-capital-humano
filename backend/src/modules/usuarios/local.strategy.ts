import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AuthService } from './auth.service.js';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: 'nombreUsuario', passwordField: 'clave' });
  }

  async validate(nombreUsuario: string, clave: string): Promise<SesionUsuario> {
    const sesion = await this.auth.validarCredenciales(nombreUsuario, clave);
    if (!sesion) throw new UnauthorizedException('Usuario o clave incorrectos');
    return sesion;
  }
}
