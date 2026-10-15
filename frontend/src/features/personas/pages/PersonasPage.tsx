import { Alert, Box, Button, Divider } from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { useSesion } from '../../../auth/useSesion';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { FichaPersona } from '../components/FichaPersona';
import { FormularioPersona } from '../components/FormularioPersona';
import { ListaPersonas } from '../components/ListaPersonas';

export function PersonasPage() {
  const { data: sesion } = useSesion();
  const puedeEditar = sesion?.rol === 'recursos_humanos';
  const [idSeleccionada, setIdSeleccionada] = useState<number>();
  const [creando, setCreando] = useState(false);

  return (
    <PaginaEnConstruccion
      titulo="Personas"
      descripcion="Personas y ocupaciones, incluidas las simultáneas y el historial (RF06, RF07)."
    >
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: '320px 1fr' },
        }}
      >
        <Box>
          <ListaPersonas
            seleccionada={idSeleccionada}
            onElegir={setIdSeleccionada}
            onNueva={puedeEditar ? () => setCreando(true) : undefined}
          />
          {puedeEditar && (
            <Button
              component={RouterLink}
              to="/personas/importar"
              sx={{ mt: 1 }}
            >
              Importar CSV
            </Button>
          )}
        </Box>
        <Box>
          <Divider sx={{ display: { md: 'none' }, mb: 2 }} />
          {idSeleccionada !== undefined ? (
            <FichaPersona
              key={idSeleccionada}
              idPersona={idSeleccionada}
              puedeEditar={puedeEditar}
            />
          ) : (
            <Alert severity="info">
              Elegí una persona para ver su ficha y sus ocupaciones.
            </Alert>
          )}
        </Box>
      </Box>
      {creando && (
        <FormularioPersona
          onCerrar={() => setCreando(false)}
          onGuardada={setIdSeleccionada}
        />
      )}
    </PaginaEnConstruccion>
  );
}
