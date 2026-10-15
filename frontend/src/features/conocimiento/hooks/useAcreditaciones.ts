import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { invalidarConocimiento } from './useConocimientos';

export type FilaPerfil = Esquemas['PerfilConocimientoDto'];
export type Acreditacion = Esquemas['AcreditacionDto'];
export type Pendiente = Esquemas['PendienteAcreditacionDto'];

export function usePerfilDePersona(idPersona: number) {
  return useQuery({
    queryKey: ['perfil-conocimiento', idPersona],
    queryFn: async () => {
      const { data, error } = await api.GET(
        '/api/personas/{idPersona}/conocimientos',
        {
          params: { path: { idPersona } },
        },
      );
      if (error || !data)
        throw new Error('No se pudo cargar el conocimiento de la persona');
      return data;
    },
    retry: false,
  });
}

export function useHistorialAcreditaciones(
  idPersona: number,
  idConocimiento: number,
) {
  return useQuery({
    queryKey: ['perfil-conocimiento', idPersona, 'historial', idConocimiento],
    queryFn: async () => {
      const { data, error } = await api.GET(
        '/api/personas/{idPersona}/conocimientos/{idConocimiento}/acreditaciones',
        { params: { path: { idPersona, idConocimiento } } },
      );
      if (error || !data) throw new Error('No se pudo cargar el historial');
      return data;
    },
  });
}

export function usePendientesAcreditacion() {
  return useQuery({
    queryKey: ['pendientes-acreditacion'],
    queryFn: async () => {
      const { data, error } = await api.GET(
        '/api/conocimientos/pendientes-acreditacion',
      );
      if (error || !data) throw new Error('No se pudo cargar la bandeja');
      return data;
    },
  });
}

export function useAcreditar() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (a: {
      idPersona: number;
      idConocimiento: number;
      idNivel: number;
      fechaEvaluacion: string;
      idTipoEvidencia: number;
      observaciones: string | null;
    }) => {
      const { data, error } = await api.POST(
        '/api/personas/{idPersona}/conocimientos/{idConocimiento}/acreditaciones',
        {
          params: {
            path: { idPersona: a.idPersona, idConocimiento: a.idConocimiento },
          },
          body: {
            idNivel: a.idNivel,
            fechaEvaluacion: a.fechaEvaluacion,
            idTipoEvidencia: a.idTipoEvidencia,
            observaciones: a.observaciones,
          },
        },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}
