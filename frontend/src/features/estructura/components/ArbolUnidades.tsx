import {
  Alert,
  CircularProgress,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Switch,
} from '@mui/material';
import { useArbolUnidades, type UnidadArbol } from '../hooks/useUnidades';

interface Props {
  seleccionada?: number;
  incluirInactivas: boolean;
  onAlternarInactivas: (valor: boolean) => void;
  onElegir: (unidad: UnidadArbol) => void;
}

function Nodo({
  unidad,
  nivel,
  seleccionada,
  onElegir,
}: {
  unidad: UnidadArbol;
  nivel: number;
  seleccionada?: number;
  onElegir: (unidad: UnidadArbol) => void;
}) {
  return (
    <>
      <ListItemButton
        selected={unidad.id === seleccionada}
        onClick={() => onElegir(unidad)}
        sx={{ pl: 2 + nivel * 3 }}
      >
        <ListItemText
          primary={unidad.denominacion}
          secondary={unidad.activo ? undefined : 'Inactiva'}
        />
      </ListItemButton>
      {unidad.hijas.map((hija) => (
        <Nodo
          key={hija.id}
          unidad={hija}
          nivel={nivel + 1}
          seleccionada={seleccionada}
          onElegir={onElegir}
        />
      ))}
    </>
  );
}

/** Árbol de solo lectura: las unidades las carga el DBA. */
export function ArbolUnidades({
  seleccionada,
  incluirInactivas,
  onAlternarInactivas,
  onElegir,
}: Props) {
  const { data, isLoading, isError } = useArbolUnidades(incluirInactivas);

  return (
    <Stack spacing={1}>
      <FormControlLabel
        control={
          <Switch
            checked={incluirInactivas}
            onChange={(e) => onAlternarInactivas(e.target.checked)}
          />
        }
        label="Mostrar inactivas"
      />
      {isLoading && <CircularProgress aria-label="Cargando" />}
      {isError && (
        <Alert severity="error">No se pudo cargar la estructura.</Alert>
      )}
      {data && data.length === 0 && (
        <Alert severity="info">
          No hay unidades cargadas. Las carga el DBA por SQL.
        </Alert>
      )}
      {data && (
        <List dense disablePadding>
          {data.map((unidad) => (
            <Nodo
              key={unidad.id}
              unidad={unidad}
              nivel={0}
              seleccionada={seleccionada}
              onElegir={onElegir}
            />
          ))}
        </List>
      )}
    </Stack>
  );
}
