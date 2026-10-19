import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  MESES_HORIZONTE_DEFECTO,
  MESES_HORIZONTE_MAX,
} from '../deteccion.constantes.js';

export class FiltroTableroDto {
  @ApiPropertyOptional({
    description: 'Unidad organizativa (incluye sus descendientes)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idUnidad?: number;

  @ApiPropertyOptional({
    description: 'Horizonte temporal en meses',
    minimum: 1,
    maximum: MESES_HORIZONTE_MAX,
    default: MESES_HORIZONTE_DEFECTO,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MESES_HORIZONTE_MAX)
  meses?: number;
}

export class ResumenPuntosUnicosTableroDto {
  @ApiProperty()
  unicoPoseedor!: number;

  @ApiProperty()
  sinPoseedor!: number;
}

export class ResumenCatedrasTableroDto {
  @ApiProperty()
  unaPersona!: number;

  @ApiProperty()
  sinDotacion!: number;
}

export class MotivoSinSucesorTableroDto {
  @ApiProperty()
  motivo!: string;

  @ApiProperty()
  cantidad!: number;
}

export class ResumenPuestosSinSucesorTableroDto {
  @ApiProperty()
  total!: number;

  @ApiProperty({ type: [MotivoSinSucesorTableroDto] })
  porMotivo!: MotivoSinSucesorTableroDto[];
}

export class ResumenHorizonteTableroDto {
  @ApiProperty()
  meses!: number;

  @ApiProperty()
  conocimientos!: number;
}

export class PuntoUnicoPorCatedraDto {
  @ApiProperty()
  idUnidad!: number;

  @ApiProperty()
  denominacion!: string;

  @ApiProperty()
  cantidad!: number;
}

export class RetiroPorSemestreDto {
  @ApiProperty()
  semestre!: string;

  @ApiProperty()
  cantidad!: number;
}

export class GraficosTableroDto {
  @ApiProperty({ type: [PuntoUnicoPorCatedraDto] })
  puntosUnicosPorCatedra!: PuntoUnicoPorCatedraDto[];

  @ApiProperty({ type: [RetiroPorSemestreDto] })
  retirosPorSemestre!: RetiroPorSemestreDto[];
}

export class CalidadCriticidadTableroDto {
  @ApiProperty()
  evaluados!: number;

  @ApiProperty()
  total!: number;
}

export class CalidadPlanesTableroDto {
  @ApiProperty()
  criticos!: number;

  @ApiProperty()
  conPlan!: number;
}

export class CalidadAcreditacionTableroDto {
  @ApiProperty()
  acreditados!: number;

  @ApiProperty()
  total!: number;
}

export class CalidadDeDatosTableroDto {
  @ApiProperty({ type: CalidadCriticidadTableroDto })
  criticidad!: CalidadCriticidadTableroDto;

  @ApiProperty({ type: CalidadPlanesTableroDto })
  planes!: CalidadPlanesTableroDto;

  @ApiProperty({ type: CalidadAcreditacionTableroDto })
  acreditacion!: CalidadAcreditacionTableroDto;
}

export class TableroDto {
  @ApiProperty({ type: ResumenPuntosUnicosTableroDto })
  puntosUnicosFalla!: ResumenPuntosUnicosTableroDto;

  @ApiProperty({ type: ResumenCatedrasTableroDto })
  catedras!: ResumenCatedrasTableroDto;

  @ApiProperty({ type: ResumenPuestosSinSucesorTableroDto })
  puestosSinSucesor!: ResumenPuestosSinSucesorTableroDto;

  @ApiProperty()
  candidatosConBrecha!: number;

  @ApiProperty({ type: ResumenHorizonteTableroDto })
  horizonte!: ResumenHorizonteTableroDto;

  @ApiProperty({ type: GraficosTableroDto })
  graficos!: GraficosTableroDto;

  @ApiProperty({ type: CalidadDeDatosTableroDto })
  calidadDeDatos!: CalidadDeDatosTableroDto;
}
