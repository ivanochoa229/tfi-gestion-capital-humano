import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ROLES_GLOBALES_DE_DETECCION } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { ParesService } from '../criticidad/pares.service.js';
import { CoberturaService } from '../sucesion/cobertura.service.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import {
  MESES_HORIZONTE_DEFECTO,
  MOTIVO_SIN_SUCESOR,
} from './deteccion.constantes.js';
import { DeteccionService } from './deteccion.service.js';
import type { FiltroTableroDto, TableroDto } from './dto/tablero.dto.js';
import {
  SQL_PUNTOS_UNICOS_POR_CATEDRA,
  SQL_RETIROS_POR_SEMESTRE,
} from './tablero.sql.js';

interface FilaPuntoUnicoPorCatedra {
  id_unidad: number;
  denominacion: string;
  cantidad: number;
}

interface FilaRetiroPorSemestre {
  semestre: string;
  cantidad: number;
}

const ORDEN_MOTIVOS_SIN_SUCESOR = [
  MOTIVO_SIN_SUCESOR.sinPlan,
  MOTIVO_SIN_SUCESOR.planEnElaboracion,
  MOTIVO_SIN_SUCESOR.ningunCandidatoCubre,
] as const;

/**
 * Tablero de riesgo consolidado (RF21, RNF04).
 * Cada cifra de tarjeta proviene de los mismos métodos de `DeteccionService`
 * que alimentan los listados, evitando divergencias entre tarjeta y tabla.
 */
@Injectable()
export class TableroService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alcance: AlcanceService,
    private readonly deteccion: DeteccionService,
    private readonly pares: ParesService,
    private readonly cobertura: CoberturaService,
  ) {}

  async tablero(
    filtro: FiltroTableroDto,
    sesion: SesionUsuario,
  ): Promise<TableroDto> {
    if (
      !(ROLES_GLOBALES_DE_DETECCION as readonly string[]).includes(sesion.rol)
    ) {
      throw new ForbiddenException(
        'El tablero de riesgo está reservado a roles con alcance global',
      );
    }

    const filtroUnidad =
      filtro.idUnidad !== undefined ? { idUnidad: filtro.idUnidad } : {};
    const filtroHorizonte = {
      ...filtroUnidad,
      ...(filtro.meses !== undefined ? { meses: filtro.meses } : {}),
    };
    const mesesEfectivos = filtro.meses ?? MESES_HORIZONTE_DEFECTO;

    const visibles = await this.alcance.unidadesVisibles(sesion);
    const idUnidadParam = filtro.idUnidad ?? null;

    const [
      puntosUnicos,
      catedras,
      sinSucesor,
      horizonte,
      brechas,
      avanceCriticidad,
      coberturaPlanes,
      filasPuntosPorCatedra,
      filasRetirosPorSemestre,
    ] = await Promise.all([
      this.deteccion.puntosUnicosFalla(filtroUnidad, sesion),
      this.deteccion.catedrasUnaPersona(filtroUnidad, sesion),
      this.deteccion.puestosSinSucesor(filtroUnidad, sesion),
      this.deteccion.horizonteRiesgo(filtroHorizonte, sesion),
      this.deteccion.brecha(filtroUnidad, sesion),
      this.pares.avance(filtroUnidad, sesion),
      this.cobertura.cobertura(filtroUnidad, sesion),
      this.dataSource.query<FilaPuntoUnicoPorCatedra[]>(
        SQL_PUNTOS_UNICOS_POR_CATEDRA,
        [visibles, idUnidadParam],
      ),
      this.dataSource.query<FilaRetiroPorSemestre[]>(SQL_RETIROS_POR_SEMESTRE, [
        visibles,
        idUnidadParam,
        mesesEfectivos,
      ]),
    ]);

    const conteoMotivos = new Map<string, number>();
    for (const m of ORDEN_MOTIVOS_SIN_SUCESOR) {
      conteoMotivos.set(m, 0);
    }
    for (const p of sinSucesor) {
      conteoMotivos.set(p.motivo, (conteoMotivos.get(p.motivo) ?? 0) + 1);
    }

    const candidatosConBrechaSet = new Set<number>();
    let acreditados = 0;
    let totalRequisitosOcupados = 0;

    for (const fila of brechas) {
      if (
        fila.contexto === 'candidato' &&
        fila.estadoPlan === 'aprobado' &&
        fila.resumen.excluyentesCubiertos < fila.resumen.excluyentesTotal
      ) {
        candidatosConBrechaSet.add(fila.idPersona);
      }
      if (fila.contexto === 'ocupante') {
        for (const c of fila.conocimientos) {
          totalRequisitosOcupados += 1;
          if (c.nivelAcreditado !== null) {
            acreditados += 1;
          }
        }
      }
    }

    return {
      puntosUnicosFalla: {
        unicoPoseedor: puntosUnicos.unicoPoseedor.length,
        sinPoseedor: puntosUnicos.sinPoseedor.length,
      },
      catedras: {
        unaPersona: catedras.unaPersona.length,
        sinDotacion: catedras.sinDotacion.length,
      },
      puestosSinSucesor: {
        total: sinSucesor.length,
        porMotivo: ORDEN_MOTIVOS_SIN_SUCESOR.map((motivo) => ({
          motivo,
          cantidad: conteoMotivos.get(motivo) ?? 0,
        })),
      },
      candidatosConBrecha: candidatosConBrechaSet.size,
      horizonte: {
        meses: horizonte.meses,
        conocimientos: horizonte.conocimientos.length,
      },
      graficos: {
        puntosUnicosPorCatedra: filasPuntosPorCatedra.map((f) => ({
          idUnidad: f.id_unidad,
          denominacion: f.denominacion,
          cantidad: f.cantidad,
        })),
        retirosPorSemestre: filasRetirosPorSemestre.map((f) => ({
          semestre: f.semestre,
          cantidad: f.cantidad,
        })),
      },
      calidadDeDatos: {
        criticidad: {
          evaluados: avanceCriticidad.evaluados,
          total: avanceCriticidad.total,
        },
        planes: {
          criticos: coberturaPlanes.criticos,
          conPlan: coberturaPlanes.conPlan,
        },
        acreditacion: {
          acreditados,
          total: totalRequisitosOcupados,
        },
      },
    };
  }
}
