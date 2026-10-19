import { SQL_SUBUNIDADES } from './deteccion.sql.js';

export const SQL_BRECHA = `
  ${SQL_SUBUNIDADES}
  SELECT b.contexto,
         b.id_persona,
         per.apellido,
         per.nombre,
         b.id_puesto,
         pu.denominacion AS denominacion_puesto,
         b.id_plan,
         b.estado_plan,
         b.a_revisar,
         b.id_conocimiento,
         k.denominacion AS denominacion_conocimiento,
         b.es_excluyente,
         nr.denominacion AS nivel_requerido,
         na.denominacion AS nivel_acreditado,
         NULL::text AS nivel_declarado,
         b.faltante,
         b.cubierto
  FROM deteccion_brecha_perfil b
  JOIN persona per ON per.id_persona = b.id_persona
  JOIN puesto pu ON pu.id_puesto = b.id_puesto
  JOIN conocimiento k ON k.id_conocimiento = b.id_conocimiento
  JOIN nivel_dominio nr ON nr.orden = b.orden_requerido
  LEFT JOIN nivel_dominio na ON na.orden = b.orden_acreditado
  WHERE ($1::int[] IS NULL OR pu.id_unidad = ANY($1::int[]))
    AND ($2::int IS NULL OR pu.id_unidad IN (SELECT id_unidad FROM subunidades))
    AND ($3::int IS NULL OR b.id_persona = $3::int)
    AND ($4::int IS NULL OR b.id_puesto = $4::int)
    AND ($5::text IS NULL OR b.contexto = $5::text)
  ORDER BY per.apellido, per.nombre, b.id_persona, b.contexto DESC, pu.denominacion, b.id_puesto, b.id_plan NULLS FIRST, b.es_excluyente DESC, k.denominacion
`;

export const SQL_MI_BRECHA = `
  SELECT b.contexto,
         b.id_persona,
         per.apellido,
         per.nombre,
         b.id_puesto,
         pu.denominacion AS denominacion_puesto,
         b.id_plan,
         b.estado_plan,
         b.a_revisar,
         b.id_conocimiento,
         k.denominacion AS denominacion_conocimiento,
         b.es_excluyente,
         nr.denominacion AS nivel_requerido,
         na.denominacion AS nivel_acreditado,
         ndec.denominacion AS nivel_declarado,
         b.faltante,
         b.cubierto
  FROM deteccion_brecha_perfil b
  JOIN persona per ON per.id_persona = b.id_persona
  JOIN puesto pu ON pu.id_puesto = b.id_puesto
  JOIN conocimiento k ON k.id_conocimiento = b.id_conocimiento
  JOIN nivel_dominio nr ON nr.orden = b.orden_requerido
  LEFT JOIN nivel_dominio na ON na.orden = b.orden_acreditado
  LEFT JOIN conocimiento_persona cp
    ON cp.id_persona = b.id_persona AND cp.id_conocimiento = b.id_conocimiento
  LEFT JOIN nivel_dominio ndec ON ndec.id_nivel_dominio = cp.id_nivel_declarado
  WHERE b.id_persona = $1::int
    AND (b.contexto = 'ocupante' OR b.estado_plan = 'aprobado')
  ORDER BY b.contexto DESC, pu.denominacion, b.id_puesto, b.id_plan NULLS FIRST, b.es_excluyente DESC, k.denominacion
`;
