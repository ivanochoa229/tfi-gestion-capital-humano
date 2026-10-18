import { ApiProperty } from '@nestjs/swagger';

export class PersonaDeteccionDto {
  @ApiProperty()
  idPersona!: number;

  @ApiProperty()
  apellido!: string;

  @ApiProperty()
  nombre!: string;
}

export class PuestoCriticoDto {
  @ApiProperty()
  idPuesto!: number;

  @ApiProperty()
  codigo!: string;

  @ApiProperty()
  denominacion!: string;

  @ApiProperty()
  idUnidad!: number;
}

export class PuntoUnicoFallaDto {
  @ApiProperty()
  idConocimiento!: number;

  @ApiProperty()
  denominacion!: string;

  @ApiProperty()
  nivelRequerido!: string;

  @ApiProperty({ enum: [0, 1] })
  cantidadPoseedores!: 0 | 1;

  @ApiProperty({ type: PersonaDeteccionDto, nullable: true })
  poseedor!: PersonaDeteccionDto | null;

  @ApiProperty({ type: [PuestoCriticoDto] })
  puestosCriticos!: PuestoCriticoDto[];

  @ApiProperty()
  puestosFueraDeAlcance!: number;
}

export class PuntosUnicosFallaDto {
  @ApiProperty({ type: [PuntoUnicoFallaDto] })
  unicoPoseedor!: PuntoUnicoFallaDto[];

  @ApiProperty({ type: [PuntoUnicoFallaDto] })
  sinPoseedor!: PuntoUnicoFallaDto[];
}
