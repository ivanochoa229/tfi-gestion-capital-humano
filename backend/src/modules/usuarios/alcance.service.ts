import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ROLES_CON_ALCANCE_POR_UNIDAD,
  ROLES_GLOBALES,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';

/** Unidades asignadas más todas sus descendientes por la jerarquía recursiva. */
const SQL_DESCENDIENTES = `
  WITH RECURSIVE arbol AS (
    SELECT id_unidad FROM unidad_organizativa WHERE id_unidad = ANY($1)
    UNION
    SELECT u.id_unidad
    FROM unidad_organizativa u
    JOIN arbol a ON u.id_unidad_superior = a.id_unidad
  )
  SELECT id_unidad FROM arbol`;

/**
 * Alcance por unidad (RF24). Los services de criticidad y sucesión lo aplican
 * como filtro por `puesto.id_unidad`.
 */
@Injectable()
export class AlcanceService {
  constructor(private readonly dataSource: DataSource) {}

  /** `null` significa sin restricción; un arreglo vacío, ninguna unidad visible. */
  async unidadesVisibles(usuario: SesionUsuario): Promise<number[] | null> {
    if (ROLES_GLOBALES.includes(usuario.rol)) return null;
    if (!ROLES_CON_ALCANCE_POR_UNIDAD.includes(usuario.rol)) return [];
    if (usuario.unidades.length === 0) return [];

    const filas: { id_unidad: number }[] = await this.dataSource.query(
      SQL_DESCENDIENTES,
      [usuario.unidades],
    );
    return filas.map((f) => Number(f.id_unidad));
  }

  async exigirUnidad(usuario: SesionUsuario, idUnidad: number): Promise<void> {
    const visibles = await this.unidadesVisibles(usuario);
    if (visibles !== null && !visibles.includes(idUnidad)) {
      throw new ForbiddenException('La unidad está fuera de tu alcance');
    }
  }
}
