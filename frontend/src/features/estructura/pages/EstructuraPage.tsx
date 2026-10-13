import { Alert, Box, Divider } from '@mui/material';
import { useState } from 'react';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { useSesion } from '../../../auth/useSesion';
import { buscarUnidad, unidadesHastaRaiz } from '../components/arbol';
import { ArbolUnidades } from '../components/ArbolUnidades';
import { TablaPuestos } from '../components/TablaPuestos';
import { useArbolUnidades } from '../hooks/useUnidades';

export function EstructuraPage() {
  const { data: sesion } = useSesion();
  const [incluirInactivas, setIncluirInactivas] = useState(false);
  const [idSeleccionada, setIdSeleccionada] = useState<number>();
  const { data: arbol } = useArbolUnidades(incluirInactivas);

  const seleccionada =
    arbol && idSeleccionada !== undefined
      ? buscarUnidad(arbol, idSeleccionada)
      : undefined;

  return (
    <PaginaEnConstruccion
      titulo="Estructura y puestos"
      descripcion="Unidades organizativas (solo consulta) e inventario de puestos (RF01, RF02). La descripción de cada puesto vendrá en un bloque posterior."
    >
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: '320px 1fr' },
        }}
      >
        <Box>
          <ArbolUnidades
            seleccionada={idSeleccionada}
            incluirInactivas={incluirInactivas}
            onAlternarInactivas={setIncluirInactivas}
            onElegir={(unidad) => setIdSeleccionada(unidad.id)}
          />
        </Box>
        <Box>
          <Divider sx={{ display: { md: 'none' }, mb: 2 }} />
          {seleccionada && arbol ? (
            <TablaPuestos
              key={seleccionada.id}
              unidad={seleccionada}
              unidadesValidas={unidadesHastaRaiz(arbol, seleccionada.id)}
              puedeEditar={sesion?.rol === 'analista_puestos'}
            />
          ) : (
            <Alert severity="info">
              Elegí una unidad para ver sus puestos.
            </Alert>
          )}
        </Box>
      </Box>
    </PaginaEnConstruccion>
  );
}
