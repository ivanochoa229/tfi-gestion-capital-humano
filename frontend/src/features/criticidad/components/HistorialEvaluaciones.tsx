import {
  Alert,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { useHistorialEvaluaciones, useMatriz } from '../hooks/useCriticidad';
import { colorNivel } from '../niveles';

interface Props {
  idPuesto: number;
  idConocimiento: number;
}

/** Todas las evaluaciones del par; la primera es la vigente. */
export function HistorialEvaluaciones({ idPuesto, idConocimiento }: Props) {
  const { data, isLoading, isError } = useHistorialEvaluaciones(
    idPuesto,
    idConocimiento,
  );
  const { data: matriz } = useMatriz();
  const { data: niveles } = useValoresReferencia('nivel-criticidad', true);
  const escala = (
    lista: { id: number; denominacion: string }[] | undefined,
    id: number,
  ) => lista?.find((e) => e.id === id)?.denominacion ?? String(id);

  if (isLoading) return <CircularProgress size={20} aria-label="Cargando" />;
  if (isError)
    return <Alert severity="error">No se pudo cargar el historial.</Alert>;
  if (!data || data.length === 0) {
    return (
      <Typography variant="body2">Todavía no se evaluó este par.</Typography>
    );
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Fecha</TableCell>
          <TableCell>Impacto</TableCell>
          <TableCell>Dificultad</TableCell>
          <TableCell>Criticidad</TableCell>
          <TableCell>Evaluó</TableCell>
          <TableCell>Observaciones</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.map((e, i) => {
          const nivel = niveles?.find((n) => n.id === e.idNivelCriticidad);
          return (
            <TableRow key={e.id}>
              <TableCell>
                {e.fechaEvaluacion}
                {i === 0 && (
                  <Chip size="small" label="Vigente" sx={{ ml: 1 }} />
                )}
              </TableCell>
              <TableCell>
                {escala(matriz?.impactos, e.idNivelImpacto)}
              </TableCell>
              <TableCell>
                {escala(matriz?.dificultades, e.idNivelDificultad)}
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={nivel?.denominacion ?? e.idNivelCriticidad}
                  color={colorNivel(nivel?.codigo)}
                />
              </TableCell>
              <TableCell>{e.nombreUsuario}</TableCell>
              <TableCell>{e.observaciones ?? '—'}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
