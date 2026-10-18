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
