import { applyDecorators } from '@nestjs/common';
import { IsISO8601, Matches } from 'class-validator';

/** Fecha sin hora, `AAAA-MM-DD`, que exista en el calendario. */
export function FechaIso() {
  return applyDecorators(
    Matches(/^\d{4}-\d{2}-\d{2}$/, {
      message: '$property debe ser una fecha AAAA-MM-DD',
    }),
    IsISO8601(
      { strict: true },
      { message: '$property debe ser una fecha válida' },
    ),
  );
}
