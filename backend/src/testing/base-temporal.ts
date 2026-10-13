import { randomBytes } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from '../infra/database/snake-naming.strategy.js';

for (const archivo of ['.env', '../.env']) {
  try {
    process.loadEnvFile(archivo);
  } catch {
    // El archivo no existe: se usan las variables ya definidas en el entorno.
  }
}

const raiz = join(import.meta.dirname, '..');

type Clase = new (...args: never[]) => unknown;

export interface OpcionesBase {
  /** Fragmentos de nombre de migraciones que no se aplican al crear la base. */
  sin?: string[];
}

export interface BaseTemporal {
  readonly dataSource: DataSource;
  /** Aplica las migraciones que quedaron fuera con `sin`. */
  aplicarTodas(): Promise<void>;
  destruir(): Promise<void>;
}

function archivos(
  carpeta: string,
  sufijo: string,
  recursivo: boolean,
): string[] {
  return (readdirSync(carpeta, { recursive: recursivo }) as string[])
    .filter((nombre) => nombre.endsWith(sufijo))
    .sort()
    .map((nombre) => join(carpeta, nombre));
}

async function clasesDe(rutas: string[]): Promise<Clase[]> {
  const clases: Clase[] = [];
  for (const ruta of rutas) {
    const modulo = await import(pathToFileURL(ruta).href);
    clases.push(
      ...Object.values(modulo).filter(
        (valor): valor is Clase => typeof valor === 'function',
      ),
    );
  }
  return clases;
}

function conexion(database: string) {
  return {
    type: 'postgres' as const,
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
  };
}

/**
 * Crea una base PostgreSQL con nombre aleatorio y le aplica las migraciones,
 * para probar restricciones, triggers y consultas SQL reales.
 */
export async function crearBaseTemporal(
  opciones: OpcionesBase = {},
): Promise<BaseTemporal> {
  const nombre = `test_${randomBytes(6).toString('hex')}`;
  const admin = new DataSource(conexion(process.env.DB_NAME ?? 'postgres'));
  await admin.initialize();
  await admin.query(`CREATE DATABASE "${nombre}"`);
  await admin.destroy();

  const entidades = [
    ...(await clasesDe(archivos(join(raiz, 'modules'), '.entity.ts', true))),
    ...(await clasesDe(archivos(join(raiz, 'infra'), '.entity.ts', true))),
  ];
  const migraciones = await clasesDe(
    archivos(join(raiz, 'infra', 'database', 'migrations'), '.ts', false),
  );

  const abrir = async (aplicar: Clase[]): Promise<DataSource> => {
    const ds = new DataSource({
      ...conexion(nombre),
      entities: entidades as never,
      migrations: aplicar as never,
      migrationsTableName: 'migraciones',
      namingStrategy: new SnakeNamingStrategy(),
      synchronize: false,
    });
    await ds.initialize();
    try {
      await ds.runMigrations();
    } catch (error) {
      await ds.destroy();
      throw error;
    }
    return ds;
  };

  const excluidas = opciones.sin ?? [];
  let actual = await abrir(
    migraciones.filter((m) => !excluidas.some((s) => m.name.includes(s))),
  );

  return {
    get dataSource() {
      return actual;
    },
    async aplicarTodas() {
      const nuevo = await abrir(migraciones);
      await actual.destroy();
      actual = nuevo;
    },
    async destruir() {
      await actual.destroy();
      const limpieza = new DataSource(
        conexion(process.env.DB_NAME ?? 'postgres'),
      );
      await limpieza.initialize();
      await limpieza.query(`DROP DATABASE "${nombre}" WITH (FORCE)`);
      await limpieza.destroy();
    },
  };
}
