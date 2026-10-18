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
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { useSeguimientoCandidato, type Candidato } from '../hooks/useSucesion';

interface Props {
  candidato: Candidato;
  onCerrar: () => void;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const esquema = z.object({
  idEstadoPreparacion: z.string().min(1, 'Elegí un estado de preparación'),
  fechaDisponibilidadEstimada: z
    .string()
    .refine((v) => v === '' || FECHA.test(v), 'Fecha inválida'),
  observaciones: z.string().max(2000, 'Máximo 2000 caracteres'),
});
type Datos = z.infer<typeof esquema>;

/** Seguimiento de un candidato: estado de preparación, plazo y observaciones. */
export function SeguimientoDialog({ candidato, onCerrar }: Props) {
  // Con inactivos, para que el valor actual siempre figure en la lista.
  const { data: estados } = useValoresReferencia('estado-preparacion', true);
  const guardarSeg = useSeguimientoCandidato();
  const [error, setError] = useState<string>();
  const actual = estados?.find((e) => e.codigo === candidato.estadoPreparacion);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    values: {
      idEstadoPreparacion: actual ? String(actual.id) : '',
      fechaDisponibilidadEstimada: candidato.fechaDisponibilidadEstimada ?? '',
      observaciones: candidato.observaciones ?? '',
    },
  });

  const guardar = handleSubmit(async (datos) => {
    setError(undefined);
    try {
      await guardarSeg.mutateAsync({
        idPlan: candidato.idPlan,
        idPersona: candidato.idPersona,
        cuerpo: {
          idEstadoPreparacion: Number(datos.idEstadoPreparacion),
          fechaDisponibilidadEstimada:
            datos.fechaDisponibilidadEstimada || null,
          observaciones: datos.observaciones.trim() || null,
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
        <DialogTitle>
          Seguimiento · {candidato.apellido}, {candidato.nombre}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Controller
              control={control}
              name="idEstadoPreparacion"
              render={({ field }) => (
                <TextField
                  select
                  label="Estado de preparación"
                  {...field}
                  error={!!errors.idEstadoPreparacion}
                  helperText={errors.idEstadoPreparacion?.message}
                >
                  {(estados ?? []).map((e) => (
                    <MenuItem key={e.id} value={String(e.id)}>
                      {e.denominacion}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <TextField
              label="Fecha estimada de disponibilidad"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...register('fechaDisponibilidadEstimada')}
              error={!!errors.fechaDisponibilidadEstimada}
              helperText={errors.fechaDisponibilidadEstimada?.message}
            />
            <TextField
              label="Observaciones"
              multiline
              minRows={2}
              {...register('observaciones')}
              error={!!errors.observaciones}
              helperText={errors.observaciones?.message}
            />
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
