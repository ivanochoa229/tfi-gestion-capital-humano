import { BadRequestException } from '@nestjs/common';
import { ParseFechaPipe } from './fecha.pipe.js';

describe('ParseFechaPipe', () => {
  const pipe = new ParseFechaPipe();
  it('devuelve una fecha válida', () => {
    expect(pipe.transform('2026-06-15')).toBe('2026-06-15');
  });
  it.each(['2026-02-30', '2026-06-15T10:00', 'ayer', '15/06/2026'])(
    'rechaza %s con 400',
    (valor) => {
      expect(() => pipe.transform(valor)).toThrow(BadRequestException);
    },
  );
});
