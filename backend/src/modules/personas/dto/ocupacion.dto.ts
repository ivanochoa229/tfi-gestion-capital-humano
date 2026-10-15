import { ApiProperty } from '@nestjs/swagger';
import type { EstadoOcupacion } from '../fechas.js';

export class OcupacionDto {
  @ApiProperty()
  idPersona: number;

  @ApiProperty()
  idPuesto: number;

  @ApiProperty({ format: 'date', example: '2024-03-01' })
  fechaDesde: string;

  @ApiProperty({
    format: 'date',
    nullable: true,
    type: String,
    description: 'null: sin fin',
  })
  fechaHasta: string | null;

  @ApiProperty()
  idCaracterOcupacion: number;

  @ApiProperty()
  idDedicacion: number;

  @ApiProperty({
    enum: ['vigente', 'futura', 'pasada'],
    description: 'Respecto de la fecha de hoy de la base',
  })
  estado: EstadoOcupacion;
}

/** Ocupación de un puesto con los datos mínimos de quien la ocupa. */
export class OcupanteDto extends OcupacionDto {
  @ApiProperty({ example: 'L-1234' })
  legajo: string;

  @ApiProperty()
  apellido: string;

  @ApiProperty()
  nombre: string;
}
