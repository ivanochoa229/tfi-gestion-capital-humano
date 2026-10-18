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
