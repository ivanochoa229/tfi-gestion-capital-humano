import type { ChipProps } from '@mui/material';

/** Color del chip de cada nivel de criticidad por su código (`baja`, `media`, `alta`). */
export function colorNivel(codigo: string | undefined): ChipProps['color'] {
  if (codigo === 'alta') return 'error';
  if (codigo === 'media') return 'warning';
  if (codigo === 'baja') return 'success';
  return 'default';
}
