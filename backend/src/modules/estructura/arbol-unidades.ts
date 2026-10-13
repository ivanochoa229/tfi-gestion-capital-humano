import type { UnidadArbolDto, UnidadDto } from './dto/unidad.dto.js';

/**
 * Arma el árbol a partir de la lista plana. Una unidad cuyo superior no está
 * en la lista (por ejemplo, porque está inactivo y se lo filtró) queda como raíz.
 */
export function armarArbol(unidades: UnidadDto[]): UnidadArbolDto[] {
  const nodos = new Map<number, UnidadArbolDto>(
    unidades.map((u) => [u.id, { ...u, hijas: [] }]),
  );
  const raices: UnidadArbolDto[] = [];
  for (const nodo of nodos.values()) {
    const padre =
      nodo.idUnidadSuperior === null
        ? undefined
        : nodos.get(nodo.idUnidadSuperior);
    (padre ? padre.hijas : raices).push(nodo);
  }
  return raices;
}
