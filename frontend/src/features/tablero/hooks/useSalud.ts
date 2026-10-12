import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/cliente';

/** Estado de la base y del almacenamiento, consultado al backend. */
export function useSalud() {
  return useQuery({
    queryKey: ['salud'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/salud');
      if (error || !data) throw new Error('El backend no responde');
      return data;
    },
    refetchInterval: 30_000,
  });
}
