import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearCandidatoSucesion1792280002000 implements MigrationInterface {
  name = 'CrearCandidatoSucesion1792280002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "candidato_sucesion" ("id_plan" integer NOT NULL, "id_persona" integer NOT NULL, "id_estado_preparacion" integer NOT NULL, "prioridad" integer NOT NULL, "fecha_disponibilidad_estimada" date, "observaciones" text, CONSTRAINT "CK_candidato_sucesion_prioridad" CHECK ("prioridad" >= 1), CONSTRAINT "UQ_candidato_sucesion_prioridad" UNIQUE ("id_plan", "prioridad") DEFERRABLE INITIALLY IMMEDIATE, CONSTRAINT "PK_candidato_sucesion" PRIMARY KEY ("id_plan", "id_persona"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidato_sucesion" ADD CONSTRAINT "FK_9a073b7c06dff333f55f167eec4" FOREIGN KEY ("id_plan") REFERENCES "plan_sucesion"("id_plan") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidato_sucesion" ADD CONSTRAINT "FK_f049ee1ebed52713669665a81ea" FOREIGN KEY ("id_persona") REFERENCES "persona"("id_persona") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidato_sucesion" ADD CONSTRAINT "FK_218f1af47d00c37a94caac7a72b" FOREIGN KEY ("id_estado_preparacion") REFERENCES "estado_preparacion"("id_estado_preparacion") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "candidato_sucesion"`);
  }
}
