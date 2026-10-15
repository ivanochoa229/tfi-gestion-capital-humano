import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { invalidarConocimiento } from './useConocimientos';

export type Requisito = Esquemas['RequisitoDto'];
export type ResultadoCopia = Esquemas['ResultadoCopiaDto'];

export function useRequisitos(idPuesto: number | undefined) {
  return useQuery({
    queryKey: ['requisitos', idPuesto],
    enabled: idPuesto !== undefined,
    queryFn: async () => {
      const { data, error } = await api.GET(
        '/api/puestos/{idPuesto}/requisitos',
        {
          params: { path: { idPuesto: idPuesto as number } },
        },
      );
      if (error || !data)
        throw new Error('No se pudieron cargar los requisitos');
      return data;
    },
  });
}

export function useGuardarRequisito() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (a: {
      idPuesto: number;
      idConocimiento: number;
      idNivel: number;
      esExcluyente: boolean;
    }) => {
      const { data, error } = await api.PUT(
        '/api/puestos/{idPuesto}/requisitos/{idConocimiento}',
        {
          params: {
            path: { idPuesto: a.idPuesto, idConocimiento: a.idConocimiento },
          },
          body: { idNivel: a.idNivel, esExcluyente: a.esExcluyente },
        },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}

export function useQuitarRequisito() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (a: { idPuesto: number; idConocimiento: number }) => {
      const { error } = await api.DELETE(
        '/api/puestos/{idPuesto}/requisitos/{idConocimiento}',
        { params: { path: a } },
      );
      if (error) throw new Error(mensajeError(error));
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}

export function useCopiarRequisitos() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (a: {
      idPuestoDestino: number;
      idPuestoOrigen: number;
    }): Promise<ResultadoCopia> => {
      const { data, error } = await api.POST(
        '/api/puestos/{idPuesto}/requisitos/copiar',
        {
          params: { path: { idPuesto: a.idPuestoDestino } },
          body: { idPuestoOrigen: a.idPuestoOrigen },
        },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}
