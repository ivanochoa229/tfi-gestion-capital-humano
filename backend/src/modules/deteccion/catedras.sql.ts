import { SQL_SUBUNIDADES, sqlPersonaEnAlcance } from './deteccion.sql.js';

export const SQL_CATEDRAS_UNA_PERSONA = `
  ${SQL_SUBUNIDADES}
  SELECT d.id_unidad,
         u.denominacion,
         d.cantidad_personas,
         d.cantidad_ocupaciones,
         per.id_persona,
         per.apellido,
         per.nombre,
         CASE
           WHEN d.id_persona_unica IS NULL THEN true
           ELSE ${sqlPersonaEnAlcance('d.id_persona_unica')}
         END AS en_alcance
  FROM deteccion_catedra_una_persona d
  JOIN unidad_organizativa u ON u.id_unidad = d.id_unidad
  LEFT JOIN persona per ON per.id_persona = d.id_persona_unica
  WHERE d.cantidad_personas <= 1
    AND ($1::int[] IS NULL OR d.id_unidad = ANY($1::int[]))
    AND ($2::int IS NULL OR d.id_unidad IN (SELECT id_unidad FROM subunidades))
  ORDER BY u.denominacion, d.id_unidad
`;
