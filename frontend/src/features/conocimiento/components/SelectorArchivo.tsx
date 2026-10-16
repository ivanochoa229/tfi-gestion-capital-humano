import { Box, Button, Stack, Typography } from '@mui/material';
import { useRef, useState, type DragEvent } from 'react';
import { EXTENSIONES_ACTIVO, formatearTamanio } from '../activos';

interface Props {
  archivo?: File;
  onElegir: (archivo: File | undefined) => void;
}

const extensionesAceptadas = EXTENSIONES_ACTIVO.split(',');

const tieneExtensionAceptada = (nombre: string) =>
  extensionesAceptadas.some((ext) => nombre.toLowerCase().endsWith(ext));

/** Zona para soltar un archivo o elegirlo con el selector clásico; el servidor valida el tipo. */
export function SelectorArchivo({ archivo, onElegir }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);

  const alSoltar = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setEncima(false);
    onElegir(e.dataTransfer.files[0] ?? undefined);
  };

  return (
    <Box
      onDragOver={(e) => {
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={alSoltar}
      sx={{
        border: 2,
        borderStyle: 'dashed',
        borderColor: encima ? 'primary.main' : 'divider',
        bgcolor: encima ? 'action.hover' : 'transparent',
        borderRadius: 1,
        p: 2,
        textAlign: 'center',
      }}
    >
      <Stack spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Arrastrá un archivo acá o
        </Typography>
        <Button variant="outlined" onClick={() => entrada.current?.click()}>
          {archivo ? 'Cambiar archivo' : 'Elegir archivo'}
        </Button>
        <input
          ref={entrada}
          hidden
          type="file"
          accept={EXTENSIONES_ACTIVO}
          onChange={(e) => onElegir(e.target.files?.[0])}
        />
        <Typography variant="body2" color="text.secondary">
          {archivo
            ? `${archivo.name} (${formatearTamanio(archivo.size)})`
            : 'PDF, DOCX, XLSX, PPTX, ODT, TXT, PNG o JPG'}
        </Typography>
        {archivo && !tieneExtensionAceptada(archivo.name) && (
          <Typography variant="body2" color="warning.main">
            La extensión no está entre las admitidas; el servidor puede
            rechazarlo.
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
