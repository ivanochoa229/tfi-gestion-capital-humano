import { normalizarDenominacion } from './normalizar.js';

describe('normalizarDenominacion', () => {
  it.each([
    ['Programación', 'programacion'],
    ['  Bases   de  DATOS ', 'bases de datos'],
    ['ÁRBOLES y Grafos', 'arboles y grafos'],
    ['Análisis Matemático II', 'analisis matematico ii'],
    ['Pingüino', 'pinguino'],
    ['\tSQL\n', 'sql'],
  ])('%j da %j', (entrada, esperado) => {
    expect(normalizarDenominacion(entrada)).toBe(esperado);
  });

  it('conserva la ñ: año y ano son palabras distintas', () => {
    expect(normalizarDenominacion('Año')).toBe('año');
    expect(normalizarDenominacion('AÑO')).toBe('año');
    expect(normalizarDenominacion('Año')).not.toBe(
      normalizarDenominacion('Ano'),
    );
  });

  it('trata igual la ñ compuesta y la descompuesta', () => {
    expect(normalizarDenominacion('año')).toBe('año');
  });

  it('trata igual una tilde compuesta y una descompuesta', () => {
    expect(normalizarDenominacion('Programación')).toBe('programacion');
  });
});
