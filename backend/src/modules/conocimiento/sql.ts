/**
 * Crea la fila de `conocimiento_persona` cuando una persona recibe su primera
 * acreditación sin haber declarado. La fila nace con la acreditación misma
 * (la restricción exige al menos un nivel); si ya existía no hace nada.
 * Parámetros: persona, conocimiento, nivel, fecha, tipo de evidencia, evaluador.
 */
export const SQL_ASEGURAR_FILA = `
  INSERT INTO conocimiento_persona
    (id_persona, id_conocimiento, id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador)
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (id_persona, id_conocimiento) DO NOTHING`;

/**
 * Copia a `conocimiento_persona` la acreditación vigente de la persona:
 * la de mayor fecha de evaluación y, en empate, la de mayor id.
 * Parámetros: persona, conocimiento.
 */
export const SQL_REFLEJAR_VIGENTE = `
  UPDATE conocimiento_persona cp
  SET id_nivel_acreditado = v.id_nivel_acreditado,
      fecha_evaluacion = v.fecha_evaluacion,
      id_tipo_evidencia = v.id_tipo_evidencia,
      id_evaluador = v.id_evaluador
  FROM (
    SELECT id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador
    FROM acreditacion
    WHERE id_persona = $1 AND id_conocimiento = $2
    ORDER BY fecha_evaluacion DESC, id_acreditacion DESC
    LIMIT 1
  ) v
  WHERE cp.id_persona = $1 AND cp.id_conocimiento = $2`;
