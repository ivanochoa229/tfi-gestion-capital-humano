import { useQuery } from '@tanstack/react-query';
import { api, type Esquemas } from '../api/cliente';

export type Sesion = Esquemas['SesionDto'];

/** Usuario autenticado, o null si no hay sesión (401). */
export function useSesion() {
  return useQuery({
    queryKey: ['sesion'],
    queryFn: async (): Promise<Sesion | null> => {
      const { data, response } = await api.GET('/api/auth/yo');
      if (response.status === 401) return null;
      if (!data) throw new Error('No se pudo consultar la sesión');
      return data;
    },
    retry: false,
    staleTime: 60_000,
  });
}
