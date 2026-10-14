import { OmitType, PartialType } from '@nestjs/swagger';
import { CrearOcupacionDto } from './crear-ocupacion.dto.js';

/** No admite `idPuesto` ni `fechaDesde`: forman la clave; para corregirlos se anula y se recarga. */
export class ActualizarOcupacionDto extends PartialType(
  OmitType(CrearOcupacionDto, ['idPuesto', 'fechaDesde'] as const),
) {}
