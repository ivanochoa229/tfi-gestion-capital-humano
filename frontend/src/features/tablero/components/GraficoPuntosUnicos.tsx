import { Alert, Box, Paper, Typography, useTheme } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PuntoUnicoPorCatedra } from '../hooks/useTablero';

interface Propiedades {
  datos: PuntoUnicoPorCatedra[];
}

/**
 * Gráfico de barras con la cantidad de conocimientos críticos que tienen un
 * único poseedor, agrupados por la cátedra del puesto crítico (RF16, decisión 26).
 */
export function GraficoPuntosUnicos({ datos }: Propiedades) {
  const tema = useTheme();

  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        Puntos únicos de falla por cátedra
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Conocimientos críticos con un único poseedor vigente según la unidad de
        sus puestos críticos.
      </Typography>

      {datos.length === 0 ? (
        <Alert severity="info">
          No hay puntos únicos de falla con un poseedor para graficar en el
          alcance seleccionado.
        </Alert>
      ) : (
        <Box sx={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={datos}
              margin={{ top: 20, right: 20, left: 0, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="denominacion" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar
                dataKey="cantidad"
                name="Conocimientos con 1 poseedor"
                fill={tema.palette.primary.main}
              >
                <LabelList dataKey="cantidad" position="top" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  );
}
