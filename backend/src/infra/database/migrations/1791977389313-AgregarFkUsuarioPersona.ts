import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgregarFkUsuarioPersona1791977389313 implements MigrationInterface {
  name = 'AgregarFkUsuarioPersona1791977389313';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const huerfanas: { id_persona: number }[] = await queryRunner.query(
      `SELECT DISTINCT u.id_persona
       FROM usuario u
       LEFT JOIN persona p ON p.id_persona = u.id_persona
       WHERE u.id_persona IS NOT NULL AND p.id_persona IS NULL
       ORDER BY u.id_persona`,
    );
    if (huerfanas.length > 0) {
      throw new Error(
        `usuario referencia personas que no existen: ${huerfanas
          .map((h) => h.id_persona)
          .join(
            ', ',
          )}. Poné esos id_persona en NULL o cargá las personas antes de migrar`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "usuario" ADD CONSTRAINT "FK_1fbc7de91b8e96937ed27739e8f" FOREIGN KEY ("id_persona") REFERENCES "persona"("id_persona") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuario" DROP CONSTRAINT "FK_1fbc7de91b8e96937ed27739e8f"`,
    );
  }
}
