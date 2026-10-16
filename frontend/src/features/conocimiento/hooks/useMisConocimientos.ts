import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { invalidarConocimiento } from './useConocimientos';

export type MiConocimiento = Esquemas['MiConocimientoDto'];

/** Requisitos de los puestos que ocupa hoy más lo que ya registró. */
export function useMisConocimientos(habilitado: boolean) {
  return useQuery({
    queryKey: ['mis-conocimientos'],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await api.GET('/api/conocimientos/mios');
      if (error || !data)
        throw new Error('No se pudieron cargar tus conocimientos');
      return data;
    },
  });
}

export function useDeclarar() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (a: {
      idPersona: number;
      idConocimiento: number;
      idNivel: number;
    }) => {
      const { data, error } = await api.PUT(
        '/api/personas/{idPersona}/conocimientos/{idConocimiento}/declaracion',
        {
          params: {
            path: { idPersona: a.idPersona, idConocimiento: a.idConocimiento },
          },
          body: { idNivel: a.idNivel },
        },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}

export function useRetirarDeclaracion() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (a: { idPersona: number; idConocimiento: number }) => {
      const { error } = await api.DELETE(
        '/api/personas/{idPersona}/conocimientos/{idConocimiento}/declaracion',
        { params: { path: a } },
      );
      if (error) throw new Error(mensajeError(error));
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}
