import type { UnidadDto } from './dto/unidad.dto.js';
import type { UnidadOrganizativa } from './entities/unidad-organizativa.entity.js';

/** La unidad debe venir con `tipo` cargado. */
export function aUnidadDto(unidad: UnidadOrganizativa): UnidadDto {
  return {
    id: unidad.id,
    denominacion: unidad.denominacion,
    tipo: unidad.tipo.codigo,
    idUnidadSuperior: unidad.idUnidadSuperior,
    activo: unidad.activo,
  };
}
