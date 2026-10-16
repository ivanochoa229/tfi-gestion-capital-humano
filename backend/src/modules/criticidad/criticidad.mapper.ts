import type { CeldaMatrizDto, EscalaDto } from './dto/matriz.dto.js';
import type { EvaluacionDto } from './dto/evaluacion.dto.js';
import type { EvaluacionCriticidad } from './entities/evaluacion-criticidad.entity.js';
import type { MatrizCriticidad } from './entities/matriz-criticidad.entity.js';
import type { NivelDificultad } from './entities/nivel-dificultad.entity.js';
import type { NivelImpacto } from './entities/nivel-impacto.entity.js';

export function aEscalaDto(e: NivelImpacto | NivelDificultad): EscalaDto {
  return {
    id: e.id,
    codigo: e.codigo,
    denominacion: e.denominacion,
    orden: e.orden,
    criterio: e.criterio,
    activo: e.activo,
  };
}

export function aCeldaDto(c: MatrizCriticidad): CeldaMatrizDto {
  return {
    idNivelImpacto: c.idNivelImpacto,
    idNivelDificultad: c.idNivelDificultad,
    idNivelCriticidad: c.idNivelCriticidad,
  };
}

export function aEvaluacionDto(
  e: EvaluacionCriticidad,
  nombreUsuario: string,
): EvaluacionDto {
  return {
    id: e.id,
    idPuesto: e.idPuesto,
    idConocimiento: e.idConocimiento,
    idNivelImpacto: e.idNivelImpacto,
    idNivelDificultad: e.idNivelDificultad,
    idNivelCriticidad: e.idNivelCriticidad,
    fechaEvaluacion: e.fechaEvaluacion,
    idUsuario: e.idUsuario,
    nombreUsuario,
    observaciones: e.observaciones,
    registradaEn: e.registradaEn.toISOString(),
  };
}
