import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CrearUsuarioDto } from './crear-usuario.dto.js';

export class ActualizarUsuarioDto extends PartialType(
  OmitType(CrearUsuarioDto, ['clave'] as const),
) {
  @ApiPropertyOptional({ description: 'false desactiva el usuario' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
