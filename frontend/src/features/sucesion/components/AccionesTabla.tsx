import {
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { etiquetaEstadoAccion, siguientesEstadosAccion } from '../estados';
import type { Accion } from '../hooks/useSucesion';

interface Props {
  acciones: Accion[];
  /** Si se pasa, se muestra el botón «Avanzar» en las acciones que admiten un paso siguiente. */
  onAvanzar?: (accion: Accion) => void;
  /** Si se pasan, se muestran «Editar» y «Cancelar» en las acciones no finalizadas. */
  onEditar?: (accion: Accion) => void;
  onCancelar?: (accion: Accion) => void;
  /** Decide por acción si el usuario puede avanzarla (responsable o RR. HH.). */
  puedeAvanzar?: (accion: Accion) => boolean;
}

/** Estado de una acción con su chip «Vencida» (la calcula el backend). */
export function EstadoAccion({ accion }: { accion: Accion }) {
  return (
    <>
      {etiquetaEstadoAccion(accion.estado)}{' '}
      {accion.vencida && <Chip size="small" color="error" label="Vencida" />}
    </>
  );
}

/** Tabla de acciones de transferencia, común al plan, a «Acciones» y a «Mi sucesión». */
export function AccionesTabla({
  acciones,
  onAvanzar,
  onEditar,
  onCancelar,
  puedeAvanzar,
}: Props) {
  const conBotones = !!(onAvanzar || onEditar || onCancelar);
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Conocimiento</TableCell>
          <TableCell>Descripción</TableCell>
          <TableCell>Responsable</TableCell>
          <TableCell>Destinatario</TableCell>
          <TableCell>Fecha prevista</TableCell>
          <TableCell>Estado</TableCell>
          {conBotones && <TableCell align="right">Acciones</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {acciones.map((a) => {
          const abierta = siguientesEstadosAccion(a.estado).length > 0;
          return (
            <TableRow key={a.id}>
              <TableCell>{a.denominacionConocimiento}</TableCell>
              <TableCell>
                {a.descripcion}
                {a.notaAvance && (
                  <>
                    <br />
                    <em>Avance: {a.notaAvance}</em>
                  </>
                )}
              </TableCell>
              <TableCell>{a.nombreResponsable}</TableCell>
              <TableCell>{a.nombreDestinatario ?? '—'}</TableCell>
              <TableCell>{a.fechaPrevista}</TableCell>
              <TableCell>
                <EstadoAccion accion={a} />
              </TableCell>
              {conBotones && (
                <TableCell align="right">
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ justifyContent: 'flex-end' }}
                  >
                    {abierta && onAvanzar && puedeAvanzar?.(a) && (
                      <Button size="small" onClick={() => onAvanzar(a)}>
                        Avanzar
                      </Button>
                    )}
                    {abierta && onEditar && (
                      <Button size="small" onClick={() => onEditar(a)}>
                        Editar
                      </Button>
                    )}
                    {abierta && onCancelar && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => onCancelar(a)}
                      >
                        Cancelar
                      </Button>
                    )}
                  </Stack>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
