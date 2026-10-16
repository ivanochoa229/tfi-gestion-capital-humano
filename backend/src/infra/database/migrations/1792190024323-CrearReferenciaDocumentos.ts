import { MigrationInterface, QueryRunner } from 'typeorm';

const TIPOS_DOCUMENTO: [codigo: string, denominacion: string][] = [
  ['manual', 'Manual'],
  ['instructivo', 'Instructivo'],
  ['procedimiento', 'Procedimiento'],
];

export class CrearReferenciaDocumentos1792190024323 implements MigrationInterface {
  name = 'CrearReferenciaDocumentos1792190024323';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tipo_documento" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "id_tipo_documento" SERIAL NOT NULL, CONSTRAINT "UQ_e22457239f493f4c634a74fa8a8" UNIQUE ("codigo"), CONSTRAINT "UQ_22df51446418df93452ca9c5865" UNIQUE ("denominacion"), CONSTRAINT "PK_bb2662f38f4c2381bb0be4f8102" PRIMARY KEY ("id_tipo_documento"))`,
    );
    for (const [codigo, denominacion] of TIPOS_DOCUMENTO) {
      await queryRunner.query(
        `INSERT INTO "tipo_documento" ("codigo", "denominacion") VALUES ($1, $2)`,
        [codigo, denominacion],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tipo_documento"`);
  }
}
