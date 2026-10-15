import { Alert } from '@mui/material';
import { useSesion } from '../../../auth/useSesion';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { FichaPersona } from '../components/FichaPersona';

/** El docente ve su propia persona y sus ocupaciones, en solo lectura. */
export function MiFichaPage() {
  const { data: sesion } = useSesion();
  return (
    <PaginaEnConstruccion
      titulo="Mi ficha"
      descripcion="Tus datos y tus ocupaciones, con el historial."
    >
      {sesion?.idPersona == null ? (
        <Alert severity="warning">
          Tu usuario todavía no tiene una persona vinculada. Pedile al
          administrador que la asigne.
        </Alert>
      ) : (
        <FichaPersona idPersona={sesion.idPersona} puedeEditar={false} verConocimientos />
      )}
    </PaginaEnConstruccion>
  );
}
