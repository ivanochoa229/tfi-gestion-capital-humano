/**
 * Cobertura de OE7. Parámetros: `$1` unidades visibles (`null` = todas), `$2`
 * unidad filtrada (con sus descendientes) o `null`. Un puesto es crítico si es
 * activo y tiene un requisito activo excluyente con criticidad vigente `alta`
 * (siempre `criticidad_vigente`, nunca `evaluacion_criticidad`); sin
 * evaluaciones no es crítico. Cubierto = tiene un plan `aprobado`; el plan en
 * elaboración es el `borrador` o `pendiente_aprobacion`, si lo hay.
 */
export const SQL_COBERTURA = `
  WITH RECURSIVE subunidades AS (
    SELECT id_unidad FROM unidad_organizativa WHERE id_unidad = $2::int
    UNION
    SELECT u.id_unidad
    FROM unidad_organizativa u
    JOIN subunidades s ON u.id_unidad_superior = s.id_unidad
  )
  SELECT p.id_puesto, p.codigo, p.denominacion, p.id_unidad,
         EXISTS (SELECT 1 FROM plan_sucesion pl
                   JOIN estado_plan e ON e.id_estado_plan = pl.id_estado_plan
                  WHERE pl.id_puesto = p.id_puesto AND e.codigo = 'aprobado') AS tiene_aprobado,
         (SELECT pl.id_plan FROM plan_sucesion pl
            JOIN estado_plan e ON e.id_estado_plan = pl.id_estado_plan
           WHERE pl.id_puesto = p.id_puesto AND e.codigo IN ('borrador', 'pendiente_aprobacion')
           ORDER BY pl.id_plan DESC LIMIT 1) AS id_plan_en_elaboracion,
         (SELECT e.codigo FROM plan_sucesion pl
            JOIN estado_plan e ON e.id_estado_plan = pl.id_estado_plan
           WHERE pl.id_puesto = p.id_puesto AND e.codigo IN ('borrador', 'pendiente_aprobacion')
           ORDER BY pl.id_plan DESC LIMIT 1) AS estado_plan_en_elaboracion
  FROM puesto p
  WHERE p.activo
    AND ($1::int[] IS NULL OR p.id_unidad = ANY($1::int[]))
    AND ($2::int IS NULL OR p.id_unidad IN (SELECT id_unidad FROM subunidades))
    AND EXISTS (
      SELECT 1
      FROM requisito_puesto r
      JOIN conocimiento k ON k.id_conocimiento = r.id_conocimiento AND k.activo
      JOIN criticidad_vigente v
        ON v.id_puesto = r.id_puesto AND v.id_conocimiento = r.id_conocimiento
      JOIN nivel_criticidad nc ON nc.id_nivel_criticidad = v.id_nivel_criticidad
      WHERE r.id_puesto = p.id_puesto AND r.es_excluyente AND nc.codigo = 'alta')
  ORDER BY p.denominacion, p.id_puesto`;

/**
 * Planes aprobados donde figura la persona. Parámetro: `$1` persona. Sin
 * prioridad ni otros candidatos. Los excluyentes se cuentan como en
 * `candidatos.sql.ts`: sin cubrir = sin nivel acreditado o de menor `orden`
 * que el requerido; solo de la propia persona.
 */
const EXCLUYENTES_DEL_PUESTO = `
  FROM requisito_puesto r
  JOIN conocimiento k ON k.id_conocimiento = r.id_conocimiento AND k.activo
  JOIN nivel_dominio nr ON nr.id_nivel_dominio = r.id_nivel_requerido
  LEFT JOIN conocimiento_persona cp
    ON cp.id_persona = c.id_persona AND cp.id_conocimiento = r.id_conocimiento
  LEFT JOIN nivel_dominio na ON na.id_nivel_dominio = cp.id_nivel_acreditado
  WHERE r.id_puesto = pl.id_puesto AND r.es_excluyente`;

export const SQL_MIS_PLANES = `
  SELECT pl.id_plan, pl.id_puesto, pu.denominacion AS denominacion_puesto,
         e.codigo AS estado_plan, ep.codigo AS estado_preparacion,
         c.fecha_disponibilidad_estimada::text AS fecha_disponibilidad_estimada,
         (SELECT count(*)::int ${EXCLUYENTES_DEL_PUESTO}
            AND (na.orden IS NULL OR na.orden < nr.orden)) AS excluyentes_sin_cubrir,
         (SELECT count(*)::int ${EXCLUYENTES_DEL_PUESTO}) AS total_excluyentes
  FROM candidato_sucesion c
  JOIN plan_sucesion pl ON pl.id_plan = c.id_plan
  JOIN estado_plan e ON e.id_estado_plan = pl.id_estado_plan
  JOIN puesto pu ON pu.id_puesto = pl.id_puesto
  JOIN estado_preparacion ep ON ep.id_estado_preparacion = c.id_estado_preparacion
  WHERE c.id_persona = $1::int AND e.codigo = 'aprobado'
  ORDER BY pu.denominacion, pl.id_plan`;
