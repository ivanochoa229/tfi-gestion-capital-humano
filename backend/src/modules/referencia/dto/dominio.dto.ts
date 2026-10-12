import { ApiProperty } from '@nestjs/swagger';

export class DominioDto {
  @ApiProperty({ example: 'nivel-dominio' })
  dominio: string;

  @ApiProperty({ example: 'Nivel de dominio' })
  denominacion: string;

  @ApiProperty({ description: 'Si es true, los valores tienen orden' })
  ordinal: boolean;
}
