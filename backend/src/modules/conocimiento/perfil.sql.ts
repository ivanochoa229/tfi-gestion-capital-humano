/**
 * Regla de «pendiente de acreditar», una sola vez para el perfil y la bandeja
 * (alias `cp` = `conocimiento_persona`): hay declaración y, o no hay
 * acreditación, o el declarado difiere del acreditado y se declaró después de
 * evaluar. Declarar y acreditar el mismo día no deja pendiente: caso borde aceptado.
 */
export const SQL_PENDIENTE = `(
  cp.id_nivel_declarado IS NOT NULL AND (
    cp.id_nivel_acreditado IS NULL
    OR (cp.id_nivel_declarado <> cp.id_nivel_acreditado AND cp.fecha_declaracion > cp.fecha_evaluacion)
  )
)`;

/** Parámetro: persona. */
export const SQL_PERFIL_DE_PERSONA = `
  SELECT cp.id_persona, cp.id_conocimiento, c.denominacion, c.id_tipo_conocimiento,
         cp.id_nivel_declarado, cp.fecha_declaracion::text AS fecha_declaracion,
         cp.id_nivel_acreditado, cp.fecha_evaluacion::text AS fecha_evaluacion,
         cp.id_tipo_evidencia, cp.id_evaluador,
         ${SQL_PENDIENTE} AS pendiente
  FROM conocimiento_persona cp
  JOIN conocimiento c ON c.id_conocimiento = cp.id_conocimiento
  WHERE cp.id_persona = $1
  ORDER BY c.denominacion`;

/** Parámetro: persona. Requisitos de los puestos con ocupación vigente (hoy de la base). */
export const SQL_REQUISITOS_VIGENTES = `
  SELECT r.id_conocimiento, c.denominacion, c.id_tipo_conocimiento,
         r.id_puesto, p.codigo AS codigo_puesto, p.denominacion AS denominacion_puesto,
         r.id_nivel_requerido, n.orden AS orden_nivel, r.es_excluyente
  FROM ocupacion o
  JOIN puesto p ON p.id_puesto = o.id_puesto
  JOIN requisito_puesto r ON r.id_puesto = p.id_puesto
  JOIN conocimiento c ON c.id_conocimiento = r.id_conocimiento AND c.activo
  JOIN nivel_dominio n ON n.id_nivel_dominio = r.id_nivel_requerido
  WHERE o.id_persona = $1
    AND o.fecha_desde <= CURRENT_DATE
    AND (o.fecha_hasta IS NULL OR o.fecha_hasta >= CURRENT_DATE)`;

/** Parámetro: persona. Lo que la persona ya tiene registrado, de conocimientos activos. */
export const SQL_FILAS_PROPIAS = `
  SELECT cp.id_conocimiento, c.denominacion, c.id_tipo_conocimiento,
         cp.id_nivel_declarado, cp.fecha_declaracion::text AS fecha_declaracion,
         cp.id_nivel_acreditado, cp.fecha_evaluacion::text AS fecha_evaluacion,
         cp.id_tipo_evidencia
  FROM conocimiento_persona cp
  JOIN conocimiento c ON c.id_conocimiento = cp.id_conocimiento AND c.activo
  WHERE cp.id_persona = $1`;

/** Parámetros: unidades del alcance, persona del evaluador (excluida: no se acredita a sí misma). */
export const SQL_PENDIENTES = `
  SELECT cp.id_persona, p.apellido, p.nombre, cp.id_conocimiento, c.denominacion,
         cp.id_nivel_declarado, cp.id_nivel_acreditado,
         cp.fecha_declaracion::text AS fecha_declaracion
  FROM conocimiento_persona cp
  JOIN persona p ON p.id_persona = cp.id_persona AND p.activo
  JOIN conocimiento c ON c.id_conocimiento = cp.id_conocimiento AND c.activo
  WHERE ${SQL_PENDIENTE}
    AND p.id_persona IS DISTINCT FROM $2
    AND EXISTS (
      SELECT 1
      FROM ocupacion o
      JOIN puesto pu ON pu.id_puesto = o.id_puesto
      WHERE o.id_persona = cp.id_persona
        AND pu.id_unidad = ANY($1)
        AND o.fecha_desde <= CURRENT_DATE
        AND (o.fecha_hasta IS NULL OR o.fecha_hasta >= CURRENT_DATE)
    )
  ORDER BY p.apellido, p.nombre, c.denominacion`;
