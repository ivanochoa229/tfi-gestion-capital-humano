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
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { usePuestos } from '../../estructura/hooks/usePuestos';
import {
  useAnularOcupacion,
  useOcupacionesDePersona,
  type Ocupacion,
} from '../hooks/useOcupaciones';
import { CerrarOcupacionDialog } from './CerrarOcupacionDialog';
import { FormularioOcupacion } from './FormularioOcupacion';

interface Props {
  idPersona: number;
  /** Solo RR. HH. escribe. */
  puedeEditar: boolean;
  /** Una persona dada de baja no admite ocupaciones nuevas. */
  admiteNuevas: boolean;
}

const COLOR = {
  vigente: 'success',
  futura: 'info',
  pasada: 'default',
} as const;
const ETIQUETA = {
  vigente: 'Vigente',
  futura: 'Futura',
  pasada: 'Historial',
} as const;

export function TablaOcupaciones({
  idPersona,
  puedeEditar,
  admiteNuevas,
}: Props) {
  const {
    data: ocupaciones,
    isLoading,
    isError,
  } = useOcupacionesDePersona(idPersona);
  const { data: puestos } = usePuestos();
  const { data: caracteres } = useValoresReferencia('caracter-ocupacion', true);
  const { data: dedicaciones } = useValoresReferencia('dedicacion', true);
  const anular = useAnularOcupacion();
  const [formulario, setFormulario] = useState<{
    ocupacion?: Ocupacion;
  } | null>(null);
  const [cerrando, setCerrando] = useState<Ocupacion>();
  const [error, setError] = useState<string>();

  if (isLoading) return <CircularProgress aria-label="Cargando" />;
  if (isError || !ocupaciones) {
    return (
      <Alert severity="error">No se pudieron cargar las ocupaciones.</Alert>
    );
  }

  const puesto = (id: number) => puestos?.find((p) => p.id === id);
  const nombre = (
    lista: { id: number; denominacion: string }[] | undefined,
    id: number,
  ) => lista?.find((v) => v.id === id)?.denominacion ?? String(id);

  const anularOcupacion = async (o: Ocupacion) => {
    setError(undefined);
    try {
      await anular.mutateAsync(o);
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center' }}>
        <Typography variant="h6" component="h3" sx={{ flexGrow: 1 }}>
          Ocupaciones
        </Typography>
        {puedeEditar && admiteNuevas && (
          <Button variant="contained" onClick={() => setFormulario({})}>
            Nueva ocupación
          </Button>
        )}
      </Stack>
      {error && (
        <Alert severity="error" onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      {ocupaciones.length === 0 ? (
        <Alert severity="info">
          Esta persona no tiene ocupaciones registradas.
        </Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Puesto</TableCell>
              <TableCell>Desde</TableCell>
              <TableCell>Hasta</TableCell>
              <TableCell>Carácter</TableCell>
              <TableCell>Dedicación</TableCell>
              <TableCell>Estado</TableCell>
              {puedeEditar && <TableCell align="right">Acciones</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {ocupaciones.map((o) => {
              const p = puesto(o.idPuesto);
              return (
                <TableRow key={`${o.idPuesto}-${o.fechaDesde}`}>
                  <TableCell>
                    {p ? `${p.codigo} · ${p.denominacion}` : o.idPuesto}
                  </TableCell>
                  <TableCell>{o.fechaDesde}</TableCell>
                  <TableCell>{o.fechaHasta ?? '—'}</TableCell>
                  <TableCell>
                    {nombre(caracteres, o.idCaracterOcupacion)}
                  </TableCell>
                  <TableCell>{nombre(dedicaciones, o.idDedicacion)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={ETIQUETA[o.estado]}
                      color={COLOR[o.estado]}
                    />
                  </TableCell>
                  {puedeEditar && (
                    <TableCell align="right">
                      {o.estado !== 'pasada' && (
                        <Button
                          size="small"
                          onClick={() => setFormulario({ ocupacion: o })}
                        >
                          Editar
                        </Button>
                      )}
                      {o.estado === 'vigente' && o.fechaHasta === null && (
                        <Button size="small" onClick={() => setCerrando(o)}>
                          Cerrar
                        </Button>
                      )}
                      {o.estado === 'futura' && (
                        <Button size="small" onClick={() => anularOcupacion(o)}>
                          Anular
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {formulario && (
        <FormularioOcupacion
          idPersona={idPersona}
          ocupacion={formulario.ocupacion}
          onCerrar={() => setFormulario(null)}
        />
      )}
      {cerrando && (
        <CerrarOcupacionDialog
          ocupacion={cerrando}
          onCerrar={() => setCerrando(undefined)}
        />
      )}
    </Stack>
  );
}
