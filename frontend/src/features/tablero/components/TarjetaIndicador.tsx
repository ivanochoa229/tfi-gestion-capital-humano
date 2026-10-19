import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';

interface Propiedades {
  titulo: string;
  cifraPrincipal: number;
  etiquetaPrincipal: string;
  cifraSecundaria?: string;
  enlace: string;
  textoEnlace?: string;
}

/**
 * Tarjeta de indicador del tablero de riesgo (RF21, decisión 25).
 * Cumple RNF06: combina color e indicador textual explícito de estado («En riesgo» / «Sin hallazgos»).
 */
export function TarjetaIndicador({
  titulo,
  cifraPrincipal,
  etiquetaPrincipal,
  cifraSecundaria,
  enlace,
  textoEnlace = 'Ver listado detallado',
}: Propiedades) {
  const hayRiesgo =
    cifraPrincipal > 0 ||
    (cifraSecundaria !== undefined && !cifraSecundaria.startsWith('0 '));

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <Box>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 1,
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            {titulo}
          </Typography>
          <Chip
            size="small"
            color={hayRiesgo ? 'warning' : 'success'}
            label={hayRiesgo ? 'Atención requerida' : 'Sin hallazgos'}
          />
        </Stack>

        <Typography variant="h3" component="p" sx={{ fontWeight: 700 }}>
          {cifraPrincipal}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {etiquetaPrincipal}
        </Typography>

        {cifraSecundaria && (
          <Typography
            variant="body2"
            color={
              cifraSecundaria.startsWith('0 ') ? 'text.secondary' : 'error.main'
            }
            sx={{ mt: 0.5, fontWeight: 500 }}
          >
            + {cifraSecundaria}
          </Typography>
        )}
      </Box>

      <Box sx={{ mt: 2 }}>
        <Button
          component={RouterLink}
          to={enlace}
          size="small"
          variant="text"
          sx={{ px: 0 }}
        >
          {textoEnlace}
        </Button>
      </Box>
    </Paper>
  );
}
