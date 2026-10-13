import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Mayor valor de una columna int4 de Postgres. */
const MAX_INT4 = 2147483647;

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearPuestoDto {
  @ApiProperty({ example: 'Jefe de cátedra', maxLength: 150 })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  denominacion: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  proposito?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  condicionesTrabajo?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    maxLength: 100,
    description: 'Texto descriptivo; no es un monto',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  rangoRetributivo?: string | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 10000, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  dotacionPrevista?: number;

  @ApiProperty({
    description: 'Unidad del puesto; no se puede cambiar después',
  })
  @IsInt()
  @Max(MAX_INT4)
  idUnidad: number;

  @ApiProperty()
  @IsInt()
  @Max(MAX_INT4)
  idNivelJerarquico: number;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  @Max(MAX_INT4)
  idTipoRelacionContractual?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: 'En la misma unidad o en una ancestra',
  })
  @IsOptional()
  @IsInt()
  @Max(MAX_INT4)
  idPuestoSuperior?: number | null;
}
