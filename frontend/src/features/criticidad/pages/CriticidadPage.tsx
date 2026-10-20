import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
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
import { useSesion } from '../../../auth/useSesion';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { useUnidades } from '../../estructura/hooks/useUnidades';
import { EvaluarDialog } from '../components/EvaluarDialog';
import { useAvance, usePares, type Par } from '../hooks/useCriticidad';
import { colorNivel } from '../niveles';

type Estado = 'todos' | 'pendiente' | 'evaluado';

/** Pares conocimiento-puesto con su criticidad vigente y el avance de OE5. */
export function CriticidadPage() {
  const { data: sesion } = useSesion();
  const { data: unidades } = useUnidades();
  const { data: niveles } = useValoresReferencia('nivel-criticidad', true);
  const [idUnidad, setIdUnidad] = useState('');
  const [estado, setEstado] = useState<Estado>('todos');
  const [texto, setTexto] = useState('');
  const [elegido, setElegido] = useState<Par>();

  const unidad = idUnidad ? Number(idUnidad) : undefined;
  const pares = usePares({
    idUnidad: unidad,
    estado: estado === 'todos' ? undefined : estado,
  });
  const avance = useAvance({ idUnidad: unidad });
  // La autoridad consulta pero no evalúa (RF24).
  const puedeEvaluar = [
    'recursos_humanos',
    'jefatura_departamento',
    'jefe_catedra',
  ].includes(sesion?.rol ?? '');

  const buscado = texto.trim().toLowerCase();
  const filas = (pares.data ?? []).filter(
    (p) =>
      !buscado ||
      `${p.codigoPuesto} ${p.denominacionPuesto} ${p.denominacionConocimiento}`
        .toLowerCase()
        .includes(buscado),
  );
  const porcentaje =
    avance.data && avance.data.total > 0
      ? (avance.data.evaluados / avance.data.total) * 100
      : 0;

  return (
    <PaginaEnConstruccion
      titulo="Criticidad"
      descripcion="Impacto de pérdida y dificultad de reemplazo de cada conocimiento que exige un puesto."
    >
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" gutterBottom>
          {avance.data
            ? `${avance.data.evaluados} de ${avance.data.total} pares evaluados`
            : avance.isError
              ? 'No se pudo calcular el avance'
              : 'Calculando avance…'}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={porcentaje}
          aria-label="Avance de la evaluación"
        />
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
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
          label="Estado"
          value={estado}
          onChange={(e) => setEstado(e.target.value as Estado)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="todos">Todos</MenuItem>
          <MenuItem value="pendiente">Pendientes</MenuItem>
          <MenuItem value="evaluado">Evaluados</MenuItem>
        </TextField>
        <TextField
          size="small"
          label="Buscar puesto o conocimiento"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          sx={{ flexGrow: 1 }}
        />
      </Stack>

      {pares.isLoading && <CircularProgress aria-label="Cargando" />}
      {pares.isError && (
        <Alert severity="error">No se pudieron cargar los pares.</Alert>
      )}
      {pares.data && filas.length === 0 && (
        <Alert severity="info">No hay pares para estos filtros.</Alert>
      )}
      {filas.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Puesto</TableCell>
              <TableCell>Conocimiento</TableCell>
              <TableCell>Carácter</TableCell>
              <TableCell>Criticidad</TableCell>
              <TableCell>Evaluado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filas.map((p) => {
              const nivel = niveles?.find((n) => n.id === p.idNivelCriticidad);
              return (
                <TableRow key={`${p.idPuesto}-${p.idConocimiento}`}>
                  <TableCell>
                    {p.codigoPuesto} — {p.denominacionPuesto}
                  </TableCell>
                  <TableCell>{p.denominacionConocimiento}</TableCell>
                  <TableCell>
                    {p.esExcluyente ? 'Excluyente' : 'Deseable'}
                  </TableCell>
                  <TableCell>
                    {nivel ? (
                      <Chip
                        size="small"
                        label={nivel.denominacion}
                        color={colorNivel(nivel.codigo)}
                      />
                    ) : (
                      <Chip
                        size="small"
                        variant="outlined"
                        label="Sin evaluar"
                      />
                    )}
                  </TableCell>
                  <TableCell>{p.fechaEvaluacion ?? '—'}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setElegido(p)}>
                      {puedeEvaluar ? 'Evaluar' : 'Ver'}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {elegido && (
        <EvaluarDialog
          idPuesto={elegido.idPuesto}
          idConocimiento={elegido.idConocimiento}
          titulo={`${elegido.denominacionPuesto} · ${elegido.denominacionConocimiento}`}
          puedeEvaluar={puedeEvaluar}
          onCerrar={() => setElegido(undefined)}
        />
      )}
    </PaginaEnConstruccion>
  );
}
