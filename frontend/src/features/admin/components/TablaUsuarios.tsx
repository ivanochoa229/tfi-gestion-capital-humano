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
} from '@mui/material';
import { useState } from 'react';
import { useUnidades } from '../../estructura/hooks/useUnidades';
import { mensajeError } from '../hooks/useGuardarValor';
import {
  useActualizarUsuario,
  useUsuarios,
  type Usuario,
} from '../hooks/useUsuarios';
import { FormularioUsuario } from './FormularioUsuario';
import { RestablecerClaveDialog } from './RestablecerClaveDialog';

export function TablaUsuarios() {
  const { data, isLoading, isError } = useUsuarios();
  const { data: unidades } = useUnidades(true);
  const actualizar = useActualizarUsuario();
  const [formulario, setFormulario] = useState<{ usuario?: Usuario } | null>(
    null,
  );
  const [paraClave, setParaClave] = useState<Usuario | null>(null);
  const [error, setError] = useState<string>();

  const alternarActivo = async (usuario: Usuario) => {
    setError(undefined);
    try {
      await actualizar.mutateAsync({
        id: usuario.id,
        cuerpo: { activo: !usuario.activo },
      });
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  if (isLoading) return <CircularProgress aria-label="Cargando" />;
  if (isError || !data) {
    return <Alert severity="error">No se pudieron cargar los usuarios.</Alert>;
  }

  return (
    <Stack spacing={2}>
      {error && (
        <Alert severity="error" onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={() => setFormulario({})}>
          Nuevo usuario
        </Button>
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Usuario</TableCell>
            <TableCell>Rol</TableCell>
            <TableCell>Unidades</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.nombreUsuario}</TableCell>
              <TableCell>{u.rol}</TableCell>
              <TableCell>
                {u.idUnidades.length === 0
                  ? '—'
                  : u.idUnidades
                      .map((id) => {
                        const unidad = unidades?.find((x) => x.id === id);
                        if (!unidad) return `#${id}`;
                        return unidad.activo
                          ? unidad.denominacion
                          : `${unidad.denominacion} (inactiva)`;
                      })
                      .join(', ')}
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={u.activo ? 'Activo' : 'Inactivo'}
                  color={u.activo ? 'success' : 'default'}
                />
              </TableCell>
              <TableCell align="right">
                <Button
                  size="small"
                  onClick={() => setFormulario({ usuario: u })}
                >
                  Editar
                </Button>
                <Button size="small" onClick={() => setParaClave(u)}>
                  Restablecer clave
                </Button>
                <Button size="small" onClick={() => alternarActivo(u)}>
                  {u.activo ? 'Desactivar' : 'Reactivar'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {formulario && (
        <FormularioUsuario
          usuario={formulario.usuario}
          onCerrar={() => setFormulario(null)}
        />
      )}
      {paraClave && (
        <RestablecerClaveDialog
          usuario={paraClave}
          onCerrar={() => setParaClave(null)}
        />
      )}
    </Stack>
  );
}
