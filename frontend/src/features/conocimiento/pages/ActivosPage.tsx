import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { useSesion } from '../../../auth/useSesion';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { useUnidades } from '../../estructura/hooks/useUnidades';
import { puedeEscribirActivos } from '../activos';
import { BajaActivoDialog } from '../components/BajaActivoDialog';
import { ChipVigencia } from '../components/ChipVigencia';
import { FormularioActivo } from '../components/FormularioActivo';
import { ReemplazarArchivoDialog } from '../components/ReemplazarArchivoDialog';
import {
  descargarActivo,
  useActivos,
  useCambiarEstadoActivo,
  type Activo,
} from '../hooks/useActivos';
import { useConocimientos } from '../hooks/useConocimientos';

const TAMANIO_PAGINA = 20;

/** Documentación que respalda los conocimientos (RF11). Todos consultan y descargan; escriben los roles de `puedeEscribirActivos`. */
export function ActivosPage() {
  const { data: sesion } = useSesion();
  const puedeEscribir = puedeEscribirActivos(sesion?.rol);
  const { data: tipos } = useValoresReferencia('tipo-documento', true);
  const { data: unidades } = useUnidades(true);
  const { data: conocimientos } = useConocimientos({});
  const cambiarEstado = useCambiarEstadoActivo();

  const [texto, setTexto] = useState('');
  const [idTipo, setIdTipo] = useState('');
  const [idUnidad, setIdUnidad] = useState('');
  const [idConocimiento, setIdConocimiento] = useState('');
  const [soloVencidos, setSoloVencidos] = useState(false);
  const [verBajas, setVerBajas] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [formulario, setFormulario] = useState<{ activo?: Activo } | null>(
    null,
  );
  const [reemplazando, setReemplazando] = useState<Activo>();
  const [dandoDeBaja, setDandoDeBaja] = useState<Activo>();
  const [error, setError] = useState<string>();

  const { data, isLoading, isError } = useActivos({
    q: texto.trim() || undefined,
    idTipoDocumento: idTipo ? Number(idTipo) : undefined,
    idUnidad: idUnidad ? Number(idUnidad) : undefined,
    idConocimiento: idConocimiento ? Number(idConocimiento) : undefined,
    vencido: soloVencidos ? true : undefined,
    incluirBajas: puedeEscribir && verBajas ? true : undefined,
    pagina: pagina + 1,
    tamanio: TAMANIO_PAGINA,
  });

  const nombre = (
    lista: { id: number; denominacion: string }[] | undefined,
    id: number,
  ) => lista?.find((v) => v.id === id)?.denominacion ?? String(id);

  const intentar = async (accion: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await accion();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const filtrar = (cambiar: () => void) => {
    cambiar();
    setPagina(0);
  };

  return (
    <PaginaEnConstruccion
      titulo="Activos de conocimiento"
      descripcion="Manuales, instructivos y procedimientos que documentan los conocimientos de la facultad."
    >
      <Stack spacing={2}>
        {error && (
          <Alert severity="error" onClose={() => setError(undefined)}>
            {error}
          </Alert>
        )}
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <TextField
            size="small"
            label="Buscar por título"
            value={texto}
            onChange={(e) => filtrar(() => setTexto(e.target.value))}
          />
          <TextField
            select
            size="small"
            label="Tipo"
            value={idTipo}
            onChange={(e) => filtrar(() => setIdTipo(e.target.value))}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {(tipos ?? []).map((t) => (
              <MenuItem key={t.id} value={String(t.id)}>
                {t.denominacion}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Unidad"
            value={idUnidad}
            onChange={(e) => filtrar(() => setIdUnidad(e.target.value))}
            sx={{ minWidth: 200 }}
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
            label="Conocimiento"
            value={idConocimiento}
            onChange={(e) => filtrar(() => setIdConocimiento(e.target.value))}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {(conocimientos ?? []).map((c) => (
              <MenuItem key={c.id} value={String(c.id)}>
                {c.denominacion}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Switch
                checked={soloVencidos}
                onChange={(e) =>
                  filtrar(() => setSoloVencidos(e.target.checked))
                }
              />
            }
            label="Solo vencidos"
          />
          {puedeEscribir && (
            <FormControlLabel
              control={
                <Switch
                  checked={verBajas}
                  onChange={(e) => filtrar(() => setVerBajas(e.target.checked))}
                />
              }
              label="Ver dados de baja"
            />
          )}
          <span style={{ flexGrow: 1 }} />
          {puedeEscribir && (
            <Button variant="contained" onClick={() => setFormulario({})}>
              Nuevo activo
            </Button>
          )}
        </Stack>

        {isLoading && <CircularProgress aria-label="Cargando" />}
        {isError && (
          <Alert severity="error">No se pudieron cargar los activos.</Alert>
        )}
        {data && data.total === 0 && (
          <Alert severity="info">No hay activos para mostrar.</Alert>
        )}
        {data && data.total > 0 && (
          <>
            {data.items.length > 0 && (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Título</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Unidad</TableCell>
                    <TableCell>Conocimientos</TableCell>
                    <TableCell>Vigencia</TableCell>
                    <TableCell>Origen</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        {a.titulo}{' '}
                        {!a.activo && <Chip size="small" label="De baja" />}
                      </TableCell>
                      <TableCell>{nombre(tipos, a.idTipoDocumento)}</TableCell>
                      <TableCell>{nombre(unidades, a.idUnidad)}</TableCell>
                      <TableCell>
                        {a.idsConocimiento
                          .map((id) => nombre(conocimientos, id))
                          .join(', ')}
                      </TableCell>
                      <TableCell>
                        {a.fechaVigencia ?? '—'} <ChipVigencia activo={a} />
                      </TableCell>
                      <TableCell>
                        {a.origen === 'archivo' ? 'Archivo' : 'Enlace'}
                      </TableCell>
                      <TableCell align="right">
                        {a.origen === 'enlace' ? (
                          <Button
                            size="small"
                            component="a"
                            href={a.enlace ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Abrir
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            onClick={() => intentar(() => descargarActivo(a))}
                          >
                            Descargar
                          </Button>
                        )}
                        {puedeEscribir && (
                          <>
                            {a.activo && (
                              <Button
                                size="small"
                                onClick={() => setFormulario({ activo: a })}
                              >
                                Editar
                              </Button>
                            )}
                            {a.activo && a.origen === 'archivo' && (
                              <Button
                                size="small"
                                onClick={() => setReemplazando(a)}
                              >
                                Reemplazar archivo
                              </Button>
                            )}
                            {a.activo ? (
                              <Button
                                size="small"
                                onClick={() => setDandoDeBaja(a)}
                              >
                                Dar de baja
                              </Button>
                            ) : (
                              <Button
                                size="small"
                                onClick={() =>
                                  intentar(() =>
                                    cambiarEstado.mutateAsync({
                                      id: a.id,
                                      accion: 'reactivar',
                                    }),
                                  )
                                }
                              >
                                Reactivar
                              </Button>
                            )}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <TablePagination
              component="div"
              count={data.total}
              page={pagina}
              rowsPerPage={TAMANIO_PAGINA}
              rowsPerPageOptions={[TAMANIO_PAGINA]}
              onPageChange={(_, p) => setPagina(p)}
              labelDisplayedRows={({ from, to, count }) =>
                `${from}–${to} de ${count}`
              }
            />
          </>
        )}
      </Stack>
      {formulario && (
        <FormularioActivo
          activo={formulario.activo}
          onCerrar={() => setFormulario(null)}
        />
      )}
      {reemplazando && (
        <ReemplazarArchivoDialog
          activo={reemplazando}
          onCerrar={() => setReemplazando(undefined)}
        />
      )}
      {dandoDeBaja && (
        <BajaActivoDialog
          activo={dandoDeBaja}
          onCerrar={() => setDandoDeBaja(undefined)}
        />
      )}
    </PaginaEnConstruccion>
  );
}
