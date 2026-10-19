import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearVistaDeBrechaDePerfil1792280007000 implements MigrationInterface {
  name = 'CrearVistaDeBrechaDePerfil1792280007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE VIEW "deteccion_brecha_perfil" AS
      WITH contextos AS (
        SELECT DISTINCT
               'ocupante'::text AS contexto,
               o.id_persona,
               o.id_puesto,
               NULL::int AS id_plan,
               NULL::text AS estado_plan,
               false AS a_revisar
        FROM ocupacion o
        JOIN persona per ON per.id_persona = o.id_persona AND per.activo
        JOIN puesto pu ON pu.id_puesto = o.id_puesto AND pu.activo
        WHERE o.fecha_desde <= CURRENT_DATE
          AND (o.fecha_hasta IS NULL OR o.fecha_hasta >= CURRENT_DATE)

        UNION ALL

        SELECT 'candidato'::text AS contexto,
               c.id_persona,
               pl.id_puesto,
               pl.id_plan,
               ep.codigo AS estado_plan,
               (EXISTS (
                  SELECT 1 FROM ocupacion o
                  WHERE o.id_persona = c.id_persona
                    AND o.id_puesto = pl.id_puesto
                    AND o.fecha_desde <= CURRENT_DATE
                    AND (o.fecha_hasta IS NULL OR o.fecha_hasta >= CURRENT_DATE)
                )
                OR NOT EXISTS (
                  SELECT 1 FROM ocupacion o
                  WHERE o.id_persona = c.id_persona
                    AND o.fecha_desde <= CURRENT_DATE
                    AND (o.fecha_hasta IS NULL OR o.fecha_hasta >= CURRENT_DATE)
                )
               ) AS a_revisar
        FROM candidato_sucesion c
        JOIN plan_sucesion pl ON pl.id_plan = c.id_plan
        JOIN estado_plan ep ON ep.id_estado_plan = pl.id_estado_plan
        JOIN puesto pu ON pu.id_puesto = pl.id_puesto AND pu.activo
        WHERE ep.codigo IN ('aprobado', 'borrador', 'pendiente_aprobacion')
      )
      SELECT ctx.contexto,
             ctx.id_persona,
             ctx.id_puesto,
             ctx.id_plan,
             ctx.estado_plan,
             r.id_conocimiento,
             r.es_excluyente,
             nr.orden AS orden_requerido,
             na.orden AS orden_acreditado,
             GREATEST(0, nr.orden - COALESCE(na.orden, 0))::int AS faltante,
             (GREATEST(0, nr.orden - COALESCE(na.orden, 0)) = 0) AS cubierto,
             ctx.a_revisar
      FROM contextos ctx
      JOIN requisito_puesto r ON r.id_puesto = ctx.id_puesto
      JOIN conocimiento k ON k.id_conocimiento = r.id_conocimiento AND k.activo
      JOIN nivel_dominio nr ON nr.id_nivel_dominio = r.id_nivel_requerido
      LEFT JOIN conocimiento_persona cp
        ON cp.id_persona = ctx.id_persona AND cp.id_conocimiento = r.id_conocimiento
      LEFT JOIN nivel_dominio na ON na.id_nivel_dominio = cp.id_nivel_acreditado
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS "deteccion_brecha_perfil"`);
  }
}
