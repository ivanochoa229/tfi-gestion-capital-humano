import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Publico } from '../decorators/publico.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import { ROLES } from '../roles.js';
import { RolesGuard } from './roles.guard.js';

class Controlador {
  @Publico()
  abierto() {}

  @Roles(ROLES.administrador)
  soloAdmin() {}

  @Roles(ROLES.recursosHumanos, ROLES.autoridad)
  variosRoles() {}

  sinDeclarar() {}
}

function contexto(metodo: keyof Controlador, rol?: string): ExecutionContext {
  return {
    getHandler: () => Controlador.prototype[metodo],
    getClass: () => Controlador,
    switchToHttp: () => ({
      getRequest: () => ({ user: rol ? { rol } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('deja pasar las rutas públicas', () => {
    expect(guard.canActivate(contexto('abierto'))).toBe(true);
  });

  it('permite el rol declarado', () => {
    expect(guard.canActivate(contexto('soloAdmin', 'administrador'))).toBe(
      true,
    );
  });

  it('permite cualquiera de varios roles declarados', () => {
    expect(guard.canActivate(contexto('variosRoles', 'autoridad'))).toBe(true);
  });

  it.each([
    'analista_puestos',
    'recursos_humanos',
    'autoridad',
    'jefatura_departamento',
    'jefe_catedra',
    'docente',
  ])('rechaza con 403 al rol %s en una ruta solo de administrador', (rol) => {
    expect(() => guard.canActivate(contexto('soloAdmin', rol))).toThrow(
      ForbiddenException,
    );
  });

  it('falla cerrado: rechaza una ruta sin @Roles aunque haya sesión', () => {
    expect(() =>
      guard.canActivate(contexto('sinDeclarar', 'administrador')),
    ).toThrow(ForbiddenException);
  });
});
