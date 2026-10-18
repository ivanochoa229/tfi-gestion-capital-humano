import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../conocimiento/dto/trim.js';

const MAX_INT4 = 2147483647;

export class AgregarCandidatoDto {
  @ApiProperty({
    description:
      'Persona activa con ocupación vigente que no ocupa el puesto del plan',
  })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idPersona: number;

  @ApiProperty({ minimum: 1, description: 'Única dentro del plan' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  prioridad: number;

  @ApiProperty({ description: 'Estado de preparación manual (activo)' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idEstadoPreparacion: number;

  @ApiPropertyOptional({ format: 'date', example: '2027-03-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaDisponibilidadEstimada debe ser AAAA-MM-DD',
  })
  @IsISO8601({ strict: true })
  fechaDisponibilidadEstimada?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;
}

export class SeguimientoCandidatoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idEstadoPreparacion?: number;

  @ApiPropertyOptional({
    format: 'date',
    nullable: true,
    type: String,
    description: 'null borra la fecha',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaDisponibilidadEstimada debe ser AAAA-MM-DD',
  })
  @IsISO8601({ strict: true })
  fechaDisponibilidadEstimada?: string | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true, type: String })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  observaciones?: string | null;
}

export class OrdenCandidatosDto {
  @ApiProperty({
    type: [Number],
    description:
      'Ids de persona de todos los candidatos del plan, en la prioridad nueva (el primero queda con 1)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT4, { each: true })
  orden: number[];
}

export class CandidatoDto {
  @ApiProperty()
  idPlan: number;

  @ApiProperty()
  idPersona: number;

  @ApiProperty()
  apellido: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty({ description: 'Código del estado de preparación manual' })
  estadoPreparacion: string;

  @ApiProperty()
  prioridad: number;

  @ApiProperty({ nullable: true, type: String, format: 'date' })
  fechaDisponibilidadEstimada: string | null;

  @ApiProperty({ nullable: true, type: String })
  observaciones: string | null;

  @ApiProperty({
    description:
      'Requisitos excluyentes del puesto que el candidato no cubre con nivel acreditado',
  })
  excluyentesSinCubrir: number;

  @ApiProperty()
  totalExcluyentes: number;

  @ApiProperty({
    description:
      'El estado manual no coincide con la preparación calculada (listo ahora y con faltantes, o al revés)',
  })
  discrepancia: boolean;

  @ApiProperty({
    description:
      'La persona hoy ocupa el puesto del plan o ya no tiene ocupación vigente',
  })
  aRevisar: boolean;
}
