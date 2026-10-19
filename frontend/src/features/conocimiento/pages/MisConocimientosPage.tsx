import {
  Alert,
  Autocomplete,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useSesion } from '../../../auth/useSesion';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { FilaMiConocimiento } from '../components/FilaMiConocimiento';
import { useConocimientos, type Conocimiento } from '../hooks/useConocimientos';
import {
  useMisConocimientos,
  type MiConocimiento,
} from '../hooks/useMisConocimientos';
import { descripcionNivel } from '../niveles';

/** Una fila sin nada registrado, para un conocimiento que la persona suma a mano. */
const filaVacia = (c: Conocimiento): MiConocimiento => ({
  idConocimiento: c.id,
  denominacion: c.denominacion,
  idTipoConocimiento: c.idTipoConocimiento,
  idNivelRequerido: null,
  esExcluyente: false,
  puestos: [],
  idNivelDeclarado: null,
  fechaDeclaracion: null,
  idNivelAcreditado: null,
  fechaEvaluacion: null,
  idTipoEvidencia: null,
  pendiente: false,
});

/**
 * Una sola pantalla para declarar los conocimientos, sin pasos ni vocabulario
 * técnico (RNF06). Parte de los requisitos de los puestos que la persona ocupa hoy.
 */
export function MisConocimientosPage() {
  const { data: sesion } = useSesion();
  const idPersona = sesion?.idPersona ?? null;
  const {
    data: filas,
    isLoading,
    isError,
  } = useMisConocimientos(idPersona !== null);
  const { data: activos } = useValoresReferencia('nivel-dominio', false);
  const { data: todos } = useValoresReferencia('nivel-dominio', true);
  const { data: evidencias } = useValoresReferencia('tipo-evidencia', true);
  const { data: catalogo } = useConocimientos({ activo: true });
  const [extras, setExtras] = useState<Conocimiento[]>([]);

  if (idPersona === null) {
    return (
      <PaginaEnConstruccion titulo="Mis conocimientos" descripcion="">
        <Alert severity="warning">
          Tu usuario todavía no tiene una persona vinculada. Pedile al
          administrador que la asigne.
        </Alert>
      </PaginaEnConstruccion>
    );
  }

  const niveles = [...(activos ?? [])].sort(
    (a, b) => (a.orden ?? a.id) - (b.orden ?? b.id),
  );
  const registrados = new Set((filas ?? []).map((f) => f.idConocimiento));
  const sumados = extras.filter((c) => !registrados.has(c.id));
  const todasLasFilas = [...(filas ?? []), ...sumados.map(filaVacia)];
  const ofrecidos = (catalogo ?? []).filter(
    (c) => !registrados.has(c.id) && !extras.some((e) => e.id === c.id),
  );

  return (
    <PaginaEnConstruccion
      titulo="Mis conocimientos"
      descripcion="Elegí el nivel que te describe en cada conocimiento. Tu jefe de cátedra lo va a confirmar más adelante."
    >
      <Stack spacing={2}>
        <Alert severity="info" icon={false}>
          <Typography variant="subtitle2" gutterBottom>
            Qué significa cada nivel
          </Typography>
          {niveles.map((n) => (
            <Typography key={n.id} variant="body2">
              <strong>{n.denominacion}:</strong> {descripcionNivel(n.codigo)}
            </Typography>
          ))}
        </Alert>

        {isLoading && <CircularProgress aria-label="Cargando" />}
        {isError && (
          <Alert severity="error">
            No se pudieron cargar tus conocimientos.
          </Alert>
        )}
        {filas && filas.length === 0 && sumados.length === 0 && (
          <Alert severity="info">
            Tus puestos todavía no tienen requisitos cargados. Podés sumar
            conocimientos a mano desde el buscador de abajo.
          </Alert>
        )}

        {todasLasFilas.map((fila) => (
          <FilaMiConocimiento
            key={fila.idConocimiento}
            fila={fila}
            idPersona={idPersona}
            niveles={niveles}
            todosLosNiveles={todos ?? []}
            tiposEvidencia={evidencias ?? []}
          />
        ))}

        <Autocomplete
          size="small"
          options={ofrecidos}
          value={null}
          onChange={(_, c) =>
            c && setExtras((anteriores) => [...anteriores, c])
          }
          getOptionLabel={(c) => c.denominacion}
          noOptionsText="No hay más conocimientos en el catálogo"
          renderInput={(p) => (
            <TextField
              {...p}
              label="Sumar otro conocimiento del catálogo"
              helperText="Si no lo encontrás, pedile al analista de puestos que lo agregue al catálogo"
            />
          )}
        />
      </Stack>
    </PaginaEnConstruccion>
  );
}
