import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

/** La unidad y todas sus ancestras. `UNION` corta solo ante un ciclo. */
const SQL_UNIDADES_HASTA_RAIZ = `
  WITH RECURSIVE ascendentes AS (
    SELECT id_unidad, id_unidad_superior FROM unidad_organizativa WHERE id_unidad = $1
    UNION
    SELECT u.id_unidad, u.id_unidad_superior
    FROM unidad_organizativa u
    JOIN ascendentes a ON u.id_unidad = a.id_unidad_superior
  )
  SELECT id_unidad FROM ascendentes`;

/** El puesto y todos sus superiores, en cualquier unidad. */
const SQL_CADENA_DE_SUPERIORES = `
  WITH RECURSIVE ascendentes AS (
    SELECT id_puesto, id_puesto_superior FROM puesto WHERE id_puesto = $1
    UNION
    SELECT p.id_puesto, p.id_puesto_superior
    FROM puesto p
    JOIN ascendentes a ON p.id_puesto = a.id_puesto_superior
  )
  SELECT id_puesto FROM ascendentes`;

/** Consultas recursivas sobre las jerarquías de unidades y de puestos. */
@Injectable()
export class JerarquiaService {
  constructor(private readonly dataSource: DataSource) {}

  /** Incluye la unidad de partida. */
  async unidadesHastaRaiz(
    idUnidad: number,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<number[]> {
    const filas = await manager.query<{ id_unidad: number }[]>(
      SQL_UNIDADES_HASTA_RAIZ,
      [idUnidad],
    );
    return filas.map((f) => Number(f.id_unidad));
  }

  /** Incluye el puesto de partida. */
  async cadenaDeSuperiores(
    idPuesto: number,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<number[]> {
    const filas = await manager.query<{ id_puesto: number }[]>(
      SQL_CADENA_DE_SUPERIORES,
      [idPuesto],
    );
    return filas.map((f) => Number(f.id_puesto));
  }
}
