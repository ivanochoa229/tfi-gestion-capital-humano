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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { useUnidades } from '../../estructura/hooks/useUnidades';
import { EXTENSIONES_ACTIVO, formatearTamanio } from '../activos';
import {
  useActualizarActivo,
  useCrearActivo,
  type Activo,
} from '../hooks/useActivos';
import { useConocimientos, type Conocimiento } from '../hooks/useConocimientos';

interface Props {
  /** Sin activo, el formulario da de alta uno nuevo. */
  activo?: Activo;
  /** Conocimiento que se precarga al agregar desde el catálogo. */
  conocimientoInicial?: Conocimiento;
  onCerrar: () => void;
}

const esUrlWeb = (valor: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(valor).protocol);
  } catch {
    return false;
  }
};

const esquema = z
  .object({
    titulo: z
      .string()
      .trim()
      .min(2, 'Ingresá al menos 2 caracteres')
      .max(200, 'Máximo 200 caracteres'),
    idTipoDocumento: z.string().min(1, 'Elegí un tipo de documento'),
    idUnidad: z.string().min(1, 'Elegí la unidad que lo mantiene'),
    idsConocimiento: z
      .array(z.number())
      .min(1, 'Elegí al menos un conocimiento'),
    fechaVigencia: z.string(),
    origen: z.enum(['archivo', 'enlace']),
    enlace: z.string().trim(),
  })
  .superRefine((datos, ctx) => {
    if (datos.origen === 'enlace' && !esUrlWeb(datos.enlace)) {
      ctx.addIssue({
        code: 'custom',
        path: ['enlace'],
        message: 'Ingresá una URL que empiece con http:// o https://',
      });
    }
  });
type Datos = z.infer<typeof esquema>;

/** Se monta solo mientras está abierto, por lo que parte siempre de cero. El archivo de un activo existente se cambia con «Reemplazar archivo». */
export function FormularioActivo({
  activo,
  conocimientoInicial,
  onCerrar,
}: Props) {
  const { data: tipos } = useValoresReferencia('tipo-documento', false);
  const { data: unidades } = useUnidades();
  const { data: conocimientos } = useConocimientos({ activo: true });
  const crear = useCrearActivo();
  const actualizar = useActualizarActivo();
  const [archivo, setArchivo] = useState<File>();
  const [error, setError] = useState<string>();

  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      titulo: activo?.titulo ?? '',
      idTipoDocumento: activo ? String(activo.idTipoDocumento) : '',
      idUnidad: activo ? String(activo.idUnidad) : '',
      idsConocimiento: activo
        ? activo.idsConocimiento
        : conocimientoInicial
          ? [conocimientoInicial.id]
          : [],
      fechaVigencia: activo?.fechaVigencia ?? '',
      origen: activo?.origen ?? 'archivo',
      enlace: activo?.enlace ?? '',
    },
  });
  const origen = watch('origen');

  const guardar = handleSubmit(async (datos) => {
    setError(undefined);
    if (!activo && datos.origen === 'archivo' && !archivo) {
      setError('Elegí el archivo que querés subir');
      return;
    }
    try {
      if (activo) {
        await actualizar.mutateAsync({
          id: activo.id,
          cuerpo: {
            titulo: datos.titulo,
            idTipoDocumento: Number(datos.idTipoDocumento),
            idUnidad: Number(datos.idUnidad),
            idsConocimiento: datos.idsConocimiento,
            fechaVigencia: datos.fechaVigencia || null,
            ...(activo.origen === 'enlace' ? { enlace: datos.enlace } : {}),
          },
        });
      } else {
        await crear.mutateAsync({
          cuerpo: {
            titulo: datos.titulo,
            idTipoDocumento: Number(datos.idTipoDocumento),
            idUnidad: Number(datos.idUnidad),
            idsConocimiento: datos.idsConocimiento,
            fechaVigencia: datos.fechaVigencia || undefined,
            enlace: datos.origen === 'enlace' ? datos.enlace : undefined,
          },
          archivo: datos.origen === 'archivo' ? archivo : undefined,
        });
      }
      onCerrar();
    } catch (e) {
      // Un duplicado vuelve como 409 con el título del activo existente; 413 y 415 explican el límite y los tipos.
      setError((e as Error).message);
    }
  });

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>{activo ? 'Editar activo' : 'Nuevo activo'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Título"
              {...register('titulo')}
              error={!!errors.titulo}
              helperText={errors.titulo?.message}
            />
            <TextField
              select
              label="Tipo de documento"
              defaultValue={activo ? String(activo.idTipoDocumento) : ''}
              {...register('idTipoDocumento')}
              error={!!errors.idTipoDocumento}
              helperText={errors.idTipoDocumento?.message}
            >
              {(tipos ?? []).map((t) => (
                <MenuItem key={t.id} value={String(t.id)}>
                  {t.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Unidad que lo mantiene"
              defaultValue={activo ? String(activo.idUnidad) : ''}
              {...register('idUnidad')}
              error={!!errors.idUnidad}
              helperText={errors.idUnidad?.message}
            >
              {(unidades ?? []).map((u) => (
                <MenuItem key={u.id} value={String(u.id)}>
                  {u.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <Controller
              name="idsConocimiento"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  multiple
                  options={conocimientos ?? []}
                  getOptionLabel={(c) => c.denominacion}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  value={(conocimientos ?? []).filter((c) =>
                    field.value.includes(c.id),
                  )}
                  onChange={(_, elegidos) =>
                    field.onChange(elegidos.map((c) => c.id))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Conocimientos que documenta"
                      error={!!errors.idsConocimiento}
                      helperText={errors.idsConocimiento?.message}
                    />
                  )}
                />
              )}
            />
            <TextField
              type="date"
              label="Vigente hasta (opcional)"
              slotProps={{ inputLabel: { shrink: true } }}
              {...register('fechaVigencia')}
            />
            {!activo && (
              <ToggleButtonGroup
                exclusive
                size="small"
                value={origen}
                onChange={(_, valor: 'archivo' | 'enlace' | null) =>
                  valor && setValue('origen', valor)
                }
                aria-label="Origen del activo"
              >
                <ToggleButton value="archivo">Subir archivo</ToggleButton>
                <ToggleButton value="enlace">Enlace externo</ToggleButton>
              </ToggleButtonGroup>
            )}
            {origen === 'archivo' && !activo && (
              <Stack spacing={1}>
                <Button component="label" variant="outlined">
                  {archivo ? 'Cambiar archivo' : 'Elegir archivo'}
                  <input
                    hidden
                    type="file"
                    accept={EXTENSIONES_ACTIVO}
                    onChange={(e) => setArchivo(e.target.files?.[0])}
                  />
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {archivo
                    ? `${archivo.name} (${formatearTamanio(archivo.size)})`
                    : 'PDF, DOCX, XLSX, PPTX, ODT, TXT, PNG o JPG'}
                </Typography>
              </Stack>
            )}
            {origen === 'enlace' && (
              <TextField
                label="Enlace"
                placeholder="https://"
                {...register('enlace')}
                error={!!errors.enlace}
                helperText={errors.enlace?.message}
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
