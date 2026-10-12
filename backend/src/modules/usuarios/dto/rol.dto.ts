import { ApiProperty } from '@nestjs/swagger';

export class RolDto {
  @ApiProperty({ example: 'jefe_catedra' })
  codigo: string;

  @ApiProperty({ example: 'Jefe de cátedra' })
  denominacion: string;
}
