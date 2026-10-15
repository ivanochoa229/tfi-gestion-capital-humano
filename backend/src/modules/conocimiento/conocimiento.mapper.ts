import type { ConocimientoDto } from './dto/catalogo.dto.js';
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
