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
  useActualizarPersona,
  useCrearPersona,
  type PersonaDetalle,
} from '../hooks/usePersonas';

interface Props {
  /** Sin persona, el formulario crea una nueva. */
  persona?: PersonaDetalle;
  onCerrar: () => void;
  onGuardada?: (id: number) => void;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const esquema = z
  .object({
    legajo: z
      .string()
      .trim()
      .min(1, 'Obligatorio')
      .max(20, 'Hasta 20 caracteres'),
    apellido: z
      .string()
      .trim()
      .min(1, 'Obligatorio')
      .max(100, 'Hasta 100 caracteres'),
    nombre: z
      .string()
      .trim()
      .min(1, 'Obligatorio')
      .max(100, 'Hasta 100 caracteres'),
    documento: z
      .string()
      .trim()
      .regex(/^\d{7,8}$/, '7 u 8 dígitos, sin puntos'),
    fechaNacimiento: z.string().regex(FECHA, 'Elegí una fecha'),
    fechaIngreso: z.string().regex(FECHA, 'Elegí una fecha'),
    idSituacionRevista: z.string().min(1, 'Elegí una situación'),
    fechaPrevistaRetiro: z
      .string()
      .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Fecha inválida'),
  })
  .refine((d) => d.fechaIngreso > d.fechaNacimiento, {
    path: ['fechaIngreso'],
    message: 'Debe ser posterior al nacimiento',
  })
  .refine(
    (d) =>
      d.fechaPrevistaRetiro === '' || d.fechaPrevistaRetiro >= d.fechaIngreso,
    {
      path: ['fechaPrevistaRetiro'],
      message: 'No puede ser anterior al ingreso',
    },
  );
type Datos = z.infer<typeof esquema>;

/** Se monta solo mientras está abierto, por lo que parte siempre de cero. */
export function FormularioPersona({ persona, onCerrar, onGuardada }: Props) {
  const { data: situaciones } = useValoresReferencia(
    'situacion-revista',
    false,
  );
  const crear = useCrearPersona();
  const actualizar = useActualizarPersona();
  const [error, setError] = useState<string>();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      legajo: persona?.legajo ?? '',
      apellido: persona?.apellido ?? '',
      nombre: persona?.nombre ?? '',
      documento: persona?.documento ?? '',
      fechaNacimiento: persona?.fechaNacimiento ?? '',
      fechaIngreso: persona?.fechaIngreso ?? '',
      idSituacionRevista: persona ? String(persona.idSituacionRevista) : '',
      fechaPrevistaRetiro: persona?.fechaPrevistaRetiro ?? '',
    },
  });

  const guardar = handleSubmit(async (datos) => {
    setError(undefined);
    const cuerpo = {
      legajo: datos.legajo,
      apellido: datos.apellido,
      nombre: datos.nombre,
      documento: datos.documento,
      fechaNacimiento: datos.fechaNacimiento,
      fechaIngreso: datos.fechaIngreso,
      idSituacionRevista: Number(datos.idSituacionRevista),
      fechaPrevistaRetiro: datos.fechaPrevistaRetiro || null,
    };
    try {
      const guardada = persona
        ? await actualizar.mutateAsync({ id: persona.id, cuerpo })
        : await crear.mutateAsync(cuerpo);
      onGuardada?.(guardada.id);
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  const fecha = (campo: keyof Datos, etiqueta: string, ayuda?: string) => (
    <TextField
      label={etiqueta}
      type="date"
      slotProps={{ inputLabel: { shrink: true } }}
      {...register(campo)}
      error={!!errors[campo]}
      helperText={errors[campo]?.message ?? ayuda}
    />
  );

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>
          {persona
            ? `Editar a ${persona.apellido}, ${persona.nombre}`
            : 'Nueva persona'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Legajo"
              {...register('legajo')}
              error={!!errors.legajo}
              helperText={errors.legajo?.message}
              autoFocus
            />
            <TextField
              label="Apellido"
              {...register('apellido')}
              error={!!errors.apellido}
              helperText={errors.apellido?.message}
            />
            <TextField
              label="Nombre"
              {...register('nombre')}
              error={!!errors.nombre}
              helperText={errors.nombre?.message}
            />
            <TextField
              label="Documento"
              {...register('documento')}
              error={!!errors.documento}
              helperText={errors.documento?.message ?? 'DNI, 7 u 8 dígitos'}
            />
            {fecha('fechaNacimiento', 'Fecha de nacimiento')}
            {fecha('fechaIngreso', 'Fecha de ingreso')}
            <TextField
              select
              label="Situación de revista"
              defaultValue={persona ? String(persona.idSituacionRevista) : ''}
              {...register('idSituacionRevista')}
              error={!!errors.idSituacionRevista}
              helperText={errors.idSituacionRevista?.message}
            >
              {(situaciones ?? []).map((s) => (
                <MenuItem key={s.id} value={String(s.id)}>
                  {s.denominacion}
                </MenuItem>
              ))}
            </TextField>
            {fecha(
              'fechaPrevistaRetiro',
              'Fecha prevista de retiro (opcional)',
              'Alimenta el horizonte de riesgo',
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
