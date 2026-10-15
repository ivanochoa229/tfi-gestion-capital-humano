import { createBrowserRouter } from 'react-router';
import { LoginPage } from './auth/LoginPage';
import { RutaProtegida } from './auth/RutaProtegida';
import { Layout } from './components/Layout';
import { AdminPage } from './features/admin/pages/AdminPage';
import { ConocimientoPage } from './features/conocimiento/pages/ConocimientoPage';
import { CriticidadPage } from './features/criticidad/pages/CriticidadPage';
import { EstructuraPage } from './features/estructura/pages/EstructuraPage';
import { ImportarPersonasPage } from './features/personas/pages/ImportarPersonasPage';
import { MiFichaPage } from './features/personas/pages/MiFichaPage';
import { PersonasPage } from './features/personas/pages/PersonasPage';
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
      { path: 'criticidad', element: <CriticidadPage /> },
      { path: 'sucesion', element: <SucesionPage /> },
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
