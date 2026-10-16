/** Roles que ven los botones de escritura de activos. El backend decide el alcance por unidad. */
export const ROLES_ESCRITORES_ACTIVOS = [
  'analista_puestos',
  'administrador',
  'jefatura_departamento',
  'jefe_catedra',
];

export const puedeEscribirActivos = (rol?: string): boolean =>
  !!rol && ROLES_ESCRITORES_ACTIVOS.includes(rol);

/** Extensiones que ofrece el selector de archivo; el servidor valida el contenido. */
export const EXTENSIONES_ACTIVO =
  '.pdf,.docx,.xlsx,.pptx,.odt,.txt,.png,.jpg,.jpeg';

export function formatearTamanio(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
