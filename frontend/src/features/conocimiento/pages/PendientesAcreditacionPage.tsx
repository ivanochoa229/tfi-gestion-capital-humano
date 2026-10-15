import {
  Alert,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { useState } from 'react';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { AcreditarDialog } from '../components/AcreditarDialog';
import {
  usePendientesAcreditacion,
  type Pendiente,
} from '../hooks/useAcreditaciones';

/** Lo que las personas de tu equipo declararon y todavía falta acreditar. */
export function PendientesAcreditacionPage() {
  const { data, isLoading, isError } = usePendientesAcreditacion();
  const { data: niveles } = useValoresReferencia('nivel-dominio', true);
  const [elegido, setElegido] = useState<Pendiente>();
  const nombre = (id: number | null) =>
    id === null
      ? '—'
      : (niveles?.find((n) => n.id === id)?.denominacion ?? String(id));

  return (
    <PaginaEnConstruccion
      titulo="Conocimientos por acreditar"
      descripcion="Lo que declaró tu equipo y todavía no tiene una acreditación que lo respalde."
    >
      {isLoading && <CircularProgress aria-label="Cargando" />}
      {isError && <Alert severity="error">No se pudo cargar la bandeja.</Alert>}
      {data && data.length === 0 && (
        <Alert severity="success">No hay nada pendiente.</Alert>
      )}
      {data && data.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Persona</TableCell>
              <TableCell>Conocimiento</TableCell>
              <TableCell>Declaró</TableCell>
              <TableCell>Desde</TableCell>
              <TableCell>Acreditado hasta ahora</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((p) => (
              <TableRow key={`${p.idPersona}-${p.idConocimiento}`}>
                <TableCell>
                  {p.apellido}, {p.nombre}
                </TableCell>
                <TableCell>{p.denominacion}</TableCell>
                <TableCell>{nombre(p.idNivelDeclarado)}</TableCell>
                <TableCell>{p.fechaDeclaracion}</TableCell>
                <TableCell>{nombre(p.idNivelAcreditado)}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setElegido(p)}>
                    Acreditar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {elegido && (
        <AcreditarDialog
          idPersona={elegido.idPersona}
          nombrePersona={`${elegido.apellido}, ${elegido.nombre}`}
          conocimiento={{
            id: elegido.idConocimiento,
            denominacion: elegido.denominacion,
          }}
          onCerrar={() => setElegido(undefined)}
        />
      )}
    </PaginaEnConstruccion>
  );
}
