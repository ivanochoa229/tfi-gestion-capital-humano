import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearPersonasYOcupaciones1791977095519 implements MigrationInterface {
  name = 'CrearPersonasYOcupaciones1791977095519';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    await queryRunner.query(
      `CREATE TABLE "persona" ("id_persona" SERIAL NOT NULL, "legajo" character varying(20) NOT NULL, "apellido" character varying(100) NOT NULL, "nombre" character varying(100) NOT NULL, "documento" character varying(8) NOT NULL, "fecha_nacimiento" date NOT NULL, "fecha_ingreso" date NOT NULL, "id_situacion_revista" integer NOT NULL, "fecha_prevista_retiro" date, "activo" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_49c0ff4beb4fb55f8caaf71773f" UNIQUE ("legajo"), CONSTRAINT "UQ_95d654ab3555fddcadf90867fa1" UNIQUE ("documento"), CONSTRAINT "CK_persona_retiro_desde_ingreso" CHECK ("fecha_prevista_retiro" IS NULL OR "fecha_prevista_retiro" >= "fecha_ingreso"), CONSTRAINT "CK_persona_ingreso_posterior_a_nacimiento" CHECK ("fecha_ingreso" > "fecha_nacimiento"), CONSTRAINT "CK_persona_documento" CHECK ("documento" ~ '^[0-9]{7,8}$'), CONSTRAINT "PK_a5b8321cce9bc11ca8931257ca3" PRIMARY KEY ("id_persona"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "ocupacion" ("id_persona" integer NOT NULL, "id_puesto" integer NOT NULL, "fecha_desde" date NOT NULL, "fecha_hasta" date, "id_caracter_ocupacion" integer NOT NULL, "id_dedicacion" integer NOT NULL, CONSTRAINT "CK_ocupacion_fechas" CHECK ("fecha_hasta" IS NULL OR "fecha_hasta" >= "fecha_desde"), CONSTRAINT "EX_ocupacion_sin_solape" EXCLUDE USING gist ("id_persona" WITH =, "id_puesto" WITH =, daterange("fecha_desde", "fecha_hasta", '[]') WITH &&), CONSTRAINT "PK_7f96ebe2ee037c67b6ac080da75" PRIMARY KEY ("id_persona", "id_puesto", "fecha_desde"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ocupacion_puesto" ON "ocupacion"  ("id_puesto") `,
    );
    await queryRunner.query(
      `ALTER TABLE "persona" ADD CONSTRAINT "FK_b996bf1d95d11352be6642390e3" FOREIGN KEY ("id_situacion_revista") REFERENCES "situacion_revista"("id_situacion_revista") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ocupacion" ADD CONSTRAINT "FK_560ac30ffaf0cd822e1a1a9b625" FOREIGN KEY ("id_persona") REFERENCES "persona"("id_persona") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ocupacion" ADD CONSTRAINT "FK_cd7abdae9f29b84101bf78a1ca0" FOREIGN KEY ("id_puesto") REFERENCES "puesto"("id_puesto") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ocupacion" ADD CONSTRAINT "FK_8713bdce425b51f562a10365bec" FOREIGN KEY ("id_caracter_ocupacion") REFERENCES "caracter_ocupacion"("id_caracter_ocupacion") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ocupacion" ADD CONSTRAINT "FK_b34658ca3216c3d9500e409c6e9" FOREIGN KEY ("id_dedicacion") REFERENCES "dedicacion"("id_dedicacion") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_persona_apellido_nombre" ON "persona" (lower("apellido"), lower("nombre"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_persona_apellido_nombre"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ocupacion" DROP CONSTRAINT "FK_b34658ca3216c3d9500e409c6e9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ocupacion" DROP CONSTRAINT "FK_8713bdce425b51f562a10365bec"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ocupacion" DROP CONSTRAINT "FK_cd7abdae9f29b84101bf78a1ca0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ocupacion" DROP CONSTRAINT "FK_560ac30ffaf0cd822e1a1a9b625"`,
    );
    await queryRunner.query(
      `ALTER TABLE "persona" DROP CONSTRAINT "FK_b996bf1d95d11352be6642390e3"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_ocupacion_puesto"`);
    await queryRunner.query(`DROP TABLE "ocupacion"`);
    await queryRunner.query(`DROP TABLE "persona"`);
  }
}
