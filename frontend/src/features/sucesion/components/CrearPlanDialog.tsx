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
import { usePuestos } from '../../estructura/hooks/usePuestos';
import { usePersonas } from '../../personas/hooks/usePersonas';
import { useCrearPlan } from '../hooks/useSucesion';

interface Props {
  /** Puesto preseleccionado (desde la tabla de puestos sin plan). */
  idPuesto?: number;
  onCreado: (idPlan: number) => void;
  onCerrar: () => void;
}

const esquema = z.object({
  idPuesto: z.string().min(1, 'Elegí un puesto'),
  idResponsable: z.string().min(1, 'Elegí un responsable'),
  observaciones: z.string().max(2000, 'Máximo 2000 caracteres'),
});
type Datos = z.infer<typeof esquema>;

export function CrearPlanDialog({ idPuesto, onCreado, onCerrar }: Props) {
  const { data: puestos } = usePuestos();
  const { data: personas } = usePersonas({ activo: true });
  const crear = useCrearPlan();
  const [error, setError] = useState<string>();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      idPuesto: idPuesto ? String(idPuesto) : '',
      idResponsable: '',
      observaciones: '',
    },
  });

  const guardar = handleSubmit(async (datos) => {
    setError(undefined);
    try {
      const plan = await crear.mutateAsync({
        idPuesto: Number(datos.idPuesto),
        idResponsable: Number(datos.idResponsable),
        observaciones: datos.observaciones.trim() || null,
      });
      onCreado(plan.id);
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>Crear plan de sucesión</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              select
              label="Puesto"
              defaultValue={idPuesto ? String(idPuesto) : ''}
              {...register('idPuesto')}
              error={!!errors.idPuesto}
              helperText={errors.idPuesto?.message}
            >
              {(puestos ?? [])
                .filter((p) => p.activo)
                .map((p) => (
                  <MenuItem key={p.id} value={String(p.id)}>
                    {p.codigo} — {p.denominacion}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              select
              label="Responsable del plan"
              defaultValue=""
              {...register('idResponsable')}
              error={!!errors.idResponsable}
              helperText={errors.idResponsable?.message}
            >
              {(personas ?? []).map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.apellido}, {p.nombre}
                </MenuItem>
              ))}
            </TextField>
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
            Crear plan
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
