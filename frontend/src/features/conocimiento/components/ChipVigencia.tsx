import { Chip } from '@mui/material';
import type { Activo } from '../hooks/useActivos';

/** Desde cuántos días antes del vencimiento se avisa. */
const DIAS_DE_AVISO = 30;

/** La etiqueta lleva texto, no solo color. Vigente o sin fecha: no muestra nada. */
export function ChipVigencia({
  activo,
}: {
  activo: Pick<Activo, 'fechaVigencia' | 'vencido' | 'diasParaVencer'>;
}) {
  if (!activo.fechaVigencia) return null;
  if (activo.vencido) {
    return <Chip size="small" color="error" label="Vencido" />;
  }
  const dias = activo.diasParaVencer;
  if (dias === null || dias > DIAS_DE_AVISO) return null;
  const etiqueta =
    dias === 0
      ? 'Vence hoy'
      : dias === 1
        ? 'Vence en 1 día'
        : `Vence en ${dias} días`;
  return <Chip size="small" color="warning" label={etiqueta} />;
}
