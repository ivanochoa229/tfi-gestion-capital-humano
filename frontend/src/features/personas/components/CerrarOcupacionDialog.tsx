import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { useCerrarOcupacion, type Ocupacion } from '../hooks/useOcupaciones';

interface Props {
  ocupacion: Ocupacion;
  onCerrar: () => void;
}

/** Fija la fecha de fin de una ocupación; la persona deja de ocupar el puesto desde el día siguiente. */
export function CerrarOcupacionDialog({ ocupacion, onCerrar }: Props) {
  const cerrar = useCerrarOcupacion();
  const [fecha, setFecha] = useState('');
  const [error, setError] = useState<string>();

  const confirmar = async () => {
    setError(undefined);
    try {
      await cerrar.mutateAsync({
        idPersona: ocupacion.idPersona,
        idPuesto: ocupacion.idPuesto,
        fechaDesde: ocupacion.fechaDesde,
        fechaHasta: fecha,
      });
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="xs">
      <DialogTitle>Cerrar ocupación</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Último día en el puesto"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText={`Desde ${ocupacion.fechaDesde}. Ese día la ocupación sigue vigente.`}
            autoFocus
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={confirmar}
          disabled={fecha === '' || cerrar.isPending}
        >
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
