import type { MigrationInterface, QueryRunner } from 'typeorm';

type Valor = [codigo: string, denominacion: string];

/** Dominios ordinales: el orden es la posición (1, 2, 3…) en la lista. */
const ORDINALES: Record<string, Valor[]> = {
  nivel_dominio: [
    ['basico', 'Básico'],
    ['intermedio', 'Intermedio'],
    ['avanzado', 'Avanzado'],
    ['experto', 'Experto'],
  ],
  nivel_criticidad: [
    ['baja', 'Baja'],
    ['media', 'Media'],
    ['alta', 'Alta'],
  ],
  estado_preparacion: [
    ['en_desarrollo', 'En desarrollo'],
    ['mediano_plazo', 'Listo a mediano plazo'],
    ['listo_ahora', 'Listo ahora'],
  ],
};

const SIMPLES: Record<string, Valor[]> = {
  tipo_conocimiento: [
    ['formacion', 'Formación formal'],
    ['competencia_generica', 'Competencia genérica'],
    ['competencia_tecnica', 'Competencia técnica'],
    ['experiencia', 'Experiencia'],
  ],
  tipo_responsabilidad: [
    ['supervision', 'Por supervisión'],
    ['informacion', 'Por información'],
    ['bienes', 'Por bienes y equipos'],
    ['resultados', 'Por resultados'],
  ],
  tipo_riesgo: [
    ['fisico', 'Físico'],
    ['ergonomico', 'Ergonómico'],
    ['psicosocial', 'Psicosocial'],
    ['informatico', 'Informático'],
  ],
  caracter_ocupacion: [
    ['titular', 'Titular'],
    ['interino', 'Interino'],
    ['suplente', 'Suplente'],
  ],
  tipo_accion_transferencia: [
    ['documentacion', 'Documentación'],
    ['capacitacion', 'Capacitación'],
    ['mentoria', 'Mentoría'],
    ['rotacion', 'Rotación'],
  ],
  estado_accion_transferencia: [
    ['pendiente', 'Pendiente'],
    ['en_curso', 'En curso'],
    ['completada', 'Completada'],
    ['cancelada', 'Cancelada'],
  ],
  estado_plan: [
    ['borrador', 'Borrador'],
    ['pendiente_aprobacion', 'Pendiente de aprobación'],
    ['aprobado', 'Aprobado'],
    ['rechazado', 'Rechazado'],
  ],
};

/** Valores iniciales de los diez dominios cerrados (RF23). */
export class CargarValoresReferencia1791835700000 implements MigrationInterface {
  name = 'CargarValoresReferencia1791835700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [tabla, valores] of Object.entries(ORDINALES)) {
      for (const [posicion, [codigo, denominacion]] of valores.entries()) {
        await queryRunner.query(
          `INSERT INTO "${tabla}" ("codigo", "denominacion", "orden") VALUES ($1, $2, $3) ON CONFLICT ("codigo") DO NOTHING`,
          [codigo, denominacion, posicion + 1],
        );
      }
    }
    for (const [tabla, valores] of Object.entries(SIMPLES)) {
      for (const [codigo, denominacion] of valores) {
        await queryRunner.query(
          `INSERT INTO "${tabla}" ("codigo", "denominacion") VALUES ($1, $2) ON CONFLICT ("codigo") DO NOTHING`,
          [codigo, denominacion],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [tabla, valores] of Object.entries({
      ...ORDINALES,
      ...SIMPLES,
    })) {
      await queryRunner.query(
        `DELETE FROM "${tabla}" WHERE "codigo" = ANY($1)`,
        [valores.map(([codigo]) => codigo)],
      );
    }
  }
}
