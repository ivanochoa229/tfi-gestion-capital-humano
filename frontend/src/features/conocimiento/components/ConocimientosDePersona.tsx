import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useSesion } from '../../../auth/useSesion';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import {
  usePerfilDePersona,
  type FilaPerfil,
} from '../hooks/useAcreditaciones';
import { AcreditarDialog } from './AcreditarDialog';
import { HistorialAcreditacionesDialog } from './HistorialAcreditacionesDialog';

interface Props {
  idPersona: number;
  /** Jefatura y jefes de cátedra; el botón no aparece en el perfil propio. */
  puedeAcreditar: boolean;
}

/** Declarado, acreditado vigente e historial del conocimiento de una persona (RF10). */
export function ConocimientosDePersona({ idPersona, puedeAcreditar }: Props) {
  const { data: sesion } = useSesion();
  const { data: filas, isLoading, isError } = usePerfilDePersona(idPersona);
  const { data: niveles } = useValoresReferencia('nivel-dominio', true);
  const { data: evidencias } = useValoresReferencia('tipo-evidencia', true);
  const [acreditando, setAcreditando] = useState<{ fila?: FilaPerfil } | null>(
    null,
  );
  const [historial, setHistorial] = useState<FilaPerfil>();

  const acreditaAqui = puedeAcreditar && sesion?.idPersona !== idPersona;
  const nombre = (
    lista: { id: number; denominacion: string }[] | undefined,
    id: number | null,
  ) =>
    id === null
      ? '—'
      : (lista?.find((v) => v.id === id)?.denominacion ?? String(id));

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center' }}>
        <Typography variant="h6" component="h3" sx={{ flexGrow: 1 }}>
          Conocimientos
        </Typography>
        {acreditaAqui && (
          <Button onClick={() => setAcreditando({})}>
            Acreditar otro conocimiento
          </Button>
        )}
      </Stack>
      {isLoading && <CircularProgress aria-label="Cargando" />}
      {isError && (
        <Alert severity="warning">
          No tenés acceso al conocimiento de esta persona.
        </Alert>
      )}
      {filas && filas.length === 0 && (
        <Alert severity="info">
          Esta persona todavía no declaró ni tiene conocimientos acreditados.
        </Alert>
      )}
      {filas && filas.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Conocimiento</TableCell>
              <TableCell>Declarado</TableCell>
              <TableCell>Acreditado</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filas.map((f) => (
              <TableRow key={f.idConocimiento}>
                <TableCell>{f.denominacion}</TableCell>
                <TableCell>{nombre(niveles, f.idNivelDeclarado)}</TableCell>
                <TableCell>
                  {f.idNivelAcreditado === null
                    ? '—'
                    : `${nombre(niveles, f.idNivelAcreditado)} · ${f.fechaEvaluacion} · ${nombre(evidencias, f.idTipoEvidencia)}`}
                </TableCell>
                <TableCell>
                  {f.pendiente ? (
                    <Chip
                      size="small"
                      color="warning"
                      label="Pendiente de acreditar"
                    />
                  ) : f.idNivelAcreditado !== null ? (
                    <Chip size="small" color="success" label="Acreditado" />
                  ) : null}
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setHistorial(f)}>
                    Historial
                  </Button>
                  {acreditaAqui && (
                    <Button
                      size="small"
                      onClick={() => setAcreditando({ fila: f })}
                    >
                      Acreditar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {acreditando && (
        <AcreditarDialog
          idPersona={idPersona}
          conocimiento={
            acreditando.fila && {
              id: acreditando.fila.idConocimiento,
              denominacion: acreditando.fila.denominacion,
            }
          }
          onCerrar={() => setAcreditando(null)}
        />
      )}
      {historial && (
        <HistorialAcreditacionesDialog
          idPersona={idPersona}
          idConocimiento={historial.idConocimiento}
          denominacion={historial.denominacion}
          onCerrar={() => setHistorial(undefined)}
        />
      )}
    </Stack>
  );
}
