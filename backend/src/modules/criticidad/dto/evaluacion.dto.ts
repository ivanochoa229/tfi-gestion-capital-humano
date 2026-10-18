import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../conocimiento/dto/trim.js';
import { FechaIso } from '../../personas/dto/fecha-iso.decorator.js';

const MAX_INT4 = 2147483647;

export class EvaluarDto {
  @ApiProperty({ description: 'Nivel de impacto de pérdida (escala fija)' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idNivelImpacto: number;

  @ApiProperty({
    description: 'Nivel de dificultad de reemplazo (escala fija)',
  })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idNivelDificultad: number;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-06-15',
    description: 'No futura; por defecto, hoy',
  })
  @IsOptional()
  @FechaIso()
  fechaEvaluacion?: string;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 2000 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  observaciones?: string | null;
}

export class EvaluacionDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  idPuesto: number;

  @ApiProperty()
  idConocimiento: number;

  @ApiProperty()
  idNivelImpacto: number;

  @ApiProperty()
  idNivelDificultad: number;

  @ApiProperty({ description: 'Resultado de la matriz al evaluar' })
  idNivelCriticidad: number;

  @ApiProperty({ format: 'date' })
  fechaEvaluacion: string;

  @ApiProperty()
  idUsuario: number;

  @ApiProperty()
  nombreUsuario: string;

  @ApiProperty({ nullable: true, type: String })
  observaciones: string | null;

  @ApiProperty({ format: 'date-time' })
  registradaEn: string;
}
