import { MigrationInterface, QueryRunner } from 'typeorm';

type Valor = [codigo: string, denominacion: string];

const SITUACIONES_REVISTA: Valor[] = [
  ['planta_permanente', 'Planta permanente'],
  ['contratado', 'Contratado'],
  ['ad_honorem', 'Ad honorem'],
  ['licencia', 'Licencia'],
];

/** Escala ordinal: el orden es la posición (1, 2, 3) en la lista. */
const DEDICACIONES: Valor[] = [
  ['simple', 'Simple'],
  ['semiexclusiva', 'Semiexclusiva'],
  ['exclusiva', 'Exclusiva'],
];

export class CrearReferenciaPersonas1791976741190 implements MigrationInterface {
  name = 'CrearReferenciaPersonas1791976741190';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "dedicacion" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "orden" integer NOT NULL, "id_dedicacion" SERIAL NOT NULL, CONSTRAINT "UQ_825a149d50e9deb6b1ab93fd34b" UNIQUE ("codigo"), CONSTRAINT "UQ_76aba23ba231604786989fc1d5c" UNIQUE ("denominacion"), CONSTRAINT "UQ_4914ae78851e669a453d2360b09" UNIQUE ("orden"), CONSTRAINT "PK_eb74992674619d2869c5968b3a7" PRIMARY KEY ("id_dedicacion"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "situacion_revista" ("codigo" character varying(40) NOT NULL, "denominacion" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "id_situacion_revista" SERIAL NOT NULL, CONSTRAINT "UQ_98c4d906074ae251e283ab56a3c" UNIQUE ("codigo"), CONSTRAINT "UQ_c6e4b542ea73fbf09b605868e28" UNIQUE ("denominacion"), CONSTRAINT "PK_8d52bd352e565d5ffd4b5f45faf" PRIMARY KEY ("id_situacion_revista"))`,
    );

    for (const [codigo, denominacion] of SITUACIONES_REVISTA) {
      await queryRunner.query(
        `INSERT INTO "situacion_revista" ("codigo", "denominacion") VALUES ($1, $2)`,
        [codigo, denominacion],
      );
    }
    for (const [posicion, [codigo, denominacion]] of DEDICACIONES.entries()) {
      await queryRunner.query(
        `INSERT INTO "dedicacion" ("codigo", "denominacion", "orden") VALUES ($1, $2, $3)`,
        [codigo, denominacion, posicion + 1],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "situacion_revista"`);
    await queryRunner.query(`DROP TABLE "dedicacion"`);
  }
}
