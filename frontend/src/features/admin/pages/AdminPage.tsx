import {
  Alert,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { MatrizCriticidad } from '../components/MatrizCriticidad';
import { TablaReferencia } from '../components/TablaReferencia';
import { TablaUsuarios } from '../components/TablaUsuarios';
import { useDominiosReferencia } from '../hooks/useValoresReferencia';

export function AdminPage() {
  const { data: dominios, isLoading, isError } = useDominiosReferencia();
  const [seccion, setSeccion] = useState<'referencia' | 'usuarios' | 'matriz'>(
    'referencia',
  );
  const [indice, setIndice] = useState(0);

  return (
    <PaginaEnConstruccion
      titulo="Administración"
      descripcion="Usuarios y roles (RF22), tablas de referencia (RF23) y matriz de criticidad (RF12)."
    >
      <Tabs value={seccion} onChange={(_, v) => setSeccion(v)} sx={{ mb: 2 }}>
        <Tab value="referencia" label="Tablas de referencia" />
        <Tab value="usuarios" label="Usuarios" />
        <Tab value="matriz" label="Matriz de criticidad" />
      </Tabs>

      {seccion === 'usuarios' && <TablaUsuarios />}

      {seccion === 'matriz' && <MatrizCriticidad />}

      {seccion === 'referencia' && (
        <>
          <Typography variant="h6" component="h2" gutterBottom>
            Tablas de referencia
          </Typography>
          {isLoading && <CircularProgress aria-label="Cargando" />}
          {isError && (
            <Alert severity="error">No se pudieron cargar los dominios.</Alert>
          )}
          {dominios && (
            <Stack spacing={2}>
              <Tabs
                value={indice}
                onChange={(_, valor: number) => setIndice(valor)}
                variant="scrollable"
                scrollButtons="auto"
              >
                {dominios.map((d) => (
                  <Tab key={d.dominio} label={d.denominacion} />
                ))}
              </Tabs>
              <TablaReferencia
                key={dominios[indice].dominio}
                dominio={dominios[indice]}
              />
            </Stack>
          )}
        </>
      )}
    </PaginaEnConstruccion>
  );
}
