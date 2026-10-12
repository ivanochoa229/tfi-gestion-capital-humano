import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CambiarClaveDto {
  @ApiProperty()
  @IsString()
  claveActual: string;

  @ApiProperty({ description: 'Al menos 10 caracteres' })
  @IsString()
  claveNueva: string;
}
