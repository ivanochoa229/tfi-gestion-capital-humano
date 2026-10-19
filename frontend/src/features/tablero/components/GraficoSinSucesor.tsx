import { Alert, Box, Paper, Typography, useTheme } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MotivoSinSucesorTablero } from '../hooks/useTablero';

interface Propiedades {
  total: number;
  porMotivo: MotivoSinSucesorTablero[];
}

/**
 * Gráfico de barras apiladas con el desglose por motivo de los puestos críticos
 * sin sucesor preparado (RF18, decisión 26).
 */
export function GraficoSinSucesor({ total, porMotivo }: Propiedades) {
  const tema = useTheme();

  const cantidadDe = (motivo: string) =>
    porMotivo.find((m) => m.motivo === motivo)?.cantidad ?? 0;

  const filaApilada = [
    {
      categoria: 'Puestos sin sucesor',
      sinPlan: cantidadDe('sin_plan'),
      planEnElaboracion: cantidadDe('plan_en_elaboracion'),
      ningunCandidatoCubre: cantidadDe('ningun_candidato_cubre'),
    },
  ];

  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        Puestos críticos sin sucesor por motivo (RF18)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Distribución entre puestos sin plan, con plan en elaboración y con plan
        aprobado cuyos candidatos no cubren los excluyentes.
      </Typography>

      {total === 0 ? (
        <Alert severity="info">
          No hay puestos críticos sin sucesor preparado para el filtro
          seleccionado.
        </Alert>
      ) : (
        <Box sx={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={filaApilada}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="categoria" hide />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="sinPlan"
                name="Sin plan"
                stackId="motivos"
                fill={tema.palette.error.main}
              >
                <LabelList dataKey="sinPlan" position="inside" fill="#fff" />
              </Bar>
              <Bar
                dataKey="planEnElaboracion"
                name="Plan en elaboración"
                stackId="motivos"
                fill={tema.palette.warning.main}
              >
                <LabelList
                  dataKey="planEnElaboracion"
                  position="inside"
                  fill="#fff"
                />
              </Bar>
              <Bar
                dataKey="ningunCandidatoCubre"
                name="Ningún candidato cubre"
                stackId="motivos"
                fill={tema.palette.info.main}
              >
                <LabelList
                  dataKey="ningunCandidatoCubre"
                  position="inside"
                  fill="#fff"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  );
}
