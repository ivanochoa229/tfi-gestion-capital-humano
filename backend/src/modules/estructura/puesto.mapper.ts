import type { PuestoDto, PuestoResumenDto } from './dto/puesto.dto.js';
import type { Puesto } from './entities/puesto.entity.js';

export function aPuestoDto(puesto: Puesto): PuestoDto {
  return {
    id: puesto.id,
    codigo: puesto.codigo,
    denominacion: puesto.denominacion,
    proposito: puesto.proposito,
    condicionesTrabajo: puesto.condicionesTrabajo,
    rangoRetributivo: puesto.rangoRetributivo,
    dotacionPrevista: puesto.dotacionPrevista,
    idUnidad: puesto.idUnidad,
    idNivelJerarquico: puesto.idNivelJerarquico,
    idTipoRelacionContractual: puesto.idTipoRelacionContractual,
    idPuestoSuperior: puesto.idPuestoSuperior,
    activo: puesto.activo,
  };
}

export function aResumen(puesto: Puesto): PuestoResumenDto {
  return {
    id: puesto.id,
    codigo: puesto.codigo,
    denominacion: puesto.denominacion,
    activo: puesto.activo,
  };
}
