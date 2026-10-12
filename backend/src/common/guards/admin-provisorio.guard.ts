import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '../../infra/config/env.validation.js';

/**
 * Guard provisorio: autoriza las escrituras con el encabezado `x-admin-token`.
 * Se reemplaza por el guard de rol real al implementar RF22.
 */
@Injectable()
export class AdminProvisorioGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(contexto: ExecutionContext): boolean {
    const esperado = this.config.get('ADMIN_TOKEN', { infer: true });
    const recibido = contexto.switchToHttp().getRequest<Request>().headers[
      'x-admin-token'
    ];

    if (!esperado || typeof recibido !== 'string') {
      throw new ForbiddenException('Se requiere el token de administrador');
    }
    const a = Buffer.from(esperado);
    const b = Buffer.from(recibido);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('Se requiere el token de administrador');
    }
    return true;
  }
}
