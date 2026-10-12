import { ApiProperty } from '@nestjs/swagger';

export class AuditoriaDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ example: 'plan_sucesion' })
  entidad: string;

  @ApiProperty({ example: '5' })
  idRegistro: string;

  @ApiProperty({ enum: ['alta', 'modificacion', 'baja'] })
  operacion: string;

  @ApiProperty()
  idUsuario: number;

  @ApiProperty()
  fecha: Date;

  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true })
  valoresAnteriores: Record<string, unknown> | null;

  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true })
  valoresNuevos: Record<string, unknown> | null;
}
