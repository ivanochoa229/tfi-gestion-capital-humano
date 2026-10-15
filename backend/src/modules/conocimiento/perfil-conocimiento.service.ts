import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { AccesoPerfilService } from './acceso-perfil.service.js';
import { aAcreditacionDto } from './conocimiento.mapper.js';
import type {
  AcreditacionDto,
  MiConocimientoDto,
  PendienteAcreditacionDto,
  PerfilConocimientoDto,
} from './dto/perfil.dto.js';
import { Acreditacion } from './entities/acreditacion.entity.js';
import { combinarRequisitos, type RequisitoDePuesto } from './perfil.js';
import {
  SQL_FILAS_PROPIAS,
  SQL_PENDIENTES,
  SQL_PERFIL_DE_PERSONA,
  SQL_REQUISITOS_VIGENTES,
} from './perfil.sql.js';

interface FilaPropia {
  id_conocimiento: number;
  denominacion: string;
  id_tipo_conocimiento: number;
  id_nivel_declarado: number | null;
  fecha_declaracion: string | null;
  id_nivel_acreditado: number | null;
  fecha_evaluacion: string | null;
  id_tipo_evidencia: number | null;
}

interface FilaPerfil extends FilaPropia {
  id_persona: number;
  id_evaluador: number | null;
  pendiente: boolean;
}

interface FilaRequisito {
  id_conocimiento: number;
  denominacion: string;
  id_tipo_conocimiento: number;
  id_puesto: number;
  codigo_puesto: string;
  denominacion_puesto: string;
  id_nivel_requerido: number;
  orden_nivel: number;
  es_excluyente: boolean;
}

interface FilaPendiente {
  id_persona: number;
  apellido: string;
  nombre: string;
  id_conocimiento: number;
  denominacion: string;
  id_nivel_declarado: number;
  id_nivel_acreditado: number | null;
  fecha_declaracion: string;
}

/** Lecturas del conocimiento de las personas (RF10, RNF06). Solo lectura. */
@Injectable()
export class PerfilConocimientoService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Acreditacion)
    private readonly acreditaciones: Repository<Acreditacion>,
    private readonly acceso: AccesoPerfilService,
    private readonly alcance: AlcanceService,
  ) {}

  async perfilDe(
    idPersona: number,
    sesion: SesionUsuario,
  ): Promise<PerfilConocimientoDto[]> {
    await this.acceso.exigirLectura(sesion, idPersona);
    const filas: FilaPerfil[] = await this.dataSource.query(
      SQL_PERFIL_DE_PERSONA,
      [idPersona],
    );
    return filas.map((f) => ({
      idPersona: f.id_persona,
      idConocimiento: f.id_conocimiento,
      denominacion: f.denominacion,
      idTipoConocimiento: f.id_tipo_conocimiento,
      idNivelDeclarado: f.id_nivel_declarado,
      fechaDeclaracion: f.fecha_declaracion,
      idNivelAcreditado: f.id_nivel_acreditado,
      fechaEvaluacion: f.fecha_evaluacion,
      idTipoEvidencia: f.id_tipo_evidencia,
      idEvaluador: f.id_evaluador,
      pendiente: f.pendiente,
    }));
  }

  /** Todas las acreditaciones del par, la más reciente primero. */
  async historial(
    idPersona: number,
    idConocimiento: number,
    sesion: SesionUsuario,
  ): Promise<AcreditacionDto[]> {
    await this.acceso.exigirLectura(sesion, idPersona);
    const filas = await this.acreditaciones.find({
      where: { idPersona, idConocimiento },
      order: { fechaEvaluacion: 'DESC', id: 'DESC' },
    });
    return filas.map(aAcreditacionDto);
  }

  /** «Mis conocimientos»: los requisitos de los puestos que ocupa hoy más lo que ya registró. */
  async mios(sesion: SesionUsuario): Promise<MiConocimientoDto[]> {
    if (sesion.idPersona === null) {
      throw new BadRequestException(
        'Tu usuario no tiene una persona vinculada: pedile al administrador que la asigne',
      );
    }
    const [requisitos, propias]: [FilaRequisito[], FilaPropia[]] =
      await Promise.all([
        this.dataSource.query(SQL_REQUISITOS_VIGENTES, [sesion.idPersona]),
        this.dataSource.query(SQL_FILAS_PROPIAS, [sesion.idPersona]),
      ]);

    const combinados = combinarRequisitos(
      requisitos.map((r): RequisitoDePuesto => ({
        idConocimiento: r.id_conocimiento,
        denominacion: r.denominacion,
        idTipoConocimiento: r.id_tipo_conocimiento,
        idPuesto: r.id_puesto,
        codigoPuesto: r.codigo_puesto,
        denominacionPuesto: r.denominacion_puesto,
        idNivelRequerido: r.id_nivel_requerido,
        ordenNivel: r.orden_nivel,
        esExcluyente: r.es_excluyente,
      })),
    );
    const propiasPorId = new Map(propias.map((p) => [p.id_conocimiento, p]));
    const registro = (p: FilaPropia | undefined) => ({
      idNivelDeclarado: p?.id_nivel_declarado ?? null,
      fechaDeclaracion: p?.fecha_declaracion ?? null,
      idNivelAcreditado: p?.id_nivel_acreditado ?? null,
      fechaEvaluacion: p?.fecha_evaluacion ?? null,
      idTipoEvidencia: p?.id_tipo_evidencia ?? null,
    });

    const filas: MiConocimientoDto[] = combinados.map((r) => ({
      idConocimiento: r.idConocimiento,
      denominacion: r.denominacion,
      idTipoConocimiento: r.idTipoConocimiento,
      idNivelRequerido: r.idNivelRequerido,
      esExcluyente: r.esExcluyente,
      puestos: r.puestos,
      ...registro(propiasPorId.get(r.idConocimiento)),
    }));
    const pedidos = new Set(combinados.map((r) => r.idConocimiento));
    for (const p of propias) {
      if (pedidos.has(p.id_conocimiento)) continue;
      filas.push({
        idConocimiento: p.id_conocimiento,
        denominacion: p.denominacion,
        idTipoConocimiento: p.id_tipo_conocimiento,
        idNivelRequerido: null,
        esExcluyente: false,
        puestos: [],
        ...registro(p),
      });
    }
    return filas.sort((a, b) =>
      a.denominacion.localeCompare(b.denominacion, 'es'),
    );
  }

  /** Bandeja del evaluador: lo declarado por personas de su alcance que falta acreditar. */
  async pendientes(sesion: SesionUsuario): Promise<PendienteAcreditacionDto[]> {
    const visibles = await this.alcance.unidadesVisibles(sesion);
    if (!visibles || visibles.length === 0) return [];
    const filas: FilaPendiente[] = await this.dataSource.query(SQL_PENDIENTES, [
      visibles,
      sesion.idPersona,
    ]);
    return filas.map((f) => ({
      idPersona: f.id_persona,
      apellido: f.apellido,
      nombre: f.nombre,
      idConocimiento: f.id_conocimiento,
      denominacion: f.denominacion,
      idNivelDeclarado: f.id_nivel_declarado,
      idNivelAcreditado: f.id_nivel_acreditado,
      fechaDeclaracion: f.fecha_declaracion,
    }));
  }
}
