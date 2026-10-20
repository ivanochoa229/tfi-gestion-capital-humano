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
import { useCatedras, type CatedraUnaPersona } from '../hooks/useDeteccion';

function TablaCatedras({
  filas,
  mostrarPersona,
  textoVacio,
}: {
  filas: CatedraUnaPersona[];
  mostrarPersona: boolean;
  textoVacio: string;
}) {
  if (filas.length === 0) {
    return <Alert severity="info">{textoVacio}</Alert>;
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Cátedra</TableCell>
          {mostrarPersona && <TableCell>Persona que la sostiene</TableCell>}
          {mostrarPersona && (
            <TableCell>Cargos vigentes que concentra</TableCell>
          )}
        </TableRow>
      </TableHead>
      <TableBody>
        {filas.map((f) => (
          <TableRow key={f.idUnidad}>
            <TableCell>{f.denominacion}</TableCell>
            {mostrarPersona && (
              <TableCell>
                {f.persona ? (
                  `${f.persona.apellido}, ${f.persona.nombre}`
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
            {mostrarPersona && <TableCell>{f.cantidadCargos}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * RF17: Cátedras activas sostenidas por una sola persona activa con ocupación vigente,
 * y en una segunda pestaña las cátedras sin dotación.
 */
export function CatedrasPage() {
  const [parametros, setParametros] = useSearchParams();
  const idUnidad = parametros.get('idUnidad') ?? '';
  const pestaniaInicial = parametros.get('pestania') === 'sin-dotacion' ? 1 : 0;
  const [pestania, setPestania] = useState(pestaniaInicial);

  const unidadNum = idUnidad ? Number(idUnidad) : undefined;
  const consulta = useCatedras({ idUnidad: unidadNum });

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
      titulo="Cátedras vulnerables"
      descripcion="Cátedras activas cuya dotación vigente recae en una única persona (aunque ocupe más de un cargo) y cátedras sin ocupaciones vigentes."
      idUnidad={idUnidad}
      onCambiarUnidad={cambiarUnidad}
      accionesExtra={
        <BotonExportarCsv
          ruta="/api/deteccion/catedras-una-persona"
          filtro={{ idUnidad: unidadNum }}
          nombreArchivo="catedras-una-persona.csv"
        />
      }
      pestaniaActiva={pestania}
      onCambiarPestania={setPestania}
      pestanias={[
        {
          etiqueta: `Con una sola persona (${consulta.data?.unaPersona.length ?? 0})`,
          contenido: consulta.isPending ? (
            <CircularProgress aria-label="Cargando cátedras" />
          ) : consulta.isError ? (
            <Alert severity="error">{consulta.error.message}</Alert>
          ) : (
            <TablaCatedras
              filas={consulta.data.unaPersona}
              mostrarPersona
              textoVacio="Ninguna cátedra está sostenida por una sola persona"
            />
          ),
        },
        {
          etiqueta: `Sin dotación (${consulta.data?.sinDotacion.length ?? 0})`,
          contenido: consulta.isPending ? (
            <CircularProgress aria-label="Cargando cátedras sin dotación" />
          ) : consulta.isError ? (
            <Alert severity="error">{consulta.error.message}</Alert>
          ) : (
            <TablaCatedras
              filas={consulta.data.sinDotacion}
              mostrarPersona={false}
              textoVacio="Ninguna cátedra activa se encuentra sin dotación vigente"
            />
          ),
        },
      ]}
    />
  );
}
