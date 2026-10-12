import { ApiProperty } from '@nestjs/swagger';

export class SaludDto {
  @ApiProperty({ example: 'ok' })
  estado: string;

  @ApiProperty({ description: 'PostgreSQL responde' })
  baseDeDatos: boolean;

  @ApiProperty({ description: 'RustFS responde y el bucket existe' })
  almacenamiento: boolean;
}
