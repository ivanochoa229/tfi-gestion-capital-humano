import {
  Box,
  Button,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink, useLocation } from 'react-router';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { useUnidades } from '../../estructura/hooks/useUnidades';

export interface PestaniaListado {
  etiqueta: string;
  contenido: ReactNode;
}

interface Propiedades {
  titulo: string;
  descripcion: string;
  idUnidad: string;
  onCambiarUnidad?: (idUnidad: string) => void;
  filtrosExtra?: ReactNode;
  accionesExtra?: ReactNode;
  pestanias?: [PestaniaListado, PestaniaListado];
  pestaniaActiva?: number;
  onCambiarPestania?: (indice: number) => void;
  children?: ReactNode;
}

const VISTAS_DETECCION = [
  {
    ruta: '/deteccion/puntos-unicos-falla',
    etiqueta: 'Puntos únicos de falla',
  },
  { ruta: '/deteccion/catedras', etiqueta: 'Cátedras (1 persona)' },
  { ruta: '/deteccion/puestos-sin-sucesor', etiqueta: 'Puestos sin sucesor' },
  { ruta: '/deteccion/horizonte', etiqueta: 'Horizonte de retiros' },
  { ruta: '/deteccion/brecha', etiqueta: 'Brecha de perfil' },
];

/**
 * Marco común de las pantallas de detección: navegación entre consultas RF16–RF20,
 * filtro de unidad organizativa sincronizado con la URL, acciones (como Exportar CSV)
 * y pestañas opcionales para listas primarias y secundarias.
 */
export function ListadoConPestanias({
  titulo,
  descripcion,
  idUnidad,
  onCambiarUnidad,
  filtrosExtra,
  accionesExtra,
  pestanias,
  pestaniaActiva = 0,
  onCambiarPestania,
  children,
}: Propiedades) {
  const { data: unidades } = useUnidades();
  const ubicacion = useLocation();
  const sufijoBusqueda = idUnidad ? `?idUnidad=${idUnidad}` : '';

  return (
    <PaginaEnConstruccion titulo={titulo} descripcion={descripcion}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}
      >
        {VISTAS_DETECCION.map((v) => {
          const activa = ubicacion.pathname === v.ruta;
          return (
            <Button
              key={v.ruta}
              component={RouterLink}
              to={`${v.ruta}${sufijoBusqueda}`}
              variant={activa ? 'contained' : 'outlined'}
              size="small"
            >
              {v.etiqueta}
            </Button>
          );
        })}
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 2, alignItems: { sm: 'center' }, flexWrap: 'wrap' }}
      >
        {onCambiarUnidad && (
          <TextField
            select
            size="small"
            label="Unidad organizativa"
            value={idUnidad}
            onChange={(e) => onCambiarUnidad(e.target.value)}
            sx={{ minWidth: 240 }}
          >
            <MenuItem value="">Todo el departamento</MenuItem>
            {(unidades ?? []).map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>
                {u.denominacion}
              </MenuItem>
            ))}
          </TextField>
        )}
        {filtrosExtra}
        <Box sx={{ flexGrow: 1 }} />
        {accionesExtra}
      </Stack>

      {pestanias ? (
        <>
          <Tabs
            value={pestaniaActiva}
            onChange={(_, nuevo) => onCambiarPestania?.(nuevo as number)}
            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label={pestanias[0].etiqueta} />
            <Tab label={pestanias[1].etiqueta} />
          </Tabs>
          <Box>{pestanias[pestaniaActiva]?.contenido}</Box>
        </>
      ) : (
        children
      )}
    </PaginaEnConstruccion>
  );
}
