import {
  Alert,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { useSesion } from '../../../auth/useSesion';
import { AccionesTabla } from '../components/AccionesTabla';
import { AvanzarAccionDialog } from '../components/AvanzarAccionDialog';
import {
  colorEstadoPlan,
  etiquetaEstadoPlan,
  puedeAvanzarAccion,
} from '../estados';
import { useAcciones, useMisPlanes, type Accion } from '../hooks/useSucesion';

/** «Su brecha» es un conteo; el detalle por conocimiento es de Detección (RF19). */
function textoBrecha(p: {
  excluyentesSinCubrir: number;
  totalExcluyentes: number;
}): string {
  if (p.totalExcluyentes === 0) return '—';
  return p.excluyentesSinCubrir === 0
    ? 'Cubrís todos los requisitos excluyentes'
    : `Te faltan ${p.excluyentesSinCubrir} de ${p.totalExcluyentes} requisitos excluyentes`;
}

/** Vista del docente: los planes donde es candidato y sus acciones (sin prioridad ni otros candidatos). */
export function MiSucesionPage() {
  const { data: sesion } = useSesion();
  const planes = useMisPlanes(true);
  const acciones = useAcciones({});
  const { data: estados } = useValoresReferencia('estado-preparacion', true);
  const [avanzando, setAvanzando] = useState<Accion>();

  const etiquetaPreparacion = (codigo: string) =>
    estados?.find((e) => e.codigo === codigo)?.denominacion ?? codigo;
  const puedeAvanzar = (a: Accion) => puedeAvanzarAccion(sesion, a);

  return (
    <PaginaEnConstruccion
      titulo="Mi sucesión"
      descripcion="Los planes de sucesión en los que figurás como candidato y tus acciones de transferencia."
    >
      <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
        Mis planes
      </Typography>
      {planes.isPending ? (
        <CircularProgress aria-label="Cargando planes" />
      ) : planes.isError ? (
        <Alert severity="error">{planes.error.message}</Alert>
      ) : planes.data.length === 0 ? (
        <Alert severity="info">
          No figurás como candidato en ningún plan de sucesión.
        </Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Puesto</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Estado de preparación</TableCell>
              <TableCell>Fecha estimada de disponibilidad</TableCell>
              <TableCell>Requisitos excluyentes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {planes.data.map((p) => (
              <TableRow key={p.idPlan}>
                <TableCell>{p.denominacionPuesto}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={etiquetaEstadoPlan(p.estadoPlan)}
                    color={colorEstadoPlan(p.estadoPlan)}
                  />
                </TableCell>
                <TableCell>
                  {etiquetaPreparacion(p.estadoPreparacion)}
                </TableCell>
                <TableCell>{p.fechaDisponibilidadEstimada ?? '—'}</TableCell>
                <TableCell>{textoBrecha(p)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Typography variant="h6" component="h2" sx={{ mt: 4, mb: 1 }}>
        Mis acciones de transferencia
      </Typography>
      {acciones.isPending ? (
        <CircularProgress aria-label="Cargando acciones" />
      ) : acciones.isError ? (
        <Alert severity="error">{acciones.error.message}</Alert>
      ) : acciones.data.length === 0 ? (
        <Alert severity="info">
          No tenés acciones de transferencia asignadas.
        </Alert>
      ) : (
        <AccionesTabla
          acciones={acciones.data}
          puedeAvanzar={puedeAvanzar}
          onAvanzar={setAvanzando}
        />
      )}

      {avanzando && (
        <AvanzarAccionDialog
          accion={avanzando}
          onCerrar={() => setAvanzando(undefined)}
        />
      )}
    </PaginaEnConstruccion>
  );
}
