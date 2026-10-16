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
import { EXTENSIONES_ACTIVO, formatearTamanio } from '../activos';
import { useReemplazarArchivo, type Activo } from '../hooks/useActivos';

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
          <Button component="label" variant="outlined">
            {archivo ? 'Cambiar archivo' : 'Elegir archivo'}
            <input
              hidden
              type="file"
              accept={EXTENSIONES_ACTIVO}
              onChange={(e) => setArchivo(e.target.files?.[0])}
            />
          </Button>
          {archivo && (
            <Typography variant="body2" color="text.secondary">
              {archivo.name} ({formatearTamanio(archivo.size)})
            </Typography>
          )}
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
