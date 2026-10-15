import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearConocimientoYRequisitos1792095997669 implements MigrationInterface {
  name = 'CrearConocimientoYRequisitos1792095997669';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "conocimiento" ("id_conocimiento" SERIAL NOT NULL, "denominacion" character varying(150) NOT NULL, "denominacion_normalizada" character varying(150) NOT NULL, "id_tipo_conocimiento" integer NOT NULL, "id_area_tematica" integer NOT NULL, "descripcion" text, "activo" boolean NOT NULL DEFAULT true, "id_fusionado_en" integer, CONSTRAINT "CK_conocimiento_fusion_distinta" CHECK ("id_fusionado_en" IS NULL OR "id_fusionado_en" <> "id_conocimiento"), CONSTRAINT "PK_6733c9919c647a86a4900d256db" PRIMARY KEY ("id_conocimiento"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_conocimiento_tipo_denominacion_activo" ON "conocimiento"  ("id_tipo_conocimiento", "denominacion_normalizada") WHERE "activo"`,
    );
    await queryRunner.query(
      `CREATE TABLE "requisito_puesto" ("id_puesto" integer NOT NULL, "id_conocimiento" integer NOT NULL, "id_nivel_requerido" integer NOT NULL, "es_excluyente" boolean NOT NULL, CONSTRAINT "PK_6b9797aa9e3af28477b5c32d51e" PRIMARY KEY ("id_puesto", "id_conocimiento"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_requisito_puesto_conocimiento" ON "requisito_puesto"  ("id_conocimiento") `,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento" ADD CONSTRAINT "FK_0614713bef8a76eafa5ee06ff18" FOREIGN KEY ("id_tipo_conocimiento") REFERENCES "tipo_conocimiento"("id_tipo_conocimiento") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento" ADD CONSTRAINT "FK_63961d2708981567ba70e408f3c" FOREIGN KEY ("id_area_tematica") REFERENCES "area_tematica"("id_area_tematica") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento" ADD CONSTRAINT "FK_6c3f7fe70c6f5006f0118ba363d" FOREIGN KEY ("id_fusionado_en") REFERENCES "conocimiento"("id_conocimiento") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "requisito_puesto" ADD CONSTRAINT "FK_c4f08807a994b59dc5c70d75b30" FOREIGN KEY ("id_puesto") REFERENCES "puesto"("id_puesto") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "requisito_puesto" ADD CONSTRAINT "FK_3954ab065b555bffc1a84ff5955" FOREIGN KEY ("id_conocimiento") REFERENCES "conocimiento"("id_conocimiento") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "requisito_puesto" ADD CONSTRAINT "FK_9e856909f54ccb3cff14c2074b9" FOREIGN KEY ("id_nivel_requerido") REFERENCES "nivel_dominio"("id_nivel_dominio") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "requisito_puesto" DROP CONSTRAINT "FK_9e856909f54ccb3cff14c2074b9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "requisito_puesto" DROP CONSTRAINT "FK_3954ab065b555bffc1a84ff5955"`,
    );
    await queryRunner.query(
      `ALTER TABLE "requisito_puesto" DROP CONSTRAINT "FK_c4f08807a994b59dc5c70d75b30"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento" DROP CONSTRAINT "FK_6c3f7fe70c6f5006f0118ba363d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento" DROP CONSTRAINT "FK_63961d2708981567ba70e408f3c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento" DROP CONSTRAINT "FK_0614713bef8a76eafa5ee06ff18"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_requisito_puesto_conocimiento"`,
    );
    await queryRunner.query(`DROP TABLE "requisito_puesto"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_conocimiento_tipo_denominacion_activo"`,
    );
    await queryRunner.query(`DROP TABLE "conocimiento"`);
  }
}
