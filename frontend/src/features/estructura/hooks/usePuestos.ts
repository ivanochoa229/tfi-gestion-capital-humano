import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';

export type Puesto = Esquemas['PuestoDto'];
export type PuestoDetalle = Esquemas['PuestoDetalleDto'];
type CrearPuesto = Esquemas['CrearPuestoDto'];
type ActualizarPuesto = Esquemas['ActualizarPuestoDto'];

/** Los puestos de toda la estructura; el volumen es chico y se filtra en la pantalla. */
export function usePuestos() {
  return useQuery({
    queryKey: ['puestos'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/puestos');
      if (error || !data) throw new Error('No se pudieron cargar los puestos');
      return data;
    },
  });
}

function useInvalidar() {
  const cliente = useQueryClient();
  return () => {
    cliente.invalidateQueries({ queryKey: ['puestos'] });
    cliente.invalidateQueries({ queryKey: ['unidades'] });
  };
}

export function useCrearPuesto() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (cuerpo: CrearPuesto) => {
      const { data, error } = await api.POST('/api/puestos', { body: cuerpo });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useActualizarPuesto() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: { id: number; cuerpo: ActualizarPuesto }) => {
      const { data, error } = await api.PATCH('/api/puestos/{id}', {
        params: { path: { id: args.id } },
        body: args.cuerpo,
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useCambiarEstadoPuesto() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: { id: number; accion: 'baja' | 'reactivar' }) => {
      const { data, error } =
        args.accion === 'baja'
          ? await api.POST('/api/puestos/{id}/baja', {
              params: { path: { id: args.id } },
            })
          : await api.POST('/api/puestos/{id}/reactivar', {
              params: { path: { id: args.id } },
            });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useCrearPuestosTipo() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (idUnidad: number) => {
      const { data, error } = await api.POST(
        '/api/unidades/{id}/puestos-tipo',
        {
          params: { path: { id: idUnidad } },
        },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}
