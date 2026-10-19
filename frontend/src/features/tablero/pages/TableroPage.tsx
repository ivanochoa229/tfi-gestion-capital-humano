import { Alert, Box, CircularProgress, Divider } from '@mui/material';
import { Navigate, useSearchParams } from 'react-router';
import { puedeVer, SECCIONES } from '../../../auth/permisos';
import { useSesion } from '../../../auth/useSesion';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { ROLES_GLOBALES_DETECCION } from '../../deteccion/hooks/useDeteccion';
import { CalidadDeDatos } from '../components/CalidadDeDatos';
import { EstadoServicios } from '../components/EstadoServicios';
import { FiltrosTablero } from '../components/FiltrosTablero';
import { GraficoPuntosUnicos } from '../components/GraficoPuntosUnicos';
import { GraficoRetiros } from '../components/GraficoRetiros';
import { GraficoSinSucesor } from '../components/GraficoSinSucesor';
import { TarjetaIndicador } from '../components/TarjetaIndicador';
import { useTablero } from '../hooks/useTablero';

function armarBusqueda(
  parametros: Record<string, string | number | undefined>,
): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(parametros)) {
    if (v !== undefined && v !== '') {
      qs.set(k, String(v));
    }
  }
  const texto = qs.toString();
  return texto ? `?${texto}` : '';
}

/**
 * Tablero de riesgo consolidado (RF21) reservado a `recursos_humanos` y `autoridad`.
 * Los demás roles son redirigidos automáticamente a la primera sección de su menú.
 */
export function TableroPage() {
  const { data: sesion, isLoading: cargandoSesion } = useSesion();
  const [parametros, setParametros] = useSearchParams();

  const idUnidad = parametros.get('idUnidad') ?? '';
  const mesesParam = Number(parametros.get('meses') ?? '24');
  const mesesEfectivos =
    Number.isInteger(mesesParam) && mesesParam >= 1 && mesesParam <= 120
      ? mesesParam
      : 24;
  const unidadNum = idUnidad ? Number(idUnidad) : undefined;

  const esGlobal = !!sesion && ROLES_GLOBALES_DETECCION.includes(sesion.rol);

  const consulta = useTablero(
    { idUnidad: unidadNum, meses: mesesEfectivos },
    esGlobal,
  );

  if (cargandoSesion) {
    return <CircularProgress aria-label="Cargando sesión" />;
  }

  if (sesion && !esGlobal) {
    const primeraSeccion = SECCIONES.find(
      (s) => s.ruta !== '/' && puedeVer(sesion.rol, s),
    );
    return <Navigate to={primeraSeccion?.ruta ?? '/estructura'} replace />;
  }

  const cambiarUnidad = (nuevoId: string) => {
    const siguientes = new URLSearchParams(parametros);
    if (nuevoId) {
      siguientes.set('idUnidad', nuevoId);
    } else {
      siguientes.delete('idUnidad');
    }
    setParametros(siguientes);
  };

  const cambiarMeses = (nuevosMeses: number) => {
    const siguientes = new URLSearchParams(parametros);
    siguientes.set('meses', String(nuevosMeses));
    setParametros(siguientes);
  };

  const sufijoUnidad = armarBusqueda({ idUnidad: unidadNum });
  const sufijoBrecha = armarBusqueda({
    idUnidad: unidadNum,
    contexto: 'candidato',
  });
  const sufijoHorizonte = armarBusqueda({
    idUnidad: unidadNum,
    meses: mesesEfectivos,
  });

  return (
    <PaginaEnConstruccion
      titulo="Tablero de riesgo (RF21)"
      descripcion="Consolidación de puntos únicos de falla, cátedras sostenidas por una sola persona, puestos críticos sin sucesor, brechas de candidatos y horizonte de retiro (RF16–RF20)."
    >
      <FiltrosTablero
        idUnidad={idUnidad}
        meses={mesesEfectivos}
        onCambiarUnidad={cambiarUnidad}
        onCambiarMeses={cambiarMeses}
      />

      {consulta.isPending ? (
        <CircularProgress aria-label="Cargando indicadores del tablero" />
      ) : consulta.isError ? (
        <Alert severity="error">{consulta.error.message}</Alert>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                lg: 'repeat(5, 1fr)',
              },
              gap: 2,
              mb: 3,
            }}
          >
            <TarjetaIndicador
              titulo="Puntos únicos de falla (RF16)"
              cifraPrincipal={consulta.data.puntosUnicosFalla.unicoPoseedor}
              etiquetaPrincipal="conocimientos con un único poseedor"
              cifraSecundaria={`${consulta.data.puntosUnicosFalla.sinPoseedor} sin poseedor`}
              enlace={`/deteccion/puntos-unicos-falla${sufijoUnidad}`}
            />

            <TarjetaIndicador
              titulo="Cátedras vulnerables (RF17)"
              cifraPrincipal={consulta.data.catedras.unaPersona}
              etiquetaPrincipal="cátedras con una sola persona"
              cifraSecundaria={`${consulta.data.catedras.sinDotacion} sin dotación`}
              enlace={`/deteccion/catedras${sufijoUnidad}`}
            />

            <TarjetaIndicador
              titulo="Puestos sin sucesor (RF18)"
              cifraPrincipal={consulta.data.puestosSinSucesor.total}
              etiquetaPrincipal="puestos críticos sin sucesor preparado"
              enlace={`/deteccion/puestos-sin-sucesor${sufijoUnidad}`}
            />

            <TarjetaIndicador
              titulo="Candidatos con brecha (RF19)"
              cifraPrincipal={consulta.data.candidatosConBrecha}
              etiquetaPrincipal="candidatos en planes aprobados con excluyentes sin cubrir"
              enlace={`/deteccion/brecha${sufijoBrecha}`}
            />

            <TarjetaIndicador
              titulo="Horizonte de retiros (RF20)"
              cifraPrincipal={consulta.data.horizonte.conocimientos}
              etiquetaPrincipal={`conocimientos críticos comprometidos en ${consulta.data.horizonte.meses} meses`}
              enlace={`/deteccion/horizonte${sufijoHorizonte}`}
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            <GraficoPuntosUnicos
              datos={consulta.data.graficos.puntosUnicosPorCatedra}
            />
            <GraficoSinSucesor
              total={consulta.data.puestosSinSucesor.total}
              porMotivo={consulta.data.puestosSinSucesor.porMotivo}
            />
            <GraficoRetiros
              datos={consulta.data.graficos.retirosPorSemestre}
              meses={consulta.data.horizonte.meses}
            />
          </Box>

          <CalidadDeDatos calidad={consulta.data.calidadDeDatos} />
        </>
      )}

      <Divider sx={{ my: 4 }} />
      <Box component="footer">
        <EstadoServicios />
      </Box>
    </PaginaEnConstruccion>
  );
}
