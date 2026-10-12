import { Alert, CircularProgress } from '@mui/material';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSesion } from './useSesion';

interface Props {
  /** Sin roles: basta con haber iniciado sesión. */
  roles?: string[];
  children: ReactNode;
}

export function RutaProtegida({ roles, children }: Props) {
  const { data: sesion, isLoading } = useSesion();
  const ubicacion = useLocation();

  if (isLoading) return <CircularProgress aria-label="Cargando" />;
  if (!sesion) {
    return (
      <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />
    );
  }
  if (roles && !roles.includes(sesion.rol)) {
    return (
      <Alert severity="warning">No tenés permiso para ver esta sección.</Alert>
    );
  }
  return children;
}
