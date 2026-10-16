import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearVistaCriticidadVigente1792194290000 implements MigrationInterface {
  name = 'CrearVistaCriticidadVigente1792194290000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE VIEW "criticidad_vigente" AS
       SELECT DISTINCT ON ("id_puesto", "id_conocimiento")
              "id_evaluacion", "id_puesto", "id_conocimiento",
              "id_nivel_impacto", "id_nivel_dificultad", "id_nivel_criticidad",
              "fecha_evaluacion", "id_usuario", "observaciones", "registrada_en"
       FROM "evaluacion_criticidad"
       ORDER BY "id_puesto", "id_conocimiento", "fecha_evaluacion" DESC, "id_evaluacion" DESC`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW "criticidad_vigente"`);
  }
}
