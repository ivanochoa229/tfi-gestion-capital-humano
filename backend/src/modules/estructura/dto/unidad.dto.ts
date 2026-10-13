import { ApiProperty } from '@nestjs/swagger';

export class UnidadDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ example: 'Departamento de Sistemas' })
  denominacion: string;

  @ApiProperty({ example: 'catedra', description: 'Código del tipo de unidad' })
  tipo: string;

  @ApiProperty({ nullable: true, type: Number })
  idUnidadSuperior: number | null;

  @ApiProperty()
  activo: boolean;
}

export class UnidadDetalleDto extends UnidadDto {
  @ApiProperty({ description: 'Puestos activos de la unidad' })
  cantidadPuestosActivos: number;
}

export class UnidadArbolDto extends UnidadDto {
  @ApiProperty({ type: () => [UnidadArbolDto] })
  hijas: UnidadArbolDto[];
}
