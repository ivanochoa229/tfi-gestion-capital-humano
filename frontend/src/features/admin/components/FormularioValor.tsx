import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useActualizarValor, useCrearValor } from '../hooks/useGuardarValor';
import type { Dominio, Valor } from '../hooks/useValoresReferencia';

interface Props {
  dominio: Dominio;
  /** Valor a editar; sin valor, el formulario crea uno nuevo. */
  valor?: Valor;
  onCerrar: () => void;
}

function crearEsquema(ordinal: boolean) {
  return z
    .object({
      codigo: z
        .string()
        .regex(
          /^[a-z][a-z0-9_]{1,39}$/,
          'Minúsculas, números y guion bajo; empieza con letra (2 a 40 caracteres)',
        ),
      denominacion: z
        .string()
        .min(1, 'Ingresá la denominación')
        .max(100, 'Máximo 100 caracteres'),
      orden: z
        .number({ error: 'Debe ser un número' })
        .int('Debe ser entero')
        .min(1, 'Debe ser 1 o mayor')
        .optional(),
    })
    .refine((d) => !ordinal || d.orden !== undefined, {
      path: ['orden'],
      message: 'Ingresá el orden',
    });
}

type Datos = z.infer<ReturnType<typeof crearEsquema>>;

/** Se monta solo mientras está abierto, por lo que parte siempre de cero. */
export function FormularioValor({ dominio, valor, onCerrar }: Props) {
  const esquema = useMemo(() => crearEsquema(dominio.ordinal), [dominio]);
  const crear = useCrearValor(dominio.dominio);
  const actualizar = useActualizarValor(dominio.dominio);
  const [error, setError] = useState<string>();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      codigo: valor?.codigo ?? '',
      denominacion: valor?.denominacion ?? '',
      orden: valor?.orden,
    },
  });

  const guardar = handleSubmit(async (datos) => {
    try {
      if (valor) {
        await actualizar.mutateAsync({ id: valor.id, cuerpo: datos });
      } else {
        await crear.mutateAsync(datos);
      }
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="xs">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>
          {valor ? 'Editar valor' : 'Nuevo valor'} · {dominio.denominacion}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Código"
              {...register('codigo')}
              error={!!errors.codigo}
              helperText={
                errors.codigo?.message ??
                (valor?.enUso
                  ? 'El código no se puede cambiar: está en uso'
                  : '')
              }
              disabled={valor?.enUso}
              autoFocus
            />
            <TextField
              label="Denominación"
              {...register('denominacion')}
              error={!!errors.denominacion}
              helperText={errors.denominacion?.message}
            />
            {dominio.ordinal && (
              <TextField
                label="Orden"
                type="number"
                {...register('orden', {
                  setValueAs: (v) => (v === '' ? undefined : Number(v)),
                })}
                error={!!errors.orden}
                helperText={
                  errors.orden?.message ?? 'Define cuál valor es mayor'
                }
              />
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
