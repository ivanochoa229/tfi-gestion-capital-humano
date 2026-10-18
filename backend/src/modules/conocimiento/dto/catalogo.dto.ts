import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Trim } from './trim.js';

const MAX_INT4 = 2147483647;

export class CrearConocimientoDto {
  @ApiProperty({ maxLength: 150, example: 'PostgreSQL' })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  denominacion: string;

  @ApiProperty({ description: 'Tipo de conocimiento activo' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idTipoConocimiento: number;

  @ApiProperty({ description: 'Área temática activa' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idAreaTematica: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  descripcion?: string | null;
}

export class ActualizarConocimientoDto extends PartialType(
  CrearConocimientoDto,
) {}

export const aBooleano = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class FiltroConocimientosDto {
  @ApiPropertyOptional({ description: 'Texto contenido en la denominación' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  idTipo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  idArea?: number;

  @ApiPropertyOptional({ description: 'Sin valor: activos e inactivos' })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  activo?: boolean;
}

export class ConocimientoDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  denominacion: string;

  @ApiProperty()
  idTipoConocimiento: number;

  @ApiProperty()
  idAreaTematica: number;

  @ApiProperty({ nullable: true, type: String })
  descripcion: string | null;

  @ApiProperty()
  activo: boolean;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Conocimiento al que se fusionó, si se retiró por duplicado',
  })
  idFusionadoEn: number | null;
}

export class FusionarConocimientoDto {
  @ApiProperty({ description: 'Conocimiento que se conserva' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idDestino: number;
}

export class ResultadoFusionDto {
  @ApiProperty()
  idOrigen: number;

  @ApiProperty()
  idDestino: number;

  @ApiProperty({ description: 'Requisitos de puesto que pedían el origen' })
  requisitosMovidos: number;

  @ApiProperty({ description: 'Personas con datos del origen' })
  personasMovidas: number;

  @ApiProperty({ description: 'Evaluaciones de criticidad del origen' })
  evaluacionesMovidas: number;

  @ApiProperty({ description: 'Acciones de transferencia del origen' })
  accionesMovidas: number;
}
