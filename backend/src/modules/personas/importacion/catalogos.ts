import { clave } from './normalizar.js';

interface Valor {
  id: number;
  denominacion: string;
}

export interface DatosCatalogos {
  situaciones: Valor[];
  caracteres: Valor[];
  dedicaciones: Valor[];
  /** Todas las unidades: las inactivas sirven para armar la ruta de las candidatas. */
  unidades: {
    id: number;
    denominacion: string;
    idSuperior: number | null;
    activo: boolean;
  }[];
  /** Solo puestos activos. */
  puestos: { id: number; denominacion: string; idUnidad: number }[];
}

export type Resolucion<T> = { valor: T } | { error: string };

export interface Catalogos {
  situaciones: Map<string, Valor>;
  caracteres: Map<string, Valor>;
  dedicaciones: Map<string, Valor>;
  /** Unidades activas por clave de denominación. */
  unidadesPorNombre: Map<string, { id: number; ruta: string }[]>;
  /** idUnidad → clave del puesto → id. */
  puestosPorUnidad: Map<number, Map<string, number>>;
}

const porClave = (valores: Valor[]) =>
  new Map(valores.map((v) => [clave(v.denominacion), v]));

export function construirCatalogos(datos: DatosCatalogos): Catalogos {
  const unidades = new Map(datos.unidades.map((u) => [u.id, u]));
  const ruta = (id: number): string => {
    const nombres: string[] = [];
    for (
      let actual = unidades.get(id);
      actual;
      actual =
        actual.idSuperior === null ? undefined : unidades.get(actual.idSuperior)
    ) {
      nombres.unshift(actual.denominacion);
    }
    return nombres.join(' > ');
  };

  const unidadesPorNombre = new Map<string, { id: number; ruta: string }[]>();
  for (const unidad of datos.unidades.filter((u) => u.activo)) {
    const k = clave(unidad.denominacion);
    unidadesPorNombre.set(k, [
      ...(unidadesPorNombre.get(k) ?? []),
      { id: unidad.id, ruta: ruta(unidad.id) },
    ]);
  }

  const puestosPorUnidad = new Map<number, Map<string, number>>();
  for (const puesto of datos.puestos) {
    const delaUnidad = puestosPorUnidad.get(puesto.idUnidad) ?? new Map();
    delaUnidad.set(clave(puesto.denominacion), puesto.id);
    puestosPorUnidad.set(puesto.idUnidad, delaUnidad);
  }

  return {
    situaciones: porClave(datos.situaciones),
    caracteres: porClave(datos.caracteres),
    dedicaciones: porClave(datos.dedicaciones),
    unidadesPorNombre,
    puestosPorUnidad,
  };
}

function resolverDominio(
  catalogo: Map<string, Valor>,
  nombreDominio: string,
  texto: string,
): Resolucion<number> {
  const encontrado = catalogo.get(clave(texto));
  if (encontrado) return { valor: encontrado.id };
  const opciones = [...catalogo.values()].map((v) => v.denominacion).join(', ');
  return {
    error: `"${texto}" no es ${nombreDominio} válido (opciones: ${opciones})`,
  };
}

export const resolverSituacion = (c: Catalogos, texto: string) =>
  resolverDominio(c.situaciones, 'una situación de revista', texto);

export const resolverCaracter = (c: Catalogos, texto: string) =>
  resolverDominio(c.caracteres, 'un carácter de ocupación', texto);

export const resolverDedicacion = (c: Catalogos, texto: string) =>
  resolverDominio(c.dedicaciones, 'una dedicación', texto);

export function resolverPuesto(
  c: Catalogos,
  unidad: string,
  puesto: string,
): Resolucion<number> {
  const candidatas = c.unidadesPorNombre.get(clave(unidad)) ?? [];
  if (candidatas.length === 0) {
    return { error: `No existe la unidad activa "${unidad}"` };
  }
  if (candidatas.length > 1) {
    return {
      error: `La unidad "${unidad}" es ambigua; puede ser: ${candidatas
        .map((u) => u.ruta)
        .join(' | ')}`,
    };
  }
  const id = c.puestosPorUnidad.get(candidatas[0].id)?.get(clave(puesto));
  if (id === undefined) {
    return {
      error: `La unidad "${unidad}" no tiene un puesto activo "${puesto}"`,
    };
  }
  return { valor: id };
}
