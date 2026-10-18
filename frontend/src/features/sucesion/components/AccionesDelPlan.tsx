import {
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { Accion } from '../hooks/useSucesion';
import { etiquetaEstadoAccion } from '../estados';

/** Acciones de transferencia del plan (solo lectura; se gestionan en otra pantalla). */
export function AccionesDelPlan({ acciones }: { acciones: Accion[] }) {
  return (
    <>
      <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
        Acciones de transferencia
      </Typography>
      {acciones.length === 0 ? (
        <Alert severity="info">El plan no tiene acciones asociadas.</Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Conocimiento</TableCell>
              <TableCell>Descripción</TableCell>
              <TableCell>Responsable</TableCell>
              <TableCell>Destinatario</TableCell>
              <TableCell>Fecha prevista</TableCell>
              <TableCell>Estado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {acciones.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.denominacionConocimiento}</TableCell>
                <TableCell>{a.descripcion}</TableCell>
                <TableCell>{a.nombreResponsable}</TableCell>
                <TableCell>{a.nombreDestinatario ?? '—'}</TableCell>
                <TableCell>{a.fechaPrevista}</TableCell>
                <TableCell>
                  {etiquetaEstadoAccion(a.estado)}{' '}
                  {a.vencida && (
                    <Chip size="small" color="error" label="Vencida" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
