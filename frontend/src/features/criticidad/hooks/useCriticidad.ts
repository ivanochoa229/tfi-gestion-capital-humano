import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';

export type Matriz = Esquemas['MatrizDto'];
export type Par = Esquemas['ParCriticidadDto'];
export type Avance = Esquemas['AvanceDto'];
export type Evaluacion = Esquemas['EvaluacionDto'];

export interface FiltroPares {
  idUnidad?: number;
  idPuesto?: number;
  estado?: 'pendiente' | 'evaluado';
}

export function useMatriz() {
  return useQuery({
    queryKey: ['criticidad', 'matriz'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/criticidad/matriz');
      if (error || !data) throw new Error('No se pudo cargar la matriz');
      return data;
    },
  });
}

export function usePares(filtro: FiltroPares) {
  return useQuery({
    queryKey: ['criticidad', 'pares', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/criticidad/pares', {
        params: { query: filtro },
      });
      if (error || !data) throw new Error('No se pudieron cargar los pares');
      return data;
    },
  });
}

export function useAvance(filtro: Pick<FiltroPares, 'idUnidad'>) {
  return useQuery({
    queryKey: ['criticidad', 'avance', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/criticidad/avance', {
        params: { query: filtro },
      });
      if (error || !data) throw new Error('No se pudo cargar el avance');
      return data;
    },
  });
}

export function useHistorialEvaluaciones(
  idPuesto: number,
  idConocimiento: number,
) {
  return useQuery({
    queryKey: ['criticidad', 'historial', idPuesto, idConocimiento],
    queryFn: async () => {
      const { data, error } = await api.GET(
        '/api/puestos/{idPuesto}/criticidad/{idConocimiento}/historial',
        { params: { path: { idPuesto, idConocimiento } } },
      );
      if (error || !data) throw new Error('No se pudo cargar el historial');
      return data;
    },
  });
}

export function useEvaluar() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (e: {
      idPuesto: number;
      idConocimiento: number;
      idNivelImpacto: number;
      idNivelDificultad: number;
      fechaEvaluacion: string;
      observaciones: string | null;
    }) => {
      const { data, error } = await api.POST(
        '/api/puestos/{idPuesto}/criticidad/{idConocimiento}',
        {
          params: {
            path: { idPuesto: e.idPuesto, idConocimiento: e.idConocimiento },
          },
          body: {
            idNivelImpacto: e.idNivelImpacto,
            idNivelDificultad: e.idNivelDificultad,
            fechaEvaluacion: e.fechaEvaluacion,
            observaciones: e.observaciones,
          },
        },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['criticidad'] }),
  });
}
