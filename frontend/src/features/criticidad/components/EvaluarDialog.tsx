import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { useEvaluar, useMatriz } from '../hooks/useCriticidad';
import { colorNivel } from '../niveles';
import { HistorialEvaluaciones } from './HistorialEvaluaciones';

interface Props {
  idPuesto: number;
  idConocimiento: number;
  titulo: string;
  /** Sin permiso de escritura (autoridad) el diálogo solo muestra el historial. */
  puedeEvaluar: boolean;
  onCerrar: () => void;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
/** Hoy en el calendario local, `AAAA-MM-DD`. El servidor valida contra el de la base. */
const hoyLocal = () => new Date().toLocaleDateString('en-CA');

const esquema = z
  .object({
    idNivelImpacto: z.string().min(1, 'Elegí un nivel de impacto'),
    idNivelDificultad: z.string().min(1, 'Elegí un nivel de dificultad'),
    fechaEvaluacion: z.string().regex(FECHA, 'Elegí una fecha'),
    observaciones: z.string().max(2000, 'Máximo 2000 caracteres'),
  })
  .refine((d) => d.fechaEvaluacion <= hoyLocal(), {
    path: ['fechaEvaluacion'],
    message: 'No puede ser futura',
  });
type Datos = z.infer<typeof esquema>;

export function EvaluarDialog({
  idPuesto,
  idConocimiento,
  titulo,
  puedeEvaluar,
  onCerrar,
}: Props) {
  const { data: matriz } = useMatriz();
  const { data: niveles } = useValoresReferencia('nivel-criticidad', true);
  const evaluar = useEvaluar();
  const [error, setError] = useState<string>();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      idNivelImpacto: '',
      idNivelDificultad: '',
      fechaEvaluacion: hoyLocal(),
      observaciones: '',
    },
  });
  const [impacto, dificultad] = useWatch({
    control,
    name: ['idNivelImpacto', 'idNivelDificultad'],
  });

  // Vista previa: el servidor vuelve a calcular el nivel con la matriz al guardar.
  const celda = matriz?.celdas.find(
    (c) =>
      c.idNivelImpacto === Number(impacto) &&
      c.idNivelDificultad === Number(dificultad),
  );
  const resultado = niveles?.find((n) => n.id === celda?.idNivelCriticidad);
  const criterio = (
    lista: { id: number; criterio: string }[] | undefined,
    id: string,
  ) => lista?.find((e) => e.id === Number(id))?.criterio;

  const guardar = handleSubmit(async (datos) => {
    setError(undefined);
    try {
      await evaluar.mutateAsync({
        idPuesto,
        idConocimiento,
        idNivelImpacto: Number(datos.idNivelImpacto),
        idNivelDificultad: Number(datos.idNivelDificultad),
        fechaEvaluacion: datos.fechaEvaluacion,
        observaciones: datos.observaciones.trim() || null,
      });
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="md">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>{titulo}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {puedeEvaluar && (
              <>
                <TextField
                  select
                  label="Impacto de pérdida"
                  defaultValue=""
                  {...register('idNivelImpacto')}
                  error={!!errors.idNivelImpacto}
                  helperText={
                    errors.idNivelImpacto?.message ??
                    criterio(matriz?.impactos, impacto) ??
                    'Qué pasa si se pierde este conocimiento'
                  }
                >
                  {(matriz?.impactos ?? []).map((n) => (
                    <MenuItem key={n.id} value={String(n.id)}>
                      {n.denominacion}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Dificultad de reemplazo"
                  defaultValue=""
                  {...register('idNivelDificultad')}
                  error={!!errors.idNivelDificultad}
                  helperText={
                    errors.idNivelDificultad?.message ??
                    criterio(matriz?.dificultades, dificultad) ??
                    'Cuánto cuesta volver a tenerlo'
                  }
                >
                  {(matriz?.dificultades ?? []).map((n) => (
                    <MenuItem key={n.id} value={String(n.id)}>
                      {n.denominacion}
                    </MenuItem>
                  ))}
                </TextField>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'center' }}
                >
                  <Typography>Criticidad resultante:</Typography>
                  {resultado ? (
                    <Chip
                      label={resultado.denominacion}
                      color={colorNivel(resultado.codigo)}
                    />
                  ) : (
                    <Typography color="text.secondary">
                      elegí impacto y dificultad
                    </Typography>
                  )}
                </Stack>
                <TextField
                  label="Fecha de evaluación"
                  type="date"
                  slotProps={{ inputLabel: { shrink: true } }}
                  {...register('fechaEvaluacion')}
                  error={!!errors.fechaEvaluacion}
                  helperText={errors.fechaEvaluacion?.message}
                />
                <TextField
                  label="Observaciones (opcional)"
                  multiline
                  minRows={2}
                  {...register('observaciones')}
                  error={!!errors.observaciones}
                  helperText={
                    errors.observaciones?.message ??
                    'No cambian el nivel: lo fija la matriz.'
                  }
                />
                <Divider />
              </>
            )}
            <Typography variant="subtitle2">Historial</Typography>
            <HistorialEvaluaciones
              idPuesto={idPuesto}
              idConocimiento={idConocimiento}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCerrar}>
            {puedeEvaluar ? 'Cancelar' : 'Cerrar'}
          </Button>
          {puedeEvaluar && (
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              Guardar evaluación
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
}
