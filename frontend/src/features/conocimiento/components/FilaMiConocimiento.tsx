import {
  Alert,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import type { Valor } from '../../admin/hooks/useValoresReferencia';
import { descripcionNivel } from '../niveles';
import {
  useDeclarar,
  useRetirarDeclaracion,
  type MiConocimiento,
} from '../hooks/useMisConocimientos';

interface Props {
  fila: MiConocimiento;
  idPersona: number;
  /** Niveles activos, de menor a mayor. */
  niveles: Valor[];
  /** Todos los niveles (activos o no), para nombrar lo ya registrado. */
  todosLosNiveles: Valor[];
  tiposEvidencia: Valor[];
}

/** Una fila: lo que pide el puesto, lo que declaré y, si existe, lo que me acreditaron. */
export function FilaMiConocimiento({
  fila,
  idPersona,
  niveles,
  todosLosNiveles,
  tiposEvidencia,
}: Props) {
  const declarar = useDeclarar();
  const retirar = useRetirarDeclaracion();
  const [error, setError] = useState<string>();

  const nombre = (lista: Valor[], id: number | null) =>
    id === null
      ? ''
      : (lista.find((v) => v.id === id)?.denominacion ?? String(id));
  const elegido = niveles.find((n) => n.id === fila.idNivelDeclarado);

  const cambiar = async (idNivel: number) => {
    setError(undefined);
    try {
      await declarar.mutateAsync({
        idPersona,
        idConocimiento: fila.idConocimiento,
        idNivel,
      });
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const quitar = async () => {
    setError(undefined);
    try {
      await retirar.mutateAsync({
        idPersona,
        idConocimiento: fila.idConocimiento,
      });
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const acreditado = fila.idNivelAcreditado !== null;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <Typography variant="subtitle1" component="h3" sx={{ flexGrow: 1 }}>
            {fila.denominacion}
          </Typography>
          {fila.idNivelRequerido !== null && (
            <Chip
              size="small"
              color={fila.esExcluyente ? 'warning' : 'default'}
              label={`Se pide: ${nombre(todosLosNiveles, fila.idNivelRequerido)}${fila.esExcluyente ? ' (excluyente)' : ''}`}
            />
          )}
          {acreditado ? (
            <Chip
              size="small"
              color="success"
              label={`Acreditado: ${nombre(todosLosNiveles, fila.idNivelAcreditado)} · ${fila.fechaEvaluacion ?? ''}${
                fila.idTipoEvidencia !== null
                  ? ` · ${nombre(tiposEvidencia, fila.idTipoEvidencia)}`
                  : ''
              }`}
            />
          ) : (
            fila.idNivelDeclarado !== null && (
              <Chip size="small" label="Declarado, esperando acreditación" />
            )
          )}
        </Stack>
        {fila.puestos.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            Lo piden:{' '}
            {fila.puestos
              .map((p) => `${p.codigo} · ${p.denominacion}`)
              .join('; ')}
          </Typography>
        )}
        {error && (
          <Alert severity="error" onClose={() => setError(undefined)}>
            {error}
          </Alert>
        )}
        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
          <TextField
            select
            size="small"
            label="Mi nivel"
            value={
              fila.idNivelDeclarado === null
                ? ''
                : String(fila.idNivelDeclarado)
            }
            onChange={(e) => cambiar(Number(e.target.value))}
            disabled={declarar.isPending}
            sx={{ minWidth: 200 }}
            helperText={
              descripcionNivel(elegido?.codigo) ||
              'Elegí el nivel que te describe'
            }
          >
            {niveles.map((n) => (
              <MenuItem key={n.id} value={String(n.id)}>
                {n.denominacion}
              </MenuItem>
            ))}
          </TextField>
          {fila.idNivelDeclarado !== null && (
            <Button size="small" onClick={quitar} disabled={retirar.isPending}>
              Quitar mi declaración
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
