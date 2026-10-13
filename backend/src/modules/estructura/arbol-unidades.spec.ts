import type { UnidadDto } from './dto/unidad.dto.js';
import { armarArbol } from './arbol-unidades.js';

const unidad = (id: number, idUnidadSuperior: number | null): UnidadDto => ({
  id,
  denominacion: `U${id}`,
  tipo: idUnidadSuperior === null ? 'departamento' : 'catedra',
  idUnidadSuperior,
  activo: true,
});

describe('armarArbol', () => {
  it('cuelga las cátedras del departamento', () => {
    const arbol = armarArbol([unidad(1, null), unidad(2, 1), unidad(3, 1)]);
    expect(arbol).toHaveLength(1);
    expect(arbol[0].hijas.map((h) => h.id)).toEqual([2, 3]);
    expect(arbol[0].hijas[0].hijas).toEqual([]);
  });

  it('sube a la raíz una unidad cuyo superior no está en la lista', () => {
    const arbol = armarArbol([unidad(2, 1)]);
    expect(arbol.map((u) => u.id)).toEqual([2]);
  });

  it('devuelve un arreglo vacío si no hay unidades', () => {
    expect(armarArbol([])).toEqual([]);
  });
});
