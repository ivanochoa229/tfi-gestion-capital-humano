import {
  Alert,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useSearchParams } from 'react-router';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { usePuestos } from '../../estructura/hooks/usePuestos';
import { usePersonas } from '../../personas/hooks/usePersonas';
import { ListadoConPestanias } from '../components/ListadoConPestanias';
import { TablaBrecha } from '../components/TablaBrecha';
import {
  useBrecha,
  useMiBrecha,
  type FiltroBrecha,
} from '../hooks/useDeteccion';

/**
 * RF19: Brecha de perfil por persona y puesto (para roles de gestión y lectura)
 * y «Mi brecha» para la persona de la sesión (docente y jefaturas).
 */
export function BrechaPage({
  modo = 'gestion',
}: {
  modo?: 'gestion' | 'propia';
}) {
  if (modo === 'propia') {
    return <MiBrechaVista />;
  }
  return <BrechaGestionVista />;
}

function MiBrechaVista() {
  const consulta = useMiBrecha();

  return (
    <PaginaEnConstruccion
      titulo="Mi brecha de perfil (RF19)"
      descripcion="Comparación entre los conocimientos requeridos por los puestos que ocupás hoy y por los planes de sucesión aprobados en los que figurás como candidato, frente a tus niveles acreditados."
    >
      <Alert severity="info" sx={{ mb: 2 }}>
        Un requisito figura como <strong>«Sin acreditar»</strong> cuando todavía
        no cuenta con un nivel acreditado vigente por tu jefatura (OE4). El
        nivel que declaraste se muestra como referencia, pero para cubrir el
        requisito se toma únicamente el nivel acreditado.
      </Alert>

      {consulta.isPending ? (
        <CircularProgress aria-label="Cargando tu brecha de perfil" />
      ) : consulta.isError ? (
        <Alert severity="error">{consulta.error.message}</Alert>
      ) : (
        <TablaBrecha filas={consulta.data} mostrarDeclarado />
      )}
    </PaginaEnConstruccion>
  );
}

function BrechaGestionVista() {
  const [parametros, setParametros] = useSearchParams();
  const idUnidad = parametros.get('idUnidad') ?? '';
  const idPersona = parametros.get('idPersona') ?? '';
  const idPuesto = parametros.get('idPuesto') ?? '';
  const contextoParam = parametros.get('contexto') ?? '';

  const { data: personas } = usePersonas({});
  const { data: puestos } = usePuestos();

  const unidadNum = idUnidad ? Number(idUnidad) : undefined;
  const personaNum = idPersona ? Number(idPersona) : undefined;
  const puestoNum = idPuesto ? Number(idPuesto) : undefined;
  const contextoFiltro = (
    contextoParam === 'ocupante' || contextoParam === 'candidato'
      ? contextoParam
      : undefined
  ) as FiltroBrecha['contexto'];

  const consulta = useBrecha({
    idUnidad: unidadNum,
    idPersona: personaNum,
    idPuesto: puestoNum,
    contexto: contextoFiltro,
  });

  const actualizarParametro = (clave: string, valor: string) => {
    const siguientes = new URLSearchParams(parametros);
    if (valor) {
      siguientes.set(clave, valor);
    } else {
      siguientes.delete(clave);
    }
    setParametros(siguientes);
  };

  const puestosFiltrados = (puestos ?? []).filter(
    (p) => !unidadNum || p.idUnidad === unidadNum,
  );

  return (
    <ListadoConPestanias
      titulo="Brecha de perfil por persona y puesto (RF19)"
      descripcion="Comparación entre el perfil de conocimientos exigido por cada puesto y el nivel acreditado vigente de sus ocupantes o candidatos."
      idUnidad={idUnidad}
      onCambiarUnidad={(v) => actualizarParametro('idUnidad', v)}
      filtrosExtra={
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            select
            size="small"
            label="Persona"
            value={idPersona}
            onChange={(e) => actualizarParametro('idPersona', e.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">Todas las personas</MenuItem>
            {(personas ?? []).map((p) => (
              <MenuItem key={p.id} value={String(p.id)}>
                {p.apellido}, {p.nombre}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Puesto"
            value={idPuesto}
            onChange={(e) => actualizarParametro('idPuesto', e.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">Todos los puestos</MenuItem>
            {puestosFiltrados.map((p) => (
              <MenuItem key={p.id} value={String(p.id)}>
                {p.codigo} — {p.denominacion}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Contexto"
            value={contextoParam}
            onChange={(e) => actualizarParametro('contexto', e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Ocupantes y candidatos</MenuItem>
            <MenuItem value="ocupante">Solo ocupantes</MenuItem>
            <MenuItem value="candidato">Solo candidatos</MenuItem>
          </TextField>
        </Stack>
      }
    >
      <Alert severity="info" sx={{ mb: 2 }}>
        Un conocimiento figura como <strong>«Sin acreditar»</strong> cuando la
        persona no tiene un nivel acreditado vigente para él; el faltante es el
        nivel requerido completo y cuenta como no cubierto.
      </Alert>

      {consulta.isPending ? (
        <CircularProgress aria-label="Cargando brecha de perfil" />
      ) : consulta.isError ? (
        <Alert severity="error">{consulta.error.message}</Alert>
      ) : (
        <TablaBrecha filas={consulta.data} />
      )}
    </ListadoConPestanias>
  );
}
