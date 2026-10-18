import type { AccionDto } from './dto/accion.dto.js';
import type { CandidatoDto } from './dto/candidato.dto.js';
import type { Persona } from '../personas/entities/persona.entity.js';
import type { PlanDto } from './dto/plan.dto.js';
import type { AccionTransferencia } from './entities/accion-transferencia.entity.js';
import type { PlanSucesion } from './entities/plan-sucesion.entity.js';
import { ESTADO_ACCION } from './sucesion.constantes.js';

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
    // El estado manual y el calculado deben contar la misma historia; sin
    // excluyentes no hay nada que calcular y no hay discrepancia.
    discrepancia:
      fila.total_excluyentes > 0 &&
      (fila.estado_preparacion === 'listo_ahora') !==
        (fila.excluyentes_sin_cubrir === 0),
    aRevisar: fila.a_revisar,
  };
}

/** La acción debe venir con tipoAccion, conocimiento, responsable, destinatario y estadoAccion cargados. */
export function aAccionDto(
  accion: AccionTransferencia,
  hoy: string,
): AccionDto {
  const nombre = (p: Persona) => `${p.apellido}, ${p.nombre}`;
  const estado = accion.estadoAccion.codigo;
  return {
    id: accion.id,
    tipo: accion.tipoAccion.codigo,
    idConocimiento: accion.idConocimiento,
    denominacionConocimiento: accion.conocimiento.denominacion,
    idPlan: accion.idPlan,
    idResponsable: accion.idResponsable,
    nombreResponsable: nombre(accion.responsable),
    idDestinatario: accion.idDestinatario,
    nombreDestinatario: accion.destinatario
      ? nombre(accion.destinatario)
      : null,
    descripcion: accion.descripcion,
    fechaPrevista: accion.fechaPrevista,
    fechaCumplimiento: accion.fechaCumplimiento,
    estado,
    notaAvance: accion.notaAvance,
    // Vencida no es un estado: solo las abiertas pueden estarlo.
    vencida: esAbierta(estado) && accion.fechaPrevista < hoy,
  };
}

export function esAbierta(estado: string): boolean {
  return estado === ESTADO_ACCION.pendiente || estado === ESTADO_ACCION.enCurso;
}
