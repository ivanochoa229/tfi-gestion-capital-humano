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
import { useOcupantesDePuesto } from '../../personas/hooks/useOcupaciones';
import type { Puesto } from '../hooks/usePuestos';

interface Props {
  puesto: Puesto;
  onCerrar: () => void;
}

/** Quiénes ocupan hoy el puesto (RF07). */
export function OcupantesPuestoDialog({ puesto, onCerrar }: Props) {
  const {
    data: ocupantes,
    isLoading,
    isError,
  } = useOcupantesDePuesto(puesto.id);
  const { data: caracteres } = useValoresReferencia('caracter-ocupacion', true);
  const { data: dedicaciones } = useValoresReferencia('dedicacion', true);
  const nombre = (
    lista: { id: number; denominacion: string }[] | undefined,
    id: number,
  ) => lista?.find((v) => v.id === id)?.denominacion ?? String(id);

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <DialogTitle>
        Ocupantes de {puesto.codigo} · {puesto.denominacion}
      </DialogTitle>
      <DialogContent>
        {isLoading && <CircularProgress aria-label="Cargando" />}
        {isError && (
          <Alert severity="error">No se pudieron cargar los ocupantes.</Alert>
        )}
        {ocupantes && ocupantes.length === 0 && (
          <Alert severity="info">Hoy nadie ocupa este puesto.</Alert>
        )}
        {ocupantes && ocupantes.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Persona</TableCell>
                <TableCell>Desde</TableCell>
                <TableCell>Hasta</TableCell>
                <TableCell>Carácter</TableCell>
                <TableCell>Dedicación</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ocupantes.map((o) => (
                <TableRow key={`${o.idPersona}-${o.fechaDesde}`}>
                  <TableCell>
                    {o.apellido}, {o.nombre} ({o.legajo})
                  </TableCell>
                  <TableCell>{o.fechaDesde}</TableCell>
                  <TableCell>{o.fechaHasta ?? '—'}</TableCell>
                  <TableCell>
                    {nombre(caracteres, o.idCaracterOcupacion)}
                  </TableCell>
                  <TableCell>{nombre(dedicaciones, o.idDedicacion)}</TableCell>
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
