import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearPlanSucesion1792280001000 implements MigrationInterface {
  name = 'CrearPlanSucesion1792280001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "plan_sucesion" ("id_plan" SERIAL NOT NULL, "id_puesto" integer NOT NULL, "id_responsable" integer NOT NULL, "id_estado_plan" integer NOT NULL, "fecha_elaboracion" date NOT NULL DEFAULT ('now'::text)::date, "id_plan_anterior" integer, "id_usuario_resolucion" integer, "fecha_resolucion" date, "motivo_resolucion" text, "observaciones" text, CONSTRAINT "CK_plan_sucesion_resolucion" CHECK (("id_usuario_resolucion" IS NULL) = ("fecha_resolucion" IS NULL)), CONSTRAINT "PK_plan_sucesion" PRIMARY KEY ("id_plan"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_sucesion" ADD CONSTRAINT "FK_c4e20bfce2adb047d9fc8fc1a8d" FOREIGN KEY ("id_puesto") REFERENCES "puesto"("id_puesto") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_sucesion" ADD CONSTRAINT "FK_8ed16bb2a0d6ee99b6b3229c078" FOREIGN KEY ("id_responsable") REFERENCES "persona"("id_persona") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_sucesion" ADD CONSTRAINT "FK_84279c2586d06d40dc3e3e68125" FOREIGN KEY ("id_estado_plan") REFERENCES "estado_plan"("id_estado_plan") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_sucesion" ADD CONSTRAINT "FK_ad62aef5fdd6bc4147206f83ae7" FOREIGN KEY ("id_plan_anterior") REFERENCES "plan_sucesion"("id_plan") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_sucesion" ADD CONSTRAINT "FK_decbebf3925634b40c39be18649" FOREIGN KEY ("id_usuario_resolucion") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Un índice parcial no puede consultar otra tabla: se leen los ids de los
    // estados y se escriben en el WHERE. Los estados se aseguran antes (la
    // carga de referencia también usa ON CONFLICT) para no depender del orden.
    for (const [codigo, denominacion] of [
      ['borrador', 'Borrador'],
      ['pendiente_aprobacion', 'Pendiente de aprobación'],
      ['aprobado', 'Aprobado'],
    ]) {
      await queryRunner.query(
        `INSERT INTO "estado_plan" ("codigo", "denominacion") VALUES ($1, $2) ON CONFLICT ("codigo") DO NOTHING`,
        [codigo, denominacion],
      );
    }
    const idEstado = async (codigo: string): Promise<number> => {
      const filas: { id: number }[] = await queryRunner.query(
        `SELECT "id_estado_plan" AS "id" FROM "estado_plan" WHERE "codigo" = $1`,
        [codigo],
      );
      return filas[0].id;
    };
    const aprobado = await idEstado('aprobado');
    const borrador = await idEstado('borrador');
    const pendiente = await idEstado('pendiente_aprobacion');
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_plan_sucesion_aprobado" ON "plan_sucesion" ("id_puesto") WHERE "id_estado_plan" = ${aprobado}`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_plan_sucesion_en_elaboracion" ON "plan_sucesion" ("id_puesto") WHERE "id_estado_plan" IN (${borrador}, ${pendiente})`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_plan_sucesion_en_elaboracion"`);
    await queryRunner.query(`DROP INDEX "UQ_plan_sucesion_aprobado"`);
    await queryRunner.query(`DROP TABLE "plan_sucesion"`);
  }
}
