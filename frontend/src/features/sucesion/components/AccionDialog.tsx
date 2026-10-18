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
import { useState, type ReactNode } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { z } from 'zod';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { useConocimientos } from '../../conocimiento/hooks/useConocimientos';
import { usePersonas } from '../../personas/hooks/usePersonas';
import { etiquetaEstadoPlan } from '../estados';
import {
  useCrearAccion,
  useEditarAccion,
  usePlanes,
  type Accion,
} from '../hooks/useSucesion';

interface Props {
  /** Sin acción: alta. Con acción: edición (conocimiento y plan no cambian). */
  accion?: Accion;
  onCerrar: () => void;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const esquema = z.object({
  idTipoAccion: z.string().min(1, 'Elegí un tipo'),
  idConocimiento: z.string().min(1, 'Elegí un conocimiento'),
  idPlan: z.string(),
  idResponsable: z.string().min(1, 'Elegí un responsable'),
  idDestinatario: z.string(),
  descripcion: z
    .string()
    .trim()
    .min(1, 'Ingresá una descripción')
    .max(2000, 'Máximo 2000 caracteres'),
  fechaPrevista: z.string().regex(FECHA, 'Ingresá la fecha prevista'),
});
type Datos = z.infer<typeof esquema>;

/** Alta y edición de una acción de transferencia (recursos humanos). */
export function AccionDialog({ accion, onCerrar }: Props) {
  const edicion = !!accion;
  const { data: tipos } = useValoresReferencia(
    'tipo-accion-transferencia',
    true,
  );
  const { data: conocimientos } = useConocimientos({ activo: true });
  const { data: planes } = usePlanes({});
  const { data: personas } = usePersonas({ activo: true });
  const crear = useCrearAccion();
  const editar = useEditarAccion();
  const [error, setError] = useState<string>();
  const tipoActual = tipos?.find((t) => t.codigo === accion?.tipo);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    values: {
      idTipoAccion: tipoActual ? String(tipoActual.id) : '',
      idConocimiento: accion ? String(accion.idConocimiento) : '',
      idPlan: accion?.idPlan ? String(accion.idPlan) : '',
      idResponsable: accion ? String(accion.idResponsable) : '',
      idDestinatario: accion?.idDestinatario
        ? String(accion.idDestinatario)
        : '',
      descripcion: accion?.descripcion ?? '',
      fechaPrevista: accion?.fechaPrevista ?? '',
    },
  });

  const guardar = handleSubmit(async (d) => {
    setError(undefined);
    try {
      if (accion) {
        await editar.mutateAsync({
          id: accion.id,
          cuerpo: {
            idTipoAccion: Number(d.idTipoAccion),
            idResponsable: Number(d.idResponsable),
            idDestinatario: d.idDestinatario ? Number(d.idDestinatario) : null,
            descripcion: d.descripcion,
            fechaPrevista: d.fechaPrevista,
          },
        });
      } else {
        await crear.mutateAsync({
          idTipoAccion: Number(d.idTipoAccion),
          idConocimiento: Number(d.idConocimiento),
          idPlan: d.idPlan ? Number(d.idPlan) : undefined,
          idResponsable: Number(d.idResponsable),
          idDestinatario: d.idDestinatario
            ? Number(d.idDestinatario)
            : undefined,
          descripcion: d.descripcion,
          fechaPrevista: d.fechaPrevista,
        });
      }
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  const personasOpciones = (personas ?? []).map((p) => (
    <MenuItem key={p.id} value={String(p.id)}>
      {p.apellido}, {p.nombre} ({p.legajo})
    </MenuItem>
  ));

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>{edicion ? 'Editar acción' : 'Nueva acción'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Selector
              control={control}
              name="idTipoAccion"
              label="Tipo de acción"
              mensaje={errors.idTipoAccion?.message}
            >
              {(tipos ?? [])
                .filter((t) => t.activo || t.id === tipoActual?.id)
                .map((t) => (
                  <MenuItem key={t.id} value={String(t.id)}>
                    {t.denominacion}
                  </MenuItem>
                ))}
            </Selector>
            <Selector
              control={control}
              name="idConocimiento"
              label="Conocimiento"
              disabled={edicion}
              mensaje={errors.idConocimiento?.message}
            >
              {(conocimientos ?? [])
                .filter((c) => c.activo || c.id === accion?.idConocimiento)
                .map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.denominacion}
                  </MenuItem>
                ))}
            </Selector>
            <Selector
              control={control}
              name="idPlan"
              label="Plan (opcional)"
              disabled={edicion}
              mensaje={errors.idPlan?.message}
            >
              <MenuItem value="">Sin plan</MenuItem>
              {(planes ?? []).map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.codigoPuesto} · {p.denominacionPuesto} (
                  {etiquetaEstadoPlan(p.estado)})
                </MenuItem>
              ))}
            </Selector>
            <Selector
              control={control}
              name="idResponsable"
              label="Responsable"
              mensaje={errors.idResponsable?.message}
            >
              {personasOpciones}
            </Selector>
            <Selector
              control={control}
              name="idDestinatario"
              label="Destinatario (opcional)"
              mensaje={errors.idDestinatario?.message}
            >
              <MenuItem value="">Sin destinatario</MenuItem>
              {personasOpciones}
            </Selector>
            <TextField
              label="Descripción"
              multiline
              minRows={2}
              {...register('descripcion')}
              error={!!errors.descripcion}
              helperText={errors.descripcion?.message}
            />
            <TextField
              label="Fecha prevista"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...register('fechaPrevista')}
              error={!!errors.fechaPrevista}
              helperText={errors.fechaPrevista?.message}
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

interface SelectorProps {
  control: Control<Datos>;
  name: Exclude<keyof Datos, 'descripcion' | 'fechaPrevista'>;
  label: string;
  mensaje?: string;
  disabled?: boolean;
  children: ReactNode;
}

function Selector({
  control,
  name,
  label,
  mensaje,
  disabled,
  children,
}: SelectorProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <TextField
          select
          label={label}
          disabled={disabled}
          {...field}
          error={!!mensaje}
          helperText={mensaje}
        >
          {children}
        </TextField>
      )}
    />
  );
}
