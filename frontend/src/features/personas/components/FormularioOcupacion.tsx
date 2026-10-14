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
import { usePuestos } from '../../estructura/hooks/usePuestos';
import {
  useActualizarOcupacion,
  useCrearOcupacion,
  type Ocupacion,
} from '../hooks/useOcupaciones';

interface Props {
  idPersona: number;
  /** Sin ocupación, el formulario crea una nueva; con una, solo edita carácter, dedicación y fin. */
  ocupacion?: Ocupacion;
  onCerrar: () => void;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const esquema = z
  .object({
    idPuesto: z.string().min(1, 'Elegí un puesto'),
    fechaDesde: z.string().regex(FECHA, 'Elegí una fecha'),
    fechaHasta: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Fecha inválida'),
    idCaracterOcupacion: z.string().min(1, 'Elegí un carácter'),
    idDedicacion: z.string().min(1, 'Elegí una dedicación'),
  })
  .refine((d) => d.fechaHasta === '' || d.fechaHasta >= d.fechaDesde, {
    path: ['fechaHasta'],
    message: 'No puede ser anterior al inicio',
  });
type Datos = z.infer<typeof esquema>;

/** Se monta solo mientras está abierto, por lo que parte siempre de cero. */
export function FormularioOcupacion({ idPersona, ocupacion, onCerrar }: Props) {
  const { data: puestos } = usePuestos();
  const { data: caracteres } = useValoresReferencia(
    'caracter-ocupacion',
    false,
  );
  const { data: dedicaciones } = useValoresReferencia('dedicacion', false);
  const crear = useCrearOcupacion();
  const actualizar = useActualizarOcupacion();
  const [error, setError] = useState<string>();
  const esEdicion = !!ocupacion;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      idPuesto: ocupacion ? String(ocupacion.idPuesto) : '',
      fechaDesde: ocupacion?.fechaDesde ?? '',
      fechaHasta: ocupacion?.fechaHasta ?? '',
      idCaracterOcupacion: ocupacion
        ? String(ocupacion.idCaracterOcupacion)
        : '',
      idDedicacion: ocupacion ? String(ocupacion.idDedicacion) : '',
    },
  });

  const guardar = handleSubmit(async (datos) => {
    setError(undefined);
    const comunes = {
      fechaHasta: datos.fechaHasta || null,
      idCaracterOcupacion: Number(datos.idCaracterOcupacion),
      idDedicacion: Number(datos.idDedicacion),
    };
    try {
      if (ocupacion) {
        await actualizar.mutateAsync({
          idPersona,
          idPuesto: ocupacion.idPuesto,
          fechaDesde: ocupacion.fechaDesde,
          cuerpo: comunes,
        });
      } else {
        await crear.mutateAsync({
          idPersona,
          cuerpo: {
            ...comunes,
            idPuesto: Number(datos.idPuesto),
            fechaDesde: datos.fechaDesde,
          },
        });
      }
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  // En una edición se muestra el puesto aunque esté de baja; en un alta, solo los activos.
  const elegibles = (puestos ?? []).filter(
    (p) => p.activo || p.id === ocupacion?.idPuesto,
  );

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="xs">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>
          {esEdicion ? 'Editar ocupación' : 'Nueva ocupación'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              select
              label="Puesto"
              disabled={esEdicion}
              defaultValue={ocupacion ? String(ocupacion.idPuesto) : ''}
              {...register('idPuesto')}
              error={!!errors.idPuesto}
              helperText={errors.idPuesto?.message}
            >
              {elegibles.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.codigo} · {p.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Desde"
              type="date"
              disabled={esEdicion}
              slotProps={{ inputLabel: { shrink: true } }}
              {...register('fechaDesde')}
              error={!!errors.fechaDesde}
              helperText={
                errors.fechaDesde?.message ??
                (esEdicion
                  ? 'Para corregir el inicio, anulá la ocupación y cargala de nuevo'
                  : undefined)
              }
            />
            <TextField
              label="Hasta (opcional)"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...register('fechaHasta')}
              error={!!errors.fechaHasta}
              helperText={
                errors.fechaHasta?.message ?? 'Vacío: sin fecha de fin'
              }
            />
            <TextField
              select
              label="Carácter"
              defaultValue={
                ocupacion ? String(ocupacion.idCaracterOcupacion) : ''
              }
              {...register('idCaracterOcupacion')}
              error={!!errors.idCaracterOcupacion}
              helperText={errors.idCaracterOcupacion?.message}
            >
              {(caracteres ?? []).map((c) => (
                <MenuItem key={c.id} value={String(c.id)}>
                  {c.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Dedicación"
              defaultValue={ocupacion ? String(ocupacion.idDedicacion) : ''}
              {...register('idDedicacion')}
              error={!!errors.idDedicacion}
              helperText={errors.idDedicacion?.message}
            >
              {(dedicaciones ?? []).map((d) => (
                <MenuItem key={d.id} value={String(d.id)}>
                  {d.denominacion}
                </MenuItem>
              ))}
            </TextField>
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
