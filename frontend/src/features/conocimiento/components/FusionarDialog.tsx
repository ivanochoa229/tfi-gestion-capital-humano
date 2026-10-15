import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import {
  useConocimientos,
  useFusionarConocimientos,
  type Conocimiento,
  type ResultadoFusion,
} from '../hooks/useConocimientos';

interface Props {
  /** El duplicado que se retira. */
  origen: Conocimiento;
  onCerrar: () => void;
}

/** Fusiona un duplicado en el conocimiento que se conserva; no se puede deshacer. */
export function FusionarDialog({ origen, onCerrar }: Props) {
  const { data: candidatos } = useConocimientos({
    activo: true,
    idTipo: origen.idTipoConocimiento,
  });
  const fusionar = useFusionarConocimientos();
  const [idDestino, setIdDestino] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState<string>();
  const [resultado, setResultado] = useState<ResultadoFusion>();

  const opciones = (candidatos ?? []).filter((c) => c.id !== origen.id);

  const confirmar = async () => {
    setError(undefined);
    try {
      setResultado(
        await fusionar.mutateAsync({
          idOrigen: origen.id,
          idDestino: Number(idDestino),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <DialogTitle>Fusionar «{origen.denominacion}»</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {resultado ? (
            <Alert severity="success">
              Listo. Se movieron {resultado.requisitosMovidos} requisitos de
              puesto y los datos de {resultado.personasMovidas} personas;
              «{origen.denominacion}» quedó dado de baja.
            </Alert>
          ) : (
            <>
              <Typography>
                Elegí el conocimiento que se conserva. Los requisitos y los
                datos de las personas del duplicado pasan a ese conocimiento.
                Si alguien tenía ambos, queda el nivel declarado más alto y la
                acreditación más reciente.
              </Typography>
              <TextField
                select
                label="Conocimiento que se conserva"
                value={idDestino}
                onChange={(e) => setIdDestino(e.target.value)}
                helperText="Solo aparecen conocimientos activos del mismo tipo"
              >
                {opciones.map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.denominacion}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={confirmado}
                    onChange={(e) => setConfirmado(e.target.checked)}
                  />
                }
                label="Entiendo que la fusión no se puede deshacer"
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>{resultado ? 'Cerrar' : 'Cancelar'}</Button>
        {!resultado && (
          <Button
            variant="contained"
            color="warning"
            disabled={!idDestino || !confirmado || fusionar.isPending}
            onClick={confirmar}
          >
            Fusionar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
