import { ApiProperty } from '@nestjs/swagger';
import { TODOS_LOS_ROLES, type CodigoRol } from '../../../common/roles.js';

export class UsuarioDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  nombreUsuario: string;

  @ApiProperty({ enum: TODOS_LOS_ROLES })
  rol: CodigoRol;

  @ApiProperty({ nullable: true, type: Number })
  idPersona: number | null;

  @ApiProperty({ type: [Number] })
  idUnidades: number[];

  @ApiProperty()
  activo: boolean;
}
