import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { useState } from 'react';
import {
  mensajeError,
  useActualizarValor,
  useEliminarValor,
} from '../hooks/useGuardarValor';
import {
  useValoresReferencia,
  type Dominio,
  type Valor,
} from '../hooks/useValoresReferencia';
import { FormularioValor } from './FormularioValor';

interface Props {
  dominio: Dominio;
}

export function TablaReferencia({ dominio }: Props) {
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [formulario, setFormulario] = useState<{ valor?: Valor } | null>(null);
  const [porBorrar, setPorBorrar] = useState<Valor | null>(null);
  const [aviso, setAviso] = useState<{
    tipo: 'error' | 'warning';
    texto: string;
  }>();

  const { data, isLoading, isError } = useValoresReferencia(
    dominio.dominio,
    incluirInactivos,
  );
  const actualizar = useActualizarValor(dominio.dominio);
  const eliminar = useEliminarValor(dominio.dominio);

  const alternarActivo = async (valor: Valor) => {
    setAviso(undefined);
    try {
      const r = await actualizar.mutateAsync({
        id: valor.id,
        cuerpo: { activo: !valor.activo },
      });
      if (r.advertencia) setAviso({ tipo: 'warning', texto: r.advertencia });
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeError(e) });
    }
  };

  const confirmarBorrado = async () => {
    if (!porBorrar) return;
    setAviso(undefined);
    try {
      await eliminar.mutateAsync(porBorrar.id);
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
    setPorBorrar(null);
  };

  if (isLoading) return <CircularProgress aria-label="Cargando" />;
  if (isError || !data) {
    return <Alert severity="error">No se pudieron cargar los valores.</Alert>;
  }

  return (
    <Stack spacing={2}>
      {aviso && (
        <Alert severity={aviso.tipo} onClose={() => setAviso(undefined)}>
          {aviso.texto}
        </Alert>
      )}
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center' }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={incluirInactivos}
              onChange={(e) => setIncluirInactivos(e.target.checked)}
            />
          }
          label="Mostrar inactivos"
        />
        <Button variant="contained" onClick={() => setFormulario({})}>
          Nuevo valor
        </Button>
      </Stack>

      <Table size="small">
        <TableHead>
          <TableRow>
            {dominio.ordinal && <TableCell>Orden</TableCell>}
            <TableCell>Código</TableCell>
            <TableCell>Denominación</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((valor) => (
            <TableRow key={valor.id}>
              {dominio.ordinal && <TableCell>{valor.orden}</TableCell>}
              <TableCell>{valor.codigo}</TableCell>
              <TableCell>{valor.denominacion}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={valor.activo ? 'Activo' : 'Inactivo'}
                  color={valor.activo ? 'success' : 'default'}
                />
                {valor.enUso && (
                  <Chip size="small" label="En uso" sx={{ ml: 1 }} />
                )}
              </TableCell>
              <TableCell align="right">
                <Button size="small" onClick={() => setFormulario({ valor })}>
                  Editar
                </Button>
                <Button size="small" onClick={() => alternarActivo(valor)}>
                  {valor.activo ? 'Desactivar' : 'Reactivar'}
                </Button>
                <Button
                  size="small"
                  color="error"
                  onClick={() => setPorBorrar(valor)}
                >
                  Borrar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {formulario && (
        <FormularioValor
          dominio={dominio}
          valor={formulario.valor}
          onCerrar={() => setFormulario(null)}
        />
      )}

      <Dialog open={!!porBorrar} onClose={() => setPorBorrar(null)}>
        <DialogTitle>Borrar valor</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Borrar «{porBorrar?.denominacion}»? Si está en uso no se podrá
            borrar y conviene desactivarlo.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPorBorrar(null)}>Cancelar</Button>
          <Button color="error" onClick={confirmarBorrado}>
            Borrar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
