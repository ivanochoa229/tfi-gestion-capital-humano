import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import PeopleOutlined from '@mui/icons-material/PeopleOutlined';
import PersonSearchOutlined from '@mui/icons-material/PersonSearchOutlined';
import PsychologyOutlined from '@mui/icons-material/PsychologyOutlined';
import SchoolOutlined from '@mui/icons-material/SchoolOutlined';
import SwapHorizOutlined from '@mui/icons-material/SwapHorizOutlined';
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined';
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import type { ElementType } from 'react';
import {
  AppBar,
  Box,
  Button,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { api } from '../api/cliente';
import logoUtn from '../assets/utn-logo.png';
import { puedeVer, SECCIONES } from '../auth/permisos';
import { useSesion } from '../auth/useSesion';

const ANCHO_MENU = 260;

const ICONOS: Record<string, ElementType> = {
  '/': DashboardOutlined,
  '/estructura': AccountTreeOutlined,
  '/personas': PeopleOutlined,
  '/personas/yo': PeopleOutlined,
  '/conocimiento': PsychologyOutlined,
  '/conocimiento/mios': SchoolOutlined,
  '/conocimiento/pendientes': TaskAltOutlined,
  '/conocimiento/activos': FolderOutlined,
  '/criticidad': WarningAmberOutlined,
  '/sucesion': SwapHorizOutlined,
  '/sucesion/mia': SwapHorizOutlined,
  '/acciones': AssignmentOutlined,
  '/deteccion/puntos-unicos-falla': PersonSearchOutlined,
  '/deteccion/mi-brecha': TrendingUpOutlined,
  '/admin': AdminPanelSettingsOutlined,
};

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
          <Box
            component="img"
            src={logoUtn}
            alt="UTN Facultad Regional Tucumán"
            sx={{
              width: 36,
              height: 36,
              mr: 1.5,
              p: 0.5,
              borderRadius: 1,
              bgcolor: '#ffffff',
              objectFit: 'contain',
            }}
          />
          <Typography variant="h6" component="div" noWrap>
            Gestión del conocimiento crítico
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Typography sx={{ mr: 2 }}>{sesion?.nombreUsuario}</Typography>
          <Button
            color="inherit"
            onClick={cerrarSesion}
            startIcon={<LogoutOutlined />}
          >
            Cerrar sesión
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: ANCHO_MENU,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: ANCHO_MENU,
            boxSizing: 'border-box',
            borderRight: 1,
            borderColor: 'divider',
          },
        }}
      >
        <Toolbar />
        <List component="nav" sx={{ px: 1.5, py: 2 }}>
          {secciones.map((s) => {
            const Icono = ICONOS[s.ruta] ?? DashboardOutlined;
            return (
              <ListItemButton
                key={s.ruta}
                component={NavLink}
                to={s.ruta}
                end={s.ruta === '/'}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  borderLeft: 3,
                  borderColor: 'transparent',
                  color: 'text.secondary',
                  '&.active': {
                    bgcolor: 'action.selected',
                    borderColor: 'secondary.main',
                    color: 'primary.main',
                    fontWeight: 600,
                    '& .MuiListItemIcon-root': { color: 'secondary.main' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}>
                  <Icono fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={s.nombre}
                  slotProps={{
                    primary: { sx: { fontWeight: 'inherit', fontSize: 15 } },
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, md: 4 } }}
      >
        <Toolbar />
        <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
