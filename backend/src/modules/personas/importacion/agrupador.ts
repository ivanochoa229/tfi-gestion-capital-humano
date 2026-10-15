import { aFechaIso } from './normalizar.js';
import {
  COLUMNAS_OBLIGATORIAS_OCUPACION,
  COLUMNAS_OCUPACION,
  COLUMNAS_PERSONA,
  type Columna,
  type ErrorImportacion,
  type FilaCsv,
} from './tipos.js';

export interface OcupacionCsv {
  fila: number;
  unidad: string;
  puesto: string;
  fechaDesde: string;
  fechaHasta: string;
  caracter: string;
  dedicacion: string;
}

export interface PersonaCsv {
  /** Primera fila del legajo en el archivo. */
  fila: number;
  legajo: string;
  apellido: string;
  nombre: string;
  documento: string;
  fechaNacimiento: string;
  fechaIngreso: string;
  situacionRevista: string;
  fechaPrevistaRetiro: string;
  ocupaciones: OcupacionCsv[];
}

const COLUMNAS_FECHA: ReadonlySet<Columna> = new Set([
  'fecha_nacimiento',
  'fecha_ingreso',
  'fecha_prevista_retiro',
  'fecha_desde',
  'fecha_hasta',
]);

/** Valor de la celda ya limpio; las fechas en `DD/MM/AAAA` pasan a ISO. */
function celda(fila: FilaCsv, columna: Columna): string {
  const valor = fila.valores[columna].trim();
  return COLUMNAS_FECHA.has(columna) ? aFechaIso(valor) : valor;
}

function personaDe(fila: FilaCsv): PersonaCsv {
  return {
    fila: fila.fila,
    legajo: celda(fila, 'legajo'),
    apellido: celda(fila, 'apellido'),
    nombre: celda(fila, 'nombre'),
    documento: celda(fila, 'documento'),
    fechaNacimiento: celda(fila, 'fecha_nacimiento'),
    fechaIngreso: celda(fila, 'fecha_ingreso'),
    situacionRevista: celda(fila, 'situacion_revista'),
    fechaPrevistaRetiro: celda(fila, 'fecha_prevista_retiro'),
    ocupaciones: [],
  };
}

/**
 * Agrupa las filas por legajo. Los datos de la persona deben coincidir en
 * todas sus filas. Una fila sin ninguna columna de ocupación solo registra a
 * la persona; con alguna, necesita unidad, puesto, fecha_desde, caracter y
 * dedicacion.
 */
export function agrupar(filas: FilaCsv[]): {
  personas: PersonaCsv[];
  errores: ErrorImportacion[];
} {
  const personas = new Map<string, PersonaCsv>();
  const errores: ErrorImportacion[] = [];

  for (const fila of filas) {
    const legajo = celda(fila, 'legajo');
    if (legajo === '') {
      errores.push({
        fila: fila.fila,
        columna: 'legajo',
        mensaje: 'El legajo es obligatorio',
      });
      continue;
    }

    const existente = personas.get(legajo);
    if (existente) {
      const discrepante = COLUMNAS_PERSONA.find(
        (c) => celda(fila, c) !== celdaDePersona(existente, c),
      );
      if (discrepante) {
        errores.push({
          fila: fila.fila,
          columna: discrepante,
          mensaje: `Difiere de la fila ${existente.fila}, que ya trae al legajo ${legajo}: los datos de la persona deben ser iguales en todas sus filas`,
        });
        continue;
      }
    }
    const persona = existente ?? personaDe(fila);
    personas.set(legajo, persona);

    const hayOcupacion = COLUMNAS_OCUPACION.some((c) => celda(fila, c) !== '');
    if (!hayOcupacion) continue;

    const faltantes = COLUMNAS_OBLIGATORIAS_OCUPACION.filter(
      (c) => celda(fila, c) === '',
    );
    if (faltantes.length > 0) {
      for (const columna of faltantes) {
        errores.push({
          fila: fila.fila,
          columna,
          mensaje: `Falta ${columna}: una fila con ocupación necesita unidad, puesto, fecha_desde, caracter y dedicacion`,
        });
      }
      continue;
    }
    persona.ocupaciones.push({
      fila: fila.fila,
      unidad: celda(fila, 'unidad'),
      puesto: celda(fila, 'puesto'),
      fechaDesde: celda(fila, 'fecha_desde'),
      fechaHasta: celda(fila, 'fecha_hasta'),
      caracter: celda(fila, 'caracter'),
      dedicacion: celda(fila, 'dedicacion'),
    });
  }
  return { personas: [...personas.values()], errores };
}

function celdaDePersona(persona: PersonaCsv, columna: Columna): string {
  switch (columna) {
    case 'legajo':
      return persona.legajo;
    case 'apellido':
      return persona.apellido;
    case 'nombre':
      return persona.nombre;
    case 'documento':
      return persona.documento;
    case 'fecha_nacimiento':
      return persona.fechaNacimiento;
    case 'fecha_ingreso':
      return persona.fechaIngreso;
    case 'situacion_revista':
      return persona.situacionRevista;
    case 'fecha_prevista_retiro':
      return persona.fechaPrevistaRetiro;
    default:
      return '';
  }
}
