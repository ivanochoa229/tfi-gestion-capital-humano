/** Códigos de `tipo_unidad` que usa el código de la aplicación. */
export const TIPOS_UNIDAD = {
  departamento: 'departamento',
  catedra: 'catedra',
} as const;

/** Códigos de `nivel_jerarquico` que usan los puestos tipo. */
export const NIVELES_JERARQUICOS = {
  conduccionDepartamento: 'conduccion_departamento',
  conduccionCatedra: 'conduccion_catedra',
  coordinacionDocente: 'coordinacion_docente',
  operativoDocente: 'operativo_docente',
} as const;

/** Slugs de los dominios de referencia (`ReferenciaService.validarActivo`). */
export const DOMINIO_NIVEL_JERARQUICO = 'nivel-jerarquico';
export const DOMINIO_TIPO_RELACION_CONTRACTUAL = 'tipo-relacion-contractual';
