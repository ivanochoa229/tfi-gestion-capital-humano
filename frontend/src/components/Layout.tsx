import {
  AppBar,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import { NavLink, Outlet } from 'react-router';

const ANCHO_MENU = 240;

const secciones = [
  { ruta: '/', nombre: 'Tablero de riesgo' },
  { ruta: '/estructura', nombre: 'Estructura y puestos' },
  { ruta: '/personas', nombre: 'Personas' },
  { ruta: '/conocimiento', nombre: 'Conocimiento' },
  { ruta: '/criticidad', nombre: 'Criticidad' },
  { ruta: '/sucesion', nombre: 'Sucesión' },
  { ruta: '/admin', nombre: 'Administración' },
];

export function Layout() {
  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" component="div" noWrap>
            Gestión del conocimiento crítico
          </Typography>
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
