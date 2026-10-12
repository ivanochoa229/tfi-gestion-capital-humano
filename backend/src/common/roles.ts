/** Roles fijos del sistema (primer avance §5). Las reglas viven en el código. */
export const ROLES = {
  analistaPuestos: 'analista_puestos',
  recursosHumanos: 'recursos_humanos',
  autoridad: 'autoridad',
  jefaturaDepartamento: 'jefatura_departamento',
  jefeCatedra: 'jefe_catedra',
  administrador: 'administrador',
  docente: 'docente',
} as const;

export type CodigoRol = (typeof ROLES)[keyof typeof ROLES];

export const TODOS_LOS_ROLES: CodigoRol[] = Object.values(ROLES);

/** Ven los datos de toda la facultad. */
export const ROLES_GLOBALES: CodigoRol[] = [
  ROLES.analistaPuestos,
  ROLES.recursosHumanos,
  ROLES.autoridad,
];

/** Ven solo las unidades asignadas y sus descendientes. */
export const ROLES_CON_ALCANCE_POR_UNIDAD: CodigoRol[] = [
  ROLES.jefaturaDepartamento,
  ROLES.jefeCatedra,
];
