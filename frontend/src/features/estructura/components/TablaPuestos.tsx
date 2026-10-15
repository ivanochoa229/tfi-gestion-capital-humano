import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import {
  useCambiarEstadoPuesto,
  useCrearPuestosTipo,
  usePuestos,
  type Puesto,
} from '../hooks/usePuestos';
import type { UnidadArbol } from '../hooks/useUnidades';
import { FormularioPuesto } from './FormularioPuesto';
import { OcupantesPuestoDialog } from './OcupantesPuestoDialog';

interface Props {
  unidad: UnidadArbol;
  unidadesValidas: number[];
  /** Solo el analista de puestos escribe. */
  puedeEditar: boolean;
  /** El docente no ve a los ocupantes de otros puestos. */
  puedeVerOcupantes: boolean;
}

export function TablaPuestos({
  unidad,
  unidadesValidas,
  puedeEditar,
  puedeVerOcupantes,
}: Props) {
  const { data: todos, isLoading, isError } = usePuestos();
  const { data: niveles } = useValoresReferencia('nivel-jerarquico', true);
  const cambiarEstado = useCambiarEstadoPuesto();
  const crearTipo = useCrearPuestosTipo();
  const [formulario, setFormulario] = useState<{ puesto?: Puesto } | null>(
    null,
  );
  const [verOcupantes, setVerOcupantes] = useState<Puesto>();
  const [verBajas, setVerBajas] = useState(false);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string>();
  const [avisos, setAvisos] = useState<string[]>([]);

  if (isLoading) return <CircularProgress aria-label="Cargando" />;
  if (isError || !todos) {
    return <Alert severity="error">No se pudieron cargar los puestos.</Alert>;
  }

  const porId = new Map(todos.map((p) => [p.id, p]));
  const nombreNivel = (id: number) =>
    niveles?.find((n) => n.id === id)?.denominacion ?? String(id);
  const buscado = texto.trim().toLowerCase();
  const filas = todos.filter(
    (p) =>
      p.idUnidad === unidad.id &&
      (verBajas || p.activo) &&
      (buscado === '' ||
        p.codigo.toLowerCase().includes(buscado) ||
        p.denominacion.toLowerCase().includes(buscado)),
  );

  const alternar = async (puesto: Puesto) => {
    setError(undefined);
    try {
      await cambiarEstado.mutateAsync({
        id: puesto.id,
        accion: puesto.activo ? 'baja' : 'reactivar',
      });
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const crearPuestosTipo = async () => {
    setError(undefined);
    setAvisos([]);
    try {
      const resultado = await crearTipo.mutateAsync(unidad.id);
      setAvisos(resultado.advertencias);
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const esCatedra = unidad.tipo === 'catedra';

  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h2">
        Puestos de {unidad.denominacion}
      </Typography>
      {error && (
        <Alert severity="error" onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      {avisos.map((aviso) => (
        <Alert key={aviso} severity="warning">
          {aviso}
        </Alert>
      ))}
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <TextField
          size="small"
          label="Buscar por código o denominación"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <FormControlLabel
          control={
            <Switch
              checked={verBajas}
              onChange={(e) => setVerBajas(e.target.checked)}
            />
          }
          label="Ver dados de baja"
        />
        <span style={{ flexGrow: 1 }} />
        {puedeEditar && esCatedra && unidad.activo && (
          <Button onClick={crearPuestosTipo} disabled={crearTipo.isPending}>
            Crear puestos tipo
          </Button>
        )}
        {puedeEditar && unidad.activo && (
          <Button variant="contained" onClick={() => setFormulario({})}>
            Nuevo puesto
          </Button>
        )}
      </Stack>
      {filas.length === 0 ? (
        <Alert severity="info">
          Esta unidad no tiene puestos para mostrar.
        </Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Denominación</TableCell>
              <TableCell>Nivel</TableCell>
              <TableCell>Superior</TableCell>
              <TableCell>Estado</TableCell>
              {(puedeEditar || puedeVerOcupantes) && (
                <TableCell align="right">Acciones</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {filas.map((p) => {
              const superior =
                p.idPuestoSuperior === null
                  ? undefined
                  : porId.get(p.idPuestoSuperior);
              return (
                <TableRow key={p.id}>
                  <TableCell>{p.codigo}</TableCell>
                  <TableCell>{p.denominacion}</TableCell>
                  <TableCell>{nombreNivel(p.idNivelJerarquico)}</TableCell>
                  <TableCell>
                    {superior
                      ? `${superior.codigo} · ${superior.denominacion}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={p.activo ? 'Activo' : 'De baja'}
                      color={p.activo ? 'success' : 'default'}
                    />
                  </TableCell>
                  {(puedeEditar || puedeVerOcupantes) && (
                    <TableCell align="right">
                      {puedeVerOcupantes && (
                        <Button size="small" onClick={() => setVerOcupantes(p)}>
                          Ocupantes
                        </Button>
                      )}
                      {puedeEditar && (
                        <>
                          <Button
                            size="small"
                            onClick={() => setFormulario({ puesto: p })}
                          >
                            Editar
                          </Button>
                          <Button size="small" onClick={() => alternar(p)}>
                            {p.activo ? 'Dar de baja' : 'Reactivar'}
                          </Button>
                        </>
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
        <FormularioPuesto
          idUnidad={unidad.id}
          unidadesValidas={unidadesValidas}
          puesto={formulario.puesto}
          onCerrar={() => setFormulario(null)}
        />
      )}
      {verOcupantes && (
        <OcupantesPuestoDialog
          puesto={verOcupantes}
          onCerrar={() => setVerOcupantes(undefined)}
        />
      )}
    </Stack>
  );
}
