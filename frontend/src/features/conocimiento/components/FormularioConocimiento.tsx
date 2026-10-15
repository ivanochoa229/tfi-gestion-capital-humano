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
import {
  useActualizarConocimiento,
  useCrearConocimiento,
  type Conocimiento,
} from '../hooks/useConocimientos';

interface Props {
  /** Sin conocimiento, el formulario da de alta uno nuevo. */
  conocimiento?: Conocimiento;
  onCerrar: () => void;
}

const esquema = z.object({
  denominacion: z
    .string()
    .trim()
    .min(2, 'Ingresá al menos 2 caracteres')
    .max(150, 'Máximo 150 caracteres'),
  idTipoConocimiento: z.string().min(1, 'Elegí un tipo'),
  idAreaTematica: z.string().min(1, 'Elegí un área'),
  descripcion: z.string().max(2000, 'Máximo 2000 caracteres'),
});
type Datos = z.infer<typeof esquema>;

/** Se monta solo mientras está abierto, por lo que parte siempre de cero. */
export function FormularioConocimiento({ conocimiento, onCerrar }: Props) {
  const { data: tipos } = useValoresReferencia('tipo-conocimiento', false);
  const { data: areas } = useValoresReferencia('area-tematica', false);
  const crear = useCrearConocimiento();
  const actualizar = useActualizarConocimiento();
  const [error, setError] = useState<string>();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      denominacion: conocimiento?.denominacion ?? '',
      idTipoConocimiento: conocimiento ? String(conocimiento.idTipoConocimiento) : '',
      idAreaTematica: conocimiento ? String(conocimiento.idAreaTematica) : '',
      descripcion: conocimiento?.descripcion ?? '',
    },
  });

  const guardar = handleSubmit(async (datos) => {
    setError(undefined);
    const cuerpo = {
      denominacion: datos.denominacion,
      idTipoConocimiento: Number(datos.idTipoConocimiento),
      idAreaTematica: Number(datos.idAreaTematica),
      descripcion: datos.descripcion.trim() || null,
    };
    try {
      if (conocimiento) {
        await actualizar.mutateAsync({ id: conocimiento.id, cuerpo });
      } else {
        await crear.mutateAsync(cuerpo);
      }
      onCerrar();
    } catch (e) {
      // Un duplicado vuelve como 409 con el nombre y el id del conocimiento existente.
      setError((e as Error).message);
    }
  });

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>
          {conocimiento ? 'Editar conocimiento' : 'Nuevo conocimiento'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Denominación"
              {...register('denominacion')}
              error={!!errors.denominacion}
              helperText={
                errors.denominacion?.message ??
                'Mayúsculas, tildes y espacios no distinguen: «Programación» y «programacion» son el mismo conocimiento'
              }
            />
            <TextField
              select
              label="Tipo"
              defaultValue={conocimiento ? String(conocimiento.idTipoConocimiento) : ''}
              {...register('idTipoConocimiento')}
              error={!!errors.idTipoConocimiento}
              helperText={errors.idTipoConocimiento?.message}
            >
              {(tipos ?? []).map((t) => (
                <MenuItem key={t.id} value={String(t.id)}>
                  {t.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Área temática"
              defaultValue={conocimiento ? String(conocimiento.idAreaTematica) : ''}
              {...register('idAreaTematica')}
              error={!!errors.idAreaTematica}
              helperText={errors.idAreaTematica?.message}
            >
              {(areas ?? []).map((a) => (
                <MenuItem key={a.id} value={String(a.id)}>
                  {a.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Descripción (opcional)"
              multiline
              minRows={2}
              {...register('descripcion')}
              error={!!errors.descripcion}
              helperText={errors.descripcion?.message}
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
