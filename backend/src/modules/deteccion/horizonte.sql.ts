import { SQL_SUBUNIDADES, sqlPersonaEnAlcance } from './deteccion.sql.js';

export const SQL_HORIZONTE_RIESGO = `
  ${SQL_SUBUNIDADES},
  pares_marcados AS (
    SELECT pc.id_conocimiento,
           p.id_puesto,
           p.codigo,
           p.denominacion,
           p.id_unidad,
           (($1::int[] IS NULL OR pc.id_unidad = ANY($1::int[]))
            AND ($2::int IS NULL OR pc.id_unidad IN (SELECT id_unidad FROM subunidades))) AS en_seleccion
    FROM par_critico pc
    JOIN puesto p ON p.id_puesto = pc.id_puesto
  ),
  pares_por_conocimiento AS (
    SELECT id_conocimiento,
           COALESCE(
             json_agg(
               json_build_object(
                 'idPuesto', id_puesto,
                 'codigo', codigo,
                 'denominacion', denominacion,
                 'idUnidad', id_unidad
               ) ORDER BY denominacion, id_puesto
             ) FILTER (WHERE en_seleccion),
             '[]'::json
           ) AS puestos_en_alcance,
           COUNT(*) FILTER (WHERE NOT en_seleccion)::int AS puestos_fuera_de_alcance,
           BOOL_OR(en_seleccion) AS tiene_en_seleccion
    FROM pares_marcados
    GROUP BY id_conocimiento
  )
  SELECT r.id_conocimiento,
         k.denominacion,
         nd.denominacion AS nivel_requerido,
         r.cantidad_poseedores,
         per.id_persona,
         per.apellido,
         per.nombre,
         r.fecha_prevista_retiro::text AS fecha_prevista_retiro,
         ${sqlPersonaEnAlcance('r.id_persona')} AS en_alcance,
         ppc.puestos_en_alcance,
         ppc.puestos_fuera_de_alcance
  FROM deteccion_retiro_poseedor r
  JOIN conocimiento k ON k.id_conocimiento = r.id_conocimiento
  JOIN nivel_dominio nd ON nd.orden = r.orden_requerido_max
  JOIN pares_por_conocimiento ppc ON ppc.id_conocimiento = r.id_conocimiento
  JOIN persona per ON per.id_persona = r.id_persona
  WHERE ppc.tiene_en_seleccion
    AND r.fecha_prevista_retiro <= (CURRENT_DATE + make_interval(months => $3::int))::date
  ORDER BY r.fecha_prevista_retiro ASC, k.denominacion ASC, per.apellido ASC, per.nombre ASC
`;
