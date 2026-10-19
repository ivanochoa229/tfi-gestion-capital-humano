import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Limpia los usuarios y personas de prueba que dejaron corridas manuales
 * contra la base de desarrollo (nombre/legajo con marca de tiempo) y deja un
 * solo jefe de cátedra vigente (el del usuario `mp_jefe`) en cada puesto
 * "Jefe de cátedra" que tenía varios. Las ocupaciones de más se cierran en
 * lugar de borrarse, para conservar el historial.
 */
export class LimpiarDatosDePrueba1792400000000 implements MigrationInterface {
  name = 'LimpiarDatosDePrueba1792400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "usuario" WHERE "nombre_usuario" ~ '^(analista|rrhh|aut|doc)_[0-9]{13}$'`,
    );

    // Personas de prueba que ya no tienen usuario vinculado.
    await queryRunner.query(`
      CREATE TEMP TABLE "persona_de_prueba" ON COMMIT DROP AS
      SELECT p."id_persona" FROM "persona" p
      WHERE p."legajo" ~ '^LEG-[AB]-[0-9]{13}$'
        AND NOT EXISTS (SELECT 1 FROM "usuario" u WHERE u."id_persona" = p."id_persona")
    `);
    await queryRunner.query(
      `DELETE FROM "ocupacion" WHERE "id_persona" IN (SELECT "id_persona" FROM "persona_de_prueba")`,
    );
    await queryRunner.query(
      `DELETE FROM "persona" WHERE "id_persona" IN (SELECT "id_persona" FROM "persona_de_prueba")`,
    );

    // Un solo jefe de cátedra vigente por puesto: el vinculado a `mp_jefe`.
    await queryRunner.query(`
      UPDATE "ocupacion" o
      SET "fecha_hasta" = GREATEST(o."fecha_desde", CURRENT_DATE - 1)
      FROM "puesto" pu
      WHERE o."id_puesto" = pu."id_puesto"
        AND pu."id_nivel_jerarquico" = (
          SELECT "id_nivel_jerarquico" FROM "nivel_jerarquico" WHERE "codigo" = 'conduccion_catedra')
        AND pu."denominacion" = 'Jefe de cátedra'
        AND o."fecha_hasta" IS NULL
        AND o."id_persona" IS DISTINCT FROM (
          SELECT "id_persona" FROM "usuario" WHERE "nombre_usuario" = 'mp_jefe')
    `);
  }

  public async down(): Promise<void> {
    throw new Error(
      'Migración de limpieza de datos: no se puede revertir (borra filas).',
    );
  }
}
