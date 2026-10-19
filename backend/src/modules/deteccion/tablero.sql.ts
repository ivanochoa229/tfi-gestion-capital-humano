import { SQL_SUBUNIDADES } from './deteccion.sql.js';

/**
 * Conocimientos críticos con exactamente un poseedor vigente (RF16), agrupados por
 * la unidad organizativa (cátedra) de los puestos que los hacen críticos.
 * Parámetros: $1 = unidades visibles (int[] | null), $2 = idUnidad filtro (int | null).
 */
export const SQL_PUNTOS_UNICOS_POR_CATEDRA = `
  ${SQL_SUBUNIDADES}
  SELECT
    u.id_unidad,
    u.denominacion,
    COUNT(DISTINCT puf.id_conocimiento)::int AS cantidad
  FROM deteccion_punto_unico_falla puf
  JOIN par_critico pc ON pc.id_conocimiento = puf.id_conocimiento
  JOIN puesto p ON p.id_puesto = pc.id_puesto
  JOIN unidad_organizativa u ON u.id_unidad = p.id_unidad
  WHERE puf.cantidad_poseedores = 1
    AND ($1::int[] IS NULL OR u.id_unidad = ANY($1::int[]))
    AND ($2::int IS NULL OR u.id_unidad IN (SELECT id_unidad FROM subunidades))
  GROUP BY u.id_unidad, u.denominacion
  ORDER BY cantidad DESC, u.denominacion ASC
`;

/**
 * Retiros previstos dentro del plazo ($3 meses) de poseedores vigentes de
 * conocimientos críticos, agrupados por semestre (formato YYYY-S1 / YYYY-S2).
 * Parámetros: $1 = unidades visibles (int[] | null), $2 = idUnidad filtro (int | null),
 * $3 = meses (int).
 */
export const SQL_RETIROS_POR_SEMESTRE = `
  ${SQL_SUBUNIDADES}
  SELECT
    (EXTRACT(YEAR FROM drp.fecha_prevista_retiro)::int || '-S' ||
      CASE WHEN EXTRACT(MONTH FROM drp.fecha_prevista_retiro) <= 6 THEN '1' ELSE '2' END) AS semestre,
    COUNT(*)::int AS cantidad
  FROM deteccion_retiro_poseedor drp
  WHERE drp.fecha_prevista_retiro <= (CURRENT_DATE + ($3::int || ' months')::interval)::date
    AND EXISTS (
      SELECT 1
      FROM par_critico pc
      JOIN puesto p ON p.id_puesto = pc.id_puesto
      WHERE pc.id_conocimiento = drp.id_conocimiento
        AND ($1::int[] IS NULL OR p.id_unidad = ANY($1::int[]))
        AND ($2::int IS NULL OR p.id_unidad IN (SELECT id_unidad FROM subunidades))
    )
  GROUP BY semestre
  ORDER BY semestre ASC
`;
