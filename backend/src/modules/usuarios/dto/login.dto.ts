import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  nombreUsuario: string;

  @ApiProperty()
  @IsString()
  clave: string;
}
