import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { useCambiarEstadoPersona, usePersona } from '../hooks/usePersonas';
import { FormularioPersona } from './FormularioPersona';
import { TablaOcupaciones } from './TablaOcupaciones';
import { ConocimientosDePersona } from '../../conocimiento/components/ConocimientosDePersona';

interface Props {
  idPersona: number;
  /** Solo RR. HH. escribe. */
  puedeEditar: boolean;
  /** Quien puede leer el conocimiento de la persona (RR. HH., autoridad, jefatura, jefes, la propia persona). */
  verConocimientos?: boolean;
  /** Jefatura y jefes de cátedra. */
  puedeAcreditar?: boolean;
}

export function FichaPersona({
  idPersona,
  puedeEditar,
  verConocimientos = false,
  puedeAcreditar = false,
}: Props) {
  const { data: persona, isLoading, isError } = usePersona(idPersona);
  const { data: situaciones } = useValoresReferencia('situacion-revista', true);
  const cambiarEstado = useCambiarEstadoPersona();
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string>();
  const [avisos, setAvisos] = useState<string[]>([]);

  if (isLoading) return <CircularProgress aria-label="Cargando" />;
  if (isError || !persona) {
    return <Alert severity="error">No se pudo cargar la persona.</Alert>;
  }

  const alternar = async () => {
    setError(undefined);
    setAvisos([]);
    try {
      setAvisos(
        await cambiarEstado.mutateAsync({
          id: persona.id,
          accion: persona.activo ? 'baja' : 'reactivar',
        }),
      );
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const dato = (etiqueta: string, valor: string | null | undefined) => (
    <Stack>
      <Typography variant="caption" color="text.secondary">
        {etiqueta}
      </Typography>
      <Typography>{valor || '—'}</Typography>
    </Stack>
  );

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Typography variant="h5" component="h2" sx={{ flexGrow: 1 }}>
          {persona.apellido}, {persona.nombre}
        </Typography>
        <Chip
          size="small"
          label={persona.activo ? 'Activa' : 'De baja'}
          color={persona.activo ? 'success' : 'default'}
        />
        {persona.tieneUsuario && <Chip size="small" label="Con usuario" />}
        {puedeEditar && (
          <>
            <Button onClick={() => setEditando(true)}>Editar</Button>
            <Button onClick={alternar} disabled={cambiarEstado.isPending}>
              {persona.activo ? 'Dar de baja' : 'Reactivar'}
            </Button>
          </>
        )}
      </Stack>
      {error && (
        <Alert severity="error" onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      {avisos.map((aviso) => (
        <Alert key={aviso} severity="warning">
          {aviso}
        </Alert>
      ))}
      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 4 }}>
        {dato('Legajo', persona.legajo)}
        {persona.documento !== undefined &&
          dato('Documento', persona.documento)}
        {persona.fechaNacimiento !== undefined &&
          dato('Fecha de nacimiento', persona.fechaNacimiento)}
        {dato('Fecha de ingreso', persona.fechaIngreso)}
        {dato(
          'Situación de revista',
          situaciones?.find((s) => s.id === persona.idSituacionRevista)
            ?.denominacion,
        )}
        {dato('Retiro previsto', persona.fechaPrevistaRetiro)}
      </Stack>
      <TablaOcupaciones
        idPersona={persona.id}
        puedeEditar={puedeEditar}
        admiteNuevas={persona.activo}
      />
      {verConocimientos && (
        <ConocimientosDePersona idPersona={persona.id} puedeAcreditar={puedeAcreditar} />
      )}
      {editando && (
        <FormularioPersona
          persona={persona}
          onCerrar={() => setEditando(false)}
        />
      )}
    </Stack>
  );
}
