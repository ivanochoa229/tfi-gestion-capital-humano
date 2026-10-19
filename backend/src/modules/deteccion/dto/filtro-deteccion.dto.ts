import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class FiltroDeteccionDto {
  @ApiPropertyOptional({
    description: 'Filtrar por unidad organizativa (con sus descendientes)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idUnidad?: number;

  @ApiPropertyOptional({
    description: 'Exportar en formato CSV',
    enum: ['csv'],
  })
  @IsOptional()
  @IsIn(['csv'])
  formato?: 'csv';
}
