import {
  Alert,
  Box,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { CalidadDeDatosTablero } from '../hooks/useTablero';

interface Propiedades {
  calidad: CalidadDeDatosTablero;
}

function BarraCobertura({
  etiqueta,
  numerador,
  denominador,
}: {
  etiqueta: string;
  numerador: number;
  denominador: number;
}) {
  const porcentaje =
    denominador > 0 ? Math.round((numerador / denominador) * 100) : 0;

  return (
    <Box sx={{ flex: 1, minWidth: 220 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {etiqueta}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {numerador} de {denominador} ({porcentaje}%)
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={porcentaje}
        color={porcentaje === 100 ? 'success' : 'primary'}
        aria-label={etiqueta}
      />
    </Box>
  );
}

/**
 * Franja de calidad de datos del tablero (decisión 20): muestra el grado de
 * completitud de la evaluación de criticidad, de los planes aprobados y de las
 * acreditaciones de nivel, advirtiendo cuando el riesgo puede estar sobreestimado.
 */
export function CalidadDeDatos({ calidad }: Propiedades) {
  const incompleta =
    calidad.criticidad.evaluados < calidad.criticidad.total ||
    calidad.planes.conPlan < calidad.planes.criticos ||
    calidad.acreditacion.acreditados < calidad.acreditacion.total;

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
        Calidad y cobertura de los datos de base
      </Typography>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={3}
        sx={{ mb: incompleta ? 2 : 0 }}
      >
        <BarraCobertura
          etiqueta="Criticidad evaluada (OE5)"
          numerador={calidad.criticidad.evaluados}
          denominador={calidad.criticidad.total}
        />
        <BarraCobertura
          etiqueta="Puestos críticos con plan aprobado (OE7)"
          numerador={calidad.planes.conPlan}
          denominador={calidad.planes.criticos}
        />
        <BarraCobertura
          etiqueta="Requisitos ocupados con nivel acreditado (OE4)"
          numerador={calidad.acreditacion.acreditados}
          denominador={calidad.acreditacion.total}
        />
      </Stack>

      {incompleta && (
        <Alert severity="info">
          Mientras las evaluaciones de criticidad, la aprobación de planes o las
          acreditaciones de nivel no estén completas, los indicadores de puntos
          únicos de falla y puestos sin sucesor sobreestiman el riesgo real.
        </Alert>
      )}
    </Paper>
  );
}
