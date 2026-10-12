import {
  ROLES,
  ROLES_CON_ALCANCE_POR_UNIDAD,
  ROLES_GLOBALES,
  TODOS_LOS_ROLES,
} from './roles.js';

describe('roles', () => {
  it('define los siete roles fijos', () => {
    expect([...TODOS_LOS_ROLES].sort()).toEqual([
      'administrador',
      'analista_puestos',
      'autoridad',
      'docente',
      'jefatura_departamento',
      'jefe_catedra',
      'recursos_humanos',
    ]);
  });

  it('separa roles globales y roles con alcance por unidad sin solaparlos', () => {
    expect(ROLES_CON_ALCANCE_POR_UNIDAD).toEqual([
      ROLES.jefaturaDepartamento,
      ROLES.jefeCatedra,
    ]);
    for (const rol of ROLES_CON_ALCANCE_POR_UNIDAD) {
      expect(ROLES_GLOBALES).not.toContain(rol);
    }
  });
});
