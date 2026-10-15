import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

const MAX_INT4 = 2147483647;

export class DeclararDto {
  @ApiProperty({ description: 'Nivel de dominio que declara (activo)' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idNivel: number;
}

/** Declaración vigente de una persona y reflejo de su acreditación vigente. */
export class ConocimientoPersonaDto {
  @ApiProperty()
  idPersona: number;

  @ApiProperty()
  idConocimiento: number;

  @ApiProperty({ nullable: true, type: Number })
  idNivelDeclarado: number | null;

  @ApiProperty({ format: 'date', nullable: true, type: String })
  fechaDeclaracion: string | null;

  @ApiProperty({ nullable: true, type: Number })
  idNivelAcreditado: number | null;

  @ApiProperty({ format: 'date', nullable: true, type: String })
  fechaEvaluacion: string | null;

  @ApiProperty({ nullable: true, type: Number })
  idTipoEvidencia: number | null;

  @ApiProperty({ nullable: true, type: Number })
  idEvaluador: number | null;
}
