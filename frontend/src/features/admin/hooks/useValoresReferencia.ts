import { useQuery } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';

export type Dominio = Esquemas['DominioDto'];
export type Valor = Esquemas['ValorReferenciaDto'];

/** Los dominios cerrados del modelo. */
export function useDominiosReferencia() {
  return useQuery({
    queryKey: ['referencia', 'dominios'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/referencia');
      if (error || !data) throw new Error('No se pudieron cargar los dominios');
      return data;
    },
  });
}

/** Valores de un dominio; los inactivos solo si se piden. */
export function useValoresReferencia(
  dominio: string,
  incluirInactivos: boolean,
) {
  return useQuery({
    queryKey: ['referencia', dominio, incluirInactivos],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/referencia/{dominio}', {
        params: { path: { dominio }, query: { incluirInactivos } },
      });
      if (error || !data) throw new Error('No se pudieron cargar los valores');
      return data;
    },
  });
}
