import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { formatearTamanio } from '../activos';
import { useReemplazarArchivo, type Activo } from '../hooks/useActivos';
import { SelectorArchivo } from './SelectorArchivo';

interface Props {
  activo: Activo;
  onCerrar: () => void;
}

export function ReemplazarArchivoDialog({ activo, onCerrar }: Props) {
  const reemplazar = useReemplazarArchivo();
  const [archivo, setArchivo] = useState<File>();
  const [error, setError] = useState<string>();

  const enviar = async () => {
    if (!archivo) return;
    setError(undefined);
    try {
      await reemplazar.mutateAsync({ id: activo.id, archivo });
      onCerrar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="xs">
      <DialogTitle>Reemplazar archivo</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2">
            Actual: {activo.nombreOriginal}
            {activo.tamanio !== null &&
              ` (${formatearTamanio(activo.tamanio)})`}
            . El archivo anterior se borra y no se guarda su historial.
          </Typography>
          <SelectorArchivo archivo={archivo} onElegir={setArchivo} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={!archivo || reemplazar.isPending}
          onClick={enviar}
        >
          Reemplazar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
