import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearVistasDeConteoDeDeteccion1792280005000 implements MigrationInterface {
  name = 'CrearVistasDeConteoDeDeteccion1792280005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE VIEW "deteccion_punto_unico_falla" AS
      WITH requeridos AS (
        SELECT id_conocimiento,
               MAX(orden_requerido) AS orden_requerido_max
        FROM par_critico
        GROUP BY id_conocimiento
      ),
      poseedores AS (
        SELECT r.id_conocimiento,
               r.orden_requerido_max,
               pv.id_persona
        FROM requeridos r
        LEFT JOIN poseedor_vigente pv
          ON pv.id_conocimiento = r.id_conocimiento
         AND pv.orden_acreditado >= r.orden_requerido_max
      )
      SELECT id_conocimiento,
             orden_requerido_max,
             COUNT(id_persona)::int AS cantidad_poseedores,
             CASE WHEN COUNT(id_persona) = 1 THEN MIN(id_persona) ELSE NULL END AS id_persona_unica
      FROM poseedores
      GROUP BY id_conocimiento, orden_requerido_max
    `);

    await queryRunner.query(`
      CREATE VIEW "deteccion_catedra_una_persona" AS
      SELECT u.id_unidad,
             COUNT(DISTINCT op.id_persona)::int AS cantidad_personas,
             COUNT(op.id_puesto)::int AS cantidad_ocupaciones,
             CASE WHEN COUNT(DISTINCT op.id_persona) = 1 THEN MIN(op.id_persona) ELSE NULL END AS id_persona_unica
      FROM unidad_organizativa u
      JOIN tipo_unidad tu ON tu.id_tipo_unidad = u.id_tipo_unidad AND tu.codigo = 'catedra'
      LEFT JOIN puesto pu ON pu.id_unidad = u.id_unidad AND pu.activo
      LEFT JOIN (
        SELECT o.id_puesto, o.id_persona
        FROM ocupacion o
        JOIN persona per ON per.id_persona = o.id_persona AND per.activo
        WHERE o.fecha_desde <= CURRENT_DATE
          AND (o.fecha_hasta IS NULL OR o.fecha_hasta >= CURRENT_DATE)
      ) op ON op.id_puesto = pu.id_puesto
      WHERE u.activo
      GROUP BY u.id_unidad
    `);

    await queryRunner.query(`
      CREATE VIEW "deteccion_retiro_poseedor" AS
      SELECT d.id_conocimiento,
             pv.id_persona,
             pv.fecha_prevista_retiro,
             d.orden_requerido_max,
             d.cantidad_poseedores
      FROM deteccion_punto_unico_falla d
      JOIN poseedor_vigente pv
        ON pv.id_conocimiento = d.id_conocimiento
       AND pv.orden_acreditado >= d.orden_requerido_max
      WHERE pv.fecha_prevista_retiro IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS "deteccion_retiro_poseedor"`);
    await queryRunner.query(
      `DROP VIEW IF EXISTS "deteccion_catedra_una_persona"`,
    );
    await queryRunner.query(
      `DROP VIEW IF EXISTS "deteccion_punto_unico_falla"`,
    );
  }
}
