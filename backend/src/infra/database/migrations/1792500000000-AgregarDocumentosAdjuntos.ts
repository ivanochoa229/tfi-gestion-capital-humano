import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Archivos adjuntos guardados en RustFS (RNF08): el documento del plan de
 * sucesión (uno por plan, reemplazable) y la evidencia de una acreditación
 * (opcional, fija). En la base quedan solo la clave del objeto y sus metadatos.
 */
export class AgregarDocumentosAdjuntos1792500000000 implements MigrationInterface {
  name = 'AgregarDocumentosAdjuntos1792500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [tabla, prefijo] of [
      ['plan_sucesion', 'documento'],
      ['acreditacion', 'evidencia'],
    ]) {
      await queryRunner.query(
        `ALTER TABLE "${tabla}"
           ADD "${prefijo}_clave" character varying(500),
           ADD "${prefijo}_nombre" character varying(255),
           ADD "${prefijo}_tipo_mime" character varying(100),
           ADD "${prefijo}_tamanio" integer,
           ADD "${prefijo}_hash" character varying(64)`,
      );
      // Todo o nada: un adjunto tiene todos sus metadatos.
      await queryRunner.query(
        `ALTER TABLE "${tabla}" ADD CONSTRAINT "CK_${tabla}_${prefijo}" CHECK (
           ("${prefijo}_clave" IS NULL AND "${prefijo}_nombre" IS NULL AND "${prefijo}_tipo_mime" IS NULL
             AND "${prefijo}_tamanio" IS NULL AND "${prefijo}_hash" IS NULL)
           OR ("${prefijo}_clave" IS NOT NULL AND "${prefijo}_nombre" IS NOT NULL AND "${prefijo}_tipo_mime" IS NOT NULL
             AND "${prefijo}_tamanio" IS NOT NULL AND "${prefijo}_hash" IS NOT NULL))`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [tabla, prefijo] of [
      ['acreditacion', 'evidencia'],
      ['plan_sucesion', 'documento'],
    ]) {
      await queryRunner.query(
        `ALTER TABLE "${tabla}" DROP CONSTRAINT "CK_${tabla}_${prefijo}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${tabla}"
           DROP COLUMN "${prefijo}_hash",
           DROP COLUMN "${prefijo}_tamanio",
           DROP COLUMN "${prefijo}_tipo_mime",
           DROP COLUMN "${prefijo}_nombre",
           DROP COLUMN "${prefijo}_clave"`,
      );
    }
  }
}
