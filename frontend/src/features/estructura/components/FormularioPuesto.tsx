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
  useActualizarPuesto,
  useCrearPuesto,
  usePuestos,
  type Puesto,
} from '../hooks/usePuestos';
import { superioresValidos } from './arbol';

interface Props {
  idUnidad: number;
  /** Unidades donde puede estar el superior: la propia y sus ancestras. */
  unidadesValidas: number[];
  /** Sin puesto, el formulario crea uno nuevo. */
  puesto?: Puesto;
  onCerrar: () => void;
}

const esquema = z.object({
  denominacion: z
    .string()
    .trim()
    .min(1, 'Obligatoria')
    .max(150, 'Hasta 150 caracteres'),
  idNivelJerarquico: z.string().min(1, 'Elegí un nivel'),
  idTipoRelacionContractual: z.string(),
  idPuestoSuperior: z.string(),
  dotacionPrevista: z
    .string()
    .regex(/^[1-9]\d*$/, 'Un entero mayor o igual a 1'),
  rangoRetributivo: z.string().trim().max(100, 'Hasta 100 caracteres'),
  proposito: z.string().trim(),
  condicionesTrabajo: z.string().trim(),
});
type Datos = z.infer<typeof esquema>;

const numeroONulo = (valor: string) => (valor === '' ? null : Number(valor));
const textoONulo = (valor: string) => (valor === '' ? null : valor);

/** Se monta solo mientras está abierto, por lo que parte siempre de cero. */
export function FormularioPuesto({
  idUnidad,
  unidadesValidas,
  puesto,
  onCerrar,
}: Props) {
  const { data: niveles } = useValoresReferencia('nivel-jerarquico', false);
  const { data: contractuales } = useValoresReferencia(
    'tipo-relacion-contractual',
    false,
  );
  const { data: todos } = usePuestos();
  const crear = useCrearPuesto();
  const actualizar = useActualizarPuesto();
  const [error, setError] = useState<string>();

  const superiores = superioresValidos(todos ?? [], puesto, unidadesValidas);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      denominacion: puesto?.denominacion ?? '',
      idNivelJerarquico: puesto ? String(puesto.idNivelJerarquico) : '',
      idTipoRelacionContractual:
        puesto?.idTipoRelacionContractual != null
          ? String(puesto.idTipoRelacionContractual)
          : '',
      idPuestoSuperior:
        puesto?.idPuestoSuperior != null ? String(puesto.idPuestoSuperior) : '',
      dotacionPrevista: String(puesto?.dotacionPrevista ?? 1),
      rangoRetributivo: puesto?.rangoRetributivo ?? '',
      proposito: puesto?.proposito ?? '',
      condicionesTrabajo: puesto?.condicionesTrabajo ?? '',
    },
  });

  const guardar = handleSubmit(async (datos) => {
    setError(undefined);
    const comunes = {
      denominacion: datos.denominacion,
      idNivelJerarquico: Number(datos.idNivelJerarquico),
      idTipoRelacionContractual: numeroONulo(datos.idTipoRelacionContractual),
      idPuestoSuperior: numeroONulo(datos.idPuestoSuperior),
      dotacionPrevista: Number(datos.dotacionPrevista),
      rangoRetributivo: textoONulo(datos.rangoRetributivo),
      proposito: textoONulo(datos.proposito),
      condicionesTrabajo: textoONulo(datos.condicionesTrabajo),
    };
    try {
      if (puesto) {
        await actualizar.mutateAsync({ id: puesto.id, cuerpo: comunes });
      } else {
        await crear.mutateAsync({ ...comunes, idUnidad });
      }
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>
          {puesto ? `Editar puesto ${puesto.codigo}` : 'Nuevo puesto'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Denominación"
              {...register('denominacion')}
              error={!!errors.denominacion}
              helperText={errors.denominacion?.message}
              autoFocus
            />
            <TextField
              select
              label="Nivel jerárquico"
              defaultValue={puesto ? String(puesto.idNivelJerarquico) : ''}
              {...register('idNivelJerarquico')}
              error={!!errors.idNivelJerarquico}
              helperText={errors.idNivelJerarquico?.message}
            >
              {(niveles ?? []).map((n) => (
                <MenuItem key={n.id} value={String(n.id)}>
                  {n.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Puesto superior"
              defaultValue={
                puesto?.idPuestoSuperior != null
                  ? String(puesto.idPuestoSuperior)
                  : ''
              }
              {...register('idPuestoSuperior')}
              helperText="De esta unidad o de una unidad superior. Vacío si no tiene."
            >
              <MenuItem value="">Sin superior</MenuItem>
              {superiores.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.codigo} · {p.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Dotación prevista"
              {...register('dotacionPrevista')}
              error={!!errors.dotacionPrevista}
              helperText={errors.dotacionPrevista?.message}
            />
            <TextField
              select
              label="Relación contractual"
              defaultValue={
                puesto?.idTipoRelacionContractual != null
                  ? String(puesto.idTipoRelacionContractual)
                  : ''
              }
              {...register('idTipoRelacionContractual')}
            >
              <MenuItem value="">Sin especificar</MenuItem>
              {(contractuales ?? []).map((c) => (
                <MenuItem key={c.id} value={String(c.id)}>
                  {c.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Rango retributivo"
              {...register('rangoRetributivo')}
              error={!!errors.rangoRetributivo}
              helperText={
                errors.rangoRetributivo?.message ??
                'Texto descriptivo; no es un monto'
              }
            />
            <TextField
              label="Propósito"
              multiline
              minRows={2}
              {...register('proposito')}
            />
            <TextField
              label="Condiciones de trabajo"
              multiline
              minRows={2}
              {...register('condicionesTrabajo')}
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
