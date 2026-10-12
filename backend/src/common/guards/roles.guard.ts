import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLICO_KEY } from '../decorators/publico.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { CodigoRol } from '../roles.js';
import type { SesionUsuario } from '../sesion-usuario.js';

/** Autoriza por rol (RNF01). Una ruta sin @Roles se rechaza: falla cerrada. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const objetivos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO_KEY, objetivos)) {
      return true;
    }

    const roles = this.reflector.getAllAndOverride<CodigoRol[]>(
      ROLES_KEY,
      objetivos,
    );
    const { user } = contexto
      .switchToHttp()
      .getRequest<{ user?: SesionUsuario }>();

    if (!roles?.length || !user || !roles.includes(user.rol)) {
      throw new ForbiddenException('No tenés permiso para esta operación');
    }
    return true;
  }
}
