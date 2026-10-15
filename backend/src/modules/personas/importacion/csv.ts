import { BadRequestException } from '@nestjs/common';
import { CsvError, parse } from 'csv-parse/sync';
import {
  COLUMNAS,
  MAX_FILAS,
  type Columna,
  type FilaCsv,
  type ValoresFila,
} from './tipos.js';

interface Registro {
  record: string[];
  info: { lines: number };
}

const ocurrencias = (texto: string, caracter: string) =>
  texto.split(caracter).length - 1;

/** Excel en español exporta con `;`; el resto, con `,`. Se decide por la cabecera. */
function detectarSeparador(texto: string): ';' | ',' {
  const cabecera = texto.split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
  return ocurrencias(cabecera, ';') > ocurrencias(cabecera, ',') ? ';' : ',';
}

function indicesDeCabecera(cabecera: string[]): Map<Columna, number> {
  const nombres = cabecera.map((c) => c.trim().toLowerCase());
  const conocidas = new Set<string>(COLUMNAS);

  if (nombres.includes('')) {
    throw new BadRequestException(
      'Hay una columna sin nombre en la cabecera; borrá las columnas vacías a la derecha del archivo',
    );
  }
  const desconocidas = nombres.filter((n) => !conocidas.has(n));
  if (desconocidas.length > 0) {
    throw new BadRequestException(
      `Columnas desconocidas en la cabecera: ${desconocidas.join(', ')}`,
    );
  }
  const repetidas = nombres.filter((n, i) => nombres.indexOf(n) !== i);
  if (repetidas.length > 0) {
    throw new BadRequestException(
      `Columnas repetidas en la cabecera: ${[...new Set(repetidas)].join(', ')}`,
    );
  }
  const faltantes = COLUMNAS.filter((c) => !nombres.includes(c));
  if (faltantes.length > 0) {
    throw new BadRequestException(
      `Faltan columnas en la cabecera: ${faltantes.join(', ')}`,
    );
  }
  return new Map(nombres.map((n, i) => [n as Columna, i]));
}

/** Firma ZIP: los .xlsx son archivos ZIP. */
const FIRMA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * Excel en español guarda "CSV (delimitado por comas)" en Windows-1252. Se
 * intenta UTF-8 estricto (que descarta el BOM) y, si no es válido, se cae a
 * Windows-1252 en vez de dejar caracteres de reemplazo en los nombres.
 */
function decodificar(archivo: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(archivo);
  } catch {
    return new TextDecoder('windows-1252').decode(archivo);
  }
}

/** Mensaje en español sin repetir el de csv-parse, que puede incluir celdas. */
function mensajeDeCsv(error: CsvError): string {
  const linea = error.lines;
  if (
    error.code === 'CSV_RECORD_INCONSISTENT_FIELDS_LENGTH' ||
    error.code === 'CSV_RECORD_INCONSISTENT_COLUMNS'
  ) {
    return `La fila ${linea} no tiene la misma cantidad de columnas que la cabecera`;
  }
  return `No se pudo leer el CSV (línea ${linea}): revisá las comillas y los separadores`;
}

/**
 * Lee el CSV y devuelve las filas de datos con su número de línea (la
 * cabecera es la 1). Ignora las filas totalmente vacías. Todo problema de
 * forma del archivo lanza 400 y corta la importación.
 */
export function leerCsv(archivo: Buffer): FilaCsv[] {
  if (archivo.subarray(0, 4).equals(FIRMA_ZIP)) {
    throw new BadRequestException(
      'El archivo es un libro de Excel (.xlsx): guardalo como CSV (UTF-8) y subilo de nuevo',
    );
  }
  const texto = decodificar(archivo);
  if (texto.trim() === '') {
    throw new BadRequestException('El archivo está vacío');
  }

  let registros: Registro[];
  try {
    registros = parse(texto, {
      delimiter: detectarSeparador(texto),
      skip_empty_lines: true,
      trim: true,
      info: true,
    }) as unknown as Registro[]; // los tipos de csv-parse no modelan el resultado de `info: true`
  } catch (error) {
    if (error instanceof CsvError) {
      throw new BadRequestException(mensajeDeCsv(error));
    }
    throw error;
  }

  const [primero, ...datos] = registros;
  const indices = indicesDeCabecera(primero.record);
  if (datos.length === 0) {
    throw new BadRequestException('El archivo no tiene filas de datos');
  }

  const filas: FilaCsv[] = datos
    .map(({ record, info }) => ({
      fila: info.lines,
      valores: Object.fromEntries(
        COLUMNAS.map((c) => [c, record[indices.get(c) as number] ?? '']),
      ) as ValoresFila,
    }))
    .filter(({ valores }) => Object.values(valores).some((v) => v !== ''));

  if (filas.length > MAX_FILAS) {
    throw new BadRequestException(
      `El archivo tiene ${filas.length} filas y el máximo es ${MAX_FILAS}`,
    );
  }
  return filas;
}
