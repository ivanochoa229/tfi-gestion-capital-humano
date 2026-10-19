import { zodResolver } from '@hookform/resolvers/zod';
import { Button, MenuItem, Stack, TextField } from '@mui/material';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useUnidades } from '../../estructura/hooks/useUnidades';

const esquemaFiltro = z.object({
  meses: z
    .number({ message: 'Ingresá un número de meses' })
    .int('Debe ser un número entero')
    .min(1, 'Mínimo 1 mes')
    .max(120, 'Máximo 120 meses'),
});

type DatosFiltro = z.infer<typeof esquemaFiltro>;

interface Propiedades {
  idUnidad: string;
  meses: number;
  onCambiarUnidad: (idUnidad: string) => void;
  onCambiarMeses: (meses: number) => void;
}

/**
 * Filtros del tablero de riesgo: selector de cátedra/unidad (con «Todo el departamento»)
 * y selector de plazo en meses (24 por defecto), sincronizados con la URL.
 */
export function FiltrosTablero({
  idUnidad,
  meses,
  onCambiarUnidad,
  onCambiarMeses,
}: Propiedades) {
  const { data: unidades } = useUnidades();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DatosFiltro>({
    resolver: zodResolver(esquemaFiltro),
    defaultValues: { meses },
  });

  useEffect(() => {
    reset({ meses });
  }, [meses, reset]);

  const aplicarMeses = handleSubmit((datos) => {
    onCambiarMeses(datos.meses);
  });

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ mb: 3, alignItems: { sm: 'center' }, flexWrap: 'wrap' }}
    >
      <TextField
        select
        size="small"
        label="Cátedra / unidad"
        value={idUnidad}
        onChange={(e) => onCambiarUnidad(e.target.value)}
        sx={{ minWidth: 240 }}
      >
        <MenuItem value="">Todo el departamento</MenuItem>
        {(unidades ?? []).map((u) => (
          <MenuItem key={u.id} value={String(u.id)}>
            {u.denominacion}
          </MenuItem>
        ))}
      </TextField>

      <Stack
        component="form"
        onSubmit={aplicarMeses}
        noValidate
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center' }}
      >
        <TextField
          size="small"
          type="number"
          label="Horizonte (meses)"
          sx={{ width: 160 }}
          {...register('meses', { valueAsNumber: true })}
          error={!!errors.meses}
          helperText={errors.meses?.message}
        />
        <Button type="submit" variant="outlined" size="small">
          Aplicar plazo
        </Button>
      </Stack>
    </Stack>
  );
}
