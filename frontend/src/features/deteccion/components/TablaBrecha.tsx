import {
  Alert,
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { etiquetaEstadoPlan } from '../../sucesion/estados';
import type { BrechaPuesto } from '../hooks/useDeteccion';

interface Propiedades {
  filas: BrechaPuesto[];
  mostrarDeclarado?: boolean;
}

/**
 * Muestra la tabla detallada de brecha de perfil por persona y puesto (RF19),
 * con los dos contadores separados (excluyentes y deseables) y la indicación
 * explícita de «Sin acreditar».
 */
export function TablaBrecha({ filas, mostrarDeclarado = false }: Propiedades) {
  if (filas.length === 0) {
    return (
      <Alert severity="info">
        No se encontraron perfiles o candidaturas para los criterios
        seleccionados.
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      {filas.map((f) => {
        const clave = `${f.contexto}-${f.idPersona}-${f.idPuesto}-${f.idPlan ?? 0}`;
        const todosExcluyentesCubiertos =
          f.resumen.excluyentesCubiertos === f.resumen.excluyentesTotal;

        return (
          <Paper key={clave} variant="outlined" sx={{ p: 2 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{
                mb: 1.5,
                alignItems: { sm: 'center' },
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {f.apellido}, {f.nombre} — {f.denominacionPuesto}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                  <Chip
                    size="small"
                    label={
                      f.contexto === 'ocupante'
                        ? 'Ocupante actual'
                        : `Candidato${f.estadoPlan ? ` (${etiquetaEstadoPlan(f.estadoPlan)})` : ''}`
                    }
                    color={f.contexto === 'ocupante' ? 'default' : 'primary'}
                    variant="outlined"
                  />
                  {f.aRevisar && (
                    <Chip
                      size="small"
                      color="warning"
                      label="Candidatura a revisar (ya ocupa el puesto o no tiene ocupación vigente)"
                    />
                  )}
                </Stack>
              </Box>

              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip
                  size="small"
                  color={todosExcluyentesCubiertos ? 'success' : 'error'}
                  label={`Excluyentes cubiertos ${f.resumen.excluyentesCubiertos} de ${f.resumen.excluyentesTotal}`}
                />
                <Chip
                  size="small"
                  color={
                    f.resumen.deseablesCubiertos === f.resumen.deseablesTotal
                      ? 'success'
                      : 'warning'
                  }
                  variant="outlined"
                  label={`Deseables cubiertos ${f.resumen.deseablesCubiertos} de ${f.resumen.deseablesTotal}`}
                />
              </Stack>
            </Stack>

            {f.conocimientos.length === 0 ? (
              <Alert severity="info">
                Este puesto no tiene requisitos de conocimiento activos.
              </Alert>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Conocimiento</TableCell>
                    <TableCell>Carácter</TableCell>
                    <TableCell>Nivel requerido</TableCell>
                    <TableCell>Nivel acreditado</TableCell>
                    {mostrarDeclarado && <TableCell>Nivel declarado</TableCell>}
                    <TableCell>Faltante (escalones)</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {f.conocimientos.map((c) => (
                    <TableRow key={c.idConocimiento}>
                      <TableCell>{c.denominacion}</TableCell>
                      <TableCell>
                        {c.esExcluyente ? 'Excluyente' : 'Deseable'}
                      </TableCell>
                      <TableCell>{c.nivelRequerido}</TableCell>
                      <TableCell>
                        {c.nivelAcreditado ?? (
                          <Typography
                            component="span"
                            variant="body2"
                            color="text.secondary"
                            sx={{ fontStyle: 'italic' }}
                          >
                            Sin acreditar
                          </Typography>
                        )}
                      </TableCell>
                      {mostrarDeclarado && (
                        <TableCell>{c.nivelDeclarado ?? '—'}</TableCell>
                      )}
                      <TableCell>{c.faltante}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={c.cubierto ? 'success' : 'warning'}
                          label={
                            c.cubierto
                              ? 'Cubierto'
                              : c.nivelAcreditado === null
                                ? 'Sin acreditar'
                                : `Faltan ${c.faltante}`
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        );
      })}
    </Stack>
  );
}
