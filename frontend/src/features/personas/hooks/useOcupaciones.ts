import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';

export type Ocupacion = Esquemas['OcupacionDto'];
export type Ocupante = Esquemas['OcupanteDto'];
type CrearOcupacion = Esquemas['CrearOcupacionDto'];
type ActualizarOcupacion = Esquemas['ActualizarOcupacionDto'];

interface ClaveOcupacion {
  idPersona: number;
  idPuesto: number;
  fechaDesde: string;
}

const ruta = (c: ClaveOcupacion) => ({
  path: {
    idPersona: c.idPersona,
    idPuesto: c.idPuesto,
    fechaDesde: c.fechaDesde,
  },
});

/** Historial completo de la persona, de la más reciente a la más antigua. */
export function useOcupacionesDePersona(idPersona: number | undefined) {
  return useQuery({
    queryKey: ['ocupaciones', 'persona', idPersona],
    enabled: idPersona !== undefined,
    queryFn: async () => {
      const { data, error } = await api.GET(
        '/api/personas/{idPersona}/ocupaciones',
        { params: { path: { idPersona: idPersona as number } } },
      );
      if (error || !data)
        throw new Error('No se pudieron cargar las ocupaciones');
      return data;
    },
  });
}

/** Quiénes ocupan hoy el puesto. */
export function useOcupantesDePuesto(idPuesto: number | undefined) {
  return useQuery({
    queryKey: ['ocupaciones', 'puesto', idPuesto],
    enabled: idPuesto !== undefined,
    queryFn: async () => {
      const { data, error } = await api.GET(
        '/api/puestos/{idPuesto}/ocupaciones',
        { params: { path: { idPuesto: idPuesto as number } } },
      );
      if (error || !data)
        throw new Error('No se pudieron cargar los ocupantes');
      return data;
    },
  });
}

function useInvalidar() {
  const cliente = useQueryClient();
  return () => {
    cliente.invalidateQueries({ queryKey: ['ocupaciones'] });
    cliente.invalidateQueries({ queryKey: ['personas'] });
  };
}

export function useCrearOcupacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: { idPersona: number; cuerpo: CrearOcupacion }) => {
      const { data, error } = await api.POST(
        '/api/personas/{idPersona}/ocupaciones',
        {
          params: { path: { idPersona: args.idPersona } },
          body: args.cuerpo,
        },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useActualizarOcupacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (
      args: ClaveOcupacion & { cuerpo: ActualizarOcupacion },
    ) => {
      const { data, error } = await api.PATCH(
        '/api/personas/{idPersona}/ocupaciones/{idPuesto}/{fechaDesde}',
        { params: ruta(args), body: args.cuerpo },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useCerrarOcupacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: ClaveOcupacion & { fechaHasta: string }) => {
      const { data, error } = await api.POST(
        '/api/personas/{idPersona}/ocupaciones/{idPuesto}/{fechaDesde}/cerrar',
        { params: ruta(args), body: { fechaHasta: args.fechaHasta } },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useAnularOcupacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: ClaveOcupacion) => {
      const { response, error } = await api.DELETE(
        '/api/personas/{idPersona}/ocupaciones/{idPuesto}/{fechaDesde}',
        { params: ruta(args) },
      );
      if (!response.ok) throw new Error(mensajeError(error));
    },
    onSuccess: invalidar,
  });
}
