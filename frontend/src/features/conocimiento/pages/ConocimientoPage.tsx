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
  TableRow,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { useSesion } from '../../../auth/useSesion';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { ActivosDeConocimientoDialog } from '../components/ActivosDeConocimientoDialog';
import { FormularioConocimiento } from '../components/FormularioConocimiento';
import { FusionarDialog } from '../components/FusionarDialog';
import {
  useCambiarEstadoConocimiento,
  useConocimientos,
  type Conocimiento,
} from '../hooks/useConocimientos';

/** Catálogo único de conocimientos (RF08). Solo el analista de puestos escribe. */
export function ConocimientoPage() {
  const { data: sesion } = useSesion();
  const puedeEditar = sesion?.rol === 'analista_puestos';
  const { data: tipos } = useValoresReferencia('tipo-conocimiento', true);
  const { data: areas } = useValoresReferencia('area-tematica', true);
  const cambiarEstado = useCambiarEstadoConocimiento();

  const [texto, setTexto] = useState('');
  const [idTipo, setIdTipo] = useState('');
  const [idArea, setIdArea] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);
  const [formulario, setFormulario] = useState<{
    conocimiento?: Conocimiento;
  } | null>(null);
  const [fusionando, setFusionando] = useState<Conocimiento>();
  const [documentando, setDocumentando] = useState<Conocimiento>();
  const [error, setError] = useState<string>();

  const { data, isLoading, isError } = useConocimientos({
    q: texto.trim() || undefined,
    idTipo: idTipo ? Number(idTipo) : undefined,
    idArea: idArea ? Number(idArea) : undefined,
    activo: verInactivos ? undefined : true,
  });

  const nombre = (
    lista: { id: number; denominacion: string }[] | undefined,
    id: number,
  ) => lista?.find((v) => v.id === id)?.denominacion ?? String(id);

  const alternar = async (c: Conocimiento) => {
    setError(undefined);
    try {
      await cambiarEstado.mutateAsync({
        id: c.id,
        accion: c.activo ? 'baja' : 'reactivar',
      });
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <PaginaEnConstruccion
      titulo="Catálogo de conocimientos"
      descripcion="Un solo catálogo para toda la facultad: los puestos lo usan para pedir conocimientos y las personas para declararlos."
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
            label="Buscar por denominación"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <TextField
            select
            size="small"
            label="Tipo"
            value={idTipo}
            onChange={(e) => setIdTipo(e.target.value)}
            sx={{ minWidth: 200 }}
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
            label="Área temática"
            value={idArea}
            onChange={(e) => setIdArea(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Todas</MenuItem>
            {(areas ?? []).map((a) => (
              <MenuItem key={a.id} value={String(a.id)}>
                {a.denominacion}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Switch
                checked={verInactivos}
                onChange={(e) => setVerInactivos(e.target.checked)}
              />
            }
            label="Ver dados de baja"
          />
          <span style={{ flexGrow: 1 }} />
          {puedeEditar && (
            <Button variant="contained" onClick={() => setFormulario({})}>
              Nuevo conocimiento
            </Button>
          )}
        </Stack>

        {isLoading && <CircularProgress aria-label="Cargando" />}
        {isError && (
          <Alert severity="error">No se pudo cargar el catálogo.</Alert>
        )}
        {data && data.length === 0 && (
          <Alert severity="info">No hay conocimientos para mostrar.</Alert>
        )}
        {data && data.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Denominación</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Área temática</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Documentación</TableCell>
                {puedeEditar && <TableCell align="right">Acciones</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.denominacion}</TableCell>
                  <TableCell>{nombre(tipos, c.idTipoConocimiento)}</TableCell>
                  <TableCell>{nombre(areas, c.idAreaTematica)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={c.activo ? 'Activo' : 'De baja'}
                      color={c.activo ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => setDocumentando(c)}>
                      Documentación
                    </Button>
                  </TableCell>
                  {puedeEditar && (
                    <TableCell align="right">
                      {c.activo && (
                        <>
                          <Button
                            size="small"
                            onClick={() => setFormulario({ conocimiento: c })}
                          >
                            Editar
                          </Button>
                          <Button size="small" onClick={() => setFusionando(c)}>
                            Fusionar
                          </Button>
                        </>
                      )}
                      <Button size="small" onClick={() => alternar(c)}>
                        {c.activo ? 'Dar de baja' : 'Reactivar'}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Stack>
      {formulario && (
        <FormularioConocimiento
          conocimiento={formulario.conocimiento}
          onCerrar={() => setFormulario(null)}
        />
      )}
      {fusionando && (
        <FusionarDialog
          origen={fusionando}
          onCerrar={() => setFusionando(undefined)}
        />
      )}
      {documentando && (
        <ActivosDeConocimientoDialog
          conocimiento={documentando}
          onCerrar={() => setDocumentando(undefined)}
        />
      )}
    </PaginaEnConstruccion>
  );
}
