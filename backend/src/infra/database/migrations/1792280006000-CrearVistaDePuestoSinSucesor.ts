import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearVistaDePuestoSinSucesor1792280006000 implements MigrationInterface {
  name = 'CrearVistaDePuestoSinSucesor1792280006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE VIEW "deteccion_puesto_sin_sucesor" AS
      WITH puestos_criticos AS (
        SELECT DISTINCT p.id_puesto
        FROM puesto p
        JOIN par_critico pc ON pc.id_puesto = p.id_puesto
        WHERE p.activo AND pc.es_excluyente
      ),
      planes_puesto AS (
        SELECT pc.id_puesto,
               (SELECT pl.id_plan
                FROM plan_sucesion pl
                JOIN estado_plan ep ON ep.id_estado_plan = pl.id_estado_plan
                WHERE pl.id_puesto = pc.id_puesto AND ep.codigo = 'aprobado'
                ORDER BY pl.id_plan DESC LIMIT 1) AS id_plan_aprobado,
               (SELECT pl.id_plan
                FROM plan_sucesion pl
                JOIN estado_plan ep ON ep.id_estado_plan = pl.id_estado_plan
                WHERE pl.id_puesto = pc.id_puesto AND ep.codigo IN ('borrador', 'pendiente_aprobacion')
                ORDER BY pl.id_plan DESC LIMIT 1) AS id_plan_elaboracion
        FROM puestos_criticos pc
      ),
      candidatos_evaluados AS (
        SELECT pp.id_puesto,
               c.id_persona,
               (per.activo
                AND (per.fecha_prevista_retiro IS NULL OR per.fecha_prevista_retiro >= CURRENT_DATE)
                AND EXISTS (
                  SELECT 1 FROM ocupacion o
                  WHERE o.id_persona = per.id_persona
                    AND o.fecha_desde <= CURRENT_DATE
                    AND (o.fecha_hasta IS NULL OR o.fecha_hasta >= CURRENT_DATE)
                )
                AND NOT EXISTS (
                  SELECT 1 FROM ocupacion o
                  WHERE o.id_persona = per.id_persona
                    AND o.id_puesto = pp.id_puesto
                    AND o.fecha_desde <= CURRENT_DATE
                    AND (o.fecha_hasta IS NULL OR o.fecha_hasta >= CURRENT_DATE)
                )
               ) AS es_valido,
               NOT EXISTS (
                 SELECT 1
                 FROM requisito_puesto r
                 JOIN conocimiento k ON k.id_conocimiento = r.id_conocimiento AND k.activo
                 JOIN nivel_dominio nr ON nr.id_nivel_dominio = r.id_nivel_requerido
                 LEFT JOIN conocimiento_persona cp
                   ON cp.id_persona = c.id_persona AND cp.id_conocimiento = r.id_conocimiento
                 LEFT JOIN nivel_dominio na ON na.id_nivel_dominio = cp.id_nivel_acreditado
                 WHERE r.id_puesto = pp.id_puesto
                   AND r.es_excluyente
                   AND (na.orden IS NULL OR na.orden < nr.orden)
               ) AS cubre_excluyentes
        FROM planes_puesto pp
        JOIN candidato_sucesion c ON c.id_plan = pp.id_plan_aprobado
        JOIN persona per ON per.id_persona = c.id_persona
      ),
      resumen_candidatos AS (
        SELECT pp.id_puesto,
               pp.id_plan_aprobado,
               pp.id_plan_elaboracion,
               COUNT(ce.id_persona)::int AS candidatos_total,
               COUNT(ce.id_persona) FILTER (WHERE ce.es_valido)::int AS candidatos_validos,
               COALESCE(BOOL_OR(ce.es_valido AND ce.cubre_excluyentes), false) AS tiene_sucesor_preparado
        FROM planes_puesto pp
        LEFT JOIN candidatos_evaluados ce ON ce.id_puesto = pp.id_puesto
        GROUP BY pp.id_puesto, pp.id_plan_aprobado, pp.id_plan_elaboracion
      )
      SELECT id_puesto,
             CASE
               WHEN id_plan_aprobado IS NOT NULL THEN 'ningun_candidato_cubre'
               WHEN id_plan_elaboracion IS NOT NULL THEN 'plan_en_elaboracion'
               ELSE 'sin_plan'
             END AS motivo,
             COALESCE(id_plan_aprobado, id_plan_elaboracion) AS id_plan,
             candidatos_total,
             candidatos_validos
      FROM resumen_candidatos
      WHERE NOT tiene_sucesor_preparado
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP VIEW IF EXISTS "deteccion_puesto_sin_sucesor"`,
    );
  }
}
