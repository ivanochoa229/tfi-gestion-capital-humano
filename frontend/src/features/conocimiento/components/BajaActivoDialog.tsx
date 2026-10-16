import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { useCambiarEstadoActivo, type Activo } from '../hooks/useActivos';

interface Props {
  activo: Activo;
  onCerrar: () => void;
}

export function BajaActivoDialog({ activo, onCerrar }: Props) {
  const cambiar = useCambiarEstadoActivo();
  const [error, setError] = useState<string>();

  const confirmar = async () => {
    setError(undefined);
    try {
      await cambiar.mutateAsync({ id: activo.id, accion: 'baja' });
      onCerrar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="xs">
      <DialogTitle>Dar de baja el activo</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error">{error}</Alert>}
        <Typography>
          «{activo.titulo}» deja de aparecer para el resto de los usuarios. El
          archivo se conserva y podés reactivarlo cuando quieras.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button
          color="error"
          variant="contained"
          disabled={cambiar.isPending}
          onClick={confirmar}
        >
          Dar de baja
        </Button>
      </DialogActions>
    </Dialog>
  );
}
