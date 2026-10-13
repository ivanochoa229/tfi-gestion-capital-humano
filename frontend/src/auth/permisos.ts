/** Secciones del menú y los roles que las ven (primer avance §5; es solo navegación). */
export interface Seccion {
  ruta: string;
  nombre: string;
  /** Sin roles: la ve cualquier usuario autenticado. */
  roles?: string[];
}

export const SECCIONES: Seccion[] = [
  { ruta: '/', nombre: 'Tablero de riesgo' },
  {
    ruta: '/estructura',
    nombre: 'Estructura y puestos',
  },
  {
    ruta: '/personas',
    nombre: 'Personas',
    roles: ['recursos_humanos', 'docente'],
  },
  {
    ruta: '/conocimiento',
    nombre: 'Conocimiento',
    roles: ['analista_puestos', 'jefe_catedra', 'docente'],
  },
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
      'docente',
    ],
  },
  { ruta: '/admin', nombre: 'Administración', roles: ['administrador'] },
];

export function puedeVer(rol: string, seccion: Seccion): boolean {
  return !seccion.roles || seccion.roles.includes(rol);
}
