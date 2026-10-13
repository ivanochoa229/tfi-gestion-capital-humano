import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearUnidadesYPuestos1791932256336 implements MigrationInterface {
  name = 'CrearUnidadesYPuestos1791932256336';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "unidad_organizativa" ("id_unidad" SERIAL NOT NULL, "denominacion" character varying(150) NOT NULL, "id_tipo_unidad" integer NOT NULL, "id_unidad_superior" integer, "activo" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_f5e387175fbbd795fd875125e8e" PRIMARY KEY ("id_unidad"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "puesto" ("id_puesto" SERIAL NOT NULL, "codigo" character varying(10) NOT NULL, "denominacion" character varying(150) NOT NULL, "proposito" text, "condiciones_trabajo" text, "rango_retributivo" character varying(100), "dotacion_prevista" integer NOT NULL DEFAULT '1', "id_unidad" integer NOT NULL, "id_nivel_jerarquico" integer NOT NULL, "id_tipo_relacion_contractual" integer, "id_puesto_superior" integer, "activo" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_8116f77db15286e9452b8141c2e" UNIQUE ("codigo"), CONSTRAINT "CK_puesto_superior_distinto" CHECK ("id_puesto_superior" <> "id_puesto"), CONSTRAINT "CK_puesto_dotacion_prevista" CHECK ("dotacion_prevista" >= 1), CONSTRAINT "PK_27df1922b3a2da628245d99fa25" PRIMARY KEY ("id_puesto"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_puesto_superior" ON "puesto"  ("id_puesto_superior") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_puesto_unidad" ON "puesto"  ("id_unidad") `,
    );
    await queryRunner.query(
      `ALTER TABLE "unidad_organizativa" ADD CONSTRAINT "FK_d3a36891418484b5d3f43f2890c" FOREIGN KEY ("id_tipo_unidad") REFERENCES "tipo_unidad"("id_tipo_unidad") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "unidad_organizativa" ADD CONSTRAINT "FK_aa8d33ddc5b4e0f4afa6bd29fe1" FOREIGN KEY ("id_unidad_superior") REFERENCES "unidad_organizativa"("id_unidad") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "puesto" ADD CONSTRAINT "FK_7875bad90203567f522d003692c" FOREIGN KEY ("id_unidad") REFERENCES "unidad_organizativa"("id_unidad") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "puesto" ADD CONSTRAINT "FK_a36c2884cf701edab673f4fb03f" FOREIGN KEY ("id_nivel_jerarquico") REFERENCES "nivel_jerarquico"("id_nivel_jerarquico") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "puesto" ADD CONSTRAINT "FK_d6d8a047ab7cb1fa765f173262a" FOREIGN KEY ("id_tipo_relacion_contractual") REFERENCES "tipo_relacion_contractual"("id_tipo_relacion_contractual") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "puesto" ADD CONSTRAINT "FK_17e9fc4a7aed08ea736cc90db14" FOREIGN KEY ("id_puesto_superior") REFERENCES "puesto"("id_puesto") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Lo que sigue no se puede declarar en las entidades: TypeORM no modela
    // índices con lower(), triggers ni secuencias. Si `migration:generate`
    // propone borrar los índices UQ_unidad_denominacion_* o
    // UQ_puesto_unidad_denominacion, quitar esas líneas.
    await queryRunner.query(
      `CREATE SEQUENCE "puesto_codigo_seq" MINVALUE 1 MAXVALUE 9999 START 1 NO CYCLE`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_unidad_denominacion_superior" ON "unidad_organizativa" ("id_unidad_superior", lower("denominacion")) WHERE "activo" AND "id_unidad_superior" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_unidad_denominacion_raiz" ON "unidad_organizativa" (lower("denominacion")) WHERE "activo" AND "id_unidad_superior" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_puesto_unidad_denominacion" ON "puesto" ("id_unidad", lower("denominacion")) WHERE "activo"`,
    );
    await queryRunner.query(`
            CREATE FUNCTION "validar_jerarquia_unidad"() RETURNS trigger AS $$
            DECLARE
              codigo_tipo text;
              codigo_superior text;
            BEGIN
              SELECT codigo INTO codigo_tipo FROM tipo_unidad WHERE id_tipo_unidad = NEW.id_tipo_unidad;
              IF codigo_tipo = 'departamento' THEN
                IF NEW.id_unidad_superior IS NOT NULL THEN
                  RAISE EXCEPTION 'El departamento "%" no puede tener unidad superior', NEW.denominacion;
                END IF;
              ELSIF codigo_tipo = 'catedra' THEN
                IF NEW.id_unidad_superior IS NULL THEN
                  RAISE EXCEPTION 'La cátedra "%" debe tener un departamento como unidad superior', NEW.denominacion;
                END IF;
                SELECT t.codigo INTO codigo_superior
                FROM unidad_organizativa u JOIN tipo_unidad t ON t.id_tipo_unidad = u.id_tipo_unidad
                WHERE u.id_unidad = NEW.id_unidad_superior;
                IF codigo_superior IS DISTINCT FROM 'departamento' THEN
                  RAISE EXCEPTION 'La unidad superior de la cátedra "%" debe ser un departamento', NEW.denominacion;
                END IF;
              ELSE
                RAISE EXCEPTION 'Tipo de unidad desconocido para la unidad "%": solo se admiten departamento y cátedra', NEW.denominacion;
              END IF;
              RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);
    await queryRunner.query(
      `CREATE TRIGGER "trg_validar_jerarquia_unidad" BEFORE INSERT OR UPDATE OF "id_tipo_unidad", "id_unidad_superior" ON "unidad_organizativa" FOR EACH ROW EXECUTE FUNCTION "validar_jerarquia_unidad"()`,
    );
    await queryRunner.query(
      `INSERT INTO "unidad_organizativa" ("denominacion", "id_tipo_unidad") SELECT 'Departamento de Sistemas', "id_tipo_unidad" FROM "tipo_unidad" WHERE "codigo" = 'departamento'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "trg_validar_jerarquia_unidad" ON "unidad_organizativa"`,
    );
    await queryRunner.query(`DROP FUNCTION "validar_jerarquia_unidad"()`);
    await queryRunner.query(`DROP SEQUENCE "puesto_codigo_seq"`);
    await queryRunner.query(
      `ALTER TABLE "puesto" DROP CONSTRAINT "FK_17e9fc4a7aed08ea736cc90db14"`,
    );
    await queryRunner.query(
      `ALTER TABLE "puesto" DROP CONSTRAINT "FK_d6d8a047ab7cb1fa765f173262a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "puesto" DROP CONSTRAINT "FK_a36c2884cf701edab673f4fb03f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "puesto" DROP CONSTRAINT "FK_7875bad90203567f522d003692c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "unidad_organizativa" DROP CONSTRAINT "FK_aa8d33ddc5b4e0f4afa6bd29fe1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "unidad_organizativa" DROP CONSTRAINT "FK_d3a36891418484b5d3f43f2890c"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_puesto_unidad"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_puesto_superior"`);
    await queryRunner.query(`DROP TABLE "puesto"`);
    await queryRunner.query(`DROP TABLE "unidad_organizativa"`);
  }
}
