import { BadRequestException } from '@nestjs/common';
import { COLUMNAS, MAX_FILAS } from './tipos.js';
import { leerCsv } from './csv.js';

const CABECERA = COLUMNAS.join(';');
const fila = (valores: Partial<Record<(typeof COLUMNAS)[number], string>>) =>
  COLUMNAS.map((c) => valores[c] ?? '').join(';');
const buffer = (...lineas: string[]) => Buffer.from(lineas.join('\n'), 'utf8');

describe('leerCsv', () => {
  it('lee una fila con separador ; y le asigna el número de línea del archivo', () => {
    const filas = leerCsv(
      buffer(CABECERA, fila({ legajo: 'L-1', apellido: 'Pérez' })),
    );
    expect(filas).toHaveLength(1);
    expect(filas[0].fila).toBe(2);
    expect(filas[0].valores.legajo).toBe('L-1');
    expect(filas[0].valores.apellido).toBe('Pérez');
    expect(filas[0].valores.unidad).toBe('');
  });

  it('detecta el separador coma', () => {
    const coma = (s: string) => s.replaceAll(';', ',');
    const filas = leerCsv(
      buffer(coma(CABECERA), coma(fila({ legajo: 'L-1' }))),
    );
    expect(filas[0].valores.legajo).toBe('L-1');
  });

  it('tolera BOM, CRLF y columnas en otro orden', () => {
    const invertida = [...COLUMNAS].reverse();
    const texto =
      '﻿' +
      invertida.join(';') +
      '\r\n' +
      invertida.map((c) => (c === 'legajo' ? 'L-9' : '')).join(';') +
      '\r\n';
    const filas = leerCsv(Buffer.from(texto, 'utf8'));
    expect(filas[0].valores.legajo).toBe('L-9');
  });

  it('lee comillas con separador adentro como una sola celda', () => {
    const filas = leerCsv(
      buffer(CABECERA, fila({ legajo: 'L-1', apellido: '"Pérez; Gómez"' })),
    );
    expect(filas[0].valores.apellido).toBe('Pérez; Gómez');
  });

  it('ignora las filas vacías que deja Excel', () => {
    const vacia = COLUMNAS.map(() => '').join(';');
    const filas = leerCsv(
      buffer(CABECERA, fila({ legajo: 'L-1' }), vacia, vacia),
    );
    expect(filas).toHaveLength(1);
  });

  it('rechaza un archivo vacío', () => {
    expect(() => leerCsv(Buffer.from('   \n', 'utf8'))).toThrow(
      BadRequestException,
    );
  });

  it('rechaza una cabecera con una columna faltante, nombrándola', () => {
    const sinNombre = COLUMNAS.filter((c) => c !== 'nombre').join(';');
    expect(() => leerCsv(buffer(sinNombre))).toThrow(/nombre/);
  });

  it('rechaza una columna desconocida (nombre mal escrito) en vez de descartarla', () => {
    const mal = COLUMNAS.map((c) =>
      c === 'fecha_prevista_retiro' ? 'fecha_retiro' : c,
    ).join(';');
    expect(() => leerCsv(buffer(mal))).toThrow(/fecha_retiro/);
  });

  it('rechaza una columna repetida', () => {
    expect(() => leerCsv(buffer(CABECERA + ';legajo'))).toThrow(/legajo/);
  });

  it('rechaza una fila con otra cantidad de columnas, indicando la línea', () => {
    expect(() => leerCsv(buffer(CABECERA, 'L-1;Pérez'))).toThrow(/2/);
  });

  it('rechaza más filas que el máximo', () => {
    const filas = Array.from({ length: MAX_FILAS + 1 }, (_, i) =>
      fila({ legajo: `L-${i}` }),
    );
    expect(() => leerCsv(buffer(CABECERA, ...filas))).toThrow(/2000|filas/);
  });

  it('acepta exactamente el máximo de filas', () => {
    const filas = Array.from({ length: MAX_FILAS }, (_, i) =>
      fila({ legajo: `L-${i}` }),
    );
    expect(leerCsv(buffer(CABECERA, ...filas))).toHaveLength(MAX_FILAS);
  });
  describe('codificación', () => {
    it('decodifica Windows-1252 (ANSI de Excel en español)', () => {
      const filas = leerCsv(
        Buffer.from(
          [CABECERA, fila({ apellido: 'Pérez', nombre: 'Muñoz' })].join('\n'),
          'latin1',
        ),
      );
      expect(filas[0].valores.apellido).toBe('Pérez');
      expect(filas[0].valores.nombre).toBe('Muñoz');
    });

    it('no deja caracteres de reemplazo al leer Windows-1252', () => {
      const filas = leerCsv(
        Buffer.from(
          [CABECERA, fila({ apellido: 'Núñez' })].join('\n'),
          'latin1',
        ),
      );
      expect(filas[0].valores.apellido).not.toContain('\uFFFD');
    });

    it('un UTF-8 válido con tildes no cambia', () => {
      const filas = leerCsv(
        buffer(CABECERA, fila({ apellido: 'Gómez Ñandú' })),
      );
      expect(filas[0].valores.apellido).toBe('Gómez Ñandú');
    });

    it('descarta el BOM UTF-8 de la cabecera', () => {
      const filas = leerCsv(
        Buffer.concat([
          Buffer.from([0xef, 0xbb, 0xbf]),
          buffer(CABECERA, fila({ legajo: 'L-1' })),
        ]),
      );
      expect(filas[0].valores.legajo).toBe('L-1');
    });
  });

  it('detecta el separador por la primera línea no vacía', () => {
    const filas = leerCsv(buffer('', CABECERA, fila({ legajo: 'L-1' })));
    expect(filas[0].valores.legajo).toBe('L-1');
    expect(filas[0].fila).toBe(3);
  });

  it('avisa de una columna sin nombre en la cabecera', () => {
    expect(() =>
      leerCsv(buffer(CABECERA + ';', fila({ legajo: 'L-1' }) + ';')),
    ).toThrow(/columna sin nombre/);
  });

  it('traduce una fila con otra cantidad de columnas sin filtrar su contenido', () => {
    const intento = () => leerCsv(buffer(CABECERA, 'SECRETO;Pérez'));
    expect(intento).toThrow(
      'La fila 2 no tiene la misma cantidad de columnas que la cabecera',
    );
    expect(intento).not.toThrow(/SECRETO/);
  });

  it('traduce una comilla sin cerrar sin filtrar su contenido', () => {
    const intento = () =>
      leerCsv(buffer(CABECERA, fila({ apellido: '"SECRETO' })));
    expect(intento).toThrow(/^No se pudo leer el CSV \(línea \d+\): revisá/);
    expect(intento).not.toThrow(/SECRETO/);
  });

  it('rechaza un archivo con solo la cabecera', () => {
    expect(() => leerCsv(buffer(CABECERA))).toThrow(
      'El archivo no tiene filas de datos',
    );
  });

  it('rechaza un libro de Excel (.xlsx)', () => {
    expect(() =>
      leerCsv(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00])),
    ).toThrow(/libro de Excel \(\.xlsx\)/);
  });
});
