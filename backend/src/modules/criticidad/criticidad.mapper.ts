import type { CeldaMatrizDto, EscalaDto } from './dto/matriz.dto.js';
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
