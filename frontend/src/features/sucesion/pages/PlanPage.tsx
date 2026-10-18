import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import { useSesion } from '../../../auth/useSesion';
import { AccionesDelPlan } from '../components/AccionesDelPlan';
import { CandidatosTabla } from '../components/CandidatosTabla';
import { ResolverPlanDialog } from '../components/ResolverPlanDialog';
import {
  colorEstadoPlan,
  etiquetaEstadoPlan,
  ROL_APROBADOR,
  ROL_ELABORADOR,
} from '../estados';
import {
  useCerrarPlan,
  useNuevaVersionPlan,
  usePlan,
  usePresentarPlan,
  useReabrirPlan,
} from '../hooks/useSucesion';

/** Detalle de un plan: estado, resolución, candidatos y acciones. */
export function PlanPage() {
  const { id } = useParams();
  const idPlan = Number(id);
  const navegar = useNavigate();
  const { data: sesion } = useSesion();
  const plan = usePlan(idPlan);
  const presentar = usePresentarPlan();
  const reabrir = useReabrirPlan();
  const nuevaVersion = useNuevaVersionPlan();
  const cerrar = useCerrarPlan();
  const [resolviendo, setResolviendo] = useState<'aprobar' | 'rechazar'>();
  const [error, setError] = useState<string>();

  if (!Number.isInteger(idPlan)) {
    return <Alert severity="error">El plan no existe.</Alert>;
  }
  if (plan.isLoading) return <CircularProgress aria-label="Cargando" />;
  if (plan.isError || !plan.data) {
    return <Alert severity="error">No se pudo cargar el plan.</Alert>;
  }

  const p = plan.data;
  const esJefatura = sesion?.rol === ROL_ELABORADOR;
  const esAutoridad = sesion?.rol === ROL_APROBADOR;

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await accion();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const botones: { clave: string; boton: React.ReactNode }[] = [];
  if (esJefatura) {
    if (p.estado === 'borrador') {
      botones.push({
        clave: 'presentar',
        boton: (
          <Button
            variant="contained"
            disabled={presentar.isPending}
            onClick={() => ejecutar(() => presentar.mutateAsync(p.id))}
          >
            Presentar para aprobación
          </Button>
        ),
      });
    }
    if (p.estado === 'rechazado') {
      botones.push({
        clave: 'reabrir',
        boton: (
          <Button
            variant="contained"
            disabled={reabrir.isPending}
            onClick={() => ejecutar(() => reabrir.mutateAsync(p.id))}
          >
            Reabrir como borrador
          </Button>
        ),
      });
    }
    if (p.estado === 'aprobado') {
      botones.push({
        clave: 'nueva',
        boton: (
          <Button
            variant="contained"
            disabled={nuevaVersion.isPending}
            onClick={() =>
              ejecutar(async () => {
                const nuevo = await nuevaVersion.mutateAsync(p.id);
                navegar(`/sucesion/planes/${nuevo.id}`);
              })
            }
          >
            Nueva versión
          </Button>
        ),
      });
    }
    if (['borrador', 'rechazado', 'aprobado'].includes(p.estado)) {
      botones.push({
        clave: 'cerrar',
        boton: (
          <Button
            color="error"
            variant="outlined"
            disabled={cerrar.isPending}
            onClick={() => {
              if (
                window.confirm(
                  'El plan cerrado no se puede reabrir. ¿Cerrarlo?',
                )
              )
                ejecutar(() => cerrar.mutateAsync(p.id));
            }}
          >
            Cerrar plan
          </Button>
        ),
      });
    }
  }
  if (esAutoridad && p.estado === 'pendiente_aprobacion') {
    botones.push(
      {
        clave: 'aprobar',
        boton: (
          <Button variant="contained" onClick={() => setResolviendo('aprobar')}>
            Aprobar
          </Button>
        ),
      },
      {
        clave: 'rechazar',
        boton: (
          <Button
            color="error"
            variant="outlined"
            onClick={() => setResolviendo('rechazar')}
          >
            Rechazar
          </Button>
        ),
      },
    );
  }

  return (
    <>
      <Link component={RouterLink} to="/sucesion" underline="hover">
        ← Volver a Sucesión
      </Link>
      <Stack
        direction="row"
        spacing={2}
        useFlexGap
        sx={{ alignItems: 'center', flexWrap: 'wrap', mt: 1, mb: 1 }}
      >
        <Typography variant="h4" component="h1">
          Plan de sucesión · {p.codigoPuesto} — {p.denominacionPuesto}
        </Typography>
        <Chip
          label={etiquetaEstadoPlan(p.estado)}
          color={colorEstadoPlan(p.estado)}
        />
      </Stack>
      <Typography>Responsable: {p.nombreResponsable}</Typography>
      <Typography>Elaborado el {p.fechaElaboracion}</Typography>
      {p.idPlanAnterior && (
        <Typography>
          Nueva versión del{' '}
          <Link
            component={RouterLink}
            to={`/sucesion/planes/${p.idPlanAnterior}`}
          >
            plan #{p.idPlanAnterior}
          </Link>
        </Typography>
      )}
      {p.observaciones && (
        <Typography>Observaciones: {p.observaciones}</Typography>
      )}
      {p.fechaResolucion && (
        <Alert
          severity={p.estado === 'rechazado' ? 'error' : 'info'}
          sx={{ mt: 2 }}
        >
          Resuelto por {p.nombreUsuarioResolucion ?? 'un usuario'} el{' '}
          {p.fechaResolucion}
          {p.motivoResolucion ? `. Motivo: ${p.motivoResolucion}` : ''}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      {botones.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          {botones.map((b) => (
            <span key={b.clave}>{b.boton}</span>
          ))}
        </Stack>
      )}

      <Divider sx={{ my: 3 }} />
      <CandidatosTabla
        idPlan={p.id}
        candidatos={p.candidatos}
        puedeEstructurar={esJefatura && p.estado === 'borrador'}
        puedeSeguir={
          esJefatura && (p.estado === 'borrador' || p.estado === 'aprobado')
        }
      />
      <Divider sx={{ my: 3 }} />
      <AccionesDelPlan acciones={p.acciones} />

      {resolviendo && (
        <ResolverPlanDialog
          idPlan={p.id}
          decision={resolviendo}
          onCerrar={() => setResolviendo(undefined)}
        />
      )}
    </>
  );
}
