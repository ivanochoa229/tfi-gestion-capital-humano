import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgregarFkUsuarioUnidad1791933028996 implements MigrationInterface {
  name = 'AgregarFkUsuarioUnidad1791933028996';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const huerfanas: { id_unidad: number }[] = await queryRunner.query(
      `SELECT DISTINCT uu.id_unidad
       FROM usuario_unidad uu
       LEFT JOIN unidad_organizativa u ON u.id_unidad = uu.id_unidad
       WHERE u.id_unidad IS NULL
       ORDER BY uu.id_unidad`,
    );
    if (huerfanas.length > 0) {
      throw new Error(
        `usuario_unidad referencia unidades que no existen: ${huerfanas
          .map((h) => h.id_unidad)
          .join(', ')}. Corregilas o borralas antes de migrar`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "usuario_unidad" ADD CONSTRAINT "FK_0054e7f943b091b0a716cd85888" FOREIGN KEY ("id_unidad") REFERENCES "unidad_organizativa"("id_unidad") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuario_unidad" DROP CONSTRAINT "FK_0054e7f943b091b0a716cd85888"`,
    );
  }
}
