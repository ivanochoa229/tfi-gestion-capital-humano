/**
 * DataSource que usa la CLI de TypeORM (generar, ejecutar y revertir
 * migraciones). Se ejecuta sobre el código compilado en dist/, por eso los
 * scripts de package.json compilan antes de llamarla.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import { opcionesBase } from './database.config.js';

const aqui = dirname(fileURLToPath(import.meta.url));

for (const archivo of ['.env', '../.env']) {
  try {
    process.loadEnvFile(archivo);
  } catch {
    // El archivo no existe: se usan las variables ya definidas en el entorno.
  }
}

export default new DataSource({
  ...opcionesBase({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? '',
    username: process.env.DB_USER ?? '',
    password: process.env.DB_PASSWORD ?? '',
    migrationsRun: false,
  }),
  entities: [
    join(aqui, '..', '..', 'modules', '**', 'entities', '*.entity.js'),
  ],
});
