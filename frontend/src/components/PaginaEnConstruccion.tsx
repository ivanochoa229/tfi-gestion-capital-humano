import { Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface Props {
  titulo: string;
  descripcion: string;
  children?: ReactNode;
}

/** Encabezado común de las páginas mientras se implementan. */
export function PaginaEnConstruccion({ titulo, descripcion, children }: Props) {
  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        {titulo}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {descripcion}
      </Typography>
      {children}
    </>
  );
}
