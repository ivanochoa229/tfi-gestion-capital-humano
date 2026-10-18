import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  MOTIVO_SIN_SUCESOR,
  type MotivoSinSucesor,
} from '../deteccion.constantes.js';
import { FiltroDeteccionDto } from './filtro-deteccion.dto.js';

const MOTIVOS = Object.values(MOTIVO_SIN_SUCESOR);

export class FiltroSinSucesorDto extends FiltroDeteccionDto {
  @ApiPropertyOptional({
    description: 'Filtrar por motivo de falta de sucesor preparado',
    enum: MOTIVOS,
  })
  @IsOptional()
  @IsIn(MOTIVOS)
  motivo?: MotivoSinSucesor;
}

export class PuestoSinSucesorDto {
  @ApiProperty()
  idPuesto!: number;

  @ApiProperty()
  codigo!: string;

  @ApiProperty()
  denominacion!: string;

  @ApiProperty()
  idUnidad!: number;

  @ApiProperty({ enum: MOTIVOS })
  motivo!: string;

  @ApiProperty({ type: Number, nullable: true })
  idPlan!: number | null;

  @ApiProperty()
  candidatosTotal!: number;

  @ApiProperty()
  candidatosValidos!: number;
}
