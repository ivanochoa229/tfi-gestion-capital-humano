import { describe, expect, it } from 'vitest';
import { aCsv } from './csv-salida.js';

describe('aCsv', () => {
  it('empieza con el BOM UTF-8 y termina las filas con CRLF', () => {
    const columnas = [
      { clave: 'nombre', titulo: 'Nombre' },
      { clave: 'apellido', titulo: 'Apellido' },
    ];
    const filas = [{ nombre: 'Juan', apellido: 'Pérez' }];
    const resultado = aCsv(columnas, filas);

    expect(resultado.startsWith('\uFEFF')).toBe(true);
    expect(resultado).toContain('Nombre;Apellido\r\n');
    expect(resultado).toContain('Juan;Pérez\r\n');
  });

  it('escapa celdas con punto y coma, comillas dobles o saltos de línea', () => {
    const columnas = [{ clave: 'detalle', titulo: 'Detalle' }];
    const filas = [
      { detalle: 'A;B' },
      { detalle: 'Texto con "comillas"' },
      { detalle: 'Línea 1\nLínea 2' },
      { detalle: 'Línea 1\r\nLínea 2' },
    ];
    const resultado = aCsv(columnas, filas);

    expect(resultado).toContain('"A;B"\r\n');
    expect(resultado).toContain('"Texto con ""comillas"""\r\n');
    expect(resultado).toContain('"Línea 1\nLínea 2"\r\n');
    expect(resultado).toContain('"Línea 1\r\nLínea 2"\r\n');
  });

  it('emite cadenas vacías para null y undefined', () => {
    const columnas = [
      { clave: 'a', titulo: 'ColA' },
      { clave: 'b', titulo: 'ColB' },
      { clave: 'c', titulo: 'ColC' },
    ];
    const filas = [{ a: 'X', b: null, c: undefined }];
    const resultado = aCsv(columnas, filas);

    expect(resultado).toContain('X;;\r\n');
  });

  it('neutraliza fórmulas en strings que empiezan con =, +, - o @ con prefijo apóstrofo', () => {
    const columnas = [{ clave: 'formula', titulo: 'Formula' }];
    const filas = [
      { formula: '=SUMA(A1:A2)' },
      { formula: '+12345' },
      { formula: '-12345' },
      { formula: '@SUM' },
    ];
    const resultado = aCsv(columnas, filas);

    expect(resultado).toContain("'=SUMA(A1:A2)\r\n");
    expect(resultado).toContain("'+12345\r\n");
    expect(resultado).toContain("'-12345\r\n");
    expect(resultado).toContain("'@SUM\r\n");
  });

  it('no prefija números negativos ni positivos de tipo number', () => {
    const columnas = [{ clave: 'valor', titulo: 'Valor' }];
    const filas = [{ valor: -42 }, { valor: 100 }, { valor: 0 }];
    const resultado = aCsv(columnas, filas);

    expect(resultado).toContain('-42\r\n');
    expect(resultado).toContain('100\r\n');
    expect(resultado).toContain('0\r\n');
  });

  it('convierte booleanos a sí y no', () => {
    const columnas = [
      { clave: 'activo', titulo: 'Activo' },
      { clave: 'valido', titulo: 'Válido' },
    ];
    const filas = [{ activo: true, valido: false }];
    const resultado = aCsv(columnas, filas);

    expect(resultado).toContain('sí;no\r\n');
  });
});
