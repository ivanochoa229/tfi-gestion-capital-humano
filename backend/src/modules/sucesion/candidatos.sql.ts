/**
 * Candidatos de un plan con su preparación calculada. Parámetro: `$1` = id del plan.
 * «Vigente» es lo mismo que en Personas: `fecha_desde <= CURRENT_DATE` y
 * `fecha_hasta` nula o `>= CURRENT_DATE`. Un excluyente queda sin cubrir si la
 * persona no tiene nivel acreditado o este es de menor `orden` que el requerido.
 */
const OCUPACION_VIGENTE = `o.fecha_desde <= CURRENT_DATE AND (o.fecha_hasta IS NULL OR o.fecha_hasta >= CURRENT_DATE)`;

const EXCLUYENTES_DEL_PUESTO = `
  FROM requisito_puesto r
  JOIN conocimiento k ON k.id_conocimiento = r.id_conocimiento AND k.activo
  JOIN nivel_dominio nr ON nr.id_nivel_dominio = r.id_nivel_requerido
  LEFT JOIN conocimiento_persona cp
    ON cp.id_persona = c.id_persona AND cp.id_conocimiento = r.id_conocimiento
  LEFT JOIN nivel_dominio na ON na.id_nivel_dominio = cp.id_nivel_acreditado
  WHERE r.id_puesto = pl.id_puesto AND r.es_excluyente`;

export const SQL_CANDIDATOS_DEL_PLAN = `
  SELECT c.id_plan, c.id_persona, p.apellido, p.nombre,
         ep.codigo AS estado_preparacion, c.prioridad,
         c.fecha_disponibilidad_estimada::text AS fecha_disponibilidad_estimada,
         c.observaciones,
         (SELECT count(*)::int ${EXCLUYENTES_DEL_PUESTO}
            AND (na.orden IS NULL OR na.orden < nr.orden)) AS excluyentes_sin_cubrir,
         (SELECT count(*)::int ${EXCLUYENTES_DEL_PUESTO}) AS total_excluyentes,
         (EXISTS (SELECT 1 FROM ocupacion o
                   WHERE o.id_persona = c.id_persona AND o.id_puesto = pl.id_puesto
                     AND ${OCUPACION_VIGENTE})
          OR NOT EXISTS (SELECT 1 FROM ocupacion o
                          WHERE o.id_persona = c.id_persona AND ${OCUPACION_VIGENTE})) AS a_revisar
  FROM candidato_sucesion c
  JOIN plan_sucesion pl ON pl.id_plan = c.id_plan
  JOIN persona p ON p.id_persona = c.id_persona
  JOIN estado_preparacion ep ON ep.id_estado_preparacion = c.id_estado_preparacion
  WHERE c.id_plan = $1
  ORDER BY c.prioridad`;

/** Parámetros: `$1` persona, `$2` puesto del plan. Aquí `ocupa_puesto` y `tiene_ocupacion` son vigentes hoy. */
export const SQL_OCUPACION_DE_PERSONA = `
  SELECT COALESCE(bool_or(o.id_puesto = $2::int), false) AS ocupa_puesto,
         count(*) > 0 AS tiene_ocupacion
  FROM ocupacion o
  WHERE o.id_persona = $1::int AND ${OCUPACION_VIGENTE}`;
