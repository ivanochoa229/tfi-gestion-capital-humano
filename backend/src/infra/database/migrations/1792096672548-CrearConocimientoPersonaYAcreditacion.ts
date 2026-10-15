import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearConocimientoPersonaYAcreditacion1792096672548 implements MigrationInterface {
  name = 'CrearConocimientoPersonaYAcreditacion1792096672548';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "conocimiento_persona" ("id_persona" integer NOT NULL, "id_conocimiento" integer NOT NULL, "id_nivel_declarado" integer, "fecha_declaracion" date, "id_nivel_acreditado" integer, "fecha_evaluacion" date, "id_tipo_evidencia" integer, "id_evaluador" integer, CONSTRAINT "CK_conocimiento_persona_acreditacion_completa" CHECK (("id_nivel_acreditado" IS NULL) = ("fecha_evaluacion" IS NULL) AND ("id_nivel_acreditado" IS NULL) = ("id_tipo_evidencia" IS NULL) AND ("id_nivel_acreditado" IS NULL) = ("id_evaluador" IS NULL)), CONSTRAINT "CK_conocimiento_persona_declaracion_completa" CHECK (("id_nivel_declarado" IS NULL) = ("fecha_declaracion" IS NULL)), CONSTRAINT "CK_conocimiento_persona_algun_nivel" CHECK ("id_nivel_declarado" IS NOT NULL OR "id_nivel_acreditado" IS NOT NULL), CONSTRAINT "PK_d31ce7f54bedc19e62baf5ce9af" PRIMARY KEY ("id_persona", "id_conocimiento"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conocimiento_persona_conocimiento" ON "conocimiento_persona"  ("id_conocimiento") `,
    );
    await queryRunner.query(
      `CREATE TABLE "acreditacion" ("id_acreditacion" SERIAL NOT NULL, "id_persona" integer NOT NULL, "id_conocimiento" integer NOT NULL, "id_nivel_acreditado" integer NOT NULL, "id_tipo_evidencia" integer NOT NULL, "fecha_evaluacion" date NOT NULL, "id_evaluador" integer NOT NULL, "observaciones" text, "registrada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CK_acreditacion_fecha_no_futura" CHECK ("fecha_evaluacion" <= CURRENT_DATE), CONSTRAINT "PK_9137220f2d39e58300ffbbc57b9" PRIMARY KEY ("id_acreditacion"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_acreditacion_persona_conocimiento" ON "acreditacion"  ("id_persona", "id_conocimiento") `,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento_persona" ADD CONSTRAINT "FK_3110864799e67d008b03d063a1b" FOREIGN KEY ("id_persona") REFERENCES "persona"("id_persona") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento_persona" ADD CONSTRAINT "FK_0621ddabf67da473a099ec8f5aa" FOREIGN KEY ("id_conocimiento") REFERENCES "conocimiento"("id_conocimiento") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento_persona" ADD CONSTRAINT "FK_9181a26e1538000a6869954e9b5" FOREIGN KEY ("id_nivel_declarado") REFERENCES "nivel_dominio"("id_nivel_dominio") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento_persona" ADD CONSTRAINT "FK_cffe183f4b3d4ed9a5fe014dcc3" FOREIGN KEY ("id_nivel_acreditado") REFERENCES "nivel_dominio"("id_nivel_dominio") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento_persona" ADD CONSTRAINT "FK_7ed964f56e021cd6577b97f6f59" FOREIGN KEY ("id_tipo_evidencia") REFERENCES "tipo_evidencia"("id_tipo_evidencia") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento_persona" ADD CONSTRAINT "FK_27d4583ac91b2f298039f614aa7" FOREIGN KEY ("id_evaluador") REFERENCES "persona"("id_persona") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "acreditacion" ADD CONSTRAINT "FK_98f0de5924917912911a1aa9fbe" FOREIGN KEY ("id_persona", "id_conocimiento") REFERENCES "conocimiento_persona"("id_persona","id_conocimiento") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "acreditacion" ADD CONSTRAINT "FK_5ba302af32550799ada91d70203" FOREIGN KEY ("id_nivel_acreditado") REFERENCES "nivel_dominio"("id_nivel_dominio") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "acreditacion" ADD CONSTRAINT "FK_0b83e18ac3225f44eb1b8dbcd22" FOREIGN KEY ("id_tipo_evidencia") REFERENCES "tipo_evidencia"("id_tipo_evidencia") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "acreditacion" ADD CONSTRAINT "FK_e6a3fe4dc944b774448d09a3c75" FOREIGN KEY ("id_evaluador") REFERENCES "persona"("id_persona") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "acreditacion" DROP CONSTRAINT "FK_e6a3fe4dc944b774448d09a3c75"`,
    );
    await queryRunner.query(
      `ALTER TABLE "acreditacion" DROP CONSTRAINT "FK_0b83e18ac3225f44eb1b8dbcd22"`,
    );
    await queryRunner.query(
      `ALTER TABLE "acreditacion" DROP CONSTRAINT "FK_5ba302af32550799ada91d70203"`,
    );
    await queryRunner.query(
      `ALTER TABLE "acreditacion" DROP CONSTRAINT "FK_98f0de5924917912911a1aa9fbe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento_persona" DROP CONSTRAINT "FK_27d4583ac91b2f298039f614aa7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento_persona" DROP CONSTRAINT "FK_7ed964f56e021cd6577b97f6f59"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento_persona" DROP CONSTRAINT "FK_cffe183f4b3d4ed9a5fe014dcc3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento_persona" DROP CONSTRAINT "FK_9181a26e1538000a6869954e9b5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento_persona" DROP CONSTRAINT "FK_0621ddabf67da473a099ec8f5aa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conocimiento_persona" DROP CONSTRAINT "FK_3110864799e67d008b03d063a1b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_acreditacion_persona_conocimiento"`,
    );
    await queryRunner.query(`DROP TABLE "acreditacion"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_conocimiento_persona_conocimiento"`,
    );
    await queryRunner.query(`DROP TABLE "conocimiento_persona"`);
  }
}
