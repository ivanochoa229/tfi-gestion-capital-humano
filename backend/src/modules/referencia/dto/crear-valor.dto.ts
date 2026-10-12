import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearValorDto {
  @ApiProperty({
    example: 'competencia_tecnica',
    description: 'Minúsculas, números y guion bajo; empieza con letra',
  })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,39}$/, {
    message:
      'codigo debe empezar con una letra minúscula y tener entre 2 y 40 caracteres (minúsculas, números y guion bajo)',
  })
  codigo: string;

  @ApiProperty({ example: 'Competencia técnica', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  denominacion: string;

  @ApiPropertyOptional({
    minimum: 1,
    description: 'Obligatorio en dominios ordinales; prohibido en el resto',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  orden?: number;
}
