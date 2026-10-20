import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Link,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { useSesion } from '../../../auth/useSesion';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { useUnidades } from '../../estructura/hooks/useUnidades';
import { CrearPlanDialog } from '../components/CrearPlanDialog';
import {
  CODIGOS_ESTADO_PLAN,
  colorEstadoPlan,
  etiquetaEstadoPlan,
  ROL_ELABORADOR,
} from '../estados';
import { useCobertura, usePlanes } from '../hooks/useSucesion';

/** Cobertura de OE7, puestos críticos sin plan aprobado y planes de sucesión. */
export function SucesionPage() {
  const { data: sesion } = useSesion();
  const { data: unidades } = useUnidades();
  const navegar = useNavigate();
  const [idUnidad, setIdUnidad] = useState('');
  const [estado, setEstado] = useState('');
  const [creando, setCreando] = useState(false);
  const [puestoInicial, setPuestoInicial] = useState<number>();

  const unidad = idUnidad ? Number(idUnidad) : undefined;
  const cobertura = useCobertura({ idUnidad: unidad });
  const planes = usePlanes({ idUnidad: unidad, estado: estado || undefined });
  const puedeCrear = sesion?.rol === ROL_ELABORADOR;

  const porcentaje =
    cobertura.data && cobertura.data.criticos > 0
      ? (cobertura.data.conPlan / cobertura.data.criticos) * 100
      : 0;

  const crear = (idPuesto?: number) => {
    setPuestoInicial(idPuesto);
    setCreando(true);
  };

  return (
    <PaginaEnConstruccion
      titulo="Sucesión"
      descripcion="Planes de sucesión y candidatos de los puestos críticos."
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 3, alignItems: { sm: 'center' } }}
      >
        <TextField
          select
          size="small"
          label="Unidad"
          value={idUnidad}
          onChange={(e) => setIdUnidad(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {(unidades ?? []).map((u) => (
            <MenuItem key={u.id} value={String(u.id)}>
              {u.denominacion}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Estado del plan"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {CODIGOS_ESTADO_PLAN.map((c) => (
            <MenuItem key={c} value={c}>
              {etiquetaEstadoPlan(c)}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ flexGrow: 1 }} />
        {puedeCrear && (
          <Button variant="contained" onClick={() => crear()}>
            Crear plan
          </Button>
        )}
      </Stack>

      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" gutterBottom>
          {cobertura.data
            ? `${cobertura.data.conPlan} de ${cobertura.data.criticos} puestos críticos con plan de sucesión aprobado`
            : cobertura.isError
              ? 'No se pudo calcular la cobertura'
              : 'Calculando cobertura…'}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={porcentaje}
          aria-label="Cobertura de planes de sucesión"
        />
      </Box>

      <Typography variant="h6" component="h2" gutterBottom>
        Puestos críticos sin plan aprobado
      </Typography>
      {cobertura.data && cobertura.data.sinPlan.length === 0 ? (
        cobertura.data.criticos === 0 ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            Todavía no hay puestos críticos evaluados.
          </Alert>
        ) : (
          <Alert severity="success" sx={{ mb: 3 }}>
            Todos los puestos críticos tienen plan aprobado.
          </Alert>
        )
      ) : (
        cobertura.data && (
          <Table size="small" sx={{ mb: 3 }}>
            <TableHead>
              <TableRow>
                <TableCell>Puesto</TableCell>
                <TableCell>Plan en elaboración</TableCell>
                {puedeCrear && <TableCell align="right">Acciones</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {cobertura.data.sinPlan.map((s) => (
                <TableRow key={s.idPuesto}>
                  <TableCell>
                    {s.codigo} — {s.denominacion}
                  </TableCell>
                  <TableCell>
                    {s.idPlanEnElaboracion && s.estadoPlanEnElaboracion ? (
                      <Link
                        component={RouterLink}
                        to={`/sucesion/planes/${s.idPlanEnElaboracion}`}
                      >
                        {etiquetaEstadoPlan(s.estadoPlanEnElaboracion)}
                      </Link>
                    ) : (
                      'Sin plan'
                    )}
                  </TableCell>
                  {puedeCrear && (
                    <TableCell align="right">
                      {!s.idPlanEnElaboracion && (
                        <Button size="small" onClick={() => crear(s.idPuesto)}>
                          Crear plan
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
      )}

      <Typography variant="h6" component="h2" gutterBottom>
        Planes de sucesión
      </Typography>
      {planes.isLoading && <CircularProgress aria-label="Cargando" />}
      {planes.isError && (
        <Alert severity="error">No se pudieron cargar los planes.</Alert>
      )}
      {planes.data && planes.data.length === 0 && (
        <Alert severity="info">No hay planes para estos filtros.</Alert>
      )}
      {planes.data && planes.data.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Puesto</TableCell>
              <TableCell>Responsable</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Candidatos</TableCell>
              <TableCell>Elaborado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {planes.data.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell>
                  <Link component={RouterLink} to={`/sucesion/planes/${p.id}`}>
                    {p.codigoPuesto} — {p.denominacionPuesto}
                  </Link>
                </TableCell>
                <TableCell>{p.nombreResponsable}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={etiquetaEstadoPlan(p.estado)}
                    color={colorEstadoPlan(p.estado)}
                  />
                </TableCell>
                <TableCell>{p.cantidadCandidatos}</TableCell>
                <TableCell>{p.fechaElaboracion}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {creando && (
        <CrearPlanDialog
          idPuesto={puestoInicial}
          onCreado={(id) => navegar(`/sucesion/planes/${id}`)}
          onCerrar={() => setCreando(false)}
        />
      )}
    </PaginaEnConstruccion>
  );
}
