import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ROLES, ROLES_CON_ALCANCE_POR_UNIDAD } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { SQL_ES_SUBORDINADO } from './perfil.sql.js';

/** ¿Ocupa hoy la persona un puesto de alguna de las unidades? ("Hoy" es el de la base.) */
const SQL_OCUPACION_EN_UNIDADES = `
  SELECT 1
  FROM ocupacion o
  JOIN puesto p ON p.id_puesto = o.id_puesto
  WHERE o.id_persona = $1
    AND p.id_unidad = ANY($2)
    AND o.fecha_desde <= CURRENT_DATE
    AND (o.fecha_hasta IS NULL OR o.fecha_hasta >= CURRENT_DATE)
  LIMIT 1`;

/** Resultado de `permisoDeAcreditar`: el motivo explica por qué no. */
export interface PermisoDeAcreditar {
  puedeAcreditar: boolean;
  motivo: string | null;
}

const NO_ES_EVALUADOR =
  'Solo la jefatura y los jefes de cátedra acreditan conocimientos';
const SIN_PERSONA =
  'Tu usuario no tiene una persona vinculada: pedile al administrador que la asigne';
const ES_UNO_MISMO = 'No podés acreditar tus propios conocimientos';
const NO_ES_SUBORDINADO =
  'Solo podés acreditar a quien ocupa hoy un puesto por debajo del tuyo';

/**
 * Quién lee y quién evalúa el conocimiento de una persona. El conocimiento
 * de las personas es un dato sensible: no se rige por `unidadesVisibles` de los
 * roles globales (el analista de puestos y el administrador no lo ven).
 */
@Injectable()
export class AccesoPerfilService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alcance: AlcanceService,
  ) {}

  /** Lectura: la propia persona; RR. HH. y autoridades; la jefatura y los jefes por alcance. */
  async exigirLectura(sesion: SesionUsuario, idPersona: number): Promise<void> {
    if (sesion.idPersona === idPersona) return;
    if (
      sesion.rol === ROLES.recursosHumanos ||
      sesion.rol === ROLES.autoridad
    ) {
      return;
    }
    if (
      ROLES_CON_ALCANCE_POR_UNIDAD.includes(sesion.rol) &&
      (await this.enAlcance(sesion, idPersona))
    ) {
      return;
    }
    throw new ForbiddenException(
      'No podés consultar el conocimiento de esta persona',
    );
  }

  /**
   * Evaluación: jefatura o jefe de cátedra con persona vinculada, nunca sobre
   * sí mismo y solo sobre quien ocupa hoy un puesto que depende, a cualquier
   * profundidad, de uno que el evaluador ocupa hoy. Las unidades asignadas al
   * usuario no intervienen: manda la jerarquía de puestos.
   */
  async exigirEvaluacion(
    sesion: SesionUsuario,
    idPersona: number,
  ): Promise<void> {
    if (!ROLES_CON_ALCANCE_POR_UNIDAD.includes(sesion.rol)) {
      throw new ForbiddenException(NO_ES_EVALUADOR);
    }
    if (sesion.idPersona === null) {
      throw new BadRequestException(SIN_PERSONA);
    }
    if (sesion.idPersona === idPersona) {
      throw new ForbiddenException(ES_UNO_MISMO);
    }
    if (!(await this.esSuperior(sesion.idPersona, idPersona))) {
      throw new ForbiddenException(NO_ES_SUBORDINADO);
    }
  }

  /** Las mismas reglas que `exigirEvaluacion`, sin lanzar: para que la interfaz sepa qué ofrecer. */
  async permisoDeAcreditar(
    sesion: SesionUsuario,
    idPersona: number,
  ): Promise<PermisoDeAcreditar> {
    const no = (motivo: string) => ({ puedeAcreditar: false, motivo });
    if (!ROLES_CON_ALCANCE_POR_UNIDAD.includes(sesion.rol)) {
      return no(NO_ES_EVALUADOR);
    }
    if (sesion.idPersona === null) return no(SIN_PERSONA);
    if (sesion.idPersona === idPersona) return no(ES_UNO_MISMO);
    if (!(await this.esSuperior(sesion.idPersona, idPersona))) {
      return no(NO_ES_SUBORDINADO);
    }
    return { puedeAcreditar: true, motivo: null };
  }

  /** ¿Ocupa hoy la persona un puesto que depende de uno que el evaluador ocupa hoy? */
  async esSuperior(idEvaluador: number, idPersona: number): Promise<boolean> {
    const filas: unknown[] = await this.dataSource.query(SQL_ES_SUBORDINADO, [
      idEvaluador,
      idPersona,
    ]);
    return filas.length > 0;
  }

  /** ¿Tiene la persona una ocupación vigente en una unidad del alcance del usuario? */
  async enAlcance(sesion: SesionUsuario, idPersona: number): Promise<boolean> {
    const visibles = await this.alcance.unidadesVisibles(sesion);
    if (visibles === null) return true;
    if (visibles.length === 0) return false;
    const filas: unknown[] = await this.dataSource.query(
      SQL_OCUPACION_EN_UNIDADES,
      [idPersona, visibles],
    );
    return filas.length > 0;
  }
}
