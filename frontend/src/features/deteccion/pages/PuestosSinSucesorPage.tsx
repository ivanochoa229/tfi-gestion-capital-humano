import {
  Alert,
  Chip,
  CircularProgress,
  Link,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { BotonExportarCsv } from '../components/BotonExportarCsv';
import { ListadoConPestanias } from '../components/ListadoConPestanias';
import {
  usePuestosSinSucesor,
  type FiltroSinSucesor,
} from '../hooks/useDeteccion';

const MOTIVOS: {
  codigo: NonNullable<FiltroSinSucesor['motivo']>;
  etiqueta: string;
  color: 'error' | 'warning' | 'info';
}[] = [
  { codigo: 'sin_plan', etiqueta: 'Sin plan de sucesión', color: 'error' },
  {
    codigo: 'plan_en_elaboracion',
    etiqueta: 'Plan en elaboración',
    color: 'warning',
  },
  {
    codigo: 'ningun_candidato_cubre',
    etiqueta: 'Ningún candidato válido cubre los excluyentes',
    color: 'info',
  },
];

function etiquetaMotivo(codigo: string) {
  return (
    MOTIVOS.find((m) => m.codigo === codigo) ?? {
      codigo,
      etiqueta: codigo,
      color: 'warning' as const,
    }
  );
}

/**
 * RF18: Puestos críticos sin un sucesor preparado válido en un plan aprobado,
 * detallando el motivo y el enlace al plan cuando existe.
 */
export function PuestosSinSucesorPage() {
  const [parametros, setParametros] = useSearchParams();
  const idUnidad = parametros.get('idUnidad') ?? '';
  const motivoParam = parametros.get('motivo') ?? '';

  const unidadNum = idUnidad ? Number(idUnidad) : undefined;
  const motivoFiltro = (
    MOTIVOS.some((m) => m.codigo === motivoParam) ? motivoParam : undefined
  ) as FiltroSinSucesor['motivo'];

  const consulta = usePuestosSinSucesor({
    idUnidad: unidadNum,
    motivo: motivoFiltro,
  });

  const actualizarParametro = (clave: string, valor: string) => {
    const siguientes = new URLSearchParams(parametros);
    if (valor) {
      siguientes.set(clave, valor);
    } else {
      siguientes.delete(clave);
    }
    setParametros(siguientes);
  };

  return (
    <ListadoConPestanias
      titulo="Puestos críticos sin sucesor preparado"
      descripcion="Puestos con al menos un requisito excluyente de criticidad vigente alta que aún no cuentan con un candidato válido en un plan aprobado que cubra todos sus requisitos excluyentes."
      idUnidad={idUnidad}
      onCambiarUnidad={(v) => actualizarParametro('idUnidad', v)}
      filtrosExtra={
        <TextField
          select
          size="small"
          label="Motivo"
          value={motivoParam}
          onChange={(e) => actualizarParametro('motivo', e.target.value)}
          sx={{ minWidth: 260 }}
        >
          <MenuItem value="">Todos los motivos</MenuItem>
          {MOTIVOS.map((m) => (
            <MenuItem key={m.codigo} value={m.codigo}>
              {m.etiqueta}
            </MenuItem>
          ))}
        </TextField>
      }
      accionesExtra={
        <BotonExportarCsv
          ruta="/api/deteccion/puestos-sin-sucesor"
          filtro={{ idUnidad: unidadNum, motivo: motivoFiltro }}
          nombreArchivo="puestos-sin-sucesor.csv"
        />
      }
    >
      {consulta.isPending ? (
        <CircularProgress aria-label="Cargando puestos sin sucesor" />
      ) : consulta.isError ? (
        <Alert severity="error">{consulta.error.message}</Alert>
      ) : consulta.data.length === 0 ? (
        <Alert severity="info">
          Todos los puestos críticos del filtro cuentan con un sucesor preparado
          válido.
        </Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Puesto</TableCell>
              <TableCell>Motivo</TableCell>
              <TableCell>Plan vinculado</TableCell>
              <TableCell>Candidatos válidos / total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {consulta.data.map((f) => {
              const info = etiquetaMotivo(f.motivo);
              return (
                <TableRow key={f.idPuesto}>
                  <TableCell>
                    {f.codigo} — {f.denominacion}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={info.color}
                      label={info.etiqueta}
                    />
                  </TableCell>
                  <TableCell>
                    {f.idPlan ? (
                      <Link
                        component={RouterLink}
                        to={`/sucesion/planes/${f.idPlan}`}
                      >
                        Plan #{f.idPlan}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {f.candidatosValidos} de {f.candidatosTotal}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </ListadoConPestanias>
  );
}
