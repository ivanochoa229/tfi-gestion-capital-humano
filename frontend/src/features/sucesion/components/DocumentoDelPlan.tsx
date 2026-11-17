import { Alert, Button, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { formatearTamanio } from '../../conocimiento/activos';
import { SelectorArchivo } from '../../conocimiento/components/SelectorArchivo';
import {
  descargarDocumentoPlan,
  useSubirDocumentoPlan,
  type Plan,
} from '../hooks/useSucesion';

interface Props {
  plan: Plan;
  /** La jefatura con el plan en borrador: puede subir o reemplazar el documento. */
  puedeSubir: boolean;
}

/** El documento del plan (uno por plan): se descarga y, en borrador, se sube o reemplaza. */
export function DocumentoDelPlan({ plan, puedeSubir }: Props) {
  const subir = useSubirDocumentoPlan();
  const [archivo, setArchivo] = useState<File>();
  const [error, setError] = useState<string>();
  const [subido, setSubido] = useState(false);
  const documento = plan.documento;

  const enviar = async () => {
    if (!archivo) return;
    setError(undefined);
    setSubido(false);
    try {
      await subir.mutateAsync({ id: plan.id, archivo });
      setArchivo(undefined);
      setSubido(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant="h6" component="h2">
        Documento del plan
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {subido && <Alert severity="success">Documento guardado.</Alert>}
      {documento ? (
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <Typography>
            {documento.nombre} ({formatearTamanio(documento.tamanio)})
          </Typography>
          <Button
            variant="outlined"
            onClick={() =>
              descargarDocumentoPlan(plan).catch((e: Error) =>
                setError(e.message),
              )
            }
          >
            Descargar
          </Button>
        </Stack>
      ) : (
        <Typography color="text.secondary">
          Todavía no se subió el documento del plan.
        </Typography>
      )}
      {puedeSubir && (
        <Stack spacing={1} sx={{ maxWidth: 480 }}>
          <Typography variant="body2" color="text.secondary">
            {documento
              ? 'Subir otro archivo reemplaza al actual.'
              : 'Subí el documento antes de presentar el plan para aprobación.'}
          </Typography>
          <SelectorArchivo archivo={archivo} onElegir={setArchivo} />
          <span>
            <Button
              variant="contained"
              disabled={!archivo || subir.isPending}
              onClick={enviar}
            >
              {documento ? 'Reemplazar documento' : 'Subir documento'}
            </Button>
          </span>
        </Stack>
      )}
    </Stack>
  );
}
