import { createBrowserRouter } from 'react-router';
import { LoginPage } from './auth/LoginPage';
import { RutaProtegida } from './auth/RutaProtegida';
import { Layout } from './components/Layout';
import { AdminPage } from './features/admin/pages/AdminPage';
import { ActivosPage } from './features/conocimiento/pages/ActivosPage';
import { ConocimientoPage } from './features/conocimiento/pages/ConocimientoPage';
import { MisConocimientosPage } from './features/conocimiento/pages/MisConocimientosPage';
import { PendientesAcreditacionPage } from './features/conocimiento/pages/PendientesAcreditacionPage';
import { CriticidadPage } from './features/criticidad/pages/CriticidadPage';
import { EstructuraPage } from './features/estructura/pages/EstructuraPage';
import { ImportarPersonasPage } from './features/personas/pages/ImportarPersonasPage';
import { MiFichaPage } from './features/personas/pages/MiFichaPage';
import { PersonasPage } from './features/personas/pages/PersonasPage';
import { PlanPage } from './features/sucesion/pages/PlanPage';
import { ROLES_SUCESION } from './features/sucesion/estados';
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
