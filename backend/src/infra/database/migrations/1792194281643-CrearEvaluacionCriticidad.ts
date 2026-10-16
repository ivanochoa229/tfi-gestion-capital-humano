import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearEvaluacionCriticidad1792194281643 implements MigrationInterface {
    name = 'CrearEvaluacionCriticidad1792194281643'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "evaluacion_criticidad" ("id_evaluacion" SERIAL NOT NULL, "id_puesto" integer NOT NULL, "id_conocimiento" integer NOT NULL, "id_nivel_impacto" integer NOT NULL, "id_nivel_dificultad" integer NOT NULL, "id_nivel_criticidad" integer NOT NULL, "fecha_evaluacion" date NOT NULL, "id_usuario" integer NOT NULL, "observaciones" text, "registrada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CK_evaluacion_criticidad_fecha_no_futura" CHECK ("fecha_evaluacion" <= CURRENT_DATE), CONSTRAINT "PK_04ae24136be68516680c9aa2412" PRIMARY KEY ("id_evaluacion"))`);
        await queryRunner.query(`CREATE INDEX "IDX_evaluacion_criticidad_par" ON "evaluacion_criticidad"  ("id_puesto", "id_conocimiento", "fecha_evaluacion") `);
        await queryRunner.query(`ALTER TABLE "evaluacion_criticidad" ADD CONSTRAINT "FK_1292c934981ef5b495d3538e829" FOREIGN KEY ("id_puesto") REFERENCES "puesto"("id_puesto") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "evaluacion_criticidad" ADD CONSTRAINT "FK_17dba525ccf282ab165596d296a" FOREIGN KEY ("id_conocimiento") REFERENCES "conocimiento"("id_conocimiento") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "evaluacion_criticidad" ADD CONSTRAINT "FK_ae6f57c9437bd476dfc9478e322" FOREIGN KEY ("id_nivel_impacto") REFERENCES "nivel_impacto"("id_nivel_impacto") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "evaluacion_criticidad" ADD CONSTRAINT "FK_858ff045fa4b835519b881956f4" FOREIGN KEY ("id_nivel_dificultad") REFERENCES "nivel_dificultad"("id_nivel_dificultad") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "evaluacion_criticidad" ADD CONSTRAINT "FK_a401ff142ff0dc4cc9d2302cbf7" FOREIGN KEY ("id_nivel_criticidad") REFERENCES "nivel_criticidad"("id_nivel_criticidad") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "evaluacion_criticidad" ADD CONSTRAINT "FK_56a67a8a74c800a1147605926c1" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "evaluacion_criticidad" DROP CONSTRAINT "FK_56a67a8a74c800a1147605926c1"`);
        await queryRunner.query(`ALTER TABLE "evaluacion_criticidad" DROP CONSTRAINT "FK_a401ff142ff0dc4cc9d2302cbf7"`);
        await queryRunner.query(`ALTER TABLE "evaluacion_criticidad" DROP CONSTRAINT "FK_858ff045fa4b835519b881956f4"`);
        await queryRunner.query(`ALTER TABLE "evaluacion_criticidad" DROP CONSTRAINT "FK_ae6f57c9437bd476dfc9478e322"`);
        await queryRunner.query(`ALTER TABLE "evaluacion_criticidad" DROP CONSTRAINT "FK_17dba525ccf282ab165596d296a"`);
        await queryRunner.query(`ALTER TABLE "evaluacion_criticidad" DROP CONSTRAINT "FK_1292c934981ef5b495d3538e829"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_evaluacion_criticidad_par"`);
        await queryRunner.query(`DROP TABLE "evaluacion_criticidad"`);
    }

}
