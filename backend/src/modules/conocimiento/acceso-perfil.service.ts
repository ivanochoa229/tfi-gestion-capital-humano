import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ROLES, ROLES_CON_ALCANCE_POR_UNIDAD } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AlcanceService } from '../usuarios/alcance.service.js';

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

  /** Evaluación: jefatura o jefe de cátedra con persona vinculada, nunca sobre sí mismo. */
  async exigirEvaluacion(
    sesion: SesionUsuario,
    idPersona: number,
  ): Promise<void> {
    if (!ROLES_CON_ALCANCE_POR_UNIDAD.includes(sesion.rol)) {
      throw new ForbiddenException(
        'Solo la jefatura y los jefes de cátedra acreditan conocimientos',
      );
    }
    if (sesion.idPersona === null) {
      throw new BadRequestException(
        'Tu usuario no tiene una persona vinculada: pedile al administrador que la asigne',
      );
    }
    if (sesion.idPersona === idPersona) {
      throw new ForbiddenException(
        'No podés acreditar tus propios conocimientos',
      );
    }
    if (!(await this.enAlcance(sesion, idPersona))) {
      throw new ForbiddenException(
        'La persona no ocupa hoy ningún puesto dentro de tu alcance',
      );
    }
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
