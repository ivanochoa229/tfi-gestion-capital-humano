import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { useSesion } from '../../../auth/useSesion';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { useConocimientos } from '../../conocimiento/hooks/useConocimientos';
import { AccionDialog } from '../components/AccionDialog';
import { AccionesTabla } from '../components/AccionesTabla';
import { AvanzarAccionDialog } from '../components/AvanzarAccionDialog';
import {
  CODIGOS_ESTADO_ACCION,
  etiquetaEstadoAccion,
  ROL_GESTOR_ACCIONES,
} from '../estados';
import {
  useAcciones,
  useEditarAccion,
  type Accion,
} from '../hooks/useSucesion';

/** Acciones de transferencia de conocimiento (RF15), según el rol. */
export function AccionesPage() {
  const { data: sesion } = useSesion();
  const { data: conocimientos } = useConocimientos();
  const [estado, setEstado] = useState('');
  const [vencidas, setVencidas] = useState('');
  const [idConocimiento, setIdConocimiento] = useState('');
  const [editando, setEditando] = useState<Accion | 'nueva'>();
  const [avanzando, setAvanzando] = useState<Accion>();
  const [cancelando, setCancelando] = useState<Accion>();
  const [errorCancelar, setErrorCancelar] = useState<string>();
  const editar = useEditarAccion();

  const acciones = useAcciones({
    estado: estado || undefined,
    vencidas: vencidas === '' ? undefined : vencidas === 'si',
    idConocimiento: idConocimiento ? Number(idConocimiento) : undefined,
  });

  const esGestor = sesion?.rol === ROL_GESTOR_ACCIONES;
  const esDocente = sesion?.rol === 'docente';
  // El backend solo deja avanzar a recursos humanos y al docente responsable.
  const puedeAvanzar = (a: Accion) =>
    esGestor ||
    (esDocente && !!sesion?.idPersona && a.idResponsable === sesion.idPersona);

  const confirmarCancelar = async () => {
    if (!cancelando) return;
    setErrorCancelar(undefined);
    try {
      await editar.mutateAsync({
        id: cancelando.id,
        cuerpo: { cancelar: true },
      });
      setCancelando(undefined);
    } catch (e) {
      setErrorCancelar((e as Error).message);
    }
  };

  return (
    <PaginaEnConstruccion
      titulo="Acciones"
      descripcion="Acciones de transferencia de conocimiento: responsable, fecha prevista y avance (RF15)."
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 3, alignItems: { sm: 'center' } }}
      >
        <TextField
          select
          size="small"
          label="Estado"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {CODIGOS_ESTADO_ACCION.map((c) => (
            <MenuItem key={c} value={c}>
              {etiquetaEstadoAccion(c)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Vencidas"
          value={vencidas}
          onChange={(e) => setVencidas(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Todas</MenuItem>
          <MenuItem value="si">Solo vencidas</MenuItem>
          <MenuItem value="no">No vencidas</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Conocimiento"
          value={idConocimiento}
          onChange={(e) => setIdConocimiento(e.target.value)}
          sx={{ minWidth: 240 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {(conocimientos ?? []).map((c) => (
            <MenuItem key={c.id} value={String(c.id)}>
              {c.denominacion}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ flexGrow: 1 }} />
        {esGestor && (
          <Button variant="contained" onClick={() => setEditando('nueva')}>
            Nueva acción
          </Button>
        )}
      </Stack>

      {acciones.isPending ? (
        <CircularProgress aria-label="Cargando acciones" />
      ) : acciones.isError ? (
        <Alert severity="error">{acciones.error.message}</Alert>
      ) : acciones.data.length === 0 ? (
        <Alert severity="info">
          No hay acciones para los filtros elegidos.
        </Alert>
      ) : (
        <AccionesTabla
          acciones={acciones.data}
          puedeAvanzar={puedeAvanzar}
          onAvanzar={esGestor || esDocente ? setAvanzando : undefined}
          onEditar={esGestor ? setEditando : undefined}
          onCancelar={
            esGestor
              ? (a) => {
                  setErrorCancelar(undefined);
                  setCancelando(a);
                }
              : undefined
          }
        />
      )}

      {editando && (
        <AccionDialog
          accion={editando === 'nueva' ? undefined : editando}
          onCerrar={() => setEditando(undefined)}
        />
      )}
      {avanzando && (
        <AvanzarAccionDialog
          accion={avanzando}
          onCerrar={() => setAvanzando(undefined)}
        />
      )}
      {cancelando && (
        <Dialog open onClose={() => setCancelando(undefined)}>
          <DialogTitle>Cancelar acción</DialogTitle>
          <DialogContent>
            {errorCancelar && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errorCancelar}
              </Alert>
            )}
            <DialogContentText>
              Se cancelará la acción sobre «
              {cancelando.denominacionConocimiento}
              ». Es un estado final.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCancelando(undefined)}>Volver</Button>
            <Button
              color="error"
              variant="contained"
              disabled={editar.isPending}
              onClick={confirmarCancelar}
            >
              Cancelar acción
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </PaginaEnConstruccion>
  );
}
