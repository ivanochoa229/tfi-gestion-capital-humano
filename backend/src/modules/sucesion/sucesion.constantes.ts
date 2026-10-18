/** Clave del bloqueo que serializa planes y candidatos (Usuarios 7001, Estructura 7002, Conocimiento 7003). */
export const BLOQUEO_SUCESION = 7004;

/** Códigos de `estado_plan`. */
export const ESTADO_PLAN = {
  borrador: 'borrador',
  pendienteAprobacion: 'pendiente_aprobacion',
  aprobado: 'aprobado',
  rechazado: 'rechazado',
  cerrado: 'cerrado',
} as const;

/** Códigos de `estado_accion_transferencia`. */
export const ESTADO_ACCION = {
  pendiente: 'pendiente',
  enCurso: 'en_curso',
  completada: 'completada',
  cancelada: 'cancelada',
} as const;

/** Transiciones permitidas entre estados de plan, por código. */
export const TRANSICIONES_PLAN: Record<string, readonly string[]> = {
  [ESTADO_PLAN.borrador]: [
    ESTADO_PLAN.pendienteAprobacion,
    ESTADO_PLAN.cerrado,
  ],
  [ESTADO_PLAN.pendienteAprobacion]: [
    ESTADO_PLAN.aprobado,
    ESTADO_PLAN.rechazado,
  ],
  [ESTADO_PLAN.aprobado]: [ESTADO_PLAN.cerrado],
  [ESTADO_PLAN.rechazado]: [ESTADO_PLAN.borrador, ESTADO_PLAN.cerrado],
  [ESTADO_PLAN.cerrado]: [],
};

/** Transiciones permitidas entre estados de acción, por código. */
export const TRANSICIONES_ACCION: Record<string, readonly string[]> = {
  [ESTADO_ACCION.pendiente]: [ESTADO_ACCION.enCurso, ESTADO_ACCION.cancelada],
  [ESTADO_ACCION.enCurso]: [ESTADO_ACCION.completada, ESTADO_ACCION.cancelada],
  [ESTADO_ACCION.completada]: [],
  [ESTADO_ACCION.cancelada]: [],
};

export function puedePasar(
  transiciones: Record<string, readonly string[]>,
  desde: string,
  hasta: string,
): boolean {
  return transiciones[desde]?.includes(hasta) ?? false;
}
