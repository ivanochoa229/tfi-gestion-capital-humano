import { ApiProperty } from '@nestjs/swagger';
import { PersonaDeteccionDto } from './punto-unico-falla.dto.js';

export class CatedraUnaPersonaDto {
  @ApiProperty()
  idUnidad!: number;

  @ApiProperty()
  denominacion!: string;

  @ApiProperty({ enum: [0, 1] })
  cantidadPersonas!: 0 | 1;

  @ApiProperty()
  cantidadCargos!: number;

  @ApiProperty({ type: PersonaDeteccionDto, nullable: true })
  persona!: PersonaDeteccionDto | null;
}

export class CatedrasUnaPersonaDto {
  @ApiProperty({ type: [CatedraUnaPersonaDto] })
  unaPersona!: CatedraUnaPersonaDto[];

  @ApiProperty({ type: [CatedraUnaPersonaDto] })
  sinDotacion!: CatedraUnaPersonaDto[];
}
