import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class FiltroPuestosDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  idUnidad?: number;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const valor = obj[key];
    if (valor === 'true') return true;
    if (valor === 'false') return false;
    return valor;
  })
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({
    description: 'Texto contenido en el código o la denominación',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
