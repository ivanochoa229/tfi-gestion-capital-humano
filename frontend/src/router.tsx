import { createBrowserRouter, Navigate } from 'react-router';
import { LoginPage } from './auth/LoginPage';
import { RutaProtegida } from './auth/RutaProtegida';
import { Layout } from './components/Layout';
import { AdminPage } from './features/admin/pages/AdminPage';
import { ActivosPage } from './features/conocimiento/pages/ActivosPage';
import { ConocimientoPage } from './features/conocimiento/pages/ConocimientoPage';
import { MisConocimientosPage } from './features/conocimiento/pages/MisConocimientosPage';
import { PendientesAcreditacionPage } from './features/conocimiento/pages/PendientesAcreditacionPage';
import { CriticidadPage } from './features/criticidad/pages/CriticidadPage';
import {
  ROLES_LECTORES_DETECCION,
  ROLES_MI_BRECHA,
} from './features/deteccion/hooks/useDeteccion';
import { BrechaPage } from './features/deteccion/pages/BrechaPage';
import { CatedrasPage } from './features/deteccion/pages/CatedrasPage';
import { HorizontePage } from './features/deteccion/pages/HorizontePage';
import { PuestosSinSucesorPage } from './features/deteccion/pages/PuestosSinSucesorPage';
import { PuntosUnicosPage } from './features/deteccion/pages/PuntosUnicosPage';
import { EstructuraPage } from './features/estructura/pages/EstructuraPage';
import { ImportarPersonasPage } from './features/personas/pages/ImportarPersonasPage';
import { MiFichaPage } from './features/personas/pages/MiFichaPage';
import { PersonasPage } from './features/personas/pages/PersonasPage';
import { ROLES_ACCIONES, ROLES_SUCESION } from './features/sucesion/estados';
import { AccionesPage } from './features/sucesion/pages/AccionesPage';
import { MiSucesionPage } from './features/sucesion/pages/MiSucesionPage';
import { PlanPage } from './features/sucesion/pages/PlanPage';
import { SucesionPage } from './features/sucesion/pages/SucesionPage';
import { TableroPage } from './features/tablero/pages/TableroPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RutaProtegida>
        <Layout />
      </RutaProtegida>
    ),
    children: [
      { index: true, element: <TableroPage /> },
      { path: 'estructura', element: <EstructuraPage /> },
      { path: 'personas', element: <PersonasPage /> },
      {
        path: 'personas/importar',
        element: (
          <RutaProtegida roles={['recursos_humanos']}>
            <ImportarPersonasPage />
          </RutaProtegida>
        ),
      },
      { path: 'personas/yo', element: <MiFichaPage /> },
      { path: 'conocimiento', element: <ConocimientoPage /> },
      {
        path: 'conocimiento/mios',
        element: (
          <RutaProtegida
            roles={['docente', 'jefe_catedra', 'jefatura_departamento']}
          >
            <MisConocimientosPage />
          </RutaProtegida>
        ),
      },
      {
        path: 'conocimiento/pendientes',
        element: (
          <RutaProtegida roles={['jefe_catedra', 'jefatura_departamento']}>
            <PendientesAcreditacionPage />
          </RutaProtegida>
        ),
      },
      { path: 'conocimiento/activos', element: <ActivosPage /> },
      {
        path: 'criticidad',
        element: (
          <RutaProtegida
            roles={[
              'recursos_humanos',
              'autoridad',
              'jefatura_departamento',
              'jefe_catedra',
            ]}
          >
            <CriticidadPage />
          </RutaProtegida>
        ),
      },
      {
        path: 'sucesion',
        element: (
          <RutaProtegida roles={ROLES_SUCESION}>
            <SucesionPage />
          </RutaProtegida>
        ),
      },
      {
        path: 'sucesion/planes/:id',
        element: (
          <RutaProtegida roles={ROLES_SUCESION}>
            <PlanPage />
          </RutaProtegida>
        ),
      },
      {
        path: 'sucesion/mia',
        element: (
          <RutaProtegida roles={['docente']}>
            <MiSucesionPage />
          </RutaProtegida>
        ),
      },
      {
        path: 'acciones',
        element: (
          <RutaProtegida roles={ROLES_ACCIONES}>
            <AccionesPage />
          </RutaProtegida>
        ),
      },
      {
        path: 'deteccion',
        element: <Navigate to="/deteccion/puntos-unicos-falla" replace />,
      },
      {
        path: 'deteccion/puntos-unicos-falla',
        element: (
          <RutaProtegida roles={ROLES_LECTORES_DETECCION}>
            <PuntosUnicosPage />
          </RutaProtegida>
        ),
      },
      {
        path: 'deteccion/catedras',
        element: (
          <RutaProtegida roles={ROLES_LECTORES_DETECCION}>
            <CatedrasPage />
          </RutaProtegida>
        ),
      },
      {
        path: 'deteccion/puestos-sin-sucesor',
        element: (
          <RutaProtegida roles={ROLES_LECTORES_DETECCION}>
            <PuestosSinSucesorPage />
          </RutaProtegida>
        ),
      },
      {
        path: 'deteccion/horizonte',
        element: (
          <RutaProtegida roles={ROLES_LECTORES_DETECCION}>
            <HorizontePage />
          </RutaProtegida>
        ),
      },
      {
        path: 'deteccion/brecha',
        element: (
          <RutaProtegida roles={ROLES_LECTORES_DETECCION}>
            <BrechaPage modo="gestion" />
          </RutaProtegida>
        ),
      },
      {
        path: 'deteccion/mi-brecha',
        element: (
          <RutaProtegida roles={ROLES_MI_BRECHA}>
            <BrechaPage modo="propia" />
          </RutaProtegida>
        ),
      },
      {
        path: 'admin',
        element: (
          <RutaProtegida roles={['administrador']}>
            <AdminPage />
          </RutaProtegida>
        ),
      },
    ],
  },
]);
