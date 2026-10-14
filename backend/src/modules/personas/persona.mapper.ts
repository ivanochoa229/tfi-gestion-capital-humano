import {
  ROLES_CON_DATOS_PERSONALES,
  type CodigoRol,
} from '../../common/roles.js';
import type { PersonaDto } from './dto/persona.dto.js';
import type { Persona } from './entities/persona.entity.js';

export interface OpcionesPersona {
  /** Incluir `documento` y `fechaNacimiento` (RNF02). */
  verSensibles: boolean;
  tieneUsuario: boolean;
}

export const puedeVerDatosPersonales = (rol: CodigoRol): boolean =>
  ROLES_CON_DATOS_PERSONALES.includes(rol);

export function aPersonaDto(
  persona: Persona,
  { verSensibles, tieneUsuario }: OpcionesPersona,
): PersonaDto {
  const dto: PersonaDto = {
    id: persona.id,
    legajo: persona.legajo,
    apellido: persona.apellido,
    nombre: persona.nombre,
    fechaIngreso: persona.fechaIngreso,
    idSituacionRevista: persona.idSituacionRevista,
    fechaPrevistaRetiro: persona.fechaPrevistaRetiro,
    activo: persona.activo,
    tieneUsuario,
  };
  if (verSensibles) {
    dto.documento = persona.documento;
    dto.fechaNacimiento = persona.fechaNacimiento;
  }
  return dto;
}
