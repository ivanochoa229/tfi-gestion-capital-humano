import { ForbiddenException } from '@nestjs/common';
import { exigirAccesoAPersona } from './acceso.js';

describe('exigirAccesoAPersona', () => {
  it('el docente accede a su propia persona', () => {
    expect(() =>
      exigirAccesoAPersona({ rol: 'docente', idPersona: 5 }, 5),
    ).not.toThrow();
  });
  it('el docente no accede a la de otro', () => {
    expect(() =>
      exigirAccesoAPersona({ rol: 'docente', idPersona: 5 }, 6),
    ).toThrow(ForbiddenException);
  });
  it('el docente sin persona vinculada no accede a ninguna', () => {
    expect(() =>
      exigirAccesoAPersona({ rol: 'docente', idPersona: null }, 5),
    ).toThrow(ForbiddenException);
  });
  it.each([
    'recursos_humanos',
    'autoridad',
    'jefe_catedra',
    'administrador',
  ] as const)('el rol %s no tiene esta restricción', (rol) => {
    expect(() =>
      exigirAccesoAPersona({ rol, idPersona: null }, 5),
    ).not.toThrow();
  });
});
