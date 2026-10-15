import { aFechaIso, clave } from './normalizar.js';

describe('clave', () => {
  it('ignora mayúsculas, tildes y espacios de más', () => {
    expect(clave('  Cátedra   de FÍSICA ')).toBe('catedra de fisica');
  });

  it('conserva la ñ, también en mayúscula', () => {
    expect(clave('Año')).toBe('año');
    expect(clave('AÑO')).toBe('año');
  });
});

describe('aFechaIso', () => {
  it('deja intacta una fecha ISO', () => {
    expect(aFechaIso('2024-03-01')).toBe('2024-03-01');
  });

  it('convierte DD/MM/AAAA, con o sin ceros', () => {
    expect(aFechaIso('01/03/2024')).toBe('2024-03-01');
    expect(aFechaIso('1/3/2024')).toBe('2024-03-01');
  });

  it('no inventa nada con formatos desconocidos: los devuelve para que la validación los rechace', () => {
    expect(aFechaIso('marzo 2024')).toBe('marzo 2024');
    expect(aFechaIso('')).toBe('');
  });
});
