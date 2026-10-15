import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/** Campos de texto del formulario multipart (el archivo viaja aparte). */
export class ImportarPersonasDto {
  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      'false: vista previa sin escribir. true: importa si no hay errores',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : value,
  )
  @IsBoolean()
  confirmar?: boolean;
}
