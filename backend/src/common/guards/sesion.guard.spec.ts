import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Publico } from '../decorators/publico.decorator.js';
import { SesionGuard } from './sesion.guard.js';

class Controlador {
  @Publico()
  abierto() {}
  cerrado() {}
}

function contexto(metodo: keyof Controlador, user?: object): ExecutionContext {
  return {
    getHandler: () => Controlador.prototype[metodo],
    getClass: () => Controlador,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('SesionGuard', () => {
  const guard = new SesionGuard(new Reflector());

  it('deja pasar las rutas públicas sin sesión', () => {
    expect(guard.canActivate(contexto('abierto'))).toBe(true);
  });

  it('rechaza con 401 una ruta privada sin sesión', () => {
    expect(() => guard.canActivate(contexto('cerrado'))).toThrow(
      UnauthorizedException,
    );
  });

  it('deja pasar una ruta privada con sesión', () => {
    expect(guard.canActivate(contexto('cerrado', { id: 1 }))).toBe(true);
  });
});
