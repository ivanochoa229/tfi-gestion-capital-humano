import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearVistasBaseDeDeteccion1792280004000 implements MigrationInterface {
  name = 'CrearVistasBaseDeDeteccion1792280004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE VIEW "poseedor_vigente" AS
      SELECT p.id_persona,
             cp.id_conocimiento,
             nd.orden AS orden_acreditado,
             p.fecha_prevista_retiro
      FROM persona p
      JOIN conocimiento_persona cp ON cp.id_persona = p.id_persona
      JOIN nivel_dominio nd ON nd.id_nivel_dominio = cp.id_nivel_acreditado
      WHERE p.activo
        AND (p.fecha_prevista_retiro IS NULL OR p.fecha_prevista_retiro >= CURRENT_DATE)
        AND EXISTS (
          SELECT 1
          FROM ocupacion o
          WHERE o.id_persona = p.id_persona
            AND o.fecha_desde <= CURRENT_DATE
            AND (o.fecha_hasta IS NULL OR o.fecha_hasta >= CURRENT_DATE)
        )
    `);

    await queryRunner.query(`
      CREATE VIEW "par_critico" AS
      SELECT r.id_puesto,
             r.id_conocimiento,
             p.id_unidad,
             nd.orden AS orden_requerido,
             r.es_excluyente
      FROM requisito_puesto r
      JOIN puesto p ON p.id_puesto = r.id_puesto
      JOIN conocimiento k ON k.id_conocimiento = r.id_conocimiento
      JOIN criticidad_vigente v ON v.id_puesto = r.id_puesto AND v.id_conocimiento = r.id_conocimiento
      JOIN nivel_criticidad nc ON nc.id_nivel_criticidad = v.id_nivel_criticidad
      JOIN nivel_dominio nd ON nd.id_nivel_dominio = r.id_nivel_requerido
      WHERE p.activo
        AND k.activo
        AND nc.codigo = 'alta'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS "par_critico"`);
    await queryRunner.query(`DROP VIEW IF EXISTS "poseedor_vigente"`);
  }
}
