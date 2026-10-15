/** Tamaño máximo del archivo; lo corta la carga multipart (413). */
export const MAX_BYTES = 2 * 1024 * 1024;
/** Filas de datos máximas (sin contar la cabecera); más da 400. */
export const MAX_FILAS = 2000;

export const COLUMNAS = [
  'legajo',
  'apellido',
  'nombre',
  'documento',
  'fecha_nacimiento',
  'fecha_ingreso',
  'situacion_revista',
  'fecha_prevista_retiro',
  'unidad',
  'puesto',
  'fecha_desde',
  'fecha_hasta',
  'caracter',
  'dedicacion',
] as const;

export type Columna = (typeof COLUMNAS)[number];
export type ValoresFila = Record<Columna, string>;

/** Una fila de datos con su número en el archivo (la cabecera es la fila 1). */
export interface FilaCsv {
  fila: number;
  valores: ValoresFila;
}

export interface ErrorImportacion {
  fila: number;
  columna?: string;
  mensaje: string;
}

export const COLUMNAS_PERSONA = [
  'legajo',
  'apellido',
  'nombre',
  'documento',
  'fecha_nacimiento',
  'fecha_ingreso',
  'situacion_revista',
  'fecha_prevista_retiro',
] as const satisfies readonly Columna[];

/** Una fila con ocupación las necesita todas; `fecha_hasta` es opcional. */
export const COLUMNAS_OBLIGATORIAS_OCUPACION = [
  'unidad',
  'puesto',
  'fecha_desde',
  'caracter',
  'dedicacion',
] as const satisfies readonly Columna[];

export const COLUMNAS_OCUPACION = [
  ...COLUMNAS_OBLIGATORIAS_OCUPACION,
  'fecha_hasta',
] as const satisfies readonly Columna[];
