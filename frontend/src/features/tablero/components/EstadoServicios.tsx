import { Alert, Chip, Stack } from '@mui/material';
import { useSalud } from '../hooks/useSalud';

function Indicador({ nombre, ok }: { nombre: string; ok: boolean }) {
  return (
    <Chip
      label={`${nombre}: ${ok ? 'conectado' : 'sin conexión'}`}
      color={ok ? 'success' : 'error'}
      variant="outlined"
    />
  );
}

export function EstadoServicios() {
  const { data, isPending, isError } = useSalud();

  if (isPending) return <Chip label="Verificando servicios…" />;
  if (isError) {
    return <Alert severity="error">No se pudo conectar con el backend.</Alert>;
  }

  return (
    <Stack direction="row" spacing={1}>
      <Indicador nombre="Base de datos" ok={data.baseDeDatos} />
      <Indicador nombre="Almacenamiento" ok={data.almacenamiento} />
    </Stack>
  );
}
