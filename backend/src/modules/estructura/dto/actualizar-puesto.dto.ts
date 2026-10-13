import { OmitType, PartialType } from '@nestjs/swagger';
import { CrearPuestoDto } from './crear-puesto.dto.js';

/** No admite `codigo` ni `idUnidad`: no se editan después del alta. */
export class ActualizarPuestoDto extends PartialType(
  OmitType(CrearPuestoDto, ['idUnidad'] as const),
) {}
