import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../conocimiento/dto/trim.js';

const MAX_INT4 = 2147483647;

export class CrearPlanDto {
  @ApiProperty({ description: 'Puesto activo, dentro de tu alcance' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idPuesto: number;

  @ApiProperty({ description: 'Persona activa responsable del plan' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idResponsable: number;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 2000 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  observaciones?: string | null;
}

export class EditarPlanDto {
  @ApiPropertyOptional({ description: 'Persona activa responsable del plan' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idResponsable?: number;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 2000 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  observaciones?: string | null;
}

export class ResolverPlanDto {
  @ApiProperty({ enum: ['aprobar', 'rechazar'] })
  @IsIn(['aprobar', 'rechazar'])
  decision: 'aprobar' | 'rechazar';

  @ApiPropertyOptional({
    maxLength: 2000,
    description: 'Obligatorio al rechazar',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  motivo?: string;
}

export class FiltroPlanesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idPuesto?: number;

  @ApiPropertyOptional({ description: 'Unidad del puesto' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idUnidad?: number;

  @ApiPropertyOptional({ description: 'Código del estado del plan' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  estado?: string;
}

export class PlanDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  idPuesto: number;

  @ApiProperty()
  codigoPuesto: string;

  @ApiProperty()
  denominacionPuesto: string;

  @ApiProperty()
  idUnidad: number;

  @ApiProperty()
  idResponsable: number;

  @ApiProperty()
  nombreResponsable: string;

  @ApiProperty({ description: 'Código del estado' })
  estado: string;

  @ApiProperty({ format: 'date' })
  fechaElaboracion: string;

  @ApiProperty({ nullable: true, type: Number })
  idPlanAnterior: number | null;

  @ApiProperty({ nullable: true, type: String })
  nombreUsuarioResolucion: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date' })
  fechaResolucion: string | null;

  @ApiProperty({ nullable: true, type: String })
  motivoResolucion: string | null;

  @ApiProperty({ nullable: true, type: String })
  observaciones: string | null;

  @ApiProperty()
  cantidadCandidatos: number;
}
