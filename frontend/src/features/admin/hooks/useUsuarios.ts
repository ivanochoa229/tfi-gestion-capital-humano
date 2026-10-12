import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from './useGuardarValor';

export type Usuario = Esquemas['UsuarioDto'];
type CrearUsuario = Esquemas['CrearUsuarioDto'];
type ActualizarUsuario = Esquemas['ActualizarUsuarioDto'];

export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/usuarios');
      if (error || !data) throw new Error('No se pudieron cargar los usuarios');
      return data;
    },
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ['usuarios', 'roles'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/usuarios/roles');
      if (error || !data) throw new Error('No se pudieron cargar los roles');
      return data;
    },
  });
}

function useInvalidarUsuarios() {
  const cliente = useQueryClient();
  return () => cliente.invalidateQueries({ queryKey: ['usuarios'] });
}

export function useCrearUsuario() {
  const invalidar = useInvalidarUsuarios();
  return useMutation({
    mutationFn: async (cuerpo: CrearUsuario) => {
      const { data, error } = await api.POST('/api/usuarios', { body: cuerpo });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useActualizarUsuario() {
  const invalidar = useInvalidarUsuarios();
  return useMutation({
    mutationFn: async (args: { id: number; cuerpo: ActualizarUsuario }) => {
      const { data, error } = await api.PATCH('/api/usuarios/{id}', {
        params: { path: { id: args.id } },
        body: args.cuerpo,
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useRestablecerClave() {
  return useMutation({
    mutationFn: async (args: { id: number; clave: string }) => {
      const { error } = await api.POST('/api/usuarios/{id}/restablecer-clave', {
        params: { path: { id: args.id } },
        body: { clave: args.clave },
      });
      if (error) throw new Error(mensajeError(error));
    },
  });
}
