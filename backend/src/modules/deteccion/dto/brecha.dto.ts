import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import {
  CONTEXTO_BRECHA,
  type ContextoBrecha,
} from '../deteccion.constantes.js';

const CONTEXTOS = Object.values(CONTEXTO_BRECHA);

export class FiltroBrechaDto {
  @ApiPropertyOptional({ description: 'Filtrar por persona' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idPersona?: number;

  @ApiPropertyOptional({ description: 'Filtrar por puesto' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idPuesto?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por unidad organizativa (con sus descendientes)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idUnidad?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por contexto (ocupante o candidato)',
    enum: CONTEXTOS,
  })
  @IsOptional()
  @IsIn(CONTEXTOS)
  contexto?: ContextoBrecha;
}

export class BrechaConocimientoDto {
  @ApiProperty()
  idConocimiento!: number;

  @ApiProperty()
  denominacion!: string;

  @ApiProperty()
  esExcluyente!: boolean;

  @ApiProperty()
  nivelRequerido!: string;

  @ApiProperty({ type: String, nullable: true })
  nivelAcreditado!: string | null;

  @ApiProperty({ type: String, nullable: true })
  nivelDeclarado!: string | null;

  @ApiProperty()
  faltante!: number;

  @ApiProperty()
  cubierto!: boolean;
}

export class ResumenBrechaDto {
  @ApiProperty()
  excluyentesCubiertos!: number;

  @ApiProperty()
  excluyentesTotal!: number;

  @ApiProperty()
  deseablesCubiertos!: number;

  @ApiProperty()
  deseablesTotal!: number;
}

export class BrechaPuestoDto {
  @ApiProperty({ enum: CONTEXTOS })
  contexto!: string;

  @ApiProperty()
  idPersona!: number;

  @ApiProperty()
  apellido!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  idPuesto!: number;

  @ApiProperty()
  denominacionPuesto!: string;

  @ApiProperty({ type: Number, nullable: true })
  idPlan!: number | null;

  @ApiProperty({ type: String, nullable: true })
  estadoPlan!: string | null;

  @ApiProperty()
  aRevisar!: boolean;

  @ApiProperty({ type: ResumenBrechaDto })
  resumen!: ResumenBrechaDto;

  @ApiProperty({ type: [BrechaConocimientoDto] })
  conocimientos!: BrechaConocimientoDto[];
}
