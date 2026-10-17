import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

const MAX_INT4 = 2147483647;

export class EscalaDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  codigo: string;

  @ApiProperty()
  denominacion: string;

  @ApiProperty()
  orden: number;

  @ApiProperty({ description: 'Criterio observable del nivel' })
  criterio: string;

  @ApiProperty()
  activo: boolean;
}

export class CeldaMatrizDto {
  @ApiProperty()
  idNivelImpacto: number;

  @ApiProperty()
  idNivelDificultad: number;

  @ApiProperty({ description: 'Nivel de criticidad que da la combinación' })
  idNivelCriticidad: number;
}

export class MatrizDto {
  @ApiProperty({ type: EscalaDto, isArray: true })
  impactos: EscalaDto[];

  @ApiProperty({ type: EscalaDto, isArray: true })
  dificultades: EscalaDto[];

  @ApiProperty({ type: CeldaMatrizDto, isArray: true })
  celdas: CeldaMatrizDto[];
}

export class EditarCeldaDto {
  @ApiProperty({ description: 'Nivel de criticidad (activo) de la celda' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idNivelCriticidad: number;
}
