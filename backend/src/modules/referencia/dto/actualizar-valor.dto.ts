import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CrearValorDto } from './crear-valor.dto.js';

export class ActualizarValorDto extends PartialType(CrearValorDto) {
  @ApiPropertyOptional({ description: 'false desactiva el valor' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
