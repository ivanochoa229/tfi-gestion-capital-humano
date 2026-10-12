import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from './snake-naming.strategy.js';

const aqui = dirname(fileURLToPath(import.meta.url));

export interface ConfigBase {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  migrationsRun: boolean;
}

/**
 * Opciones de conexión compartidas por la aplicación y por la CLI de TypeORM,
 * para que ambas usen exactamente la misma configuración.
 *
 * `synchronize` queda siempre en false: el esquema cambia solo por migraciones.
 */
export function opcionesBase(config: ConfigBase): DataSourceOptions {
  return {
    type: 'postgres',
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    synchronize: false,
    migrationsRun: config.migrationsRun,
    migrationsTableName: 'migraciones',
    migrations: [join(aqui, 'migrations', '*.js')],
    namingStrategy: new SnakeNamingStrategy(),
  };
}
