import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLICO_KEY } from '../decorators/publico.decorator.js';
import type { SesionUsuario } from '../sesion-usuario.js';

/** Exige sesión iniciada en toda ruta que no sea @Publico (RNF01). */
@Injectable()
export class SesionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const publico = this.reflector.getAllAndOverride<boolean>(PUBLICO_KEY, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (publico) return true;

    const { user } = contexto
      .switchToHttp()
      .getRequest<{ user?: SesionUsuario }>();
    if (!user) throw new UnauthorizedException('Iniciá sesión para continuar');
    return true;
  }
}
