import type { ChipProps } from '@mui/material';

/** Etiqueta en español de cada estado de plan, por su código de referencia. */
const ESTADOS_PLAN: Record<
  string,
  { etiqueta: string; color: ChipProps['color'] }
> = {
  borrador: { etiqueta: 'Borrador', color: 'default' },
  pendiente_aprobacion: {
    etiqueta: 'Pendiente de aprobación',
    color: 'warning',
  },
  aprobado: { etiqueta: 'Aprobado', color: 'success' },
  rechazado: { etiqueta: 'Rechazado', color: 'error' },
  cerrado: { etiqueta: 'Cerrado', color: 'default' },
};

export const CODIGOS_ESTADO_PLAN = Object.keys(ESTADOS_PLAN);

export function etiquetaEstadoPlan(codigo: string): string {
  return ESTADOS_PLAN[codigo]?.etiqueta ?? codigo;
}

export function colorEstadoPlan(codigo: string): ChipProps['color'] {
  return ESTADOS_PLAN[codigo]?.color ?? 'default';
}

const ESTADOS_ACCION: Record<string, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export function etiquetaEstadoAccion(codigo: string): string {
  return ESTADOS_ACCION[codigo] ?? codigo;
}

/** Roles que escriben planes y candidatos (jefatura) y que resuelven (autoridad). */
export const ROL_ELABORADOR = 'jefatura_departamento';
export const ROL_APROBADOR = 'autoridad';
export const ROLES_SUCESION = [
  'recursos_humanos',
  'autoridad',
  'jefatura_departamento',
  'jefe_catedra',
];

export const CODIGOS_ESTADO_ACCION = Object.keys(ESTADOS_ACCION);

/**
 * Opciones al avanzar una acción (completada y cancelada son finales). En
 * curso ofrece «en_curso» de nuevo: es actualizar la nota sin cambiar el estado.
 */
export function siguientesEstadosAccion(codigo: string): string[] {
  if (codigo === 'pendiente') return ['en_curso'];
  if (codigo === 'en_curso') return ['completada', 'en_curso'];
  return [];
}

export const ROL_GESTOR_ACCIONES = 'recursos_humanos';
export const ROLES_ACCIONES = [
  'recursos_humanos',
  'autoridad',
  'jefatura_departamento',
  'jefe_catedra',
  'docente',
];

/** Roles que, sin gestionar, avanzan las acciones de las que son responsables. */
const ROLES_RESPONSABLES_QUE_AVANZAN = [
  'docente',
  'jefatura_departamento',
  'jefe_catedra',
];

/** Quién ve «Avanzar»: RR. HH. cualquiera; docente y jefes solo las suyas como responsable. */
export function puedeAvanzarAccion(
  sesion: { rol: string; idPersona?: number | null } | null | undefined,
  accion: { idResponsable: number },
): boolean {
  if (!sesion) return false;
  if (sesion.rol === ROL_GESTOR_ACCIONES) return true;
  return (
    ROLES_RESPONSABLES_QUE_AVANZAN.includes(sesion.rol) &&
    !!sesion.idPersona &&
    accion.idResponsable === sesion.idPersona
  );
}
