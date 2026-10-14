import {
  ROLES,
  ROLES_CON_ALCANCE_POR_UNIDAD,
  ROLES_CON_DATOS_PERSONALES,
  ROLES_GLOBALES,
  ROLES_SIN_DOCENTE,
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

  it('el docente es el único rol fuera de ROLES_SIN_DOCENTE', () => {
    expect(ROLES_SIN_DOCENTE).not.toContain('docente');
    expect(ROLES_SIN_DOCENTE).toHaveLength(TODOS_LOS_ROLES.length - 1);
  });

  it('solo RR. HH. y el administrador ven datos personales', () => {
    expect([...ROLES_CON_DATOS_PERSONALES].sort()).toEqual([
      'administrador',
      'recursos_humanos',
    ]);
  });
});
