import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { SesionUsuario } from '../sesion-usuario.js';

/** Usuario autenticado de la petición actual. */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): SesionUsuario =>
    contexto.switchToHttp().getRequest<{ user: SesionUsuario }>().user,
);
