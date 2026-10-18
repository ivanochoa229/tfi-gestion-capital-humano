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

/** Todos menos el docente: ven personas y ocupaciones de la facultad. */
export const ROLES_SIN_DOCENTE: CodigoRol[] = TODOS_LOS_ROLES.filter(
  (rol) => rol !== ROLES.docente,
);

/** Ven el documento y la fecha de nacimiento (RNF02, Ley 25.326). */
export const ROLES_CON_DATOS_PERSONALES: CodigoRol[] = [
  ROLES.recursosHumanos,
  ROLES.administrador,
];

/** Declaran su propio conocimiento: todos los que son personas con conocimientos que declarar. */
export const ROLES_DECLARANTES: CodigoRol[] = [
  ROLES.docente,
  ROLES.jefeCatedra,
  ROLES.jefaturaDepartamento,
];

/** Acreditan el conocimiento de otras personas, dentro de su alcance por unidad. */
export const ROLES_EVALUADORES: CodigoRol[] = [
  ROLES.jefeCatedra,
  ROLES.jefaturaDepartamento,
];

/** Leen el perfil de conocimiento de una persona (dato sensible, RNF02). */
export const ROLES_LECTORES_DE_PERFIL: CodigoRol[] = [
  ROLES.recursosHumanos,
  ROLES.autoridad,
  ROLES.jefaturaDepartamento,
  ROLES.jefeCatedra,
  ROLES.docente,
];

/** Escriben activos de conocimiento (RF11): cualquier unidad o solo las de su alcance. */
export const ROLES_ESCRITORES_DE_ACTIVOS: CodigoRol[] = [
  ROLES.analistaPuestos,
  ROLES.administrador,
  ROLES.jefaturaDepartamento,
  ROLES.jefeCatedra,
];

/** Entre los escritores, los que no están limitados por alcance. */
export const ROLES_ESCRITORES_GLOBALES_DE_ACTIVOS: CodigoRol[] = [
  ROLES.analistaPuestos,
  ROLES.administrador,
];

/** Evalúan la criticidad de un par conocimiento-puesto (RF12): RR. HH. sin límite; los jefes, dentro de su alcance. */
export const ROLES_EVALUADORES_DE_CRITICIDAD: CodigoRol[] = [
  ROLES.recursosHumanos,
  ROLES.jefaturaDepartamento,
  ROLES.jefeCatedra,
];

/** Leen evaluaciones de criticidad (RF24): los evaluadores y las autoridades. El docente no. */
export const ROLES_LECTORES_DE_CRITICIDAD: CodigoRol[] = [
  ROLES.recursosHumanos,
  ROLES.autoridad,
  ROLES.jefaturaDepartamento,
  ROLES.jefeCatedra,
];

/** Leen escalas y matriz: los lectores de criticidad y el administrador, que edita la matriz. */
export const ROLES_LECTORES_DE_MATRIZ: CodigoRol[] = [
  ...ROLES_LECTORES_DE_CRITICIDAD,
  ROLES.administrador,
];

/** Leen planes y candidatos de sucesión (RF13): RR. HH. y autoridad, y los jefes dentro de su alcance. */
export const ROLES_LECTORES_DE_SUCESION: CodigoRol[] = [
  ROLES.recursosHumanos,
  ROLES.autoridad,
  ROLES.jefaturaDepartamento,
  ROLES.jefeCatedra,
];

/** Elaboran planes y candidatos: la jefatura, para puestos de su alcance. */
export const ROLES_ELABORADORES_DE_PLANES: CodigoRol[] = [
  ROLES.jefaturaDepartamento,
];

/** Aprueban o rechazan planes. */
export const ROLES_APROBADORES_DE_PLANES: CodigoRol[] = [ROLES.autoridad];

/** Crean y editan acciones de transferencia (RF15). */
export const ROLES_GESTORES_DE_ACCIONES: CodigoRol[] = [ROLES.recursosHumanos];

/** Leen acciones: los lectores de sucesión y el docente (las suyas). */
export const ROLES_LECTORES_DE_ACCIONES: CodigoRol[] = [
  ...ROLES_LECTORES_DE_SUCESION,
  ROLES.docente,
];

/**
 * Avanzan el estado de una acción: RR. HH. (cualquiera) y, solo si son el
 * responsable de la acción, el docente y las jefaturas. La autoridad no.
 */
export const ROLES_AVANZADORES_DE_ACCIONES: CodigoRol[] = [
  ROLES.recursosHumanos,
  ROLES.docente,
  ROLES.jefaturaDepartamento,
  ROLES.jefeCatedra,
];

/** Leen los listados de detección y la brecha (RF16–RF20, RF24). */
export const ROLES_LECTORES_DE_DETECCION: CodigoRol[] = [
  ROLES.recursosHumanos,
  ROLES.autoridad,
  ROLES.jefaturaDepartamento,
  ROLES.jefeCatedra,
];

/** Roles con acceso global a detección, CSV y tablero de riesgo (RF21). */
export const ROLES_GLOBALES_DE_DETECCION: CodigoRol[] = [
  ROLES.recursosHumanos,
  ROLES.autoridad,
];

/** Leen su propia brecha de perfil (RF19, RF24): docente y jefaturas. */
export const ROLES_LECTORES_DE_BRECHA_PROPIA: CodigoRol[] = [
  ROLES.docente,
  ROLES.jefeCatedra,
  ROLES.jefaturaDepartamento,
];
