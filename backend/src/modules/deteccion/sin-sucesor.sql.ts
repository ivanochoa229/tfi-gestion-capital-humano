import { SQL_SUBUNIDADES } from './deteccion.sql.js';

export const SQL_PUESTOS_SIN_SUCESOR = `
  ${SQL_SUBUNIDADES}
  SELECT d.id_puesto,
         p.codigo,
         p.denominacion,
         p.id_unidad,
         d.motivo,
         d.id_plan,
         d.candidatos_total,
         d.candidatos_validos
  FROM deteccion_puesto_sin_sucesor d
  JOIN puesto p ON p.id_puesto = d.id_puesto
  WHERE ($1::int[] IS NULL OR p.id_unidad = ANY($1::int[]))
    AND ($2::int IS NULL OR p.id_unidad IN (SELECT id_unidad FROM subunidades))
    AND ($3::text IS NULL OR d.motivo = $3::text)
  ORDER BY p.denominacion, d.id_puesto
`;
