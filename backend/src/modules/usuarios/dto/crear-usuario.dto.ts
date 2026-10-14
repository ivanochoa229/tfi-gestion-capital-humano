import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { TODOS_LOS_ROLES, type CodigoRol } from '../../../common/roles.js';
import { normalizarNombreUsuario } from '../auth.service.js';
import { LARGO_MINIMO_CLAVE } from '../password.service.js';

export class CrearUsuarioDto {
  @ApiProperty({
    example: 'ana.perez',
    description: '3 a 50 caracteres; se guarda en minúsculas',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizarNombreUsuario(value) : value,
  )
  @Matches(/^[a-z0-9._-]{3,50}$/, {
    message:
      'nombreUsuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion y guion bajo',
  })
  nombreUsuario: string;

  @ApiProperty({ minLength: LARGO_MINIMO_CLAVE })
  @IsString()
  @MinLength(LARGO_MINIMO_CLAVE, {
    message: `clave debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres`,
  })
  clave: string;

  @ApiProperty({ enum: TODOS_LOS_ROLES })
  @IsIn(TODOS_LOS_ROLES)
  rol: CodigoRol;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Obligatoria para el rol docente',
  })
  @IsOptional()
  @IsInt()
  idPersona?: number | null;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Solo para jefatura y jefe de cátedra',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  idUnidades?: number[];
}
