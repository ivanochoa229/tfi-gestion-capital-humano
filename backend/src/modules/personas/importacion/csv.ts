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
  const cabecera = texto.split(/\r?\n/, 1)[0];
  return ocurrencias(cabecera, ';') > ocurrencias(cabecera, ',') ? ';' : ',';
}

function indicesDeCabecera(cabecera: string[]): Map<Columna, number> {
  const nombres = cabecera.map((c) => c.trim().toLowerCase());
  const conocidas = new Set<string>(COLUMNAS);

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

/**
 * Lee el CSV y devuelve las filas de datos con su número de línea (la
 * cabecera es la 1). Ignora las filas totalmente vacías. Todo problema de
 * forma del archivo lanza 400 y corta la importación.
 */
export function leerCsv(archivo: Buffer): FilaCsv[] {
  const texto = archivo.toString('utf8').replace(/^﻿/, '');
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
      throw new BadRequestException(`No se pudo leer el CSV: ${error.message}`);
    }
    throw error;
  }

  const [primero, ...datos] = registros;
  const indices = indicesDeCabecera(primero.record);

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
