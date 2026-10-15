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
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useUnidades } from '../../estructura/hooks/useUnidades';
import { usePersonas } from '../../personas/hooks/usePersonas';
import {
  useActualizarUsuario,
  useCrearUsuario,
  useRoles,
  type Usuario,
} from '../hooks/useUsuarios';

interface Props {
  /** Sin usuario, el formulario crea uno nuevo. */
  usuario?: Usuario;
  onCerrar: () => void;
}

function crearEsquema(esAlta: boolean) {
  return z
    .object({
      nombreUsuario: z
        .string()
        .trim()
        .regex(
          /^[A-Za-z0-9._-]{3,50}$/,
          '3 a 50 caracteres: letras, números, punto, guion y guion bajo',
        ),
      clave: esAlta
        ? z.string().min(10, 'Al menos 10 caracteres')
        : z.string().optional(),
      rol: z.string().min(1, 'Elegí un rol'),
      idPersona: z.string(),
      idUnidades: z.array(z.number()),
    })
    .refine((d) => d.rol !== 'docente' || d.idPersona !== '', {
      path: ['idPersona'],
      message: 'El rol docente exige una persona',
    });
}
type Datos = z.infer<ReturnType<typeof crearEsquema>>;

/** Se monta solo mientras está abierto, por lo que parte siempre de cero. */
export function FormularioUsuario({ usuario, onCerrar }: Props) {
  const esAlta = !usuario;
  const esquema = useMemo(() => crearEsquema(esAlta), [esAlta]);
  const { data: roles } = useRoles();
  const crear = useCrearUsuario();
  const actualizar = useActualizarUsuario();
  const [error, setError] = useState<string>();

  const { data: unidades } = useUnidades(true);
  const { data: personas } = usePersonas({ activo: true });
  // Solo las que no tienen usuario, más la que ya está vinculada a este.
  const personasElegibles = (personas ?? []).filter(
    (p) => !p.tieneUsuario || p.id === usuario?.idPersona,
  );

  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombreUsuario: usuario?.nombreUsuario ?? '',
      clave: '',
      rol: usuario?.rol ?? '',
      idPersona: usuario?.idPersona != null ? String(usuario.idPersona) : '',
      idUnidades: usuario?.idUnidades ?? [],
    },
  });
  const rol = useWatch({ control, name: 'rol' });
  const tipoUnidad =
    rol === 'jefe_catedra'
      ? 'catedra'
      : rol === 'jefatura_departamento'
        ? 'departamento'
        : undefined;
  const delTipo = (unidades ?? []).filter((u) => u.tipo === tipoUnidad);
  const elegibles = (seleccion: number[]) =>
    // Las inactivas solo se muestran si ya están asignadas, para poder quitarlas.
    delTipo.filter((u) => u.activo || seleccion.includes(u.id));

  const guardar = handleSubmit(async (datos) => {
    const idUnidades = tipoUnidad ? datos.idUnidades : [];
    const idPersona = datos.idPersona === '' ? null : Number(datos.idPersona);
    try {
      if (usuario) {
        await actualizar.mutateAsync({
          id: usuario.id,
          cuerpo: {
            nombreUsuario: datos.nombreUsuario,
            rol: datos.rol as never,
            idPersona,
            idUnidades,
          },
        });
      } else {
        await crear.mutateAsync({
          nombreUsuario: datos.nombreUsuario,
          clave: datos.clave ?? '',
          rol: datos.rol as never,
          idPersona,
          idUnidades,
        });
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
          {usuario ? 'Editar usuario' : 'Nuevo usuario'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Usuario"
              {...register('nombreUsuario')}
              error={!!errors.nombreUsuario}
              helperText={errors.nombreUsuario?.message}
              autoFocus
            />
            {esAlta && (
              <TextField
                label="Clave"
                type="password"
                {...register('clave')}
                error={!!errors.clave}
                helperText={errors.clave?.message ?? 'Al menos 10 caracteres'}
              />
            )}
            <TextField
              select
              label="Rol"
              defaultValue={usuario?.rol ?? ''}
              {...register('rol', {
                onChange: () => setValue('idUnidades', []),
              })}
              error={!!errors.rol}
              helperText={
                errors.rol?.message ??
                'El rol docente exige vincular una persona'
              }
            >
              {(roles ?? []).map((r) => (
                <MenuItem key={r.codigo} value={r.codigo}>
                  {r.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Persona vinculada"
              defaultValue={
                usuario?.idPersona != null ? String(usuario.idPersona) : ''
              }
              {...register('idPersona')}
              error={!!errors.idPersona}
              helperText={
                errors.idPersona?.message ??
                'Obligatoria para el rol docente; solo se ofrecen personas activas sin usuario'
              }
            >
              <MenuItem value="">Sin persona</MenuItem>
              {personasElegibles.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.apellido}, {p.nombre} · {p.legajo}
                </MenuItem>
              ))}
            </TextField>
            {tipoUnidad && (
              <Controller
                control={control}
                name="idUnidades"
                render={({ field }) => (
                  <TextField
                    select
                    label={
                      tipoUnidad === 'catedra'
                        ? 'Cátedras a cargo'
                        : 'Departamento a cargo'
                    }
                    value={field.value}
                    onChange={field.onChange}
                    slotProps={{ select: { multiple: true } }}
                    helperText={
                      elegibles(field.value).length === 0
                        ? 'No hay unidades de este tipo cargadas. Las carga el DBA.'
                        : 'Define qué unidades ve y gestiona este usuario'
                    }
                  >
                    {elegibles(field.value).map((u) => (
                      <MenuItem key={u.id} value={u.id}>
                        {u.activo
                          ? u.denominacion
                          : `${u.denominacion} (inactiva)`}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
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
