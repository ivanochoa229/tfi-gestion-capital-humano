import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
} from 'class-validator';
import { FechaIso } from './fecha-iso.decorator.js';

/** Mayor valor de una columna int4 de Postgres. */
const MAX_INT4 = 2147483647;

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearPersonaDto {
  @ApiProperty({ example: 'L-1234', maxLength: 20, description: 'Único' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  legajo: string;

  @ApiProperty({ example: 'Pérez', maxLength: 100 })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellido: string;

  @ApiProperty({ example: 'Ana', maxLength: 100 })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({
    example: '30111111',
    description: 'DNI de 7 u 8 dígitos, sin puntos. Único',
  })
  @Transform(recortar)
  @Matches(/^\d{7,8}$/, {
    message: 'documento debe tener 7 u 8 dígitos, sin puntos',
  })
  documento: string;

  @ApiProperty({ example: '1980-05-20', format: 'date' })
  @FechaIso()
  fechaNacimiento: string;

  @ApiProperty({
    example: '2005-03-01',
    format: 'date',
    description: 'Posterior al nacimiento',
  })
  @FechaIso()
  fechaIngreso: string;

  @ApiProperty()
  @IsInt()
  @Max(MAX_INT4)
  idSituacionRevista: number;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'date',
    description: 'No anterior al ingreso; null la borra',
  })
  @IsOptional()
  @FechaIso()
  fechaPrevistaRetiro?: string | null;
}
