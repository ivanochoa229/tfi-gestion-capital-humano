import type { ConocimientoDto } from './dto/catalogo.dto.js';
import type { ConocimientoPersonaDto } from './dto/perfil.dto.js';
import type { ConocimientoPersona } from './entities/conocimiento-persona.entity.js';
import type { Conocimiento } from './entities/conocimiento.entity.js';

export function aConocimientoDto(c: Conocimiento): ConocimientoDto {
  return {
    id: c.id,
    denominacion: c.denominacion,
    idTipoConocimiento: c.idTipoConocimiento,
    idAreaTematica: c.idAreaTematica,
    descripcion: c.descripcion,
    activo: c.activo,
    idFusionadoEn: c.idFusionadoEn,
  };
}

export function aConocimientoPersonaDto(
  f: ConocimientoPersona,
): ConocimientoPersonaDto {
  return {
    idPersona: f.idPersona,
    idConocimiento: f.idConocimiento,
    idNivelDeclarado: f.idNivelDeclarado,
    fechaDeclaracion: f.fechaDeclaracion,
    idNivelAcreditado: f.idNivelAcreditado,
    fechaEvaluacion: f.fechaEvaluacion,
    idTipoEvidencia: f.idTipoEvidencia,
    idEvaluador: f.idEvaluador,
  };
}

