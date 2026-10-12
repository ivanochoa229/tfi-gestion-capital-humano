import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearTablasReferencia1791835601120 implements MigrationInterface {
  name = 'CrearTablasReferencia1791835601120';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "caracter_ocupacion" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "id_caracter_ocupacion" SERIAL NOT NULL, CONSTRAINT "UQ_114bb9b431889d511f672035a93" UNIQUE ("codigo"), CONSTRAINT "UQ_4e43fb2a59bc2b95538d83122da" UNIQUE ("denominacion"), CONSTRAINT "PK_2b3f64eafa30f9f382196035a00" PRIMARY KEY ("id_caracter_ocupacion"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "estado_accion_transferencia" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "id_estado_accion_transferencia" SERIAL NOT NULL, CONSTRAINT "UQ_a37a022f7d239262e275409bf1d" UNIQUE ("codigo"), CONSTRAINT "UQ_a12650320e6c76a9d8815a8b24c" UNIQUE ("denominacion"), CONSTRAINT "PK_c0d38155e2f572c498dd12e835e" PRIMARY KEY ("id_estado_accion_transferencia"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "estado_preparacion" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "orden" integer NOT NULL, "id_estado_preparacion" SERIAL NOT NULL, CONSTRAINT "UQ_1c60c07f9f2427b8ecc1c6d5cc3" UNIQUE ("codigo"), CONSTRAINT "UQ_94846fc4ad53e26fb27d6c46cdf" UNIQUE ("denominacion"), CONSTRAINT "UQ_f7becf7bb55da9cb9fd52244334" UNIQUE ("orden"), CONSTRAINT "PK_117f3341adecf536704d4150b91" PRIMARY KEY ("id_estado_preparacion"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "estado_plan" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "id_estado_plan" SERIAL NOT NULL, CONSTRAINT "UQ_32a97ce133701816482ddf26688" UNIQUE ("codigo"), CONSTRAINT "UQ_c69ef5b3b98f8ca4ff8f7236022" UNIQUE ("denominacion"), CONSTRAINT "PK_5354e986bf13731fe199dae6d53" PRIMARY KEY ("id_estado_plan"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "nivel_criticidad" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "orden" integer NOT NULL, "id_nivel_criticidad" SERIAL NOT NULL, CONSTRAINT "UQ_fbbf30e9377a71a56ce682d5e55" UNIQUE ("codigo"), CONSTRAINT "UQ_a4a061a4ee9a5eaf65ed2f6db69" UNIQUE ("denominacion"), CONSTRAINT "UQ_8200eff32b8163bc4473ec96f7c" UNIQUE ("orden"), CONSTRAINT "PK_eec9c043e8ec349f3a6a85f5455" PRIMARY KEY ("id_nivel_criticidad"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "nivel_dominio" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "orden" integer NOT NULL, "id_nivel_dominio" SERIAL NOT NULL, CONSTRAINT "UQ_ea6c126a3dff004222c0416b970" UNIQUE ("codigo"), CONSTRAINT "UQ_06b7d9c59e5e20109613c9e01a3" UNIQUE ("denominacion"), CONSTRAINT "UQ_d8ec3b1d96f37badc1cba341f01" UNIQUE ("orden"), CONSTRAINT "PK_00e2d44742560c6c103c06093dd" PRIMARY KEY ("id_nivel_dominio"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tipo_accion_transferencia" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "id_tipo_accion_transferencia" SERIAL NOT NULL, CONSTRAINT "UQ_974aa8e76e430a6393393c69dbb" UNIQUE ("codigo"), CONSTRAINT "UQ_77843139de28679f556f0be46ad" UNIQUE ("denominacion"), CONSTRAINT "PK_e6526a19ee72f103b707e113908" PRIMARY KEY ("id_tipo_accion_transferencia"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tipo_conocimiento" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "id_tipo_conocimiento" SERIAL NOT NULL, CONSTRAINT "UQ_d5b8a3892d879649c486b158560" UNIQUE ("codigo"), CONSTRAINT "UQ_41acf8a95e19533e9898267cd7f" UNIQUE ("denominacion"), CONSTRAINT "PK_dadced18943a3d8386b00dd02c3" PRIMARY KEY ("id_tipo_conocimiento"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tipo_responsabilidad" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "id_tipo_responsabilidad" SERIAL NOT NULL, CONSTRAINT "UQ_7d2edb5df56ec5a177e7dc98857" UNIQUE ("codigo"), CONSTRAINT "UQ_a68ea905d6cd01f60973f62e74e" UNIQUE ("denominacion"), CONSTRAINT "PK_84f0833ff39c8c8cdbb8586d372" PRIMARY KEY ("id_tipo_responsabilidad"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tipo_riesgo" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "id_tipo_riesgo" SERIAL NOT NULL, CONSTRAINT "UQ_df229986716e57ad611b941636c" UNIQUE ("codigo"), CONSTRAINT "UQ_df920bade972b6a795f8bd19c09" UNIQUE ("denominacion"), CONSTRAINT "PK_608fe8b977483a8d4ec913d37ff" PRIMARY KEY ("id_tipo_riesgo"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tipo_riesgo"`);
    await queryRunner.query(`DROP TABLE "tipo_responsabilidad"`);
    await queryRunner.query(`DROP TABLE "tipo_conocimiento"`);
    await queryRunner.query(`DROP TABLE "tipo_accion_transferencia"`);
    await queryRunner.query(`DROP TABLE "nivel_dominio"`);
    await queryRunner.query(`DROP TABLE "nivel_criticidad"`);
    await queryRunner.query(`DROP TABLE "estado_plan"`);
    await queryRunner.query(`DROP TABLE "estado_preparacion"`);
    await queryRunner.query(`DROP TABLE "estado_accion_transferencia"`);
    await queryRunner.query(`DROP TABLE "caracter_ocupacion"`);
  }
}
