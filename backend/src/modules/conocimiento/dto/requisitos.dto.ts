import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';

const MAX_INT4 = 2147483647;

export class GuardarRequisitoDto {
  @ApiProperty({ description: 'Nivel de dominio requerido (activo)' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idNivel: number;

  @ApiProperty({ description: 'true: excluyente; false: deseable' })
  @IsBoolean()
  esExcluyente: boolean;
}

export class CopiarRequisitosDto {
  @ApiProperty({ description: 'Puesto del que se copian los requisitos' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idPuestoOrigen: number;
}

export class RequisitoDto {
  @ApiProperty()
  idPuesto: number;

  @ApiProperty()
  idConocimiento: number;

  @ApiProperty()
  denominacion: string;

  @ApiProperty()
  idTipoConocimiento: number;

  @ApiProperty()
  idNivelRequerido: number;

  @ApiProperty()
  esExcluyente: boolean;
}

export class OmitidoDto {
  @ApiProperty()
  idConocimiento: number;

  @ApiProperty()
  denominacion: string;
}

export class ResultadoCopiaDto {
  @ApiProperty()
  copiados: number;

  @ApiProperty({
    type: OmitidoDto,
    isArray: true,
    description: 'Los que el puesto destino ya tenía; no se pisan',
  })
  omitidos: OmitidoDto[];
}
