import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OcupacionDto } from './ocupacion.dto.js';

export class PersonaDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ example: 'L-1234' })
  legajo: string;

  @ApiProperty()
  apellido: string;

  @ApiProperty()
  nombre: string;

  @ApiPropertyOptional({
    description: 'Solo para recursos humanos y administrador (Ley 25.326)',
  })
  documento?: string;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Solo para recursos humanos y administrador (Ley 25.326)',
  })
  fechaNacimiento?: string;

  @ApiProperty({ format: 'date' })
  fechaIngreso: string;

  @ApiProperty()
  idSituacionRevista: number;

  @ApiProperty({ format: 'date', nullable: true, type: String })
  fechaPrevistaRetiro: string | null;

  @ApiProperty()
  activo: boolean;

  @ApiProperty({ description: 'Tiene un usuario vinculado' })
  tieneUsuario: boolean;
}

export class PersonaDetalleDto extends PersonaDto {
  @ApiProperty({ type: OcupacionDto, isArray: true })
  ocupacionesVigentes: OcupacionDto[];
}

export class ResultadoBajaPersonaDto {
  @ApiProperty({ type: PersonaDetalleDto })
  persona: PersonaDetalleDto;

  @ApiProperty({
    type: String,
    isArray: true,
    description: 'Avisos que no impidieron la baja',
  })
  advertencias: string[];
}
