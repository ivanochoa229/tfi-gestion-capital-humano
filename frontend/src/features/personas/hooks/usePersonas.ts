import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';

export type Persona = Esquemas['PersonaDto'];
export type PersonaDetalle = Esquemas['PersonaDetalleDto'];
type CrearPersona = Esquemas['CrearPersonaDto'];
type ActualizarPersona = Esquemas['ActualizarPersonaDto'];

interface FiltroPersonas {
  q?: string;
  activo?: boolean;
  sinUsuario?: boolean;
}

/** Las personas de la facultad; el volumen es chico y la pantalla filtra por texto. */
export function usePersonas(filtro: FiltroPersonas = {}) {
  return useQuery({
    queryKey: ['personas', 'lista', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/personas', {
        params: { query: filtro },
      });
      if (error || !data) throw new Error('No se pudieron cargar las personas');
      return data;
    },
  });
}

export function usePersona(id: number | undefined) {
  return useQuery({
    queryKey: ['personas', 'detalle', id],
    enabled: id !== undefined,
    queryFn: async () => {
      const { data, error } = await api.GET('/api/personas/{id}', {
        params: { path: { id: id as number } },
      });
      if (error || !data) throw new Error('No se pudo cargar la persona');
      return data;
    },
  });
}

function useInvalidar() {
  const cliente = useQueryClient();
  return () => {
    cliente.invalidateQueries({ queryKey: ['personas'] });
    cliente.invalidateQueries({ queryKey: ['ocupaciones'] });
  };
}

export function useCrearPersona() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (cuerpo: CrearPersona) => {
      const { data, error } = await api.POST('/api/personas', { body: cuerpo });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useActualizarPersona() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: { id: number; cuerpo: ActualizarPersona }) => {
      const { data, error } = await api.PATCH('/api/personas/{id}', {
        params: { path: { id: args.id } },
        body: args.cuerpo,
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

/** Devuelve los avisos de la baja (por ejemplo, un usuario vinculado que sigue activo). */
export function useCambiarEstadoPersona() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: {
      id: number;
      accion: 'baja' | 'reactivar';
    }): Promise<string[]> => {
      if (args.accion === 'baja') {
        const { data, error } = await api.POST('/api/personas/{id}/baja', {
          params: { path: { id: args.id } },
        });
        if (error || !data) throw new Error(mensajeError(error));
        return data.advertencias;
      }
      const { data, error } = await api.POST('/api/personas/{id}/reactivar', {
        params: { path: { id: args.id } },
      });
      if (error || !data) throw new Error(mensajeError(error));
      return [];
    },
    onSuccess: invalidar,
  });
}
