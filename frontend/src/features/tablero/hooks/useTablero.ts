import { useQuery } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';

export type Tablero = Esquemas['TableroDto'];
export type PuntoUnicoPorCatedra = Esquemas['PuntoUnicoPorCatedraDto'];
export type MotivoSinSucesorTablero = Esquemas['MotivoSinSucesorTableroDto'];
export type RetiroPorSemestre = Esquemas['RetiroPorSemestreDto'];
export type CalidadDeDatosTablero = Esquemas['CalidadDeDatosTableroDto'];

export interface FiltroTablero {
  idUnidad?: number;
  meses?: number;
}

export function useTablero(filtro: FiltroTablero, habilitado = true) {
  return useQuery({
    queryKey: ['deteccion', 'tablero', filtro],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await api.GET('/api/deteccion/tablero', {
        params: { query: filtro },
      });
      if (error || !data) {
        throw new Error('No se pudo cargar el tablero de riesgo');
      }
      return data;
    },
  });
}
