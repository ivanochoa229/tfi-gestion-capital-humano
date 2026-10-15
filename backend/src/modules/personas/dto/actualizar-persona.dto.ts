import { PartialType } from '@nestjs/swagger';
import { CrearPersonaDto } from './crear-persona.dto.js';

/** Todo es opcional; solo `fechaPrevistaRetiro` admite `null`. */
export class ActualizarPersonaDto extends PartialType(CrearPersonaDto) {}
