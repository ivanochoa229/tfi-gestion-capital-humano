import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValorReferenciaDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ example: 'basico' })
  codigo: string;

  @ApiProperty({ example: 'Básico' })
  denominacion: string;

  @ApiProperty()
  activo: boolean;

  @ApiPropertyOptional({ description: 'Solo en dominios ordinales' })
  orden?: number;

  @ApiProperty({ description: 'Hay registros que usan este valor' })
  enUso: boolean;
}

export class ActualizacionValorDto extends ValorReferenciaDto {
  @ApiPropertyOptional({
    description: 'Aviso cuando se desactiva el último valor activo',
  })
  advertencia?: string;
}
