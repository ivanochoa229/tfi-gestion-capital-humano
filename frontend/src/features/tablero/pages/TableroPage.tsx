import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { EstadoServicios } from '../components/EstadoServicios';

export function TableroPage() {
  return (
    <PaginaEnConstruccion
      titulo="Tablero de riesgo"
      descripcion="Puntos únicos de falla, cátedras sostenidas por una sola persona, puestos sin sucesor, brechas de perfil y horizonte de retiro (RF16–RF21)."
    >
      <EstadoServicios />
    </PaginaEnConstruccion>
  );
}
