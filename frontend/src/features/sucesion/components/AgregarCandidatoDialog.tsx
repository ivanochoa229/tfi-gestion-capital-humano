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
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { usePersonas } from '../../personas/hooks/usePersonas';
import { useAgregarCandidato, type Candidato } from '../hooks/useSucesion';

interface Props {
  idPlan: number;
  candidatos: Candidato[];
  onCerrar: () => void;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const esquema = z.object({
  idPersona: z.string().min(1, 'Elegí una persona'),
  prioridad: z.string().regex(/^[1-9]\d*$/, 'Entero mayor o igual a 1'),
  idEstadoPreparacion: z.string().min(1, 'Elegí un estado de preparación'),
  fechaDisponibilidadEstimada: z
    .string()
    .refine((v) => v === '' || FECHA.test(v), 'Fecha inválida'),
  observaciones: z.string().max(2000, 'Máximo 2000 caracteres'),
});
type Datos = z.infer<typeof esquema>;

export function AgregarCandidatoDialog({
  idPlan,
  candidatos,
  onCerrar,
}: Props) {
  const { data: personas } = usePersonas({ activo: true });
  const { data: estados } = useValoresReferencia('estado-preparacion', false);
  const agregar = useAgregarCandidato();
  const [error, setError] = useState<string>();

  const siguiente = Math.max(0, ...candidatos.map((c) => c.prioridad)) + 1;
  const yaEstan = new Set(candidatos.map((c) => c.idPersona));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      idPersona: '',
      prioridad: String(siguiente),
      idEstadoPreparacion: '',
      fechaDisponibilidadEstimada: '',
      observaciones: '',
    },
  });

  const guardar = handleSubmit(async (datos) => {
    setError(undefined);
    try {
      await agregar.mutateAsync({
        idPlan,
        cuerpo: {
          idPersona: Number(datos.idPersona),
          prioridad: Number(datos.prioridad),
          idEstadoPreparacion: Number(datos.idEstadoPreparacion),
          fechaDisponibilidadEstimada:
            datos.fechaDisponibilidadEstimada || undefined,
          observaciones: datos.observaciones.trim() || undefined,
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
        <DialogTitle>Agregar candidato</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              select
              label="Persona"
              defaultValue=""
              {...register('idPersona')}
              error={!!errors.idPersona}
              helperText={
                errors.idPersona?.message ??
                'Debe tener una ocupación vigente y no ocupar este puesto'
              }
            >
              {(personas ?? [])
                .filter((p) => !yaEstan.has(p.id))
                .map((p) => (
                  <MenuItem key={p.id} value={String(p.id)}>
                    {p.apellido}, {p.nombre}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              label="Prioridad"
              type="number"
              slotProps={{ htmlInput: { min: 1 } }}
              {...register('prioridad')}
              error={!!errors.prioridad}
              helperText={
                errors.prioridad?.message ?? '1 es el sucesor principal'
              }
            />
            <TextField
              select
              label="Estado de preparación"
              defaultValue=""
              {...register('idEstadoPreparacion')}
              error={!!errors.idEstadoPreparacion}
              helperText={errors.idEstadoPreparacion?.message}
            >
              {(estados ?? []).map((e) => (
                <MenuItem key={e.id} value={String(e.id)}>
                  {e.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Fecha estimada de disponibilidad (opcional)"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...register('fechaDisponibilidadEstimada')}
              error={!!errors.fechaDisponibilidadEstimada}
              helperText={errors.fechaDisponibilidadEstimada?.message}
            />
            <TextField
              label="Observaciones (opcional)"
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
            Agregar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
