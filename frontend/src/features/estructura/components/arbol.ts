import type { UnidadArbol } from '../hooks/useUnidades';
import type { Puesto } from '../hooks/usePuestos';

/** La unidad y todas sus ancestras, o [] si no está en el árbol. */
export function unidadesHastaRaiz(
  arbol: UnidadArbol[],
  idUnidad: number,
  ruta: number[] = [],
): number[] {
  for (const unidad of arbol) {
    const actual = [unidad.id, ...ruta];
    if (unidad.id === idUnidad) return actual;
    const dentro = unidadesHastaRaiz(unidad.hijas, idUnidad, actual);
    if (dentro.length > 0) return dentro;
  }
  return [];
}

export function buscarUnidad(
  arbol: UnidadArbol[],
  idUnidad: number,
): UnidadArbol | undefined {
  for (const unidad of arbol) {
    if (unidad.id === idUnidad) return unidad;
    const dentro = buscarUnidad(unidad.hijas, idUnidad);
    if (dentro) return dentro;
  }
  return undefined;
}

/**
 * Puestos que pueden ser superior de un puesto de la unidad `idUnidad`: activos,
 * de esa unidad o de una ancestra, y sin el propio puesto ni sus subordinados.
 */
export function superioresValidos(
  todos: Puesto[],
  actual: Puesto | undefined,
  unidadesValidas: number[],
): Puesto[] {
  const excluidos = new Set<number>();
  if (actual) {
    excluidos.add(actual.id);
    let crecio = true;
    while (crecio) {
      crecio = false;
      for (const p of todos) {
        if (
          p.idPuestoSuperior !== null &&
          excluidos.has(p.idPuestoSuperior) &&
          !excluidos.has(p.id)
        ) {
          excluidos.add(p.id);
          crecio = true;
        }
      }
    }
  }
  return todos.filter(
    (p) =>
      p.activo && unidadesValidas.includes(p.idUnidad) && !excluidos.has(p.id),
  );
}
