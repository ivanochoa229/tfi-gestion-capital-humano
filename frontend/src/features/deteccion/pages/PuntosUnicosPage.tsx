import {
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { BotonExportarCsv } from '../components/BotonExportarCsv';
import { ListadoConPestanias } from '../components/ListadoConPestanias';
import { usePuntosUnicos, type PuntoUnicoFalla } from '../hooks/useDeteccion';

function formatearPuestos(fila: PuntoUnicoFalla): string {
  const visibles = fila.puestosCriticos.map((p) => p.denominacion);
  if (fila.puestosFueraDeAlcance > 0) {
    visibles.push(`y ${fila.puestosFueraDeAlcance} más fuera de tu alcance`);
  }
  return visibles.join(', ');
}

function TablaPuntos({
  filas,
  mostrarPoseedor,
  textoVacio,
}: {
  filas: PuntoUnicoFalla[];
  mostrarPoseedor: boolean;
  textoVacio: string;
}) {
  if (filas.length === 0) {
    return <Alert severity="info">{textoVacio}</Alert>;
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Conocimiento</TableCell>
          <TableCell>Nivel requerido más exigente</TableCell>
          {mostrarPoseedor && <TableCell>Poseedor acreditado</TableCell>}
          <TableCell>Puestos críticos asociados</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {filas.map((f) => (
          <TableRow key={f.idConocimiento}>
            <TableCell>{f.denominacion}</TableCell>
            <TableCell>{f.nivelRequerido}</TableCell>
            {mostrarPoseedor && (
              <TableCell>
                {f.poseedor ? (
                  `${f.poseedor.apellido}, ${f.poseedor.nombre}`
                ) : (
                  <Typography
                    component="span"
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontStyle: 'italic' }}
                  >
                    Fuera de tu alcance
                  </Typography>
                )}
              </TableCell>
            )}
            <TableCell>{formatearPuestos(f)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * RF16: Conocimientos críticos con un único poseedor vigente en el departamento,
 * y en una segunda pestaña aquellos sin ningún poseedor acreditado.
 */
export function PuntosUnicosPage() {
  const [parametros, setParametros] = useSearchParams();
  const idUnidad = parametros.get('idUnidad') ?? '';
  const pestaniaInicial = parametros.get('pestania') === 'sin-poseedor' ? 1 : 0;
  const [pestania, setPestania] = useState(pestaniaInicial);

  const unidadNum = idUnidad ? Number(idUnidad) : undefined;
  const consulta = usePuntosUnicos({ idUnidad: unidadNum });

  const cambiarUnidad = (nuevoId: string) => {
    const siguientes = new URLSearchParams(parametros);
    if (nuevoId) {
      siguientes.set('idUnidad', nuevoId);
    } else {
      siguientes.delete('idUnidad');
    }
    setParametros(siguientes);
  };

  return (
    <ListadoConPestanias
      titulo="Puntos únicos de falla"
      descripcion="Conocimientos con criticidad vigente alta que dependen de una única persona acreditada en el departamento o que no cuentan con ningún poseedor."
      idUnidad={idUnidad}
      onCambiarUnidad={cambiarUnidad}
      accionesExtra={
        <BotonExportarCsv
          ruta="/api/deteccion/puntos-unicos-falla"
          filtro={{ idUnidad: unidadNum }}
          nombreArchivo="puntos-unicos-falla.csv"
        />
      }
      pestaniaActiva={pestania}
      onCambiarPestania={setPestania}
      pestanias={[
        {
          etiqueta: `Con un único poseedor (${consulta.data?.unicoPoseedor.length ?? 0})`,
          contenido: consulta.isPending ? (
            <CircularProgress aria-label="Cargando puntos únicos de falla" />
          ) : consulta.isError ? (
            <Alert severity="error">{consulta.error.message}</Alert>
          ) : (
            <TablaPuntos
              filas={consulta.data.unicoPoseedor}
              mostrarPoseedor
              textoVacio="Ningún conocimiento crítico tiene un único poseedor"
            />
          ),
        },
        {
          etiqueta: `Sin poseedor (${consulta.data?.sinPoseedor.length ?? 0})`,
          contenido: (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Un conocimiento puede figurar sin poseedor acreditado mientras
                falten acreditaciones de nivel (OE4) o si el único docente que
                lo acredita no tiene ocupación vigente o ya cumplió su fecha de
                retiro. Lo declarado sin acreditar no cuenta como cobertura.
              </Alert>
              {consulta.isPending ? (
                <CircularProgress aria-label="Cargando conocimientos sin poseedor" />
              ) : consulta.isError ? (
                <Alert severity="error">{consulta.error.message}</Alert>
              ) : (
                <TablaPuntos
                  filas={consulta.data.sinPoseedor}
                  mostrarPoseedor={false}
                  textoVacio="Ningún conocimiento crítico se encuentra sin poseedor acreditado"
                />
              )}
            </>
          ),
        },
      ]}
    />
  );
}
