import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorImportacionDto {
  @ApiProperty({ description: 'Fila del archivo; la cabecera es la 1' })
  fila: number;

  @ApiPropertyOptional({
    description: 'Columna del CSV a la que apunta el error',
  })
  columna?: string;

  @ApiProperty()
  mensaje: string;
}

export class ResultadoImportacionDto {
  @ApiProperty({
    description:
      'true solo si se pidió confirmar y no hubo errores: se escribió todo',
  })
  importado: boolean;

  @ApiProperty({ description: 'Filas de datos leídas' })
  filas: number;

  @ApiProperty({
    description: 'Personas creadas, o que se crearían en la vista previa',
  })
  personas: number;

  @ApiProperty({
    description: 'Ocupaciones creadas, o que se crearían en la vista previa',
  })
  ocupaciones: number;

  @ApiProperty({ type: ErrorImportacionDto, isArray: true })
  errores: ErrorImportacionDto[];
}
