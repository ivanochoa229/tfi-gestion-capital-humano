import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Stack,
} from '@mui/material';
import { useState } from 'react';
import { useSesion } from '../../../auth/useSesion';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { esUrlWeb, puedeEscribirActivos } from '../activos';
import { descargarActivo, useActivos } from '../hooks/useActivos';
import type { Conocimiento } from '../hooks/useConocimientos';
import { ChipVigencia } from './ChipVigencia';
import { FormularioActivo } from './FormularioActivo';

interface Props {
  conocimiento: Conocimiento;
  onCerrar: () => void;
}

/** Documentación de un conocimiento, desde el catálogo. */
export function ActivosDeConocimientoDialog({ conocimiento, onCerrar }: Props) {
  const { data: sesion } = useSesion();
  const { data, isLoading, isError } = useActivos({
    idConocimiento: conocimiento.id,
    tamanio: 100,
  });
  const [agregando, setAgregando] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <>
      <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
        <DialogTitle>Documentación: {conocimiento.denominacion}</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            {error && <Alert severity="error">{error}</Alert>}
            {isLoading && <CircularProgress aria-label="Cargando" />}
            {isError && (
              <Alert severity="error">No se pudieron cargar los activos.</Alert>
            )}
            {data && data.items.length === 0 && (
              <Alert severity="info">
                Este conocimiento todavía no tiene documentación.
              </Alert>
            )}
            {data && data.total > data.items.length && (
              <Alert severity="info">
                Mostrando {data.items.length} de {data.total} activos; usá la
                pantalla de Activos para ver el resto.
              </Alert>
            )}
            <List dense>
              {(data?.items ?? []).map((a) => (
                <ListItem
                  key={a.id}
                  secondaryAction={
                    a.origen === 'enlace' ? (
                      esUrlWeb(a.enlace) ? (
                        <Button
                          size="small"
                          component="a"
                          href={a.enlace ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Abrir
                        </Button>
                      ) : null
                    ) : (
                      <Button
                        size="small"
                        onClick={async () => {
                          setError(undefined);
                          try {
                            await descargarActivo(a);
                          } catch (e) {
                            setError(mensajeError(e));
                          }
                        }}
                      >
                        Descargar
                      </Button>
                    )
                  }
                >
                  <ListItemText
                    primary={
                      <>
                        {a.titulo} <ChipVigencia activo={a} />
                      </>
                    }
                    secondary={
                      a.origen === 'archivo' ? a.nombreOriginal : a.enlace
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Stack>
        </DialogContent>
        <DialogActions>
          {puedeEscribirActivos(sesion?.rol) && (
            <Button onClick={() => setAgregando(true)}>Agregar activo</Button>
          )}
          <Button onClick={onCerrar}>Cerrar</Button>
        </DialogActions>
      </Dialog>
      {agregando && (
        <FormularioActivo
          conocimientoInicial={conocimiento}
          onCerrar={() => setAgregando(false)}
        />
      )}
    </>
  );
}
