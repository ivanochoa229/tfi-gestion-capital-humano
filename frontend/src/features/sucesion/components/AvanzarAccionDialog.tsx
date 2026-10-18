import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { etiquetaEstadoAccion, siguientesEstadosAccion } from '../estados';
import { useAvanzarAccion, type Accion } from '../hooks/useSucesion';

interface Props {
  accion: Accion;
  onCerrar: () => void;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
/** Hoy en la zona local, como AAAA-MM-DD (el servidor igual rechaza fechas futuras). */
const hoy = () => new Date().toLocaleDateString('en-CA');

const esquema = z.object({
  estado: z.enum(['en_curso', 'completada']),
  notaAvance: z.string().max(2000, 'Máximo 2000 caracteres'),
  fechaCumplimiento: z
    .string()
    .refine((v) => v === '' || FECHA.test(v), 'Fecha inválida')
    .refine((v) => v === '' || v <= hoy(), 'No puede ser futura'),
});
type Datos = z.infer<typeof esquema>;

/** Avance de una acción: pasa a en curso o completada con una nota. */
export function AvanzarAccionDialog({ accion, onCerrar }: Props) {
  const avanzar = useAvanzarAccion();
  const [error, setError] = useState<string>();
  const opciones = siguientesEstadosAccion(accion.estado) as Datos['estado'][];

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      estado: opciones[0],
      notaAvance: accion.notaAvance ?? '',
      fechaCumplimiento: '',
    },
  });
  const estado = useWatch({ control, name: 'estado' });

  const guardar = handleSubmit(async (datos) => {
    setError(undefined);
    try {
      await avanzar.mutateAsync({
        id: accion.id,
        cuerpo: {
          estado: datos.estado,
          notaAvance: datos.notaAvance.trim() || undefined,
          fechaCumplimiento:
            datos.estado === 'completada' && datos.fechaCumplimiento
              ? datos.fechaCumplimiento
              : undefined,
        },
      });
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>Avanzar · {accion.denominacionConocimiento}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Controller
              control={control}
              name="estado"
              render={({ field }) => (
                <TextField select label="Nuevo estado" {...field}>
                  {opciones.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c === accion.estado
                        ? 'Actualizar nota (sigue en curso)'
                        : etiquetaEstadoAccion(c)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <TextField
              label="Nota de avance"
              multiline
              minRows={2}
              {...register('notaAvance')}
              error={!!errors.notaAvance}
              helperText={errors.notaAvance?.message}
            />
            {estado === 'completada' && (
              <TextField
                label="Fecha de cumplimiento"
                type="date"
                slotProps={{ inputLabel: { shrink: true } }}
                {...register('fechaCumplimiento')}
                error={!!errors.fechaCumplimiento}
                helperText={
                  errors.fechaCumplimiento?.message ??
                  'Opcional; por defecto hoy'
                }
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            Guardar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
