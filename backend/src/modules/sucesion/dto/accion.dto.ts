import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import { aBooleano } from '../../conocimiento/dto/catalogo.dto.js';
import { Trim } from '../../conocimiento/dto/trim.js';

const MAX_INT4 = 2147483647;
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class CrearAccionDto {
  @ApiProperty({ description: 'Tipo de acción activo' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idTipoAccion: number;

  @ApiProperty({ description: 'Conocimiento activo a transferir' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idConocimiento: number;

  @ApiPropertyOptional({
    description:
      'Plan al que pertenece; el conocimiento debe ser requisito de su puesto',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idPlan?: number;

  @ApiProperty({ description: 'Persona activa responsable de la acción' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idResponsable: number;

  @ApiPropertyOptional({
    description:
      'Persona activa que recibe el conocimiento; distinta del responsable',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idDestinatario?: number;

  @ApiProperty({ maxLength: 2000 })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  descripcion: string;

  @ApiProperty({ format: 'date', example: '2027-03-31' })
  @Matches(FORMATO_FECHA, { message: 'fechaPrevista debe ser AAAA-MM-DD' })
  @IsISO8601({ strict: true })
  fechaPrevista: string;
}

export class EditarAccionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idTipoAccion?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idResponsable?: number;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: 'null quita al destinatario',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idDestinatario?: number | null;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  descripcion?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(FORMATO_FECHA, { message: 'fechaPrevista debe ser AAAA-MM-DD' })
  @IsISO8601({ strict: true })
  fechaPrevista?: string;

  @ApiPropertyOptional({
    description: 'true cancela la acción (solo desde pendiente o en curso)',
  })
  @IsOptional()
  @IsBoolean()
  cancelar?: boolean;
}

export class AvanzarAccionDto {
  @ApiProperty({ enum: ['en_curso', 'completada'] })
  @IsIn(['en_curso', 'completada'])
  estado: 'en_curso' | 'completada';

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  notaAvance?: string;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Solo al completar; por defecto hoy, nunca futura',
  })
  @IsOptional()
  @Matches(FORMATO_FECHA, { message: 'fechaCumplimiento debe ser AAAA-MM-DD' })
  @IsISO8601({ strict: true })
  fechaCumplimiento?: string;
}

export class FiltroAccionesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idPlan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idConocimiento?: number;

  @ApiPropertyOptional({ description: 'Código del estado de la acción' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  estado?: string;

  @ApiPropertyOptional({
    description:
      'true: pendientes o en curso con fecha prevista pasada; false: el resto',
  })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  vencidas?: boolean;
}

export class AccionDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ description: 'Código del tipo de acción' })
  tipo: string;

  @ApiProperty()
  idConocimiento: number;

  @ApiProperty()
  denominacionConocimiento: string;

  @ApiProperty({ nullable: true, type: Number })
  idPlan: number | null;

  @ApiProperty()
  idResponsable: number;

  @ApiProperty()
  nombreResponsable: string;

  @ApiProperty({ nullable: true, type: Number })
  idDestinatario: number | null;

  @ApiProperty({ nullable: true, type: String })
  nombreDestinatario: string | null;

  @ApiProperty()
  descripcion: string;

  @ApiProperty({ format: 'date' })
  fechaPrevista: string;

  @ApiProperty({ nullable: true, type: String, format: 'date' })
  fechaCumplimiento: string | null;

  @ApiProperty({ description: 'Código del estado' })
  estado: string;

  @ApiProperty({ nullable: true, type: String })
  notaAvance: string | null;

  @ApiProperty({
    description:
      'Calculada: pendiente o en curso con fecha prevista anterior a hoy',
  })
  vencida: boolean;
}
