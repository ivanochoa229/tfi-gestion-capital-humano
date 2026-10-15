import {
  Alert,
  Button,
  CircularProgress,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { usePersonas } from '../hooks/usePersonas';

interface Props {
  seleccionada?: number;
  onElegir: (id: number) => void;
  /** Solo RR. HH. da de alta. */
  onNueva?: () => void;
}

export function ListaPersonas({ seleccionada, onElegir, onNueva }: Props) {
  const [verBajas, setVerBajas] = useState(false);
  const [texto, setTexto] = useState('');
  const { data, isLoading, isError } = usePersonas({
    activo: verBajas ? undefined : true,
  });

  if (isLoading) return <CircularProgress aria-label="Cargando" />;
  if (isError || !data) {
    return <Alert severity="error">No se pudieron cargar las personas.</Alert>;
  }

  const buscado = texto.trim().toLowerCase();
  const filas = data.filter(
    (p) =>
      buscado === '' ||
      `${p.legajo} ${p.apellido} ${p.nombre}`.toLowerCase().includes(buscado),
  );

  return (
    <Stack spacing={1}>
      {onNueva && (
        <Button variant="contained" onClick={onNueva}>
          Nueva persona
        </Button>
      )}
      <TextField
        size="small"
        label="Buscar por legajo, apellido o nombre"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <FormControlLabel
        control={
          <Switch
            checked={verBajas}
            onChange={(e) => setVerBajas(e.target.checked)}
          />
        }
        label="Ver dadas de baja"
      />
      {filas.length === 0 ? (
        <Alert severity="info">No hay personas para mostrar.</Alert>
      ) : (
        <List dense>
          {filas.map((p) => (
            <ListItemButton
              key={p.id}
              selected={p.id === seleccionada}
              onClick={() => onElegir(p.id)}
            >
              <ListItemText
                primary={`${p.apellido}, ${p.nombre}`}
                secondary={`${p.legajo}${p.activo ? '' : ' · de baja'}${p.tieneUsuario ? ' · con usuario' : ''}`}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Stack>
  );
}
