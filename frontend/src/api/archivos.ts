import { mensajeError } from '../features/admin/hooks/useGuardarValor';

const tieneMensaje = (datos: unknown): boolean =>
  typeof datos === 'object' &&
  datos !== null &&
  'message' in datos &&
  !!(datos as { message: unknown }).message;

/**
 * `openapi-fetch` no arma multipart cómodamente: las subidas usan `fetch` y
 * dejan que el navegador ponga el boundary. Devuelve el JSON de la respuesta.
 */
export async function enviarMultipart<T>(
  url: string,
  metodo: 'POST' | 'PUT',
  cuerpo: FormData,
): Promise<T> {
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
  return datos as T;
}

/** Descarga un archivo de la API y lo guarda con el nombre dado. */
export async function descargarArchivo(
  url: string,
  nombre: string,
): Promise<void> {
  const respuesta = await fetch(url, { credentials: 'include' });
  if (!respuesta.ok) {
    const datos: unknown = await respuesta.json().catch(() => null);
    throw new Error(mensajeError(datos));
  }
  const objeto = URL.createObjectURL(await respuesta.blob());
  const enlace = document.createElement('a');
  enlace.href = objeto;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(objeto), 1000);
}
