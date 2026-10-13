import { MigrationInterface, QueryRunner } from 'typeorm';

type Valor = [codigo: string, denominacion: string];

/** Escala ordinal: el orden es la posición (1, 2, 3…) en la lista. */
const NIVELES_JERARQUICOS: Valor[] = [
  ['conduccion_departamento', 'Conducción de departamento'],
  ['conduccion_catedra', 'Conducción de cátedra'],
  ['coordinacion_docente', 'Coordinación docente'],
  ['operativo_docente', 'Operativo docente'],
];

const SIMPLES: Record<string, Valor[]> = {
  tipo_unidad: [
    ['departamento', 'Departamento'],
    ['catedra', 'Cátedra'],
  ],
  tipo_relacion_contractual: [
    ['planta_permanente', 'Planta permanente'],
    ['contratado', 'Contratado'],
    ['ad_honorem', 'Ad honorem'],
  ],
};

export class CrearReferenciaEstructura1791931921390 implements MigrationInterface {
  name = 'CrearReferenciaEstructura1791931921390';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "nivel_jerarquico" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "orden" integer NOT NULL, "id_nivel_jerarquico" SERIAL NOT NULL, CONSTRAINT "UQ_cd817fb16280328bac1488d9534" UNIQUE ("codigo"), CONSTRAINT "UQ_9e1495345e0727a98806ff0ee50" UNIQUE ("denominacion"), CONSTRAINT "UQ_f4cb6076d15ad23fa0a4083b6df" UNIQUE ("orden"), CONSTRAINT "PK_b80cea8cc91cc913b95246b1b6a" PRIMARY KEY ("id_nivel_jerarquico"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tipo_relacion_contractual" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "id_tipo_relacion_contractual" SERIAL NOT NULL, CONSTRAINT "UQ_a849972aa8bf4e3ff3ef4a2d4db" UNIQUE ("codigo"), CONSTRAINT "UQ_ed11cc126daa29096d22c23fc84" UNIQUE ("denominacion"), CONSTRAINT "PK_17ba5aa0d6baead1427f6c4084a" PRIMARY KEY ("id_tipo_relacion_contractual"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tipo_unidad" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "id_tipo_unidad" SERIAL NOT NULL, CONSTRAINT "UQ_24534c72f1dd8a7db10f2b66d53" UNIQUE ("codigo"), CONSTRAINT "UQ_90ddb120745710249f04eb62159" UNIQUE ("denominacion"), CONSTRAINT "PK_ec81e2fcb0f5bca9351aa2820a0" PRIMARY KEY ("id_tipo_unidad"))`,
    );
    for (const [
      posicion,
      [codigo, denominacion],
    ] of NIVELES_JERARQUICOS.entries()) {
      await queryRunner.query(
        `INSERT INTO "nivel_jerarquico" ("codigo", "denominacion", "orden") VALUES ($1, $2, $3)`,
        [codigo, denominacion, posicion + 1],
      );
    }
    for (const [tabla, valores] of Object.entries(SIMPLES)) {
      for (const [codigo, denominacion] of valores) {
        await queryRunner.query(
          `INSERT INTO "${tabla}" ("codigo", "denominacion") VALUES ($1, $2)`,
          [codigo, denominacion],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tipo_unidad"`);
    await queryRunner.query(`DROP TABLE "tipo_relacion_contractual"`);
    await queryRunner.query(`DROP TABLE "nivel_jerarquico"`);
  }
}
