import type { CodigoRol } from './roles.js';

/** Lo que Passport deja en `req.user` en cada petición autenticada. */
export interface SesionUsuario {
  id: number;
  nombreUsuario: string;
  rol: CodigoRol;
  idPersona: number | null;
  /** Unidades asignadas explícitamente (sin descendientes). */
  unidades: number[];
}
