import { useQuery } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';

export type PuntosUnicosFalla = Esquemas['PuntosUnicosFallaDto'];
export type PuntoUnicoFalla = Esquemas['PuntoUnicoFallaDto'];
export type CatedrasUnaPersona = Esquemas['CatedrasUnaPersonaDto'];
export type CatedraUnaPersona = Esquemas['CatedraUnaPersonaDto'];
export type PuestoSinSucesor = Esquemas['PuestoSinSucesorDto'];
export type HorizonteRespuesta = Esquemas['HorizonteRespuestaDto'];
export type HorizonteRiesgo = Esquemas['HorizonteRiesgoDto'];
export type BrechaPuesto = Esquemas['BrechaPuestoDto'];
export type BrechaConocimiento = Esquemas['BrechaConocimientoDto'];

export interface FiltroUnidadDeteccion {
  idUnidad?: number;
}

export interface FiltroSinSucesor extends FiltroUnidadDeteccion {
  motivo?: 'sin_plan' | 'plan_en_elaboracion' | 'ningun_candidato_cubre';
}

export interface FiltroHorizonte extends FiltroUnidadDeteccion {
  meses?: number;
  incluirConDosOMas?: boolean;
}

export interface FiltroBrecha extends FiltroUnidadDeteccion {
  idPersona?: number;
  idPuesto?: number;
  contexto?: 'ocupante' | 'candidato';
}

export const ROLES_LECTORES_DETECCION = [
  'recursos_humanos',
  'autoridad',
  'jefatura_departamento',
  'jefe_catedra',
];

export const ROLES_GLOBALES_DETECCION = ['recursos_humanos', 'autoridad'];

export const ROLES_MI_BRECHA = [
  'docente',
  'jefe_catedra',
  'jefatura_departamento',
];

export function usePuntosUnicos(filtro: FiltroUnidadDeteccion) {
  return useQuery({
    queryKey: ['deteccion', 'puntos-unicos-falla', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET(
        '/api/deteccion/puntos-unicos-falla',
        {
          params: { query: filtro },
        },
      );
      if (error || !data) {
        throw new Error('No se pudieron cargar los puntos únicos de falla');
      }
      return data;
    },
  });
}

export function useCatedras(filtro: FiltroUnidadDeteccion) {
  return useQuery({
    queryKey: ['deteccion', 'catedras-una-persona', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET(
        '/api/deteccion/catedras-una-persona',
        {
          params: { query: filtro },
        },
      );
      if (error || !data) {
        throw new Error('No se pudieron cargar las cátedras');
      }
      return data;
    },
  });
}

export function usePuestosSinSucesor(filtro: FiltroSinSucesor) {
  return useQuery({
    queryKey: ['deteccion', 'puestos-sin-sucesor', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET(
        '/api/deteccion/puestos-sin-sucesor',
        {
          params: { query: filtro },
        },
      );
      if (error || !data) {
        throw new Error('No se pudieron cargar los puestos sin sucesor');
      }
      return data;
    },
  });
}

export function useHorizonte(filtro: FiltroHorizonte) {
  return useQuery({
    queryKey: ['deteccion', 'horizonte-riesgo', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/deteccion/horizonte-riesgo', {
        params: { query: filtro },
      });
      if (error || !data) {
        throw new Error('No se pudo cargar el horizonte de riesgo');
      }
      return data;
    },
  });
}

export function useBrecha(filtro: FiltroBrecha) {
  return useQuery({
    queryKey: ['deteccion', 'brecha', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/deteccion/brecha', {
        params: { query: filtro },
      });
      if (error || !data) {
        throw new Error('No se pudo cargar la brecha de perfil');
      }
      return data;
    },
  });
}

export function useMiBrecha() {
  return useQuery({
    queryKey: ['deteccion', 'mi-brecha'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/deteccion/mi-brecha');
      if (error || !data) {
        throw new Error('No se pudo cargar tu brecha de perfil');
      }
      return data;
    },
  });
}

/**
 * Descarga un listado de detección en formato CSV pasando la cookie de sesión
 * y los mismos parámetros de filtro que la tabla en pantalla.
 */
export async function descargarCsv(
  ruta: string,
  filtro: Record<string, unknown>,
  nombreArchivo = 'deteccion.csv',
): Promise<void> {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtro)) {
    if (valor !== undefined && valor !== null && valor !== '') {
      params.set(clave, String(valor));
    }
  }
  params.set('formato', 'csv');

  const urlConsulta = `${ruta}?${params.toString()}`;
  const respuesta = await fetch(urlConsulta, {
    credentials: 'include',
  });
  if (!respuesta.ok) {
    const datos: unknown = await respuesta.json().catch(() => null);
    throw new Error(mensajeError(datos));
  }
  const url = URL.createObjectURL(await respuesta.blob());
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
