import {
  Alert,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { TablaReferencia } from '../components/TablaReferencia';
import { guardarToken, leerToken } from '../hooks/useGuardarValor';
import { useDominiosReferencia } from '../hooks/useValoresReferencia';

export function AdminPage() {
  const { data: dominios, isLoading, isError } = useDominiosReferencia();
  const [indice, setIndice] = useState(0);
  const [token, setToken] = useState(leerToken);

  return (
    <PaginaEnConstruccion
      titulo="Administración"
      descripcion="Tablas de referencia (RF23). Usuarios, roles y permisos (RF22, RF24) llegan en otra etapa."
    >
      <Typography variant="h6" component="h2" gutterBottom>
        Tablas de referencia
      </Typography>
      <TextField
        label="Token de administrador (provisorio)"
        type="password"
        size="small"
        value={token}
        onChange={(e) => {
          setToken(e.target.value);
          guardarToken(e.target.value);
        }}
        helperText="Necesario para crear, editar, desactivar o borrar valores"
        sx={{ mb: 2, minWidth: 320 }}
      />

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
    </PaginaEnConstruccion>
  );
}
