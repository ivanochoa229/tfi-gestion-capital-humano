import { BadRequestException } from '@nestjs/common';
import {
  esFechaValida,
  estaAbierta,
  estadoDe,
  hoyDeLaBase,
  seSolapan,
  validarFechasDePersona,
  validarRango,
} from './fechas.js';

const HOY = '2026-06-15';
const o = (fechaDesde: string, fechaHasta: string | null) => ({
  fechaDesde,
  fechaHasta,
});

describe('esFechaValida', () => {
  it.each(['2026-06-15', '2024-02-29', '1999-12-31'])('acepta %s', (f) =>
    expect(esFechaValida(f)).toBe(true),
  );
  it.each([
    '2026-02-30',
    '2025-02-29',
    '2026-13-01',
    '2026-00-10',
    '26-06-15',
    '2026-06-15T10:00:00',
    '2026-6-5',
    '',
    'hoy',
  ])('rechaza %s', (f) => expect(esFechaValida(f)).toBe(false));
});

describe('estadoDe', () => {
  it('es vigente entre el inicio y el fin, ambos inclusive', () => {
    expect(estadoDe(o('2026-06-15', '2026-06-15'), HOY)).toBe('vigente');
    expect(estadoDe(o('2020-01-01', null), HOY)).toBe('vigente');
  });
  it('una ocupación que vence hoy sigue vigente', () => {
    expect(estadoDe(o('2020-01-01', HOY), HOY)).toBe('vigente');
  });
  it('es pasada si terminó antes de hoy', () => {
    expect(estadoDe(o('2020-01-01', '2026-06-14'), HOY)).toBe('pasada');
  });
  it('es futura si empieza después de hoy', () => {
    expect(estadoDe(o('2026-06-16', null), HOY)).toBe('futura');
  });
  it('está abierta si es vigente o futura', () => {
    expect(estaAbierta(o('2020-01-01', HOY), HOY)).toBe(true);
    expect(estaAbierta(o('2027-01-01', null), HOY)).toBe(true);
    expect(estaAbierta(o('2020-01-01', '2026-06-14'), HOY)).toBe(false);
  });
});

describe('seSolapan', () => {
  it('detecta rangos que comparten algún día', () => {
    expect(
      seSolapan(o('2024-01-01', '2024-06-30'), o('2024-06-30', null)),
    ).toBe(true);
    expect(
      seSolapan(o('2024-01-01', null), o('2030-01-01', '2030-02-01')),
    ).toBe(true);
  });
  it('las fechas adyacentes no se solapan', () => {
    expect(
      seSolapan(o('2024-01-01', '2024-06-30'), o('2024-07-01', null)),
    ).toBe(false);
  });
  it('es simétrica', () => {
    const a = o('2024-01-01', '2024-03-01');
    const b = o('2024-02-01', '2024-04-01');
    expect(seSolapan(a, b)).toBe(seSolapan(b, a));
  });
});

describe('validarRango', () => {
  it('acepta fin igual o posterior al inicio y fin nulo', () => {
    expect(() => validarRango('2024-01-01', '2024-01-01')).not.toThrow();
    expect(() => validarRango('2024-01-01', null)).not.toThrow();
  });
  it('rechaza con 400 un fin anterior al inicio', () => {
    expect(() => validarRango('2024-01-02', '2024-01-01')).toThrow(
      BadRequestException,
    );
  });
});

describe('validarFechasDePersona', () => {
  it('acepta un caso válido, con y sin retiro', () => {
    expect(() =>
      validarFechasDePersona('1980-01-01', '2005-03-01', null),
    ).not.toThrow();
    expect(() =>
      validarFechasDePersona('1980-01-01', '2005-03-01', '2005-03-01'),
    ).not.toThrow();
  });
  it('rechaza un ingreso que no es posterior al nacimiento', () => {
    expect(() =>
      validarFechasDePersona('2000-01-01', '2000-01-01', null),
    ).toThrow(/ingreso debe ser posterior al nacimiento/);
  });
  it('rechaza un retiro anterior al ingreso', () => {
    expect(() =>
      validarFechasDePersona('1980-01-01', '2005-03-01', '2005-02-28'),
    ).toThrow(/retiro no puede ser anterior al ingreso/);
  });
});

describe('hoyDeLaBase', () => {
  it('devuelve CURRENT_DATE como texto', async () => {
    const manager = { query: vi.fn(async () => [{ hoy: HOY }]) };
    expect(await hoyDeLaBase(manager)).toBe(HOY);
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('CURRENT_DATE'),
    );
  });
});
