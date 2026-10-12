import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { AdminProvisorioGuard } from './admin-provisorio.guard.js';

function contexto(token?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: token ? { 'x-admin-token': token } : {} }),
    }),
  } as unknown as ExecutionContext;
}

function guard(esperado?: string) {
  const config = { get: () => esperado } as unknown as ConfigService<
    never,
    true
  >;
  return new AdminProvisorioGuard(config);
}

describe('AdminProvisorioGuard', () => {
  it('permite el acceso con el token correcto', () => {
    expect(guard('secreto').canActivate(contexto('secreto'))).toBe(true);
  });

  it('rechaza un token incorrecto', () => {
    expect(() => guard('secreto').canActivate(contexto('otro'))).toThrow(
      ForbiddenException,
    );
  });

  it('rechaza si falta el encabezado', () => {
    expect(() => guard('secreto').canActivate(contexto())).toThrow(
      ForbiddenException,
    );
  });

  it('rechaza todo si ADMIN_TOKEN no está definida', () => {
    expect(() => guard(undefined).canActivate(contexto('x'))).toThrow(
      ForbiddenException,
    );
  });
});
