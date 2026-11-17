import { ApiProperty } from '@nestjs/swagger';

/** Metadatos de un archivo adjunto guardado en RustFS. La clave del objeto no sale de la API. */
export class ArchivoAdjuntoDto {
  @ApiProperty({ example: 'certificado.pdf' })
  nombre: string;

  @ApiProperty({ example: 'application/pdf' })
  tipoMime: string;

  @ApiProperty({ description: 'Tamaño en bytes' })
  tamanio: number;
}

/** Arma el DTO a partir de las columnas `{prefijo}Nombre`, `{prefijo}TipoMime` y `{prefijo}Tamanio`. */
export function aArchivoAdjunto(
  nombre: string | null,
  tipoMime: string | null,
  tamanio: number | null,
): ArchivoAdjuntoDto | null {
  if (nombre === null || tipoMime === null || tamanio === null) return null;
  return { nombre, tipoMime, tamanio };
}
