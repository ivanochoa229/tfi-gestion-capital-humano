import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { useHistorialAcreditaciones } from '../hooks/useAcreditaciones';

interface Props {
  idPersona: number;
  idConocimiento: number;
  denominacion: string;
  onCerrar: () => void;
}

/** Todas las acreditaciones del par; la primera es la vigente. */
export function HistorialAcreditacionesDialog({
  idPersona,
  idConocimiento,
  denominacion,
  onCerrar,
}: Props) {
  const { data, isLoading, isError } = useHistorialAcreditaciones(
    idPersona,
    idConocimiento,
  );
  const { data: niveles } = useValoresReferencia('nivel-dominio', true);
  const { data: evidencias } = useValoresReferencia('tipo-evidencia', true);
  const nombre = (
    lista: { id: number; denominacion: string }[] | undefined,
    id: number,
  ) => lista?.find((v) => v.id === id)?.denominacion ?? String(id);

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="md">
      <DialogTitle>Historial de acreditaciones: {denominacion}</DialogTitle>
      <DialogContent>
        {isLoading && <CircularProgress aria-label="Cargando" />}
        {isError && (
          <Alert severity="error">No se pudo cargar el historial.</Alert>
        )}
        {data && data.length === 0 && (
          <Alert severity="info">Todavía no hay acreditaciones.</Alert>
        )}
        {data && data.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Nivel</TableCell>
                <TableCell>Evidencia</TableCell>
                <TableCell>Observaciones</TableCell>
                <TableCell>Vigente</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((a, i) => (
                <TableRow key={a.id}>
                  <TableCell>{a.fechaEvaluacion}</TableCell>
                  <TableCell>{nombre(niveles, a.idNivelAcreditado)}</TableCell>
                  <TableCell>{nombre(evidencias, a.idTipoEvidencia)}</TableCell>
                  <TableCell>{a.observaciones ?? '—'}</TableCell>
                  <TableCell>{i === 0 ? 'Sí' : ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
