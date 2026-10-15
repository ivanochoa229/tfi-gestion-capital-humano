import { ApiProperty } from '@nestjs/swagger';
import { FechaIso } from './fecha-iso.decorator.js';

export class CerrarOcupacionDto {
  @ApiProperty({ format: 'date', example: '2026-06-30' })
  @FechaIso()
  fechaHasta: string;
}
