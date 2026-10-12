import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearTablasUsuarios1791839514662 implements MigrationInterface {
  name = 'CrearTablasUsuarios1791839514662';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "rol" ("id_rol" SERIAL NOT NULL, "codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, CONSTRAINT "UQ_59960bb0e72a21e5c347566fb4a" UNIQUE ("codigo"), CONSTRAINT "PK_0b42a30072d57ccfad9949218da" PRIMARY KEY ("id_rol"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "usuario_unidad" ("id_usuario" integer NOT NULL, "id_unidad" integer NOT NULL, CONSTRAINT "PK_07e25995498192aba56652a0223" PRIMARY KEY ("id_usuario", "id_unidad"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "usuario" ("id_usuario" SERIAL NOT NULL, "nombre_usuario" character varying(50) NOT NULL, "clave_hash" character varying(255) NOT NULL, "id_persona" integer, "activo" boolean NOT NULL DEFAULT true, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_rol" integer NOT NULL, CONSTRAINT "UQ_478a50149cbb7366c7d2aab8ea3" UNIQUE ("nombre_usuario"), CONSTRAINT "UQ_1fbc7de91b8e96937ed27739e8f" UNIQUE ("id_persona"), CONSTRAINT "PK_dd52716c2652e0e23c15530c695" PRIMARY KEY ("id_usuario"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "auditoria" ("id_auditoria" SERIAL NOT NULL, "entidad" character varying(60) NOT NULL, "id_registro" character varying(100) NOT NULL, "operacion" character varying(20) NOT NULL, "id_usuario" integer NOT NULL, "fecha" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "valores_anteriores" jsonb, "valores_nuevos" jsonb, CONSTRAINT "PK_9c9ae9e15c3caf7d555c6b9f354" PRIMARY KEY ("id_auditoria"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario_unidad" ADD CONSTRAINT "FK_3117b54339998878cd30956b963" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario" ADD CONSTRAINT "FK_3628e9894c4b014d61a01cb21dd" FOREIGN KEY ("id_rol") REFERENCES "rol"("id_rol") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "auditoria" ADD CONSTRAINT "FK_5c6a206a4b0a531bb13667e5683" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    for (const [codigo, denominacion] of [
      ['analista_puestos', 'Analista de puestos'],
      ['recursos_humanos', 'Recursos Humanos'],
      ['autoridad', 'Autoridades de la facultad'],
      ['jefatura_departamento', 'Jefatura de Departamento'],
      ['jefe_catedra', 'Jefe de cátedra'],
      ['administrador', 'Administrador del sistema'],
      ['docente', 'Docente'],
    ]) {
      await queryRunner.query(
        `INSERT INTO "rol" ("codigo", "denominacion") VALUES ($1, $2) ON CONFLICT ("codigo") DO NOTHING`,
        [codigo, denominacion],
      );
    }
    // Tabla del store de sesiones (connect-pg-simple); no tiene entidad.
    await queryRunner.query(
      `CREATE TABLE "sesion" ("sid" character varying NOT NULL, "sess" json NOT NULL, "expire" timestamp(6) NOT NULL, CONSTRAINT "PK_sesion_sid" PRIMARY KEY ("sid"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sesion_expire" ON "sesion" ("expire")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_sesion_expire"`);
    await queryRunner.query(`DROP TABLE "sesion"`);
    await queryRunner.query(
      `ALTER TABLE "auditoria" DROP CONSTRAINT "FK_5c6a206a4b0a531bb13667e5683"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario" DROP CONSTRAINT "FK_3628e9894c4b014d61a01cb21dd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario_unidad" DROP CONSTRAINT "FK_3117b54339998878cd30956b963"`,
    );
    await queryRunner.query(`DROP TABLE "auditoria"`);
    await queryRunner.query(`DROP TABLE "usuario"`);
    await queryRunner.query(`DROP TABLE "usuario_unidad"`);
    await queryRunner.query(`DROP TABLE "rol"`);
  }
}
