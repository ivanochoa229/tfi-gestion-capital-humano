import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { LARGO_MINIMO_CLAVE } from '../password.service.js';

export class RestablecerClaveDto {
  @ApiProperty({ minLength: LARGO_MINIMO_CLAVE })
  @IsString()
  @MinLength(LARGO_MINIMO_CLAVE, {
    message: `clave debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres`,
  })
  clave: string;
}
