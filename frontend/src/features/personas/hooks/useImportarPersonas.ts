import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';

export type ResultadoImportacion = Esquemas['ResultadoImportacionDto'];

interface Args {
  archivo: File;
  /** false: vista previa. true: importa si no hay errores. */
  confirmar: boolean;
}

/** Sube el CSV. Los errores de datos vuelven en `errores`; un rechazo del archivo lanza. */
export function useImportarPersonas() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({
      archivo,
      confirmar,
    }: Args): Promise<ResultadoImportacion> => {
      const cuerpo = new FormData();
      cuerpo.append('archivo', archivo);
      cuerpo.append('confirmar', String(confirmar));
      const respuesta = await fetch('/api/personas/importacion', {
        method: 'POST',
        body: cuerpo,
        credentials: 'include',
      });
      const datos: unknown = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        throw new Error(
          respuesta.status === 413
            ? 'El archivo supera los 2 MB'
            : mensajeError(datos),
        );
      }
      return datos as ResultadoImportacion;
    },
    onSuccess: (resultado) => {
      if (resultado.importado) {
        cliente.invalidateQueries({ queryKey: ['personas'] });
        cliente.invalidateQueries({ queryKey: ['ocupaciones'] });
      }
    },
  });
}
