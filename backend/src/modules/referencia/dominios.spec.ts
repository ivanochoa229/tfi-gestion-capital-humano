import { DOMINIOS } from './dominios.js';
import {
  ValorReferencia,
  ValorReferenciaOrdinal,
} from './entities/valor-referencia.base.js';

describe('DOMINIOS', () => {
  it('define los dieciocho dominios cerrados', () => {
    expect(DOMINIOS).toHaveLength(18);
  });

  it('no repite slugs ni tablas', () => {
    expect(new Set(DOMINIOS.map((d) => d.slug)).size).toBe(18);
    expect(new Set(DOMINIOS.map((d) => d.tabla)).size).toBe(18);
  });

  it('tiene exactamente cinco dominios ordinales', () => {
    expect(
      DOMINIOS.filter((d) => d.ordinal)
        .map((d) => d.slug)
        .sort(),
    ).toEqual([
      'dedicacion',
      'estado-preparacion',
      'nivel-criticidad',
      'nivel-dominio',
      'nivel-jerarquico',
    ]);
  });

  it('incluye los dominios de conocimiento', () => {
    const porSlug = new Map(DOMINIOS.map((d) => [d.slug, d]));
    expect(porSlug.get('area-tematica')).toMatchObject({
      tabla: 'area_tematica',
      ordinal: false,
    });
    expect(porSlug.get('tipo-evidencia')).toMatchObject({
      tabla: 'tipo_evidencia',
      ordinal: false,
    });
  });

  it('incluye los dominios de personas', () => {
    const porSlug = new Map(DOMINIOS.map((d) => [d.slug, d]));
    expect(porSlug.get('situacion-revista')).toMatchObject({
      tabla: 'situacion_revista',
      ordinal: false,
    });
    expect(porSlug.get('dedicacion')).toMatchObject({
      tabla: 'dedicacion',
      ordinal: true,
    });
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

  it('incluye el dominio de documentos', () => {
    const porSlug = new Map(DOMINIOS.map((d) => [d.slug, d]));
    expect(porSlug.get('tipo-documento')).toMatchObject({
      tabla: 'tipo_documento',
      ordinal: false,
    });
  });
});
