/** Cuántos requisitos de puesto pide el conocimiento (parámetro: id). */
export const SQL_CONTAR_REQUISITOS = `SELECT count(*)::int AS n FROM requisito_puesto WHERE id_conocimiento = $1`;

/** Cuántas personas tienen datos del conocimiento (parámetro: id). */
export const SQL_CONTAR_PERSONAS = `SELECT count(*)::int AS n FROM conocimiento_persona WHERE id_conocimiento = $1`;

/** Cuántas evaluaciones de criticidad tiene el conocimiento (parámetro: id). */
export const SQL_CONTAR_EVALUACIONES = `SELECT count(*)::int AS n FROM evaluacion_criticidad WHERE id_conocimiento = $1`;

/**
 * Pasos de la fusión, en orden, todos con `[idOrigen, idDestino]`.
 * Requisitos: donde un puesto pedía ambos queda el nivel más exigente y
 * excluyente si alguno lo era. Personas: el declarado más alto; las
 * acreditaciones del origen pasan al destino y el reflejo se recalcula con la
 * regla de siempre (la más reciente, no la de nivel más alto). Los activos que
 * documentaban el origen quedan vinculados al destino. Las evaluaciones de
 * criticidad del origen pasan al destino con su historial.
 */
export const PASOS_FUSION: string[] = [
  // 1. Puestos que pedían ambos: se endurece el requisito del destino.
  `UPDATE requisito_puesto rd
   SET id_nivel_requerido = CASE
         WHEN (SELECT orden FROM nivel_dominio WHERE id_nivel_dominio = ro.id_nivel_requerido)
            > (SELECT orden FROM nivel_dominio WHERE id_nivel_dominio = rd.id_nivel_requerido)
         THEN ro.id_nivel_requerido ELSE rd.id_nivel_requerido END,
       es_excluyente = rd.es_excluyente OR ro.es_excluyente
   FROM requisito_puesto ro
   WHERE ro.id_conocimiento = $1 AND rd.id_conocimiento = $2
     AND rd.id_puesto = ro.id_puesto`,
  // 2. Se descartan los requisitos del origen que ya quedaron absorbidos.
  `DELETE FROM requisito_puesto ro USING requisito_puesto rd
   WHERE ro.id_conocimiento = $1 AND rd.id_conocimiento = $2
     AND rd.id_puesto = ro.id_puesto`,
  // 3. Los demás requisitos del origen pasan al destino.
  `UPDATE requisito_puesto SET id_conocimiento = $2 WHERE id_conocimiento = $1`,
  // 4. Personas que solo tenían el origen: su fila se copia al destino.
  `INSERT INTO conocimiento_persona
     (id_persona, id_conocimiento, id_nivel_declarado, fecha_declaracion,
      id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador)
   SELECT co.id_persona, $2, co.id_nivel_declarado, co.fecha_declaracion,
          co.id_nivel_acreditado, co.fecha_evaluacion, co.id_tipo_evidencia, co.id_evaluador
   FROM conocimiento_persona co
   WHERE co.id_conocimiento = $1
     AND NOT EXISTS (
       SELECT 1 FROM conocimiento_persona cd
       WHERE cd.id_persona = co.id_persona AND cd.id_conocimiento = $2)`,
  // 5. Personas que tenían ambos: queda el nivel declarado más alto.
  `UPDATE conocimiento_persona cd
   SET id_nivel_declarado = co.id_nivel_declarado,
       fecha_declaracion = co.fecha_declaracion
   FROM conocimiento_persona co
   WHERE co.id_conocimiento = $1 AND cd.id_conocimiento = $2
     AND cd.id_persona = co.id_persona
     AND co.id_nivel_declarado IS NOT NULL
     AND (cd.id_nivel_declarado IS NULL
          OR (SELECT orden FROM nivel_dominio WHERE id_nivel_dominio = co.id_nivel_declarado)
           > (SELECT orden FROM nivel_dominio WHERE id_nivel_dominio = cd.id_nivel_declarado))`,
  // 6. El historial de acreditaciones pasa al destino.
  `UPDATE acreditacion SET id_conocimiento = $2 WHERE id_conocimiento = $1`,
  // 7. El reflejo del destino se recalcula: la acreditación más reciente.
  `UPDATE conocimiento_persona cp
   SET id_nivel_acreditado = v.id_nivel_acreditado,
       fecha_evaluacion = v.fecha_evaluacion,
       id_tipo_evidencia = v.id_tipo_evidencia,
       id_evaluador = v.id_evaluador
   FROM (
     SELECT DISTINCT ON (id_persona)
            id_persona, id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador
     FROM acreditacion
     WHERE id_conocimiento = $2
     ORDER BY id_persona, fecha_evaluacion DESC, id_acreditacion DESC
   ) v
   WHERE cp.id_conocimiento = $2 AND cp.id_persona = v.id_persona
     AND $1::int IS NOT NULL`,
  // 8. Las filas del origen ya no tienen nada que las sostenga.
  `DELETE FROM conocimiento_persona WHERE id_conocimiento = $1 AND $2::int IS NOT NULL`,
  // 9. Los activos que documentaban el origen pasan a documentar el destino.
  `INSERT INTO activo_conocimiento_conocimiento (id_activo, id_conocimiento)
   SELECT id_activo, $2 FROM activo_conocimiento_conocimiento
   WHERE id_conocimiento = $1
   ON CONFLICT DO NOTHING`,
  // 10. Se sueltan los vínculos al origen.
  `DELETE FROM activo_conocimiento_conocimiento WHERE id_conocimiento = $1 AND $2::int IS NOT NULL`,
  // 11. Las evaluaciones de criticidad del origen pasan al destino; la vigente sale de la vista.
  // Deliberado: es SQL crudo sobre una tabla auditada, así que `auditoria` no registra este
  // movimiento (queda trazable por conocimiento.id_fusionado_en). No copiar este patrón para
  // otras escrituras auditadas (plan, candidato): esas deben usar save()/remove().
  `UPDATE evaluacion_criticidad SET id_conocimiento = $2 WHERE id_conocimiento = $1`,
];
