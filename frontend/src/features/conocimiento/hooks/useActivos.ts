import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';

export type Activo = Esquemas['ActivoDto'];
type ActualizarActivo = Esquemas['ActualizarActivoDto'];

export interface FiltroActivos {
  q?: string;
  idConocimiento?: number;
  idUnidad?: number;
  idTipoDocumento?: number;
  vencido?: boolean;
  incluirBajas?: boolean;
  pagina?: number;
  tamanio?: number;
}

/** Datos del alta; el archivo viaja aparte (multipart). */
export interface CuerpoActivo {
  titulo: string;
  idTipoDocumento: number;
  idUnidad: number;
  idsConocimiento: number[];
  fechaVigencia?: string;
  enlace?: string;
}

const invalidarActivos = (cliente: QueryClient) =>
  cliente.invalidateQueries({ queryKey: ['activos'] });

export function useActivos(filtro: FiltroActivos = {}) {
  return useQuery({
    queryKey: ['activos', 'lista', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/activos', {
        params: { query: filtro },
      });
      if (error || !data) throw new Error('No se pudieron cargar los activos');
      return data;
    },
  });
}

const tieneMensaje = (datos: unknown): boolean =>
  typeof datos === 'object' &&
  datos !== null &&
  'message' in datos &&
  !!(datos as { message: unknown }).message;

/** `openapi-fetch` no arma multipart cómodamente: la subida usa `fetch` y deja que el navegador ponga el boundary. */
async function enviarMultipart(
  url: string,
  metodo: 'POST' | 'PUT',
  cuerpo: FormData,
): Promise<Activo> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: metodo,
      body: cuerpo,
      credentials: 'include',
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor');
  }
  const datos: unknown = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    // Un 413 cortado por un proxy puede no traer JSON.
    if (respuesta.status === 413 && !tieneMensaje(datos)) {
      throw new Error('El archivo supera el tamaño máximo permitido');
    }
    throw new Error(mensajeError(datos));
  }
  return datos as Activo;
}

function aFormData(cuerpo: CuerpoActivo, archivo?: File): FormData {
  const formulario = new FormData();
  formulario.append('titulo', cuerpo.titulo);
  formulario.append('idTipoDocumento', String(cuerpo.idTipoDocumento));
  formulario.append('idUnidad', String(cuerpo.idUnidad));
  for (const id of cuerpo.idsConocimiento) {
    formulario.append('idsConocimiento', String(id));
  }
  if (cuerpo.fechaVigencia) {
    formulario.append('fechaVigencia', cuerpo.fechaVigencia);
  }
  if (cuerpo.enlace) formulario.append('enlace', cuerpo.enlace);
  if (archivo) formulario.append('archivo', archivo);
  return formulario;
}

export function useCrearActivo() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({
      cuerpo,
      archivo,
    }: {
      cuerpo: CuerpoActivo;
      archivo?: File;
    }) => enviarMultipart('/api/activos', 'POST', aFormData(cuerpo, archivo)),
    onSuccess: () => invalidarActivos(cliente),
  });
}

export function useActualizarActivo() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      cuerpo,
    }: {
      id: number;
      cuerpo: ActualizarActivo;
    }) => {
      const { data, error } = await api.PATCH('/api/activos/{id}', {
        params: { path: { id } },
        body: cuerpo,
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarActivos(cliente),
  });
}

export function useReemplazarArchivo() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archivo }: { id: number; archivo: File }) => {
      const formulario = new FormData();
      formulario.append('archivo', archivo);
      return enviarMultipart(`/api/activos/${id}/archivo`, 'PUT', formulario);
    },
    onSuccess: () => invalidarActivos(cliente),
  });
}

export function useCambiarEstadoActivo() {
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
          ? await api.POST('/api/activos/{id}/baja', {
              params: { path: { id } },
            })
          : await api.POST('/api/activos/{id}/reactivar', {
              params: { path: { id } },
            });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarActivos(cliente),
  });
}

/** La descarga lleva la cookie de sesión, así que se pide por `fetch` y se guarda desde un `Blob`. */
export async function descargarActivo(activo: Activo): Promise<void> {
  const respuesta = await fetch(`/api/activos/${activo.id}/descarga`, {
    credentials: 'include',
  });
  if (!respuesta.ok) {
    const datos: unknown = await respuesta.json().catch(() => null);
    throw new Error(mensajeError(datos));
  }
  const url = URL.createObjectURL(await respuesta.blob());
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = activo.nombreOriginal ?? 'activo';
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
