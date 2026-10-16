import {
  Alert,
  CircularProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import {
  useEditarCelda,
  useMatriz,
} from '../../criticidad/hooks/useCriticidad';
import { useValoresReferencia } from '../hooks/useValoresReferencia';

/** Matriz que combina impacto y dificultad en un nivel de criticidad (RF12). */
export function MatrizCriticidad() {
  const { data: matriz, isLoading, isError } = useMatriz();
  const { data: niveles } = useValoresReferencia('nivel-criticidad', false);
  const editar = useEditarCelda();
  const [mensaje, setMensaje] = useState<{
    tipo: 'success' | 'error';
    texto: string;
  }>();

  if (isLoading) return <CircularProgress aria-label="Cargando" />;
  if (isError || !matriz) {
    return <Alert severity="error">No se pudo cargar la matriz.</Alert>;
  }

  const impactos = [...matriz.impactos].sort((a, b) => b.orden - a.orden);
  const dificultades = [...matriz.dificultades].sort(
    (a, b) => a.orden - b.orden,
  );
  const valorDe = (idImpacto: number, idDificultad: number) =>
    matriz.celdas.find(
      (c) =>
        c.idNivelImpacto === idImpacto && c.idNivelDificultad === idDificultad,
    )?.idNivelCriticidad;

  const cambiar = async (
    idNivelImpacto: number,
    idNivelDificultad: number,
    valor: string,
  ) => {
    setMensaje(undefined);
    try {
      await editar.mutateAsync({
        idNivelImpacto,
        idNivelDificultad,
        idNivelCriticidad: Number(valor),
      });
      setMensaje({ tipo: 'success', texto: 'Celda actualizada' });
    } catch (e) {
      setMensaje({ tipo: 'error', texto: (e as Error).message });
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h2">
        Matriz de criticidad
      </Typography>
      <Alert severity="info">
        Cambiar la matriz no modifica las evaluaciones ya guardadas: cada una
        conserva el nivel que tenía al evaluarse. Las evaluaciones nuevas usan
        la matriz actual.
      </Alert>
      {mensaje && <Alert severity={mensaje.tipo}>{mensaje.texto}</Alert>}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Impacto \ Dificultad</TableCell>
            {dificultades.map((d) => (
              <TableCell key={d.id}>
                <Tooltip title={d.criterio}>
                  <span>{d.denominacion}</span>
                </Tooltip>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {impactos.map((i) => (
            <TableRow key={i.id}>
              <TableCell>
                <Tooltip title={i.criterio}>
                  <span>{i.denominacion}</span>
                </Tooltip>
              </TableCell>
              {dificultades.map((d) => (
                <TableCell key={d.id}>
                  <TextField
                    select
                    size="small"
                    value={String(valorDe(i.id, d.id) ?? '')}
                    onChange={(e) => cambiar(i.id, d.id, e.target.value)}
                    disabled={editar.isPending}
                    slotProps={{
                      htmlInput: {
                        'aria-label': `${i.denominacion} y ${d.denominacion}`,
                      },
                    }}
                  >
                    {(niveles ?? []).map((n) => (
                      <MenuItem key={n.id} value={String(n.id)}>
                        {n.denominacion}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Stack>
  );
}
