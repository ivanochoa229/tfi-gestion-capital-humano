import createClient from 'openapi-fetch';
import type { components, paths } from './esquema';

/**
 * Cliente tipado de la API. Los tipos de esquema.d.ts se generan desde el
 * Swagger del backend con `npm run api:tipos`; no se editan a mano.
 *
 * Las rutas son relativas (/api/...) y Vite las reenvía al backend.
 */
export const api = createClient<paths>({
  baseUrl: '/',
  credentials: 'include',
});

export type Esquemas = components['schemas'];
