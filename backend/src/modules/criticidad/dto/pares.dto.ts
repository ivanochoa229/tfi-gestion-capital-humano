import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';

export const ESTADOS_PAR = ['pendiente', 'evaluado'] as const;
export type EstadoPar = (typeof ESTADOS_PAR)[number];

const aNumero = ({ value }: { value: unknown }) => Number(value);

export class FiltroParesDto {
  @ApiPropertyOptional({
    description: 'Unidad (incluye sus unidades descendientes)',
  })
  @IsOptional()
  @Transform(aNumero)
  @IsInt()
  idUnidad?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(aNumero)
  @IsInt()
  idPuesto?: number;

  @ApiPropertyOptional({ enum: ESTADOS_PAR })
  @IsOptional()
  @IsIn(ESTADOS_PAR)
  estado?: EstadoPar;
}

export class ParCriticidadDto {
  @ApiProperty()
  idPuesto: number;

  @ApiProperty()
  codigoPuesto: string;

  @ApiProperty()
  denominacionPuesto: string;

  @ApiProperty()
  idUnidad: number;

  @ApiProperty()
  idConocimiento: number;

  @ApiProperty()
  denominacionConocimiento: string;

  @ApiProperty()
  idNivelRequerido: number;

  @ApiProperty()
  esExcluyente: boolean;

  @ApiProperty({ enum: ESTADOS_PAR })
  estado: EstadoPar;

  @ApiProperty({ nullable: true, type: Number })
  idEvaluacion: number | null;

  @ApiProperty({ nullable: true, type: Number })
  idNivelImpacto: number | null;

  @ApiProperty({ nullable: true, type: Number })
  idNivelDificultad: number | null;

  @ApiProperty({ nullable: true, type: Number })
  idNivelCriticidad: number | null;

  @ApiProperty({ nullable: true, type: String, format: 'date' })
  fechaEvaluacion: string | null;
}

export class AvanceDto {
  @ApiProperty({ description: 'Pares con evaluación vigente' })
  evaluados: number;

  @ApiProperty({ description: 'Requisitos activos del alcance' })
  total: number;
}
