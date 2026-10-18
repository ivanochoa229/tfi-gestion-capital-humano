import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useResolverPlan } from '../hooks/useSucesion';

interface Props {
  idPlan: number;
  decision: 'aprobar' | 'rechazar';
  onCerrar: () => void;
}

const esquema = z.object({
  motivo: z.string().max(2000, 'Máximo 2000 caracteres'),
});
type Datos = z.infer<typeof esquema>;

/** Aprobar o rechazar un plan pendiente; el rechazo exige motivo. */
export function ResolverPlanDialog({ idPlan, decision, onCerrar }: Props) {
  const resolver = useResolverPlan();
  const [error, setError] = useState<string>();
  const rechaza = decision === 'rechazar';

  const {
    register,
    handleSubmit,
    setError: marcar,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: { motivo: '' },
  });

  const confirmar = handleSubmit(async (datos) => {
    setError(undefined);
    const motivo = datos.motivo.trim();
    if (rechaza && !motivo) {
      marcar('motivo', { message: 'El rechazo exige un motivo' });
      return;
    }
    try {
      await resolver.mutateAsync({
        id: idPlan,
        cuerpo: { decision, motivo: motivo || undefined },
      });
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <form onSubmit={confirmar} noValidate>
        <DialogTitle>{rechaza ? 'Rechazar plan' : 'Aprobar plan'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {!rechaza && (
              <DialogContentText>
                Al aprobar, el plan queda vigente y cierra la versión aprobada
                anterior del puesto, si la hay.
              </DialogContentText>
            )}
            <TextField
              label={rechaza ? 'Motivo del rechazo' : 'Motivo (opcional)'}
              multiline
              minRows={2}
              {...register('motivo')}
              error={!!errors.motivo}
              helperText={errors.motivo?.message}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCerrar}>Cancelar</Button>
          <Button
            type="submit"
            variant="contained"
            color={rechaza ? 'error' : 'primary'}
            disabled={isSubmitting}
          >
            {rechaza ? 'Rechazar' : 'Aprobar'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
