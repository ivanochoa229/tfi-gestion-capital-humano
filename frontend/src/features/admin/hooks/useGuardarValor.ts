import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';

type CrearValor = Esquemas['CrearValorDto'];
type ActualizarValor = Esquemas['ActualizarValorDto'];

const CLAVE_TOKEN = 'adminToken';

/** Token provisorio de administrador (hasta RF22); vive solo en la sesión. */
export function leerToken(): string {
  try {
    return sessionStorage.getItem(CLAVE_TOKEN) ?? '';
  } catch {
    return '';
  }
}

export function guardarToken(token: string): void {
  try {
    sessionStorage.setItem(CLAVE_TOKEN, token);
  } catch {
    // Sin almacenamiento de sesión: el token deberá ingresarse de nuevo.
  }
}

const encabezados = () => ({ 'x-admin-token': leerToken() });

/** Mensaje en español que devolvió el backend, o uno genérico. */
export function mensajeError(error: unknown): string {
  const mensaje = (error as { message?: string | string[] } | null)?.message;
  if (Array.isArray(mensaje)) return mensaje.join('. ');
  return mensaje ?? 'No se pudo completar la operación';
}

function useInvalidarReferencia() {
  const cliente = useQueryClient();
  return () => cliente.invalidateQueries({ queryKey: ['referencia'] });
}

export function useCrearValor(dominio: string) {
  const invalidar = useInvalidarReferencia();
  return useMutation({
    mutationFn: async (cuerpo: CrearValor) => {
      const { data, error } = await api.POST('/api/referencia/{dominio}', {
        params: { path: { dominio } },
        headers: encabezados(),
        body: cuerpo,
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useActualizarValor(dominio: string) {
  const invalidar = useInvalidarReferencia();
  return useMutation({
    mutationFn: async (args: { id: number; cuerpo: ActualizarValor }) => {
      const { data, error } = await api.PATCH(
        '/api/referencia/{dominio}/{id}',
        {
          params: { path: { dominio, id: args.id } },
          headers: encabezados(),
          body: args.cuerpo,
        },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useEliminarValor(dominio: string) {
  const invalidar = useInvalidarReferencia();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await api.DELETE('/api/referencia/{dominio}/{id}', {
        params: { path: { dominio, id } },
        headers: encabezados(),
      });
      if (error) throw new Error(mensajeError(error));
    },
    onSuccess: invalidar,
  });
}
