import type { CandidatoDto } from './dto/candidato.dto.js';
import type { Persona } from '../personas/entities/persona.entity.js';
import type { PlanDto } from './dto/plan.dto.js';
import type { PlanSucesion } from './entities/plan-sucesion.entity.js';

/** El plan debe venir con puesto, responsable, estadoPlan y usuarioResolucion cargados. */
export function aPlanDto(
  plan: PlanSucesion,
  cantidadCandidatos: number,
): PlanDto {
  const nombre = (p: Persona) => `${p.apellido}, ${p.nombre}`;
  return {
    id: plan.id,
    idPuesto: plan.idPuesto,
    codigoPuesto: plan.puesto.codigo,
    denominacionPuesto: plan.puesto.denominacion,
    idUnidad: plan.puesto.idUnidad,
    idResponsable: plan.idResponsable,
    nombreResponsable: nombre(plan.responsable),
    estado: plan.estadoPlan.codigo,
    fechaElaboracion: plan.fechaElaboracion,
    idPlanAnterior: plan.idPlanAnterior,
    nombreUsuarioResolucion: plan.usuarioResolucion?.nombreUsuario ?? null,
    fechaResolucion: plan.fechaResolucion,
    motivoResolucion: plan.motivoResolucion,
    observaciones: plan.observaciones,
    cantidadCandidatos,
  };
}

/** Fila de `SQL_CANDIDATOS_DEL_PLAN`. */
export interface FilaCandidato {
  id_plan: number;
  id_persona: number;
  apellido: string;
  nombre: string;
  estado_preparacion: string;
  prioridad: number;
  fecha_disponibilidad_estimada: string | null;
  observaciones: string | null;
  excluyentes_sin_cubrir: number;
  total_excluyentes: number;
  a_revisar: boolean;
}

export function aCandidatoDto(fila: FilaCandidato): CandidatoDto {
  return {
    idPlan: fila.id_plan,
    idPersona: fila.id_persona,
    apellido: fila.apellido,
    nombre: fila.nombre,
    estadoPreparacion: fila.estado_preparacion,
    prioridad: fila.prioridad,
    fechaDisponibilidadEstimada: fila.fecha_disponibilidad_estimada,
    observaciones: fila.observaciones,
    excluyentesSinCubrir: fila.excluyentes_sin_cubrir,
    totalExcluyentes: fila.total_excluyentes,
    // El estado manual y el calculado deben contar la misma historia.
    discrepancia:
      (fila.estado_preparacion === 'listo_ahora') !==
      (fila.excluyentes_sin_cubrir === 0),
    aRevisar: fila.a_revisar,
  };
}
