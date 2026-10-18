import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';

export type Plan = Esquemas['PlanDto'];
export type PlanDetalle = Esquemas['PlanDetalleDto'];
export type Candidato = Esquemas['CandidatoDto'];
export type Accion = Esquemas['AccionDto'];
export type Cobertura = Esquemas['CoberturaDto'];
type CrearPlan = Esquemas['CrearPlanDto'];
type ResolverPlan = Esquemas['ResolverPlanDto'];
type AgregarCandidato = Esquemas['AgregarCandidatoDto'];
type Seguimiento = Esquemas['SeguimientoCandidatoDto'];

export interface FiltroSucesion {
  idUnidad?: number;
  estado?: string;
}

export function useCobertura(filtro: Pick<FiltroSucesion, 'idUnidad'>) {
  return useQuery({
    queryKey: ['sucesion', 'cobertura', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/sucesion/cobertura', {
        params: { query: filtro },
      });
      if (error || !data) throw new Error('No se pudo cargar la cobertura');
      return data;
    },
  });
}

export function usePlanes(filtro: FiltroSucesion) {
  return useQuery({
    queryKey: ['sucesion', 'planes', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/planes', {
        params: { query: filtro },
      });
      if (error || !data) throw new Error('No se pudieron cargar los planes');
      return data;
    },
  });
}

export function usePlan(id: number) {
  return useQuery({
    queryKey: ['sucesion', 'plan', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/planes/{id}', {
        params: { path: { id } },
      });
      if (error || !data) throw new Error('No se pudo cargar el plan');
      return data;
    },
  });
}

function useInvalidar() {
  const cliente = useQueryClient();
  return () => cliente.invalidateQueries({ queryKey: ['sucesion'] });
}

export function useCrearPlan() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (cuerpo: CrearPlan) => {
      const { data, error } = await api.POST('/api/planes', { body: cuerpo });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function usePresentarPlan() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data, error } = await api.POST('/api/planes/{id}/presentar', {
        params: { path: { id } },
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useResolverPlan() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: { id: number; cuerpo: ResolverPlan }) => {
      const { data, error } = await api.POST('/api/planes/{id}/resolver', {
        params: { path: { id: args.id } },
        body: args.cuerpo,
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useNuevaVersionPlan() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data, error } = await api.POST('/api/planes/{id}/nueva-version', {
        params: { path: { id } },
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useCerrarPlan() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data, error } = await api.POST('/api/planes/{id}/cerrar', {
        params: { path: { id } },
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useReabrirPlan() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data, error } = await api.POST('/api/planes/{id}/reabrir', {
        params: { path: { id } },
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useAgregarCandidato() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: { idPlan: number; cuerpo: AgregarCandidato }) => {
      const { data, error } = await api.POST(
        '/api/planes/{idPlan}/candidatos',
        {
          params: { path: { idPlan: args.idPlan } },
          body: args.cuerpo,
        },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useSeguimientoCandidato() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: {
      idPlan: number;
      idPersona: number;
      cuerpo: Seguimiento;
    }) => {
      const { data, error } = await api.PATCH(
        '/api/planes/{idPlan}/candidatos/{idPersona}',
        {
          params: {
            path: { idPlan: args.idPlan, idPersona: args.idPersona },
          },
          body: args.cuerpo,
        },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useReordenarCandidatos() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: { idPlan: number; orden: number[] }) => {
      const { data, error } = await api.PUT(
        '/api/planes/{idPlan}/candidatos/orden',
        {
          params: { path: { idPlan: args.idPlan } },
          body: { orden: args.orden },
        },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useQuitarCandidato() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: { idPlan: number; idPersona: number }) => {
      const { error } = await api.DELETE(
        '/api/planes/{idPlan}/candidatos/{idPersona}',
        { params: { path: args } },
      );
      if (error) throw new Error(mensajeError(error));
    },
    onSuccess: invalidar,
  });
}

export interface FiltroAcciones {
  idPlan?: number;
  idConocimiento?: number;
  estado?: string;
  vencidas?: boolean;
}

export type MiPlan = Esquemas['MiPlanDto'];
type CrearAccion = Esquemas['CrearAccionDto'];
type EditarAccion = Esquemas['EditarAccionDto'];
type AvanzarAccion = Esquemas['AvanzarAccionDto'];

export function useAcciones(filtro: FiltroAcciones) {
  return useQuery({
    queryKey: ['sucesion', 'acciones', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/acciones', {
        params: { query: filtro },
      });
      if (error || !data) throw new Error('No se pudieron cargar las acciones');
      return data;
    },
  });
}

export function useMisPlanes(habilitado: boolean) {
  return useQuery({
    queryKey: ['sucesion', 'mis-planes'],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await api.GET('/api/sucesion/mis-planes');
      if (error || !data) throw new Error('No se pudieron cargar tus planes');
      return data;
    },
  });
}

export function useCrearAccion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (cuerpo: CrearAccion) => {
      const { data, error } = await api.POST('/api/acciones', {
        body: cuerpo,
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

/** Edita una acción; con `cancelar: true` la cancela. */
export function useEditarAccion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: { id: number; cuerpo: EditarAccion }) => {
      const { data, error } = await api.PATCH('/api/acciones/{id}', {
        params: { path: { id: args.id } },
        body: args.cuerpo,
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useAvanzarAccion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: { id: number; cuerpo: AvanzarAccion }) => {
      const { data, error } = await api.POST('/api/acciones/{id}/avanzar', {
        params: { path: { id: args.id } },
        body: args.cuerpo,
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}
