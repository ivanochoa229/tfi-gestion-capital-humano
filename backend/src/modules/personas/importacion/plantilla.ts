import { COLUMNAS } from './tipos.js';

const EJEMPLO: Record<(typeof COLUMNAS)[number], string> = {
  legajo: 'L-1234',
  apellido: 'Pérez',
  nombre: 'Ana',
  documento: '30111111',
  fecha_nacimiento: '1980-05-20',
  fecha_ingreso: '2005-03-01',
  situacion_revista: 'Planta permanente',
  fecha_prevista_retiro: '',
  unidad: 'Cátedra de Física',
  puesto: 'Profesor titular',
  fecha_desde: '2020-03-01',
  fecha_hasta: '',
  caracter: 'Titular',
  dedicacion: 'Exclusiva',
};

/** BOM para que Excel abra el archivo como UTF-8; separador `;` como el Excel en español. */
export const PLANTILLA_CSV = `﻿${COLUMNAS.join(';')}\n${COLUMNAS.map((c) => EJEMPLO[c]).join(';')}\n`;
