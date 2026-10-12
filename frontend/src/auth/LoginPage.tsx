import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { api } from '../api/cliente';

const esquema = z.object({
  nombreUsuario: z.string().min(1, 'Ingresá tu usuario'),
  clave: z.string().min(1, 'Ingresá tu clave'),
});
type Datos = z.infer<typeof esquema>;

export function LoginPage() {
  const [error, setError] = useState<string>();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const cliente = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({ resolver: zodResolver(esquema) });

  const ingresar = handleSubmit(async (datos) => {
    setError(undefined);
    const { data } = await api.POST('/api/auth/login', { body: datos });
    if (!data) {
      setError('Usuario o clave incorrectos');
      return;
    }
    cliente.setQueryData(['sesion'], data);
    const desde = (ubicacion.state as { desde?: string } | null)?.desde ?? '/';
    navegar(desde, { replace: true });
  });

  return (
    <Box
      sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh', p: 2 }}
    >
      <Paper
        component="form"
        onSubmit={ingresar}
        noValidate
        sx={{ p: 4, width: 360 }}
      >
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">
            Gestión del conocimiento crítico
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Usuario"
            autoComplete="username"
            autoFocus
            {...register('nombreUsuario')}
            error={!!errors.nombreUsuario}
            helperText={errors.nombreUsuario?.message}
          />
          <TextField
            label="Clave"
            type="password"
            autoComplete="current-password"
            {...register('clave')}
            error={!!errors.clave}
            helperText={errors.clave?.message}
          />
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            Ingresar
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
