import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { MESES_HORIZONTE_DEFECTO } from './deteccion.constantes.js';
import { FiltroHorizonteDto } from './dto/horizonte.dto.js';

const validar = (datos: object) =>
  validateSync(plainToInstance(FiltroHorizonteDto, datos), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

describe('FiltroHorizonteDto', () => {
  it('usa 24 meses por defecto cuando está ausente', () => {
    const inst = plainToInstance(FiltroHorizonteDto, {});
    expect(validar({})).toEqual([]);
    expect(inst.meses ?? MESES_HORIZONTE_DEFECTO).toBe(24);
  });

  it('acepta meses enteros entre 1 y 120', () => {
    expect(validar({ meses: '1' })).toEqual([]);
    expect(validar({ meses: '24' })).toEqual([]);
    expect(validar({ meses: '120' })).toEqual([]);
  });

  it('rechaza meses fuera de rango o no enteros (0, 121, 1.5, abc)', () => {
    expect(validar({ meses: '0' })).toContain('meses');
    expect(validar({ meses: '121' })).toContain('meses');
    expect(validar({ meses: '1.5' })).toContain('meses');
    expect(validar({ meses: 'abc' })).toContain('meses');
  });

  it('acepta incluirConDosOMas como true o false', () => {
    const t = plainToInstance(FiltroHorizonteDto, {
      incluirConDosOMas: 'true',
    });
    expect(validateSync(t)).toEqual([]);
    expect(t.incluirConDosOMas).toBe(true);

    const f = plainToInstance(FiltroHorizonteDto, {
      incluirConDosOMas: 'false',
    });
    expect(validateSync(f)).toEqual([]);
    expect(f.incluirConDosOMas).toBe(false);
  });
});
