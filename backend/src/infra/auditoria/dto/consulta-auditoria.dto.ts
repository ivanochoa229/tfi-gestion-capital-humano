import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ConsultaAuditoriaDto {
  @ApiPropertyOptional({ example: 'plan_sucesion' })
  @IsOptional()
  @IsString()
  entidad?: string;

  @ApiPropertyOptional({ example: '5' })
  @IsOptional()
  @IsString()
  idRegistro?: string;
}
