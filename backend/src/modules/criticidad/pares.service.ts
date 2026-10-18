import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import type {
  AvanceDto,
  FiltroParesDto,
  ParCriticidadDto,
} from './dto/pares.dto.js';
import { SQL_AVANCE, SQL_PARES } from './pares.sql.js';

interface FilaPar {
  id_puesto: number;
  codigo_puesto: string;
  denominacion_puesto: string;
  id_unidad: number;
  id_conocimiento: number;
  denominacion_conocimiento: string;
  id_nivel_requerido: number;
  es_excluyente: boolean;
  id_evaluacion: number | null;
  id_nivel_impacto: number | null;
  id_nivel_dificultad: number | null;
  id_nivel_criticidad: number | null;
  fecha_evaluacion: string | null;
}

/**
 * Pares conocimiento-puesto con su evaluación vigente y avance de OE5 (RNF04:
 * todo por consulta, nada almacenado). El universo son los requisitos activos
 * del alcance de quien consulta.
 */
@Injectable()
export class ParesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alcance: AlcanceService,
  ) {}

  async pares(
    filtro: FiltroParesDto,
    sesion: SesionUsuario,
  ): Promise<ParCriticidadDto[]> {
    const visibles = await this.alcance.unidadesVisibles(sesion);
    const filas: FilaPar[] = await this.dataSource.query(SQL_PARES, [
      visibles,
      filtro.idUnidad ?? null,
      filtro.idPuesto ?? null,
      filtro.estado ?? null,
    ]);
    return filas.map((f) => ({
      idPuesto: f.id_puesto,
      codigoPuesto: f.codigo_puesto,
      denominacionPuesto: f.denominacion_puesto,
      idUnidad: f.id_unidad,
      idConocimiento: f.id_conocimiento,
      denominacionConocimiento: f.denominacion_conocimiento,
      idNivelRequerido: f.id_nivel_requerido,
      esExcluyente: f.es_excluyente,
      estado: f.id_evaluacion === null ? 'pendiente' : 'evaluado',
      idEvaluacion: f.id_evaluacion,
      idNivelImpacto: f.id_nivel_impacto,
      idNivelDificultad: f.id_nivel_dificultad,
      idNivelCriticidad: f.id_nivel_criticidad,
      fechaEvaluacion: f.fecha_evaluacion,
    }));
  }

  async avance(
    filtro: FiltroParesDto,
    sesion: SesionUsuario,
  ): Promise<AvanceDto> {
    const visibles = await this.alcance.unidadesVisibles(sesion);
    const [fila]: { evaluados: number; total: number }[] =
      await this.dataSource.query(SQL_AVANCE, [
        visibles,
        filtro.idUnidad ?? null,
        filtro.idPuesto ?? null,
      ]);
    return { evaluados: fila.evaluados, total: fila.total };
  }
}
