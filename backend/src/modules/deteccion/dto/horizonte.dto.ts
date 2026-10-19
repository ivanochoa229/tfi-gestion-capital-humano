import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  MESES_HORIZONTE_DEFECTO,
  MESES_HORIZONTE_MAX,
} from '../deteccion.constantes.js';
import { FiltroDeteccionDto } from './filtro-deteccion.dto.js';
import { PuestoCriticoDto } from './punto-unico-falla.dto.js';

export class FiltroHorizonteDto extends FiltroDeteccionDto {
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

  @ApiPropertyOptional({
    description:
      'Incluir conocimientos que quedan con 2 o más poseedores tras los retiros',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  incluirConDosOMas?: boolean;
}

export class RetiroRiesgoDto {
  @ApiProperty({ type: Number, nullable: true })
  idPersona!: number | null;

  @ApiProperty({ type: String, nullable: true })
  apellido!: string | null;

  @ApiProperty({ type: String, nullable: true })
  nombre!: string | null;

  @ApiProperty({ type: String, nullable: true })
  fechaPrevistaRetiro!: string | null;
}

export class HorizonteRiesgoDto {
  @ApiProperty()
  idConocimiento!: number;

  @ApiProperty()
  denominacion!: string;

  @ApiProperty()
  nivelRequerido!: string;

  @ApiProperty()
  cantidadPoseedores!: number;

  @ApiProperty()
  quedan!: number;

  @ApiProperty({ type: [RetiroRiesgoDto] })
  retiros!: RetiroRiesgoDto[];

  @ApiProperty({ type: [PuestoCriticoDto] })
  puestosCriticos!: PuestoCriticoDto[];

  @ApiProperty()
  puestosFueraDeAlcance!: number;
}

export class HorizonteRespuestaDto {
  @ApiProperty()
  meses!: number;

  @ApiProperty({ type: [HorizonteRiesgoDto] })
  conocimientos!: HorizonteRiesgoDto[];
}
