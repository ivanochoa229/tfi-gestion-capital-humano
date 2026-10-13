import { DOMINIOS } from './dominios.js';
import {
  ValorReferencia,
  ValorReferenciaOrdinal,
} from './entities/valor-referencia.base.js';

describe('DOMINIOS', () => {
  it('define los trece dominios cerrados', () => {
    expect(DOMINIOS).toHaveLength(13);
  });

  it('no repite slugs ni tablas', () => {
    expect(new Set(DOMINIOS.map((d) => d.slug)).size).toBe(13);
    expect(new Set(DOMINIOS.map((d) => d.tabla)).size).toBe(13);
  });

  it('tiene exactamente cuatro dominios ordinales', () => {
    expect(
      DOMINIOS.filter((d) => d.ordinal)
        .map((d) => d.slug)
        .sort(),
    ).toEqual([
      'estado-preparacion',
      'nivel-criticidad',
      'nivel-dominio',
      'nivel-jerarquico',
    ]);
  });

  it('cada entidad extiende la base que corresponde a su tipo', () => {
    for (const d of DOMINIOS) {
      const base = d.ordinal ? ValorReferenciaOrdinal : ValorReferencia;
      expect(d.entidad.prototype).toBeInstanceOf(base);
      expect(d.entidad.prototype instanceof ValorReferenciaOrdinal).toBe(
        d.ordinal,
      );
    }
  });
});
