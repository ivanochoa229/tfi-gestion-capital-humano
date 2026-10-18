/**
 * CTE recursiva que resuelve las subunidades a partir de $2::int (la unidad filtrada).
 * Si $2 es nulo, la CTE queda vacía y no debe usarse sola sin contemplar $2 IS NULL.
 */
export const SQL_SUBUNIDADES = `
  WITH RECURSIVE subunidades AS (
    SELECT id_unidad FROM unidad_organizativa WHERE id_unidad = $2::int
    UNION
    SELECT u.id_unidad
    FROM unidad_organizativa u
    JOIN subunidades s ON u.id_unidad_superior = s.id_unidad
  )
`;

/**
 * Predicado booleano que es verdadero si $1::int[] es nulo o la persona tiene una
 * ocupación vigente en un puesto de esas unidades (alcance).
 */
export function sqlPersonaEnAlcance(columnaPersona: string): string {
  return `($1::int[] IS NULL OR EXISTS (
    SELECT 1 FROM ocupacion o
    JOIN puesto p ON p.id_puesto = o.id_puesto
    WHERE o.id_persona = ${columnaPersona}
      AND o.fecha_desde <= CURRENT_DATE
      AND (o.fecha_hasta IS NULL OR o.fecha_hasta >= CURRENT_DATE)
      AND p.id_unidad = ANY($1::int[])
  ))`;
}
