import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Valida las credenciales y abre la sesión (cookie). */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const autenticado = (await super.canActivate(contexto)) as boolean;
    await super.logIn(contexto.switchToHttp().getRequest());
    return autenticado;
  }
}
