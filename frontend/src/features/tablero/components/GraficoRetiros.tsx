import { Alert, Box, Paper, Typography, useTheme } from '@mui/material';
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RetiroPorSemestre } from '../hooks/useTablero';

interface Propiedades {
  datos: RetiroPorSemestre[];
  meses: number;
}

/**
 * Gráfico de línea con la evolución por semestre de los retiros previstos de
 * poseedores de conocimientos críticos dentro del horizonte (RF20, decisión 26).
 */
export function GraficoRetiros({ datos, meses }: Propiedades) {
  const tema = useTheme();

  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        Retiros previstos por semestre en {meses} meses (RF20)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Cantidad de pérdidas de poseedores acreditados en conocimientos críticos
        agrupadas por semestre calendario.
      </Typography>

      {datos.length === 0 ? (
        <Alert severity="info">
          No se registran retiros de poseedores de conocimientos críticos en los
          próximos {meses} meses.
        </Alert>
      ) : (
        <Box sx={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={datos}
              margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="semestre" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="cantidad"
                name="Retiros en conocimientos críticos"
                stroke={tema.palette.secondary.main}
                strokeWidth={2}
              >
                <LabelList dataKey="cantidad" position="top" />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  );
}
