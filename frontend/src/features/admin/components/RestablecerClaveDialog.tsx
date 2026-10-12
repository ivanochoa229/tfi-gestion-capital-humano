import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRestablecerClave, type Usuario } from '../hooks/useUsuarios';

const esquema = z.object({
  clave: z.string().min(10, 'Al menos 10 caracteres'),
});
type Datos = z.infer<typeof esquema>;

interface Props {
  usuario: Usuario;
  onCerrar: () => void;
}

export function RestablecerClaveDialog({ usuario, onCerrar }: Props) {
  const restablecer = useRestablecerClave();
  const [error, setError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({ resolver: zodResolver(esquema) });

  const guardar = handleSubmit(async ({ clave }) => {
    try {
      await restablecer.mutateAsync({ id: usuario.id, clave });
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="xs">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>Restablecer clave de {usuario.nombreUsuario}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            label="Clave nueva"
            type="password"
            fullWidth
            sx={{ mt: 1 }}
            {...register('clave')}
            error={!!errors.clave}
            helperText={errors.clave?.message}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            Restablecer
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
