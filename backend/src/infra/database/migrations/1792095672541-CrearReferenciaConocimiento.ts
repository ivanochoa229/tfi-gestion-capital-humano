import { MigrationInterface, QueryRunner } from 'typeorm';

type Valor = [codigo: string, denominacion: string];

const AREAS_TEMATICAS: Valor[] = [
  ['programacion', 'Programación'],
  ['bases_de_datos', 'Bases de datos'],
  ['redes_y_comunicaciones', 'Redes y comunicaciones'],
  ['ingenieria_de_software', 'Ingeniería de software'],
  ['sistemas_operativos', 'Sistemas operativos'],
  ['matematica', 'Matemática'],
  ['gestion_y_organizacion', 'Gestión y organización'],
  ['docencia_universitaria', 'Docencia universitaria'],
];

const TIPOS_EVIDENCIA: Valor[] = [
  ['titulo', 'Título'],
  ['certificado', 'Certificado'],
  ['produccion', 'Producción académica'],
  ['observacion_directa', 'Observación directa'],
  ['entrevista', 'Entrevista'],
];

export class CrearReferenciaConocimiento1792095672541
  implements MigrationInterface
{
  name = 'CrearReferenciaConocimiento1792095672541';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "area_tematica" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "id_area_tematica" SERIAL NOT NULL, CONSTRAINT "UQ_1ffe50a85a24edd91ff2c733f21" UNIQUE ("codigo"), CONSTRAINT "UQ_213b811e032a9019fef82068a8d" UNIQUE ("denominacion"), CONSTRAINT "PK_f2074221ec2b172034787006138" PRIMARY KEY ("id_area_tematica"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tipo_evidencia" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "id_tipo_evidencia" SERIAL NOT NULL, CONSTRAINT "UQ_798f754f9728f352a1dde2f6e53" UNIQUE ("codigo"), CONSTRAINT "UQ_c9000c52d01d89a12f015b1f044" UNIQUE ("denominacion"), CONSTRAINT "PK_27f10d5c0c54b691d1976b993c0" PRIMARY KEY ("id_tipo_evidencia"))`,
    );

    for (const [codigo, denominacion] of AREAS_TEMATICAS) {
      await queryRunner.query(
        `INSERT INTO "area_tematica" ("codigo", "denominacion") VALUES ($1, $2)`,
        [codigo, denominacion],
      );
    }
    for (const [codigo, denominacion] of TIPOS_EVIDENCIA) {
      await queryRunner.query(
        `INSERT INTO "tipo_evidencia" ("codigo", "denominacion") VALUES ($1, $2)`,
        [codigo, denominacion],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tipo_evidencia"`);
    await queryRunner.query(`DROP TABLE "area_tematica"`);
  }
}
