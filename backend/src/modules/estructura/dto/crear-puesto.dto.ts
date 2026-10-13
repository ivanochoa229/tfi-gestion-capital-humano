import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

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

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  dotacionPrevista?: number;

  @ApiProperty({
    description: 'Unidad del puesto; no se puede cambiar después',
  })
  @IsInt()
  idUnidad: number;

  @ApiProperty()
  @IsInt()
  idNivelJerarquico: number;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  idTipoRelacionContractual?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: 'En la misma unidad o en una ancestra',
  })
  @IsOptional()
  @IsInt()
  idPuestoSuperior?: number | null;
}
