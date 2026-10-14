import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max } from 'class-validator';
import { FechaIso } from './fecha-iso.decorator.js';

const MAX_INT4 = 2147483647;

export class CrearOcupacionDto {
  @ApiProperty({ description: 'Puesto activo' })
  @IsInt()
  @Max(MAX_INT4)
  idPuesto: number;

  @ApiProperty({ format: 'date', example: '2024-03-01' })
  @FechaIso()
  fechaDesde: string;

  @ApiPropertyOptional({
    format: 'date',
    nullable: true,
    type: String,
    description: 'No anterior al inicio; sin valor, la ocupación no tiene fin',
  })
  @IsOptional()
  @FechaIso()
  fechaHasta?: string | null;

  @ApiProperty()
  @IsInt()
  @Max(MAX_INT4)
  idCaracterOcupacion: number;

  @ApiProperty()
  @IsInt()
  @Max(MAX_INT4)
  idDedicacion: number;
}
