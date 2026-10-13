import { ApiProperty } from '@nestjs/swagger';

export class PuestoDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ example: 'P-0001' })
  codigo: string;

  @ApiProperty({ example: 'Jefe de cátedra' })
  denominacion: string;

  @ApiProperty({ nullable: true, type: String })
  proposito: string | null;

  @ApiProperty({ nullable: true, type: String })
  condicionesTrabajo: string | null;

  @ApiProperty({ nullable: true, type: String })
  rangoRetributivo: string | null;

  @ApiProperty({ minimum: 1 })
  dotacionPrevista: number;

  @ApiProperty()
  idUnidad: number;

  @ApiProperty()
  idNivelJerarquico: number;

  @ApiProperty({ nullable: true, type: Number })
  idTipoRelacionContractual: number | null;

  @ApiProperty({ nullable: true, type: Number })
  idPuestoSuperior: number | null;

  @ApiProperty()
  activo: boolean;
}

export class PuestoResumenDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ example: 'P-0001' })
  codigo: string;

  @ApiProperty()
  denominacion: string;

  @ApiProperty()
  activo: boolean;
}

export class PuestoDetalleDto extends PuestoDto {
  @ApiProperty({ type: PuestoResumenDto, nullable: true })
  superior: PuestoResumenDto | null;

  @ApiProperty({
    type: [PuestoResumenDto],
    description: 'Subordinados directos',
  })
  subordinados: PuestoResumenDto[];
}

export class PuestosTipoCreadosDto {
  @ApiProperty({ type: [PuestoDto] })
  puestos: PuestoDto[];

  @ApiProperty({ type: [String] })
  advertencias: string[];
}
