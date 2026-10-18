import {
  Alert,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import {
  useQuitarCandidato,
  useReordenarCandidatos,
  type Candidato,
} from '../hooks/useSucesion';
import { AgregarCandidatoDialog } from './AgregarCandidatoDialog';
import { SeguimientoDialog } from './SeguimientoDialog';

interface Props {
  idPlan: number;
  candidatos: Candidato[];
  /** Agregar, quitar y reordenar: jefatura y plan en borrador. */
  puedeEstructurar: boolean;
  /** Seguimiento: jefatura y plan en borrador o aprobado. */
  puedeSeguir: boolean;
}

function textoDiscrepancia(c: Candidato, estado: string): string {
  return c.excluyentesSinCubrir > 0
    ? `Jefatura: ${estado}, pero faltan ${c.excluyentesSinCubrir} de ${c.totalExcluyentes} excluyentes`
    : `Jefatura: ${estado}, pero cubre todos los excluyentes`;
}

export function CandidatosTabla({
  idPlan,
  candidatos,
  puedeEstructurar,
  puedeSeguir,
}: Props) {
  const { data: estados } = useValoresReferencia('estado-preparacion', true);
  const reordenar = useReordenarCandidatos();
  const quitar = useQuitarCandidato();
  const [agregando, setAgregando] = useState(false);
  const [siguiendo, setSiguiendo] = useState<Candidato>();
  const [error, setError] = useState<string>();

  const ordenados = [...candidatos].sort((a, b) => a.prioridad - b.prioridad);
  const etiqueta = (codigo: string) =>
    estados?.find((e) => e.codigo === codigo)?.denominacion ?? codigo;

  const mover = async (indice: number, delta: -1 | 1) => {
    const orden = ordenados.map((c) => c.idPersona);
    [orden[indice], orden[indice + delta]] = [
      orden[indice + delta],
      orden[indice],
    ];
    setError(undefined);
    try {
      await reordenar.mutateAsync({ idPlan, orden });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const sacar = async (c: Candidato) => {
    setError(undefined);
    try {
      await quitar.mutateAsync({ idPlan, idPersona: c.idPersona });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
      >
        <Typography variant="h6" component="h2">
          Candidatos
        </Typography>
        {puedeEstructurar && (
          <Button variant="outlined" onClick={() => setAgregando(true)}>
            Agregar candidato
          </Button>
        )}
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}
      {ordenados.length === 0 ? (
        <Alert severity="info">El plan todavía no tiene candidatos.</Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Prioridad</TableCell>
              <TableCell>Apellido y nombre</TableCell>
              <TableCell>Preparación</TableCell>
              <TableCell>Fecha estimada</TableCell>
              <TableCell>Marcas</TableCell>
              {(puedeEstructurar || puedeSeguir) && (
                <TableCell align="right">Acciones</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {ordenados.map((c, i) => (
              <TableRow key={c.idPersona}>
                <TableCell>{c.prioridad}</TableCell>
                <TableCell>
                  {c.apellido}, {c.nombre}
                </TableCell>
                <TableCell>{etiqueta(c.estadoPreparacion)}</TableCell>
                <TableCell>{c.fechaDisponibilidadEstimada ?? '—'}</TableCell>
                <TableCell>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    useFlexGap
                    sx={{ flexWrap: 'wrap' }}
                  >
                    {c.discrepancia && (
                      <Chip
                        size="small"
                        color="warning"
                        label={textoDiscrepancia(
                          c,
                          etiqueta(c.estadoPreparacion),
                        )}
                      />
                    )}
                    {c.aRevisar && (
                      <Tooltip title="Hoy ocupa el puesto del plan o ya no tiene ocupación vigente">
                        <Chip size="small" color="error" label="A revisar" />
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
                {(puedeEstructurar || puedeSeguir) && (
                  <TableCell align="right">
                    {puedeEstructurar && (
                      <>
                        <Button
                          size="small"
                          aria-label={`Subir prioridad de ${c.apellido}`}
                          disabled={i === 0 || reordenar.isPending}
                          onClick={() => mover(i, -1)}
                        >
                          Subir
                        </Button>
                        <Button
                          size="small"
                          aria-label={`Bajar prioridad de ${c.apellido}`}
                          disabled={
                            i === ordenados.length - 1 || reordenar.isPending
                          }
                          onClick={() => mover(i, 1)}
                        >
                          Bajar
                        </Button>
                      </>
                    )}
                    {puedeSeguir && (
                      <Button size="small" onClick={() => setSiguiendo(c)}>
                        Seguimiento
                      </Button>
                    )}
                    {puedeEstructurar && (
                      <Button
                        size="small"
                        color="error"
                        disabled={quitar.isPending}
                        onClick={() => sacar(c)}
                      >
                        Quitar
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {agregando && (
        <AgregarCandidatoDialog
          idPlan={idPlan}
          candidatos={candidatos}
          onCerrar={() => setAgregando(false)}
        />
      )}
      {siguiendo && (
        <SeguimientoDialog
          candidato={siguiendo}
          onCerrar={() => setSiguiendo(undefined)}
        />
      )}
    </>
  );
}
