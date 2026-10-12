import {
  AppBar,
  Box,
  Button,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { api } from '../api/cliente';
import { puedeVer, SECCIONES } from '../auth/permisos';
import { useSesion } from '../auth/useSesion';

const ANCHO_MENU = 240;

export function Layout() {
  const { data: sesion } = useSesion();
  const navegar = useNavigate();
  const cliente = useQueryClient();

  const cerrarSesion = async () => {
    await api.POST('/api/auth/logout');
    cliente.setQueryData(['sesion'], null);
    cliente.clear();
    navegar('/login', { replace: true });
  };
  const secciones = SECCIONES.filter((s) => sesion && puedeVer(sesion.rol, s));

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" component="div" noWrap>
            Gestión del conocimiento crítico
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Typography sx={{ mr: 2 }}>{sesion?.nombreUsuario}</Typography>
          <Button color="inherit" onClick={cerrarSesion}>
            Cerrar sesión
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: ANCHO_MENU,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: ANCHO_MENU, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <List component="nav">
          {secciones.map((s) => (
            <ListItemButton
              key={s.ruta}
              component={NavLink}
              to={s.ruta}
              end={s.ruta === '/'}
              sx={{ '&.active': { bgcolor: 'action.selected' } }}
            >
              <ListItemText primary={s.nombre} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
