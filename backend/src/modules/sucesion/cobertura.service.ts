import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { SQL_COBERTURA, SQL_MIS_PLANES } from './cobertura.sql.js';
import type {
  CoberturaDto,
  MiPlanDto,
  PuestoSinPlanDto,
} from './dto/cobertura.dto.js';

interface FilaCobertura {
  id_puesto: number;
  codigo: string;
  denominacion: string;
  id_unidad: number;
  tiene_aprobado: boolean;
  id_plan_en_elaboracion: number | null;
  estado_plan_en_elaboracion: string | null;
}

interface FilaMiPlan {
  id_plan: number;
  id_puesto: number;
  denominacion_puesto: string;
  estado_plan: string;
  estado_preparacion: string;
  fecha_disponibilidad_estimada: string | null;
}

/**
 * Cobertura de OE7 (RNF04: todo por consulta, nada almacenado) y «mis planes»
 * del docente candidato. Lee `criticidad_vigente`, nunca las evaluaciones.
 */
@Injectable()
export class CoberturaService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alcance: AlcanceService,
  ) {}

  async cobertura(
    filtro: { idUnidad?: number },
    sesion: SesionUsuario,
  ): Promise<CoberturaDto> {
    const visibles = await this.alcance.unidadesVisibles(sesion);
    const filas: FilaCobertura[] = await this.dataSource.query(SQL_COBERTURA, [
      visibles,
      filtro.idUnidad ?? null,
    ]);
    const sinPlan: PuestoSinPlanDto[] = filas
      .filter((f) => !f.tiene_aprobado)
      .map((f) => ({
        idPuesto: f.id_puesto,
        codigo: f.codigo,
        denominacion: f.denominacion,
        idUnidad: f.id_unidad,
        idPlanEnElaboracion: f.id_plan_en_elaboracion,
        estadoPlanEnElaboracion: f.estado_plan_en_elaboracion,
      }));
    return {
      criticos: filas.length,
      conPlan: filas.length - sinPlan.length,
      sinPlan,
    };
  }

  /** Solo planes aprobados donde figura la persona de la sesión; sin prioridad ni otros candidatos. */
  async misPlanes(sesion: SesionUsuario): Promise<MiPlanDto[]> {
    if (sesion.idPersona === null) return [];
    const filas: FilaMiPlan[] = await this.dataSource.query(SQL_MIS_PLANES, [
      sesion.idPersona,
    ]);
    return filas.map((f) => ({
      idPlan: f.id_plan,
      idPuesto: f.id_puesto,
      denominacionPuesto: f.denominacion_puesto,
      estadoPlan: f.estado_plan,
      estadoPreparacion: f.estado_preparacion,
      fechaDisponibilidadEstimada: f.fecha_disponibilidad_estimada,
    }));
  }
}
