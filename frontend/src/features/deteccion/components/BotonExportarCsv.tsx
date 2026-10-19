import { Alert, Button } from '@mui/material';
import { useState } from 'react';
import { useSesion } from '../../../auth/useSesion';
import { descargarCsv, ROLES_GLOBALES_DETECCION } from '../hooks/useDeteccion';

interface Propiedades {
  ruta: string;
  filtro: Record<string, unknown>;
  nombreArchivo: string;
}

/**
 * Botón «Exportar CSV» visible únicamente para roles globales (`recursos_humanos` y `autoridad`).
 */
export function BotonExportarCsv({ ruta, filtro, nombreArchivo }: Propiedades) {
  const { data: sesion } = useSesion();
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!sesion || !ROLES_GLOBALES_DETECCION.includes(sesion.rol)) {
    return null;
  }

  const manejarDescarga = async () => {
    setDescargando(true);
    setError(null);
    try {
      await descargarCsv(ruta, filtro, nombreArchivo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo exportar el CSV');
    } finally {
      setDescargando(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        disabled={descargando}
        onClick={() => void manejarDescarga()}
      >
        {descargando ? 'Exportando…' : 'Exportar CSV'}
      </Button>
      {error && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </>
  );
}
