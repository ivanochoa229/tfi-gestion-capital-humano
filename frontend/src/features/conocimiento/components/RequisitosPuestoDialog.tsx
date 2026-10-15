import {
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
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
import { usePuestos, type Puesto } from '../../estructura/hooks/usePuestos';
import { useConocimientos, type Conocimiento } from '../hooks/useConocimientos';
import {
  useCopiarRequisitos,
  useGuardarRequisito,
  useQuitarRequisito,
  useRequisitos,
  type ResultadoCopia,
} from '../hooks/useRequisitos';

interface Props {
  puesto: Puesto;
  /** Solo el analista de puestos escribe. */
  puedeEditar: boolean;
  onCerrar: () => void;
}

/** Conocimientos que exige el puesto, con nivel y carácter (RF09). */
export function RequisitosPuestoDialog({ puesto, puedeEditar, onCerrar }: Props) {
  const { data: requisitos, isLoading, isError } = useRequisitos(puesto.id);
  const { data: niveles } = useValoresReferencia('nivel-dominio', false);
  const { data: catalogo } = useConocimientos({ activo: true });
  const { data: puestos } = usePuestos();
  const guardar = useGuardarRequisito();
  const quitar = useQuitarRequisito();
  const copiar = useCopiarRequisitos();

  const [nuevo, setNuevo] = useState<Conocimiento | null>(null);
  const [nivelNuevo, setNivelNuevo] = useState('');
  const [excluyenteNuevo, setExcluyenteNuevo] = useState(false);
  const [origen, setOrigen] = useState('');
  const [resultado, setResultado] = useState<ResultadoCopia>();
  const [error, setError] = useState<string>();

  const envolver = async (accion: () => Promise<unknown>) => {
    setError(undefined);
    setResultado(undefined);
    try {
      await accion();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const yaPedidos = new Set((requisitos ?? []).map((r) => r.idConocimiento));
  const ofrecidos = (catalogo ?? []).filter((c) => !yaPedidos.has(c.id));
  const otrosPuestos = (puestos ?? []).filter((p) => p.activo && p.id !== puesto.id);
  const ordenados = [...(niveles ?? [])].sort(
    (a, b) => (a.orden ?? a.id) - (b.orden ?? b.id),
  );

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="md">
      <DialogTitle>
        Requisitos de {puesto.codigo} · {puesto.denominacion}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(undefined)}>
              {error}
            </Alert>
          )}
          {resultado && (
            <Alert severity="success" onClose={() => setResultado(undefined)}>
              Se copiaron {resultado.copiados} requisitos.
              {resultado.omitidos.length > 0 &&
                ` No se tocaron los que el puesto ya tenía: ${resultado.omitidos
                  .map((o) => o.denominacion)
                  .join(', ')}.`}
            </Alert>
          )}
          {isLoading && <CircularProgress aria-label="Cargando" />}
          {isError && <Alert severity="error">No se pudieron cargar los requisitos.</Alert>}
          {requisitos && requisitos.length === 0 && (
            <Alert severity="info">Este puesto todavía no tiene requisitos.</Alert>
          )}
          {requisitos && requisitos.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Conocimiento</TableCell>
                  <TableCell>Nivel requerido</TableCell>
                  <TableCell>Excluyente</TableCell>
                  {puedeEditar && <TableCell align="right">Acciones</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {requisitos.map((r) => (
                  <TableRow key={r.idConocimiento}>
                    <TableCell>{r.denominacion}</TableCell>
                    <TableCell>
                      {puedeEditar ? (
                        <TextField
                          select
                          size="small"
                          value={String(r.idNivelRequerido)}
                          onChange={(e) =>
                            envolver(() =>
                              guardar.mutateAsync({
                                idPuesto: puesto.id,
                                idConocimiento: r.idConocimiento,
                                idNivel: Number(e.target.value),
                                esExcluyente: r.esExcluyente,
                              }),
                            )
                          }
                        >
                          {ordenados.map((n) => (
                            <MenuItem key={n.id} value={String(n.id)}>
                              {n.denominacion}
                            </MenuItem>
                          ))}
                        </TextField>
                      ) : (
                        (niveles?.find((n) => n.id === r.idNivelRequerido)?.denominacion ??
                        r.idNivelRequerido)
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={r.esExcluyente}
                        disabled={!puedeEditar}
                        slotProps={{ input: { 'aria-label': `Excluyente: ${r.denominacion}` } }}
                        onChange={(e) =>
                          envolver(() =>
                            guardar.mutateAsync({
                              idPuesto: puesto.id,
                              idConocimiento: r.idConocimiento,
                              idNivel: r.idNivelRequerido,
                              esExcluyente: e.target.checked,
                            }),
                          )
                        }
                      />
                    </TableCell>
                    {puedeEditar && (
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          aria-label={`Quitar ${r.denominacion}`}
                          onClick={() =>
                            envolver(() =>
                              quitar.mutateAsync({
                                idPuesto: puesto.id,
                                idConocimiento: r.idConocimiento,
                              }),
                            )
                          }
                        >
                          ✕
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {puedeEditar && (
            <>
              <Typography variant="subtitle2">Agregar un requisito</Typography>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Autocomplete
                  sx={{ flexGrow: 1 }}
                  size="small"
                  options={ofrecidos}
                  value={nuevo}
                  onChange={(_, v) => setNuevo(v)}
                  getOptionLabel={(c) => c.denominacion}
                  noOptionsText="No hay más conocimientos en el catálogo"
                  renderInput={(p) => <TextField {...p} label="Conocimiento" />}
                />
                <TextField
                  select
                  size="small"
                  label="Nivel"
                  value={nivelNuevo}
                  onChange={(e) => setNivelNuevo(e.target.value)}
                  sx={{ minWidth: 160 }}
                >
                  {ordenados.map((n) => (
                    <MenuItem key={n.id} value={String(n.id)}>
                      {n.denominacion}
                    </MenuItem>
                  ))}
                </TextField>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={excluyenteNuevo}
                      onChange={(e) => setExcluyenteNuevo(e.target.checked)}
                    />
                  }
                  label="Excluyente"
                />
                <Button
                  variant="contained"
                  disabled={!nuevo || !nivelNuevo || guardar.isPending}
                  onClick={() =>
                    envolver(async () => {
                      await guardar.mutateAsync({
                        idPuesto: puesto.id,
                        idConocimiento: (nuevo as Conocimiento).id,
                        idNivel: Number(nivelNuevo),
                        esExcluyente: excluyenteNuevo,
                      });
                      setNuevo(null);
                      setNivelNuevo('');
                      setExcluyenteNuevo(false);
                    })
                  }
                >
                  Agregar
                </Button>
              </Stack>

              <Typography variant="subtitle2">Copiar de otro puesto</Typography>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <TextField
                  select
                  size="small"
                  label="Puesto de origen"
                  value={origen}
                  onChange={(e) => setOrigen(e.target.value)}
                  sx={{ flexGrow: 1 }}
                  helperText="Se copian una sola vez; los que este puesto ya tiene no se modifican"
                >
                  {otrosPuestos.map((p) => (
                    <MenuItem key={p.id} value={String(p.id)}>
                      {p.codigo} · {p.denominacion}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  disabled={!origen || copiar.isPending}
                  onClick={() =>
                    envolver(async () => {
                      setResultado(
                        await copiar.mutateAsync({
                          idPuestoDestino: puesto.id,
                          idPuestoOrigen: Number(origen),
                        }),
                      );
                    })
                  }
                >
                  Copiar requisitos
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
