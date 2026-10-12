import { AsyncLocalStorage } from 'node:async_hooks';

/** Usuario de la petición en curso; lo lee el subscriber de auditoría. */
export const contextoUsuario = new AsyncLocalStorage<{
  idUsuario: number | null;
}>();

export function usuarioDelContexto(): number | null {
  return contextoUsuario.getStore()?.idUsuario ?? null;
}
