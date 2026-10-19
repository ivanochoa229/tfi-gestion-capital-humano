import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import { BotonExportarCsv } from '../components/BotonExportarCsv';
import { ListadoConPestanias } from '../components/ListadoConPestanias';
import { useHorizonte, type HorizonteRiesgo } from '../hooks/useDeteccion';

const esquemaPlazo = z.object({
  meses: z
    .number({ message: 'Ingresá un número de meses' })
    .int('Debe ser un número entero')
    .min(1, 'Mínimo 1 mes')
    .max(120, 'Máximo 120 meses'),
});

type DatosPlazo = z.infer<typeof esquemaPlazo>;

function formatearPuestos(fila: HorizonteRiesgo): string {
  const visibles = fila.puestosCriticos.map((p) => p.denominacion);
  if (fila.puestosFueraDeAlcance > 0) {
    visibles.push(`y ${fila.puestosFueraDeAlcance} más fuera de tu alcance`);
  }
  return visibles.join(', ');
}

/**
 * RF20: Horizonte de riesgo de retiros de poseedores de conocimientos críticos.
 * Permite configurar el plazo en meses (1 a 120, 24 por defecto) e incluir
 * opcionalmente los conocimientos que quedan con 2 o más poseedores.
 */
export function HorizontePage() {
  const [parametros, setParametros] = useSearchParams();
  const idUnidad = parametros.get('idUnidad') ?? '';
  const mesesParam = Number(parametros.get('meses') ?? '24');
  const mesesEfectivos =
    Number.isInteger(mesesParam) && mesesParam >= 1 && mesesParam <= 120
      ? mesesParam
      : 24;
  const incluirConDosOMas = parametros.get('incluirConDosOMas') === 'true';

  const unidadNum = idUnidad ? Number(idUnidad) : undefined;
  const consulta = useHorizonte({
    idUnidad: unidadNum,
    meses: mesesEfectivos,
    incluirConDosOMas: incluirConDosOMas || undefined,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DatosPlazo>({
    resolver: zodResolver(esquemaPlazo),
    defaultValues: { meses: mesesEfectivos },
  });

  useEffect(() => {
    reset({ meses: mesesEfectivos });
  }, [mesesEfectivos, reset]);

  const actualizarParametro = (clave: string, valor: string) => {
    const siguientes = new URLSearchParams(parametros);
    if (valor) {
      siguientes.set(clave, valor);
    } else {
      siguientes.delete(clave);
    }
    setParametros(siguientes);
  };

  const aplicarPlazo = handleSubmit(({ meses }) => {
    actualizarParametro('meses', String(meses));
  });

  return (
    <ListadoConPestanias
      titulo="Horizonte de riesgo por retiros (RF20)"
      descripcion="Conocimientos críticos que pierden poseedores acreditados por fecha prevista de retiro dentro del plazo seleccionado."
      idUnidad={idUnidad}
      onCambiarUnidad={(v) => actualizarParametro('idUnidad', v)}
      filtrosExtra={
        <Stack
          component="form"
          onSubmit={aplicarPlazo}
          noValidate
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { sm: 'center' } }}
        >
          <TextField
            size="small"
            type="number"
            label="Plazo (meses)"
            sx={{ width: 150 }}
            {...register('meses', { valueAsNumber: true })}
            error={!!errors.meses}
            helperText={errors.meses?.message}
          />
          <Button type="submit" variant="outlined" size="small">
            Aplicar plazo
          </Button>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={incluirConDosOMas}
                onChange={(e) =>
                  actualizarParametro(
                    'incluirConDosOMas',
                    e.target.checked ? 'true' : '',
                  )
                }
              />
            }
            label="Incluir los que quedan con 2 o más"
          />
        </Stack>
      }
      accionesExtra={
        <BotonExportarCsv
          ruta="/api/deteccion/horizonte-riesgo"
          filtro={{
            idUnidad: unidadNum,
            meses: mesesEfectivos,
            incluirConDosOMas: incluirConDosOMas || undefined,
          }}
          nombreArchivo="horizonte-riesgo.csv"
        />
      }
    >
      {consulta.isPending ? (
        <CircularProgress aria-label="Cargando horizonte de riesgo" />
      ) : consulta.isError ? (
        <Alert severity="error">{consulta.error.message}</Alert>
      ) : consulta.data.conocimientos.length === 0 ? (
        <Alert severity="info">
          Ningún conocimiento crítico pierde poseedores en los próximos{' '}
          {consulta.data.meses} meses bajo el criterio seleccionado.
        </Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Conocimiento</TableCell>
              <TableCell>Nivel requerido</TableCell>
              <TableCell>Poseedores actuales</TableCell>
              <TableCell>Quedan tras el plazo</TableCell>
              <TableCell>Retiros previstos</TableCell>
              <TableCell>Puestos críticos asociados</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {consulta.data.conocimientos.map((f) => (
              <TableRow key={f.idConocimiento}>
                <TableCell>{f.denominacion}</TableCell>
                <TableCell>{f.nivelRequerido}</TableCell>
                <TableCell>{f.cantidadPoseedores}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={
                      f.quedan === 0
                        ? 'error'
                        : f.quedan === 1
                          ? 'warning'
                          : 'default'
                    }
                    label={
                      f.quedan === 1 ? '1 poseedor' : `${f.quedan} poseedores`
                    }
                  />
                </TableCell>
                <TableCell>
                  <Stack spacing={0.5}>
                    {f.retiros.map((r, indice) =>
                      r.idPersona !== null && r.apellido && r.nombre ? (
                        <Typography key={r.idPersona} variant="body2">
                          {r.apellido}, {r.nombre} ({r.fechaPrevistaRetiro})
                        </Typography>
                      ) : (
                        <Typography
                          key={`enmascarado-${indice}`}
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontStyle: 'italic' }}
                        >
                          Fuera de tu alcance
                        </Typography>
                      ),
                    )}
                  </Stack>
                </TableCell>
                <TableCell>{formatearPuestos(f)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ListadoConPestanias>
  );
}
