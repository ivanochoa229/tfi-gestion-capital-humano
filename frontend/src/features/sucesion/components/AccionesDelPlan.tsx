import { Alert, Typography } from '@mui/material';
import type { Accion } from '../hooks/useSucesion';
import { AccionesTabla } from './AccionesTabla';

/** Acciones de transferencia del plan (solo lectura; se gestionan en «Acciones»). */
export function AccionesDelPlan({ acciones }: { acciones: Accion[] }) {
  return (
    <>
      <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
        Acciones de transferencia
      </Typography>
      {acciones.length === 0 ? (
        <Alert severity="info">El plan no tiene acciones asociadas.</Alert>
      ) : (
        <AccionesTabla acciones={acciones} />
      )}
    </>
  );
}
