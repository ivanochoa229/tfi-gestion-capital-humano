import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';

export type Conocimiento = Esquemas['ConocimientoDto'];
export type ResultadoFusion = Esquemas['ResultadoFusionDto'];
type CrearConocimiento = Esquemas['CrearConocimientoDto'];
type ActualizarConocimiento = Esquemas['ActualizarConocimientoDto'];

export interface FiltroConocimientos {
  q?: string;
  idTipo?: number;
  idArea?: number;
  /** Sin valor: activos e inactivos. */
  activo?: boolean;
}

/** Todo lo que depende del catálogo y de los datos de conocimiento se vuelve a pedir. */
export function invalidarConocimiento(cliente: QueryClient) {
  for (const clave of [
    'conocimientos',
    'requisitos',
    'mis-conocimientos',
    'pendientes-acreditacion',
    'perfil-conocimiento',
  ]) {
    cliente.invalidateQueries({ queryKey: [clave] });
  }
}

/** El catálogo es chico (cientos de filas): la pantalla filtra en el servidor pero sin paginar. */
export function useConocimientos(filtro: FiltroConocimientos = {}) {
  return useQuery({
    queryKey: ['conocimientos', 'lista', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/conocimientos', {
        params: { query: filtro },
      });
      if (error || !data) {
        throw new Error('No se pudo cargar el catálogo de conocimientos');
      }
      return data;
    },
  });
}

export function useCrearConocimiento() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (cuerpo: CrearConocimiento) => {
      const { data, error } = await api.POST('/api/conocimientos', {
        body: cuerpo,
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}

export function useActualizarConocimiento() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      cuerpo,
    }: {
      id: number;
      cuerpo: ActualizarConocimiento;
    }) => {
      const { data, error } = await api.PATCH('/api/conocimientos/{id}', {
        params: { path: { id } },
        body: cuerpo,
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}

export function useCambiarEstadoConocimiento() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      accion,
    }: {
      id: number;
      accion: 'baja' | 'reactivar';
    }) => {
      const { data, error } =
        accion === 'baja'
          ? await api.POST('/api/conocimientos/{id}/baja', {
              params: { path: { id } },
            })
          : await api.POST('/api/conocimientos/{id}/reactivar', {
              params: { path: { id } },
            });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}

export function useFusionarConocimientos() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({
      idOrigen,
      idDestino,
    }: {
      idOrigen: number;
      idDestino: number;
    }): Promise<ResultadoFusion> => {
      const { data, error } = await api.POST('/api/conocimientos/{id}/fusionar', {
        params: { path: { id: idOrigen } },
        body: { idDestino },
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}
