import type { OcupacionDto, OcupanteDto } from './dto/ocupacion.dto.js';
import type { Ocupacion } from './entities/ocupacion.entity.js';
import { estadoDe, type FechaISO } from './fechas.js';

export function aOcupacionDto(
  ocupacion: Ocupacion,
  hoy: FechaISO,
): OcupacionDto {
  return {
    idPersona: ocupacion.idPersona,
    idPuesto: ocupacion.idPuesto,
    fechaDesde: ocupacion.fechaDesde,
    fechaHasta: ocupacion.fechaHasta,
    idCaracterOcupacion: ocupacion.idCaracterOcupacion,
    idDedicacion: ocupacion.idDedicacion,
    estado: estadoDe(ocupacion, hoy),
  };
}

/** Requiere `ocupacion.persona` cargada. */
export function aOcupanteDto(ocupacion: Ocupacion, hoy: FechaISO): OcupanteDto {
  return {
    ...aOcupacionDto(ocupacion, hoy),
    legajo: ocupacion.persona.legajo,
    apellido: ocupacion.persona.apellido,
    nombre: ocupacion.persona.nombre,
  };
}
