import {
  Alert,
  Button,
  CircularProgress,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import {
  useImportarPersonas,
  type ResultadoImportacion,
} from '../hooks/useImportarPersonas';

export function ImportarPersonasPage() {
  const [archivo, setArchivo] = useState<File>();
  const [resultado, setResultado] = useState<ResultadoImportacion>();
  const importar = useImportarPersonas();

  const elegir = (nuevo: File | undefined) => {
    setArchivo(nuevo);
    setResultado(undefined);
    importar.reset();
    if (nuevo) {
      importar.mutate(
        { archivo: nuevo, confirmar: false },
        { onSuccess: setResultado },
      );
    }
  };

  const confirmar = () => {
    if (!archivo) return;
    importar.mutate({ archivo, confirmar: true }, { onSuccess: setResultado });
  };

  const sinErrores = resultado !== undefined && resultado.errores.length === 0;

  return (
    <PaginaEnConstruccion
      titulo="Importar personas y ocupaciones"
      descripcion="Carga inicial desde un CSV: primero una vista previa sin escribir y después la confirmación (OE4)."
    >
      <Stack spacing={2}>
        <Alert severity="info">
          Solo da de alta: un legajo o documento que ya existe es un error. El
          archivo contiene datos personales; no se guarda en el sistema.{' '}
          <Link href="/api/personas/importacion/plantilla" download>
            Descargar la plantilla
          </Link>
        </Alert>

        <Button
          variant="outlined"
          component="label"
          sx={{ alignSelf: 'start' }}
        >
          {archivo ? `Archivo: ${archivo.name}` : 'Elegir archivo CSV'}
          <input
            hidden
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              elegir(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </Button>

        {importar.isPending && <CircularProgress aria-label="Procesando" />}
        {importar.isError && (
          <Alert severity="error">{importar.error.message}</Alert>
        )}

        {resultado?.importado && (
          <Alert severity="success">
            Importadas {resultado.personas} personas y {resultado.ocupaciones}{' '}
            ocupaciones.{' '}
            <Link component={RouterLink} to="/personas">
              Ir a Personas
            </Link>
          </Alert>
        )}

        {resultado && !resultado.importado && (
          <>
            {sinErrores ? (
              <Alert severity="success">
                {resultado.filas} filas leídas, sin errores. Se crearían{' '}
                {resultado.personas} personas y {resultado.ocupaciones}{' '}
                ocupaciones.
              </Alert>
            ) : (
              <Alert severity="error">
                {resultado.errores.length} errores en {resultado.filas} filas.
                No se escribió nada: corregí el archivo y elegilo de nuevo.
              </Alert>
            )}
            {!sinErrores && (
              <Table size="small" aria-label="Errores de la importación">
                <TableHead>
                  <TableRow>
                    <TableCell>Fila</TableCell>
                    <TableCell>Columna</TableCell>
                    <TableCell>Error</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {resultado.errores.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.fila}</TableCell>
                      <TableCell>{e.columna ?? '—'}</TableCell>
                      <TableCell>{e.mensaje}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                disabled={!sinErrores || importar.isPending}
                onClick={confirmar}
              >
                Importar
              </Button>
            </Stack>
            {sinErrores && (
              <Typography variant="caption">
                Al importar se vuelve a validar todo el archivo; si algo cambió
                desde la vista previa, no se escribe nada y se muestran los
                nuevos errores.
              </Typography>
            )}
          </>
        )}
      </Stack>
    </PaginaEnConstruccion>
  );
}
