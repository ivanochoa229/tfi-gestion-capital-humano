import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearEscalasYMatrizCriticidad1792194135446 implements MigrationInterface {
  name = 'CrearEscalasYMatrizCriticidad1792194135446';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "nivel_dificultad" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "orden" integer NOT NULL, "id_nivel_dificultad" SERIAL NOT NULL, "criterio" text NOT NULL, CONSTRAINT "UQ_854de7261ce15db44ab2c9db6ca" UNIQUE ("codigo"), CONSTRAINT "UQ_6eb818d0fea349e2e9977f65778" UNIQUE ("denominacion"), CONSTRAINT "UQ_998e726fe47df171c5f98757cdb" UNIQUE ("orden"), CONSTRAINT "PK_740e398c755cec8908a77cc7dea" PRIMARY KEY ("id_nivel_dificultad"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "nivel_impacto" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "orden" integer NOT NULL, "id_nivel_impacto" SERIAL NOT NULL, "criterio" text NOT NULL, CONSTRAINT "UQ_f627abb8ea8ac91e85ec3dc6d04" UNIQUE ("codigo"), CONSTRAINT "UQ_3311d6bb17a51c12798d2a10cb5" UNIQUE ("denominacion"), CONSTRAINT "UQ_19b2655afa55e937e6b8d14d376" UNIQUE ("orden"), CONSTRAINT "PK_702cf862a3d5e20a376156407c9" PRIMARY KEY ("id_nivel_impacto"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "matriz_criticidad" ("id_nivel_impacto" integer NOT NULL, "id_nivel_dificultad" integer NOT NULL, "id_nivel_criticidad" integer NOT NULL, CONSTRAINT "PK_5f2052f352a446a847e3c8fc230" PRIMARY KEY ("id_nivel_impacto", "id_nivel_dificultad"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "matriz_criticidad" ADD CONSTRAINT "FK_c8ddb28a214f728bf617d977685" FOREIGN KEY ("id_nivel_impacto") REFERENCES "nivel_impacto"("id_nivel_impacto") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "matriz_criticidad" ADD CONSTRAINT "FK_dc5d77555d41cb7e9d1f28390c2" FOREIGN KEY ("id_nivel_dificultad") REFERENCES "nivel_dificultad"("id_nivel_dificultad") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "matriz_criticidad" ADD CONSTRAINT "FK_4e424a2b4cd333ca1d440f67d1e" FOREIGN KEY ("id_nivel_criticidad") REFERENCES "nivel_criticidad"("id_nivel_criticidad") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "matriz_criticidad" DROP CONSTRAINT "FK_4e424a2b4cd333ca1d440f67d1e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matriz_criticidad" DROP CONSTRAINT "FK_dc5d77555d41cb7e9d1f28390c2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matriz_criticidad" DROP CONSTRAINT "FK_c8ddb28a214f728bf617d977685"`,
    );
    await queryRunner.query(`DROP TABLE "matriz_criticidad"`);
    await queryRunner.query(`DROP TABLE "nivel_impacto"`);
    await queryRunner.query(`DROP TABLE "nivel_dificultad"`);
  }
}
