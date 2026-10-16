import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearActivosDeConocimiento1792190164003 implements MigrationInterface {
  name = 'CrearActivosDeConocimiento1792190164003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "activo_conocimiento" ("id_activo" SERIAL NOT NULL, "titulo" character varying(200) NOT NULL, "id_tipo_documento" integer NOT NULL, "id_unidad" integer NOT NULL, "origen" character varying(10) NOT NULL, "ubicacion" character varying(2000) NOT NULL, "nombre_original" character varying(255), "tipo_mime" character varying(100), "tamanio" integer, "hash" character varying(64), "fecha_vigencia" date, "activo" boolean NOT NULL DEFAULT true, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CK_activo_origen_coherente" CHECK (("origen" = 'archivo' AND "nombre_original" IS NOT NULL AND "tipo_mime" IS NOT NULL AND "tamanio" IS NOT NULL AND "hash" IS NOT NULL) OR ("origen" = 'enlace' AND "nombre_original" IS NULL AND "tipo_mime" IS NULL AND "tamanio" IS NULL AND "hash" IS NULL)), CONSTRAINT "PK_ac9fcbc2d089d64db8a9f58a6cf" PRIMARY KEY ("id_activo"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_activo_hash_activo" ON "activo_conocimiento"  ("hash") WHERE "activo" AND "hash" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "activo_conocimiento_conocimiento" ("id_activo" integer NOT NULL, "id_conocimiento" integer NOT NULL, CONSTRAINT "PK_2522817622035b8d36fba1e6147" PRIMARY KEY ("id_activo", "id_conocimiento"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_activo_conocimiento_conocimiento" ON "activo_conocimiento_conocimiento"  ("id_conocimiento") `,
    );
    await queryRunner.query(
      `ALTER TABLE "activo_conocimiento" ADD CONSTRAINT "FK_d4c69cd4a7afbbc5226e6acecf4" FOREIGN KEY ("id_tipo_documento") REFERENCES "tipo_documento"("id_tipo_documento") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "activo_conocimiento" ADD CONSTRAINT "FK_5d2c07b4da1b87a55e25f02bbfa" FOREIGN KEY ("id_unidad") REFERENCES "unidad_organizativa"("id_unidad") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "activo_conocimiento_conocimiento" ADD CONSTRAINT "FK_140ee70558229e08e8b3ea5f1ae" FOREIGN KEY ("id_activo") REFERENCES "activo_conocimiento"("id_activo") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "activo_conocimiento_conocimiento" ADD CONSTRAINT "FK_da9567781b53838222167de7bad" FOREIGN KEY ("id_conocimiento") REFERENCES "conocimiento"("id_conocimiento") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activo_conocimiento_conocimiento" DROP CONSTRAINT "FK_da9567781b53838222167de7bad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activo_conocimiento_conocimiento" DROP CONSTRAINT "FK_140ee70558229e08e8b3ea5f1ae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activo_conocimiento" DROP CONSTRAINT "FK_5d2c07b4da1b87a55e25f02bbfa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activo_conocimiento" DROP CONSTRAINT "FK_d4c69cd4a7afbbc5226e6acecf4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_activo_conocimiento_conocimiento"`,
    );
    await queryRunner.query(`DROP TABLE "activo_conocimiento_conocimiento"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_activo_hash_activo"`);
    await queryRunner.query(`DROP TABLE "activo_conocimiento"`);
  }
}
