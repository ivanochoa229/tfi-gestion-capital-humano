/** Secciones del menú y los roles que las ven (primer avance §5; es solo navegación). */
export interface Seccion {
  ruta: string;
  nombre: string;
  /** Sin roles: la ve cualquier usuario autenticado. */
  roles?: string[];
}

export const SECCIONES: Seccion[] = [
  {
    ruta: '/',
    nombre: 'Tablero de riesgo',
    roles: ['recursos_humanos', 'autoridad'],
  },
  {
    ruta: '/estructura',
    nombre: 'Estructura y puestos',
  },
  {
    ruta: '/personas',
    nombre: 'Personas',
    roles: [
      'recursos_humanos',
      'autoridad',
      'jefatura_departamento',
      'jefe_catedra',
      'analista_puestos',
      'administrador',
    ],
  },
  { ruta: '/personas/yo', nombre: 'Mi ficha', roles: ['docente'] },
  {
    ruta: '/conocimiento',
    nombre: 'Catálogo de conocimientos',
    roles: [
      'analista_puestos',
      'recursos_humanos',
      'autoridad',
      'jefatura_departamento',
      'jefe_catedra',
      'administrador',
    ],
  },
  {
    ruta: '/conocimiento/mios',
    nombre: 'Mis conocimientos',
    roles: ['docente', 'jefe_catedra', 'jefatura_departamento'],
  },
  {
    ruta: '/conocimiento/pendientes',
    nombre: 'Por acreditar',
    roles: ['jefe_catedra', 'jefatura_departamento'],
  },
  { ruta: '/conocimiento/activos', nombre: 'Activos de conocimiento' },
  {
    ruta: '/criticidad',
    nombre: 'Criticidad',
    roles: [
      'recursos_humanos',
      'autoridad',
      'jefatura_departamento',
      'jefe_catedra',
    ],
  },
  {
    ruta: '/sucesion',
    nombre: 'Sucesión',
    roles: [
      'recursos_humanos',
      'autoridad',
      'jefatura_departamento',
      'jefe_catedra',
    ],
  },
  { ruta: '/sucesion/mia', nombre: 'Mi sucesión', roles: ['docente'] },
  {
    ruta: '/acciones',
    nombre: 'Acciones',
    roles: [
      'recursos_humanos',
      'autoridad',
      'jefatura_departamento',
      'jefe_catedra',
      'docente',
    ],
  },
  {
    ruta: '/deteccion/puntos-unicos-falla',
    nombre: 'Detección',
    roles: [
      'recursos_humanos',
      'autoridad',
      'jefatura_departamento',
      'jefe_catedra',
    ],
  },
  {
    ruta: '/deteccion/mi-brecha',
    nombre: 'Mi brecha',
    roles: ['docente', 'jefe_catedra', 'jefatura_departamento'],
  },
  { ruta: '/admin', nombre: 'Administración', roles: ['administrador'] },
];

export function puedeVer(rol: string, seccion: Seccion): boolean {
  return !seccion.roles || seccion.roles.includes(rol);
}
