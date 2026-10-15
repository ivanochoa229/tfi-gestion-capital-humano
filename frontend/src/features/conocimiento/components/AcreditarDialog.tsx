import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Autocomplete,
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
import { useAcreditar } from '../hooks/useAcreditaciones';
import { useConocimientos, type Conocimiento } from '../hooks/useConocimientos';

interface Props {
  idPersona: number;
  nombrePersona?: string;
  /** Sin conocimiento, el diálogo ofrece elegirlo del catálogo. */
  conocimiento?: { id: number; denominacion: string };
  onCerrar: () => void;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
/** Hoy en el calendario local, `AAAA-MM-DD`. El servidor valida contra el de la base. */
const hoyLocal = () => new Date().toLocaleDateString('en-CA');

const esquema = z
  .object({
    idNivel: z.string().min(1, 'Elegí un nivel'),
    fechaEvaluacion: z.string().regex(FECHA, 'Elegí una fecha'),
    idTipoEvidencia: z.string().min(1, 'Elegí un tipo de evidencia'),
    observaciones: z.string().max(2000, 'Máximo 2000 caracteres'),
  })
  .refine((d) => d.fechaEvaluacion <= hoyLocal(), {
    path: ['fechaEvaluacion'],
    message: 'No puede ser futura',
  });
type Datos = z.infer<typeof esquema>;

/** Se monta solo mientras está abierto, por lo que parte siempre de cero. */
export function AcreditarDialog({ idPersona, nombrePersona, conocimiento, onCerrar }: Props) {
  const { data: niveles } = useValoresReferencia('nivel-dominio', false);
  const { data: evidencias } = useValoresReferencia('tipo-evidencia', false);
  const { data: catalogo } = useConocimientos({ activo: true });
  const acreditar = useAcreditar();
  const [elegido, setElegido] = useState<Conocimiento | null>(null);
  const [error, setError] = useState<string>();

  const destino = conocimiento ?? (elegido && { id: elegido.id, denominacion: elegido.denominacion });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      idNivel: '',
      fechaEvaluacion: hoyLocal(),
      idTipoEvidencia: '',
      observaciones: '',
    },
  });

  const guardar = handleSubmit(async (datos) => {
    if (!destino) {
      setError('Elegí el conocimiento que vas a acreditar');
      return;
    }
    setError(undefined);
    try {
      await acreditar.mutateAsync({
        idPersona,
        idConocimiento: destino.id,
        idNivel: Number(datos.idNivel),
        fechaEvaluacion: datos.fechaEvaluacion,
        idTipoEvidencia: Number(datos.idTipoEvidencia),
        observaciones: datos.observaciones.trim() || null,
      });
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="xs">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>
          Acreditar conocimiento{nombrePersona ? ` de ${nombrePersona}` : ''}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {conocimiento ? (
              <TextField label="Conocimiento" value={conocimiento.denominacion} disabled />
            ) : (
              <Autocomplete
                options={catalogo ?? []}
                value={elegido}
                onChange={(_, c) => setElegido(c)}
                getOptionLabel={(c) => c.denominacion}
                renderInput={(p) => <TextField {...p} label="Conocimiento" />}
              />
            )}
            <TextField
              select
              label="Nivel acreditado"
              defaultValue=""
              {...register('idNivel')}
              error={!!errors.idNivel}
              helperText={errors.idNivel?.message}
            >
              {(niveles ?? []).map((n) => (
                <MenuItem key={n.id} value={String(n.id)}>
                  {n.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Fecha de evaluación"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...register('fechaEvaluacion')}
              error={!!errors.fechaEvaluacion}
              helperText={errors.fechaEvaluacion?.message}
            />
            <TextField
              select
              label="Tipo de evidencia"
              defaultValue=""
              {...register('idTipoEvidencia')}
              error={!!errors.idTipoEvidencia}
              helperText={errors.idTipoEvidencia?.message}
            >
              {(evidencias ?? []).map((t) => (
                <MenuItem key={t.id} value={String(t.id)}>
                  {t.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Observaciones (opcional)"
              multiline
              minRows={2}
              {...register('observaciones')}
              error={!!errors.observaciones}
              helperText={
                errors.observaciones?.message ??
                'Por ejemplo, dónde está el comprobante. No se adjuntan archivos.'
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            Acreditar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
