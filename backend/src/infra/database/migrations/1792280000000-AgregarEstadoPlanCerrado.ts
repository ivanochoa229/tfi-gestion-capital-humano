import { MigrationInterface, QueryRunner } from 'typeorm';

/** Un plan que se descarta o se da de baja sin reemplazo pasa a `cerrado`. */
export class AgregarEstadoPlanCerrado1792280000000 implements MigrationInterface {
  name = 'AgregarEstadoPlanCerrado1792280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "estado_plan" ("codigo", "denominacion") VALUES ('cerrado', 'Cerrado')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "estado_plan" WHERE "codigo" = 'cerrado'`,
    );
  }
}
