import {
  ROLES,
  ROLES_CON_ALCANCE_POR_UNIDAD,
  ROLES_CON_DATOS_PERSONALES,
  ROLES_DECLARANTES,
  ROLES_EVALUADORES,
  ROLES_GLOBALES,
  ROLES_EVALUADORES_DE_CRITICIDAD,
  ROLES_LECTORES_DE_CRITICIDAD,
  ROLES_LECTORES_DE_MATRIZ,
  ROLES_LECTORES_DE_PERFIL,
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

  it('define quién declara, quién acredita y quién lee el perfil de conocimiento', () => {
    expect(ROLES_DECLARANTES).toEqual([
      ROLES.docente,
      ROLES.jefeCatedra,
      ROLES.jefaturaDepartamento,
    ]);
    expect(ROLES_EVALUADORES).toEqual([
      ROLES.jefeCatedra,
      ROLES.jefaturaDepartamento,
    ]);
    expect([...ROLES_LECTORES_DE_PERFIL].sort()).toEqual([
      'autoridad',
      'docente',
      'jefatura_departamento',
      'jefe_catedra',
      'recursos_humanos',
    ]);
    // El analista de puestos y el administrador no ven el conocimiento de las personas.
    expect(ROLES_LECTORES_DE_PERFIL).not.toContain(ROLES.analistaPuestos);
    expect(ROLES_LECTORES_DE_PERFIL).not.toContain(ROLES.administrador);
  });

  it('la criticidad la evalúan RR. HH. y los jefes; la leen además las autoridades; el docente, el analista y el administrador no', () => {
    expect([...ROLES_EVALUADORES_DE_CRITICIDAD].sort()).toEqual([
      'jefatura_departamento',
      'jefe_catedra',
      'recursos_humanos',
    ]);
    expect([...ROLES_LECTORES_DE_CRITICIDAD].sort()).toEqual([
      'autoridad',
      'jefatura_departamento',
      'jefe_catedra',
      'recursos_humanos',
    ]);
    for (const rol of [
      'docente',
      'analista_puestos',
      'administrador',
    ] as const) {
      expect(ROLES_LECTORES_DE_CRITICIDAD).not.toContain(rol);
    }
    expect(ROLES_LECTORES_DE_MATRIZ).toEqual([
      ...ROLES_LECTORES_DE_CRITICIDAD,
      'administrador',
    ]);
  });
});
