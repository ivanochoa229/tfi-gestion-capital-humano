import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearAccionTransferencia1792280003000 implements MigrationInterface {
  name = 'CrearAccionTransferencia1792280003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Se asegura el estado (la carga de referencia también usa ON CONFLICT)
    // para no depender del orden de las migraciones.
    await queryRunner.query(
      `INSERT INTO "estado_accion_transferencia" ("codigo", "denominacion") VALUES ('completada', 'Completada') ON CONFLICT ("codigo") DO NOTHING`,
    );
    const filas: { id: number }[] = await queryRunner.query(
      `SELECT "id_estado_accion_transferencia" AS "id" FROM "estado_accion_transferencia" WHERE "codigo" = 'completada'`,
    );
    const completada = filas[0].id;
    await queryRunner.query(
      `CREATE TABLE "accion_transferencia" ("id_accion" SERIAL NOT NULL, "id_tipo_accion" integer NOT NULL, "id_conocimiento" integer NOT NULL, "id_plan" integer, "id_responsable" integer NOT NULL, "id_destinatario" integer, "descripcion" text NOT NULL, "fecha_prevista" date NOT NULL, "fecha_cumplimiento" date, "id_estado_accion" integer NOT NULL, "nota_avance" text, "registrada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CK_accion_cumplimiento_fecha_no_futura" CHECK ("fecha_cumplimiento" IS NULL OR "fecha_cumplimiento" <= CURRENT_DATE), CONSTRAINT "CK_accion_destinatario_distinto" CHECK ("id_destinatario" IS NULL OR "id_destinatario" <> "id_responsable"), CONSTRAINT "CK_accion_cumplimiento_estado" CHECK (("fecha_cumplimiento" IS NOT NULL) = ("id_estado_accion" = ${completada})), CONSTRAINT "PK_accion_transferencia" PRIMARY KEY ("id_accion"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_accion_transferencia_responsable" ON "accion_transferencia" ("id_responsable")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_accion_transferencia_destinatario" ON "accion_transferencia" ("id_destinatario")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_accion_transferencia_plan" ON "accion_transferencia" ("id_plan")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_accion_transferencia_conocimiento" ON "accion_transferencia" ("id_conocimiento")`,
    );
    await queryRunner.query(
      `ALTER TABLE "accion_transferencia" ADD CONSTRAINT "FK_19c2c2752c879b89ca457a318ee" FOREIGN KEY ("id_tipo_accion") REFERENCES "tipo_accion_transferencia"("id_tipo_accion_transferencia") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "accion_transferencia" ADD CONSTRAINT "FK_3514831bb4157241bea9bb21c2b" FOREIGN KEY ("id_conocimiento") REFERENCES "conocimiento"("id_conocimiento") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "accion_transferencia" ADD CONSTRAINT "FK_2dc4c8e462b3a7f6223b0163eb8" FOREIGN KEY ("id_plan") REFERENCES "plan_sucesion"("id_plan") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "accion_transferencia" ADD CONSTRAINT "FK_3855c6f1163b3da1738465ac7c5" FOREIGN KEY ("id_responsable") REFERENCES "persona"("id_persona") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "accion_transferencia" ADD CONSTRAINT "FK_890b6001656ed7aca48c191f5ff" FOREIGN KEY ("id_destinatario") REFERENCES "persona"("id_persona") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "accion_transferencia" ADD CONSTRAINT "FK_669dfd826970219dd5425f7da33" FOREIGN KEY ("id_estado_accion") REFERENCES "estado_accion_transferencia"("id_estado_accion_transferencia") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "accion_transferencia"`);
  }
}
