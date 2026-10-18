import { MigrationInterface, QueryRunner } from 'typeorm';

type Escala = [
  codigo: string,
  denominacion: string,
  orden: number,
  criterio: string,
];

const IMPACTOS: Escala[] = [
  [
    'bajo',
    'Bajo',
    1,
    'La cátedra o el departamento sigue funcionando con ajustes menores',
  ],
  ['medio', 'Medio', 2, 'Una función se degrada o se demora'],
  [
    'alto',
    'Alto',
    3,
    'Una función crítica no puede cumplirse (por ejemplo, no se puede dictar o evaluar)',
  ],
];

const DIFICULTADES: Escala[] = [
  [
    'facil',
    'Fácil',
    1,
    'Otra persona del departamento lo cubre en menos de un mes',
  ],
  ['moderada', 'Moderada', 2, 'Se forma o se contrata en uno a seis meses'],
  [
    'dificil',
    'Difícil',
    3,
    'Más de seis meses, o nadie en el departamento lo tiene',
  ],
];

/** [impacto, dificultad, nivel de criticidad] */
const MATRIZ: [string, string, string][] = [
  ['alto', 'facil', 'media'],
  ['alto', 'moderada', 'alta'],
  ['alto', 'dificil', 'alta'],
  ['medio', 'facil', 'baja'],
  ['medio', 'moderada', 'media'],
  ['medio', 'dificil', 'alta'],
  ['bajo', 'facil', 'baja'],
  ['bajo', 'moderada', 'baja'],
  ['bajo', 'dificil', 'media'],
];

export class CargarEscalasYMatrizCriticidad1792194138635 implements MigrationInterface {
  name = 'CargarEscalasYMatrizCriticidad1792194138635';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [tabla, escala] of [
      ['nivel_impacto', IMPACTOS],
      ['nivel_dificultad', DIFICULTADES],
    ] as const) {
      for (const [codigo, denominacion, orden, criterio] of escala) {
        await queryRunner.query(
          `INSERT INTO "${tabla}" ("codigo", "denominacion", "orden", "criterio") VALUES ($1, $2, $3, $4)`,
          [codigo, denominacion, orden, criterio],
        );
      }
    }
    for (const [impacto, dificultad, nivel] of MATRIZ) {
      await queryRunner.query(
        `INSERT INTO "matriz_criticidad" ("id_nivel_impacto", "id_nivel_dificultad", "id_nivel_criticidad")
         SELECT i."id_nivel_impacto", d."id_nivel_dificultad", n."id_nivel_criticidad"
         FROM "nivel_impacto" i, "nivel_dificultad" d, "nivel_criticidad" n
         WHERE i."codigo" = $1 AND d."codigo" = $2 AND n."codigo" = $3`,
        [impacto, dificultad, nivel],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "matriz_criticidad"`);
    await queryRunner.query(`DELETE FROM "nivel_dificultad"`);
    await queryRunner.query(`DELETE FROM "nivel_impacto"`);
  }
}
