import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FechaIso } from '../../personas/dto/fecha-iso.decorator.js';
import { Trim } from './trim.js';

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

export class AcreditarDto {
  @ApiProperty({ description: 'Nivel de dominio que se acredita (activo)' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idNivel: number;

  @ApiProperty({
    format: 'date',
    example: '2026-06-15',
    description: 'No futura',
  })
  @FechaIso()
  fechaEvaluacion: string;

  @ApiProperty({ description: 'Tipo de evidencia activo' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idTipoEvidencia: number;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 2000 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  observaciones?: string | null;
}

export class AcreditacionDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  idPersona: number;

  @ApiProperty()
  idConocimiento: number;

  @ApiProperty()
  idNivelAcreditado: number;

  @ApiProperty()
  idTipoEvidencia: number;

  @ApiProperty({ format: 'date' })
  fechaEvaluacion: string;

  @ApiProperty({ description: 'Persona que evaluó' })
  idEvaluador: number;

  @ApiProperty({ nullable: true, type: String })
  observaciones: string | null;

  @ApiProperty({ format: 'date-time' })
  registradaEn: string;
}

/** Una fila del perfil de conocimiento de una persona. */
export class PerfilConocimientoDto extends ConocimientoPersonaDto {
  @ApiProperty()
  denominacion: string;

  @ApiProperty()
  idTipoConocimiento: number;

  @ApiProperty({
    description:
      'Declarado que todavía no tiene una acreditación que lo respalde o lo contradiga',
  })
  pendiente: boolean;
}

export class PuestoQuePideDto {
  @ApiProperty()
  idPuesto: number;

  @ApiProperty({ example: 'P-0001' })
  codigo: string;

  @ApiProperty()
  denominacion: string;
}

/** Fila de «Mis conocimientos»: un conocimiento una sola vez, aunque lo pidan varios puestos. */
export class MiConocimientoDto {
  @ApiProperty()
  idConocimiento: number;

  @ApiProperty()
  denominacion: string;

  @ApiProperty()
  idTipoConocimiento: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'El más exigente entre los puestos que ocupa; null si ninguno lo pide',
  })
  idNivelRequerido: number | null;

  @ApiProperty({ description: 'true si algún puesto lo pide como excluyente' })
  esExcluyente: boolean;

  @ApiProperty({ type: PuestoQuePideDto, isArray: true })
  puestos: PuestoQuePideDto[];

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

  @ApiProperty({
    description:
      'true si lo declarado espera acreditación (no hay una, o declaró otro nivel después de la última)',
  })
  pendiente: boolean;
}

export class PendienteAcreditacionDto {
  @ApiProperty()
  idPersona: number;

  @ApiProperty()
  apellido: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  idConocimiento: number;

  @ApiProperty()
  denominacion: string;

  @ApiProperty()
  idNivelDeclarado: number;

  @ApiProperty({ nullable: true, type: Number })
  idNivelAcreditado: number | null;

  @ApiProperty({ format: 'date' })
  fechaDeclaracion: string;
}
