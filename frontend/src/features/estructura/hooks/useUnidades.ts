import { useQuery } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';

export type UnidadArbol = Esquemas['UnidadArbolDto'];
export type Unidad = Esquemas['UnidadDto'];

export function useArbolUnidades(incluirInactivas: boolean) {
  return useQuery({
    queryKey: ['unidades', 'arbol', incluirInactivas],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/unidades/arbol', {
        params: { query: { incluirInactivas } },
      });
      if (error || !data) throw new Error('No se pudo cargar la estructura');
      return data;
    },
  });
}

/** Lista plana de unidades activas (selectores). */
export function useUnidades() {
  return useQuery({
    queryKey: ['unidades', 'lista'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/unidades');
      if (error || !data) throw new Error('No se pudieron cargar las unidades');
      return data;
    },
  });
}
