/**
 * Parámetros comunes: `$1` unidades visibles (`null` = todas), `$2` unidad filtrada
 * (con sus descendientes) o `null`, `$3` puesto o `null`.
 */
const SUBUNIDADES = `
  WITH RECURSIVE subunidades AS (
    SELECT id_unidad FROM unidad_organizativa WHERE id_unidad = $2::int
    UNION
    SELECT u.id_unidad
    FROM unidad_organizativa u
    JOIN subunidades s ON u.id_unidad_superior = s.id_unidad
  )`;

/** Cada requisito activo con su evaluación vigente, si la hay. Un requisito quitado no aparece. */
const DESDE_PARES = `
  FROM requisito_puesto r
  JOIN puesto p ON p.id_puesto = r.id_puesto AND p.activo
  JOIN conocimiento c ON c.id_conocimiento = r.id_conocimiento AND c.activo
  LEFT JOIN criticidad_vigente v
    ON v.id_puesto = r.id_puesto AND v.id_conocimiento = r.id_conocimiento
  WHERE ($1::int[] IS NULL OR p.id_unidad = ANY($1::int[]))
    AND ($2::int IS NULL OR p.id_unidad IN (SELECT id_unidad FROM subunidades))
    AND ($3::int IS NULL OR p.id_puesto = $3::int)`;

/** Parámetros: los tres comunes y `$4` estado (`pendiente`, `evaluado` o `null`). */
export const SQL_PARES = `${SUBUNIDADES}
  SELECT p.id_puesto, p.codigo AS codigo_puesto, p.denominacion AS denominacion_puesto, p.id_unidad,
         r.id_conocimiento, c.denominacion AS denominacion_conocimiento,
         r.id_nivel_requerido, r.es_excluyente,
         v.id_evaluacion, v.id_nivel_impacto, v.id_nivel_dificultad, v.id_nivel_criticidad,
         v.fecha_evaluacion::text AS fecha_evaluacion
  ${DESDE_PARES}
    AND ($4::text IS NULL OR ($4::text = 'pendiente') = (v.id_evaluacion IS NULL))
  ORDER BY p.denominacion, p.id_puesto, r.es_excluyente DESC, c.denominacion`;

/** Parámetros: los tres comunes. */
export const SQL_AVANCE = `${SUBUNIDADES}
  SELECT count(*)::int AS total, count(v.id_evaluacion)::int AS evaluados
  ${DESDE_PARES}`;
