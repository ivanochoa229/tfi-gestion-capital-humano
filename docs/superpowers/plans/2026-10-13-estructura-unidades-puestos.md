Estado: En curso | Fecha: 2026-10-13 | PR: pendiente

# Estructura: unidades organizativas y puestos: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** que el analista de puestos gestione el inventario de puestos (RF02) sobre una estructura de unidades que la aplicación solo consulta (RF01), y que el administrador asigne cátedras a los jefes de cátedra.

**Arquitectura:** módulo `modules/estructura` con `UnidadesService` (lectura), `PuestosService` (alta, edición, baja, reactivación), `PuestosTipoService` (los cuatro cargos de una cátedra) y `JerarquiaService` (consultas recursivas). Las reglas de la jerarquía de unidades viven en la base (CHECK, trigger e índices parciales) porque el DBA carga las unidades por SQL. Tres dominios nuevos se suman a `referencia`. `UsuariosService` valida las unidades asignadas contra `estructura`. El frontend reemplaza la página en construcción por un árbol de solo lectura y la gestión de puestos.

**Stack:** NestJS 12, TypeORM 1.x sobre PostgreSQL 16, vitest; React 19, MUI, TanStack Query, react-hook-form, zod. No se agregan dependencias.

**Spec:** `docs/superpowers/specs/2026-10-13-estructura-unidades-puestos-design.md`

## Restricciones globales

- Nombres de dominio y de código en español; snake_case en la base y camelCase en el código (`snake-naming.strategy.ts`).
- `synchronize` desactivado: el esquema cambia solo por migraciones; las generadas se revisan antes de aplicarse.
- Imports ESM con extensión `.js` en el backend (`'./app.module.js'`).
- DTOs con class-validator y `@ApiProperty`. Tras cambiar endpoints o DTOs: `npm run api:tipos` en `frontend/` (backend corriendo). `esquema.d.ts` no se edita a mano.
- Las unidades las carga el DBA por SQL: la aplicación no crea, edita ni da de baja unidades. Una migración carga solo el Departamento de Sistemas.
- Dos niveles de unidades: el departamento no tiene superior; la cátedra tiene como superior un departamento. Se identifican por `tipo_unidad.codigo` (`departamento`, `catedra`).
- Código de puesto con formato `P-0001`, generado con `nextval('puesto_codigo_seq')` (`MAXVALUE 9999`), único e inmutable. La unidad de un puesto no cambia después del alta.
- Superior de un puesto: opcional, activo, en la misma unidad o en una ancestra, sin ciclos. Baja lógica (`activo`); no hay `DELETE`.
- Todas las escrituras de puestos corren en una transacción con `pg_advisory_xact_lock(7002)` (Usuarios usa 7001).
- Lecturas de unidades y puestos: cualquier rol autenticado (`TODOS_LOS_ROLES`). Escrituras de puestos: solo `analista_puestos`.
- Los comandos de `backend/` se corren en el contenedor: `docker compose exec -T backend ...`. El contenedor `backend` y la base `db` deben estar arriba (`docker compose up -d --build`).
- Antes de cada commit: `npm run lint`, `npm run format` y `npm test` en `backend/`; `npm run lint`, `npm run format` y `npm run build` en `frontend/` cuando se toca el frontend.
- Los commits no llevan línea `Co-Authored-By` ni otra atribución a Claude.
- Rama de trabajo: `feat/estructura`.

## Foco de revisión

Entradas o fallas que la spec implica y que ninguna tarea cubriría por sí sola; cada línea tiene su test en la tarea indicada.

1. Un ciclo indirecto (A → B → C y se intenta poner A como superior de C) y dos ediciones simultáneas: el primero se rechaza con 400 y las escrituras toman el bloqueo consultivo (Tarea 5; la consulta recursiva real, incluso ante un ciclo escrito directo en la base, se prueba en la Tarea 4).
2. Una denominación que difiere solo en mayúsculas o espacios (`"  jefe de CÁTEDRA "`) cuenta como repetida dentro de la unidad (Tarea 5).
3. Un texto de búsqueda con `%` o `_` no coincide con todo: se escapa antes del `ILIKE` (Tarea 5).
4. `PATCH /puestos/:id` con `codigo` o `idUnidad`, o con `null` en un campo obligatorio, se rechaza con 400 sin modificar nada (Tarea 5).
5. Reactivar un puesto cuya unidad o cuyo superior están inactivos responde 409, y dar de baja uno con subordinados activos lista cuáles son (Tarea 6).

---

## Mapa de archivos

| Archivo | Responsabilidad |
| --- | --- |
| `backend/src/modules/referencia/entities/{tipo-unidad,nivel-jerarquico,tipo-relacion-contractual}.entity.ts` | Tres dominios nuevos de RF23 |
| `backend/src/modules/estructura/entities/{unidad-organizativa,puesto}.entity.ts` | Entidades de estructura |
| `backend/src/modules/estructura/estructura.constantes.ts` | Códigos de tipo de unidad y de nivel jerárquico, slugs de dominio |
| `backend/src/modules/estructura/transaccion.ts` | Transacción con bloqueo, traducción de duplicados y código de puesto |
| `backend/src/modules/estructura/jerarquia.service.ts` | Unidades ancestras y cadena de superiores (SQL recursivo) |
| `backend/src/modules/estructura/arbol-unidades.ts` | Arma el árbol a partir de la lista plana |
| `backend/src/modules/estructura/unidades.service.ts` | Lectura de unidades |
| `backend/src/modules/estructura/puestos.service.ts` | RF02: listar, obtener, crear, actualizar, baja y reactivación |
| `backend/src/modules/estructura/puestos-tipo.ts` y `puestos-tipo.service.ts` | Los cuatro cargos tipo de una cátedra |
| `backend/src/modules/estructura/{unidades,puestos}.controller.ts` | Endpoints HTTP |
| `backend/src/modules/estructura/dto/` | DTOs de unidades y puestos |
| `backend/src/modules/estructura/{unidad,puesto}.mapper.ts` | Entidad → DTO |
| `backend/src/testing/base-temporal.ts` | Base PostgreSQL temporal con las migraciones aplicadas, para tests de integración |
| `backend/vitest.integracion.config.ts` | Configuración de los tests `*.int.spec.ts` |
| `backend/scripts/catedras-ejemplo.sql` | Cátedras de ejemplo para el entorno local (no es migración) |
| `frontend/src/features/estructura/` | Árbol, lista y formulario de puestos |
| `frontend/src/features/admin/` | Selector de unidades en el formulario de usuarios |

---

### Tarea 1: Tres dominios de referencia

**Archivos:**
- Crear: `backend/src/modules/referencia/entities/tipo-unidad.entity.ts`, `nivel-jerarquico.entity.ts`, `tipo-relacion-contractual.entity.ts`
- Modificar: `backend/src/modules/referencia/dominios.ts`, `referencia.module.ts`, `dominios.spec.ts`, `referencia.service.spec.ts:67-70`, `frontend/src/features/admin/hooks/useValoresReferencia.ts:7`
- Crear (generada y editada): `backend/src/infra/database/migrations/<timestamp>-CrearReferenciaEstructura.ts`

**Interfaces:**
- Produce: dominios `tipo-unidad` (simple), `nivel-jerarquico` (ordinal) y `tipo-relacion-contractual` (simple) en `DOMINIOS`; tablas `tipo_unidad`, `nivel_jerarquico`, `tipo_relacion_contractual` con sus valores. Códigos cargados: `tipo_unidad` → `departamento`, `catedra`; `nivel_jerarquico` → `conduccion_departamento`(1), `conduccion_catedra`(2), `coordinacion_docente`(3), `operativo_docente`(4); `tipo_relacion_contractual` → `planta_permanente`, `contratado`, `ad_honorem`.

- [ ] **Paso 1: Actualizar los tests de dominios para que esperen 13**

En `backend/src/modules/referencia/dominios.spec.ts` reemplazar los tres primeros tests por:

```ts
describe('DOMINIOS', () => {
  it('define los trece dominios cerrados', () => {
    expect(DOMINIOS).toHaveLength(13);
  });

  it('no repite slugs ni tablas', () => {
    expect(new Set(DOMINIOS.map((d) => d.slug)).size).toBe(13);
    expect(new Set(DOMINIOS.map((d) => d.tabla)).size).toBe(13);
  });

  it('tiene exactamente cuatro dominios ordinales', () => {
    expect(
      DOMINIOS.filter((d) => d.ordinal)
        .map((d) => d.slug)
        .sort(),
    ).toEqual([
      'estado-preparacion',
      'nivel-criticidad',
      'nivel-dominio',
      'nivel-jerarquico',
    ]);
  });
```

(el cuarto test, "cada entidad extiende la base…", queda igual). En `referencia.service.spec.ts` cambiar el test `lista los diez dominios` por:

```ts
  it('lista los trece dominios', () => {
    const { servicio } = crearEntorno([]);
    expect(servicio.listarDominios()).toHaveLength(13);
  });
```

- [ ] **Paso 2: Verificar que fallan**

Run: `docker compose exec -T backend npx vitest run src/modules/referencia`
Expected: FAIL en `dominios.spec.ts` y `referencia.service.spec.ts` ("expected 10 to have length 13" o similar).

- [ ] **Paso 3: Crear las tres entidades**

`backend/src/modules/referencia/entities/tipo-unidad.entity.ts`:

```ts
import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('tipo_unidad')
export class TipoUnidad extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_tipo_unidad' })
  id: number;
}
```

`backend/src/modules/referencia/entities/nivel-jerarquico.entity.ts`:

```ts
import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferenciaOrdinal } from './valor-referencia.base.js';

@Entity('nivel_jerarquico')
export class NivelJerarquico extends ValorReferenciaOrdinal {
  @PrimaryGeneratedColumn({ name: 'id_nivel_jerarquico' })
  id: number;
}
```

`backend/src/modules/referencia/entities/tipo-relacion-contractual.entity.ts`:

```ts
import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('tipo_relacion_contractual')
export class TipoRelacionContractual extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_tipo_relacion_contractual' })
  id: number;
}
```

- [ ] **Paso 4: Registrar los dominios y las entidades**

En `backend/src/modules/referencia/dominios.ts` agregar los imports:

```ts
import { TipoUnidad } from './entities/tipo-unidad.entity.js';
import { NivelJerarquico } from './entities/nivel-jerarquico.entity.js';
import { TipoRelacionContractual } from './entities/tipo-relacion-contractual.entity.js';
```

cambiar el comentario de `DOMINIOS` a `/** Los trece dominios cerrados del modelo (RF23). */` y agregar al final del arreglo, antes de `];`:

```ts
  {
    slug: 'tipo-unidad',
    denominacion: 'Tipo de unidad',
    tabla: 'tipo_unidad',
    ordinal: false,
    entidad: TipoUnidad,
  },
  {
    slug: 'nivel-jerarquico',
    denominacion: 'Nivel jerárquico',
    tabla: 'nivel_jerarquico',
    ordinal: true,
    entidad: NivelJerarquico,
  },
  {
    slug: 'tipo-relacion-contractual',
    denominacion: 'Tipo de relación contractual',
    tabla: 'tipo_relacion_contractual',
    ordinal: false,
    entidad: TipoRelacionContractual,
  },
```

En `referencia.module.ts` agregar los tres imports de entidades y sumarlos al arreglo de `TypeOrmModule.forFeature([...])` (después de `EstadoPlan`). En `frontend/src/features/admin/hooks/useValoresReferencia.ts:7` cambiar el comentario a `/** Los dominios cerrados del modelo. */`.

- [ ] **Paso 5: Verificar que los tests pasan**

Run: `docker compose exec -T backend npx vitest run src/modules/referencia`
Expected: PASS.

- [ ] **Paso 6: Generar y completar la migración**

```bash
docker compose up -d --build
docker compose exec -T backend npm run migration:run
docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/CrearReferenciaEstructura
```

Abrir el archivo generado y verificar que solo crea `tipo_unidad`, `nivel_jerarquico` y `tipo_relacion_contractual` (con sus claves únicas) y que `down` las elimina; si propone otros cambios, detenerse y revisar las entidades. Después agregar al principio del archivo, debajo de los imports:

```ts
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
```

y al final del método `up` (después de los `CREATE TABLE` generados):

```ts
    for (const [posicion, [codigo, denominacion]] of NIVELES_JERARQUICOS.entries()) {
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
```

`down` no necesita cambios: elimina las tablas junto con sus valores.

- [ ] **Paso 7: Aplicar, revertir y reaplicar la migración**

```bash
docker compose exec -T backend npm run migration:run
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT codigo, orden FROM nivel_jerarquico ORDER BY orden" -c "SELECT codigo FROM tipo_unidad ORDER BY codigo"'
docker compose exec -T backend npm run migration:revert
docker compose exec -T backend npm run migration:run
```

Expected: la primera consulta lista los cuatro niveles con orden 1 a 4; la segunda, `catedra` y `departamento`; el `revert` y el segundo `run` terminan sin error.

- [ ] **Paso 8: Lint, formato, tests y commit**

```bash
docker compose exec -T backend npm run lint
docker compose exec -T backend npm run format
docker compose exec -T backend npm test
git add backend/src/modules/referencia backend/src/infra/database/migrations frontend/src/features/admin/hooks/useValoresReferencia.ts
git commit -m "Agregar los dominios tipo de unidad, nivel jerárquico y tipo de relación contractual"
```

---

### Tarea 2: Infraestructura de tests de integración

**Archivos:**
- Crear: `backend/src/testing/base-temporal.ts`, `backend/src/testing/base-temporal.int.spec.ts`, `backend/vitest.integracion.config.ts`
- Modificar: `backend/vitest.config.ts`, `backend/package.json` (script), `backend/tsconfig.build.json`

**Interfaces:**
- Produce: `crearBaseTemporal(opciones?: { sin?: string[] }): Promise<BaseTemporal>` con `BaseTemporal = { dataSource: DataSource; aplicarTodas(): Promise<void>; destruir(): Promise<void> }`. `sin` lista fragmentos de nombre de migraciones que no se aplican al crear la base; `aplicarTodas()` aplica las que falten. `dataSource` es un getter: tras `aplicarTodas()` apunta a la conexión nueva.
- Produce: `npm run test:integracion`; `npm test` deja de correr los `*.int.spec.ts`.

- [ ] **Paso 1: Escribir el test de la base temporal**

`backend/src/testing/base-temporal.int.spec.ts`:

```ts
import { crearBaseTemporal, type BaseTemporal } from './base-temporal.js';

describe('crearBaseTemporal', () => {
  let base: BaseTemporal;

  beforeAll(async () => {
    base = await crearBaseTemporal();
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('aplica las migraciones en una base propia', async () => {
    const filas: { codigo: string }[] = await base.dataSource.query(
      'SELECT codigo FROM tipo_unidad ORDER BY codigo',
    );
    expect(filas.map((f) => f.codigo)).toEqual(['catedra', 'departamento']);
  });

  it('carga los niveles jerárquicos como escala ordinal', async () => {
    const filas: { codigo: string; orden: number }[] =
      await base.dataSource.query(
        'SELECT codigo, orden FROM nivel_jerarquico ORDER BY orden',
      );
    expect(filas.map((f) => [f.codigo, f.orden])).toEqual([
      ['conduccion_departamento', 1],
      ['conduccion_catedra', 2],
      ['coordinacion_docente', 3],
      ['operativo_docente', 4],
    ]);
  });

  it('permite dejar migraciones fuera y aplicarlas después', async () => {
    const parcial = await crearBaseTemporal({ sin: ['CargarValoresReferencia'] });
    try {
      const antes = await parcial.dataSource.query(
        'SELECT count(*)::int AS n FROM nivel_dominio',
      );
      expect(antes[0].n).toBe(0);

      await parcial.aplicarTodas();

      const despues = await parcial.dataSource.query(
        'SELECT count(*)::int AS n FROM nivel_dominio',
      );
      expect(despues[0].n).toBe(4);
    } finally {
      await parcial.destruir();
    }
  });
});
```

- [ ] **Paso 2: Configuración de vitest y script**

`backend/vitest.integracion.config.ts`:

```ts
import { configDefaults, defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/** Tests contra PostgreSQL real (requiere `docker compose up -d db`). */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.int.spec.ts'],
    exclude: [...configDefaults.exclude, 'dist/**'],
    setupFiles: ['reflect-metadata'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
```

`backend/vitest.config.ts` queda:

```ts
import { configDefaults, defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // Los de integración corren aparte: `npm run test:integracion`.
    exclude: [...configDefaults.exclude, '**/*.int.spec.ts'],
    setupFiles: ['reflect-metadata'],
  },
});
```

En `backend/package.json`, scripts, agregar después de `"test:cov"`:

```json
    "test:integracion": "vitest run --config vitest.integracion.config.ts",
```

En `backend/tsconfig.build.json` cambiar `exclude` a `["node_modules", "test", "dist", "src/testing", "**/*spec.ts"]`.

- [ ] **Paso 3: Verificar que falla**

Run: `docker compose exec -T backend npm run test:integracion`
Expected: FAIL (`Failed to resolve import "./base-temporal.js"`).

- [ ] **Paso 4: Implementar la base temporal**

`backend/src/testing/base-temporal.ts`:

```ts
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

function archivos(carpeta: string, sufijo: string, recursivo: boolean): string[] {
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
      const limpieza = new DataSource(conexion(process.env.DB_NAME ?? 'postgres'));
      await limpieza.initialize();
      await limpieza.query(`DROP DATABASE "${nombre}" WITH (FORCE)`);
      await limpieza.destroy();
    },
  };
}
```

- [ ] **Paso 5: Verificar que pasa y que `npm test` no los toma**

```bash
docker compose exec -T backend npm run test:integracion
docker compose exec -T backend npm test
```

Expected: el primero, 3 tests PASS; el segundo, sin archivos `*.int.spec.ts` en la lista.

- [ ] **Paso 6: Lint, formato y commit**

```bash
docker compose exec -T backend npm run lint
docker compose exec -T backend npm run format
git add backend/src/testing backend/vitest.config.ts backend/vitest.integracion.config.ts backend/package.json backend/tsconfig.build.json
git commit -m "Agregar tests de integración contra una base PostgreSQL temporal"
```

---

### Tarea 3: Esquema de unidades y puestos

**Archivos:**
- Crear: `backend/src/modules/estructura/entities/unidad-organizativa.entity.ts`, `puesto.entity.ts`, `backend/scripts/catedras-ejemplo.sql`, `backend/src/infra/database/estructura.int.spec.ts`
- Crear (generada y editada): `backend/src/infra/database/migrations/<timestamp>-CrearUnidadesYPuestos.ts`
- Modificar: `backend/src/modules/estructura/estructura.module.ts`

**Interfaces:**
- Produce: tablas `unidad_organizativa` (`id_unidad`, `denominacion`, `id_tipo_unidad`, `id_unidad_superior`, `activo`) y `puesto` (`id_puesto`, `codigo`, `denominacion`, `proposito`, `condiciones_trabajo`, `rango_retributivo`, `dotacion_prevista`, `id_unidad`, `id_nivel_jerarquico`, `id_tipo_relacion_contractual`, `id_puesto_superior`, `activo`), secuencia `puesto_codigo_seq`, trigger `trg_validar_jerarquia_unidad` y el Departamento de Sistemas. Entidades `UnidadOrganizativa` y `Puesto` con propiedades `id`, `denominacion`, `idTipoUnidad`, `tipo`, `idUnidadSuperior`, `superior`, `activo` (unidad) y `id`, `codigo`, `denominacion`, `proposito`, `condicionesTrabajo`, `rangoRetributivo`, `dotacionPrevista`, `idUnidad`, `idNivelJerarquico`, `idTipoRelacionContractual`, `idPuestoSuperior`, `activo` (puesto).

- [ ] **Paso 1: Escribir el test de integración del esquema**

`backend/src/infra/database/estructura.int.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';

describe('esquema de estructura', () => {
  let base: BaseTemporal;
  const sql = <T = unknown>(consulta: string, parametros?: unknown[]) =>
    base.dataSource.query(consulta, parametros) as Promise<T>;

  const idTipo = async (codigo: string) =>
    (
      await sql<{ id: number }[]>(
        'SELECT id_tipo_unidad AS id FROM tipo_unidad WHERE codigo = $1',
        [codigo],
      )
    )[0].id;
  const idNivel = async (codigo: string) =>
    (
      await sql<{ id: number }[]>(
        'SELECT id_nivel_jerarquico AS id FROM nivel_jerarquico WHERE codigo = $1',
        [codigo],
      )
    )[0].id;
  const unidad = async (
    denominacion: string,
    tipo: string,
    idSuperior: number | null = null,
    activo = true,
  ) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior, activo)
         VALUES ($1, $2, $3, $4) RETURNING id_unidad AS id`,
        [denominacion, await idTipo(tipo), idSuperior, activo],
      )
    )[0].id;
  const puesto = async (
    codigo: string,
    denominacion: string,
    idUnidad: number,
    activo = true,
  ) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico, activo)
         VALUES ($1, $2, $3, $4, $5) RETURNING id_puesto AS id`,
        [codigo, denominacion, idUnidad, await idNivel('operativo_docente'), activo],
      )
    )[0].id;

  let departamento: number;

  beforeAll(async () => {
    base = await crearBaseTemporal();
    departamento = (
      await sql<{ id: number }[]>(
        `SELECT id_unidad AS id FROM unidad_organizativa WHERE denominacion = 'Departamento de Sistemas'`,
      )
    )[0].id;
  });
  afterAll(async () => {
    await base.destruir();
  });

  describe('jerarquía de unidades', () => {
    it('carga el Departamento de Sistemas sin superior', async () => {
      const filas = await sql<{ superior: number | null; tipo: string }[]>(
        `SELECT u.id_unidad_superior AS superior, t.codigo AS tipo
         FROM unidad_organizativa u JOIN tipo_unidad t USING (id_tipo_unidad)
         WHERE u.id_unidad = $1`,
        [departamento],
      );
      expect(filas).toEqual([{ superior: null, tipo: 'departamento' }]);
    });

    it('rechaza un departamento con unidad superior', async () => {
      await expect(unidad('Otro dpto', 'departamento', departamento)).rejects.toThrow(
        /no puede tener unidad superior/,
      );
    });

    it('rechaza una cátedra sin unidad superior', async () => {
      await expect(unidad('Cátedra suelta', 'catedra')).rejects.toThrow(
        /debe tener un departamento/,
      );
    });

    it('rechaza una cátedra bajo otra cátedra', async () => {
      const a = await unidad('Cátedra A', 'catedra', departamento);
      await expect(unidad('Cátedra bajo A', 'catedra', a)).rejects.toThrow(
        /debe ser un departamento/,
      );
    });

    it('rechaza cambiar el superior de una cátedra a otra cátedra', async () => {
      const b = await unidad('Cátedra B', 'catedra', departamento);
      const c = await unidad('Cátedra C', 'catedra', departamento);
      await expect(
        sql('UPDATE unidad_organizativa SET id_unidad_superior = $1 WHERE id_unidad = $2', [b, c]),
      ).rejects.toThrow(/debe ser un departamento/);
    });

    it('no admite dos unidades activas con la misma denominación bajo el mismo superior', async () => {
      await unidad('Cátedra D', 'catedra', departamento);
      await expect(unidad('CÁTEDRA d', 'catedra', departamento)).rejects.toThrow(
        /UQ_unidad_denominacion_superior/,
      );
    });

    it('admite repetir la denominación si la otra unidad está inactiva', async () => {
      await unidad('Cátedra E', 'catedra', departamento, false);
      await expect(unidad('Cátedra E', 'catedra', departamento)).resolves.toBeGreaterThan(0);
    });

    it('no admite dos departamentos activos con la misma denominación', async () => {
      await expect(unidad('departamento de sistemas', 'departamento')).rejects.toThrow(
        /UQ_unidad_denominacion_raiz/,
      );
    });
  });

  describe('puestos', () => {
    let catedra: number;
    beforeAll(async () => {
      catedra = await unidad('Cátedra de puestos', 'catedra', departamento);
    });

    it('rechaza una dotación prevista menor a 1', async () => {
      await expect(
        sql(
          `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico, dotacion_prevista)
           VALUES ('P-9001', 'Dotación cero', $1, $2, 0)`,
          [catedra, await idNivel('operativo_docente')],
        ),
      ).rejects.toThrow(/CK_puesto_dotacion_prevista/);
    });

    it('rechaza que un puesto sea su propio superior', async () => {
      const id = await puesto('P-9002', 'Puesto propio', catedra);
      await expect(
        sql('UPDATE puesto SET id_puesto_superior = $1 WHERE id_puesto = $1', [id]),
      ).rejects.toThrow(/CK_puesto_superior_distinto/);
    });

    it('rechaza un código repetido', async () => {
      await puesto('P-9003', 'Con código', catedra);
      await expect(puesto('P-9003', 'Otro con el mismo código', catedra)).rejects.toThrow(
        /duplicate key|unique/i,
      );
    });

    it('rechaza dos puestos activos con la misma denominación en la unidad, sin distinguir mayúsculas', async () => {
      await puesto('P-9004', 'Auxiliar', catedra);
      await expect(puesto('P-9005', 'AUXILIAR', catedra)).rejects.toThrow(
        /UQ_puesto_unidad_denominacion/,
      );
    });

    it('admite repetir la denominación si el otro puesto está dado de baja', async () => {
      await puesto('P-9006', 'Suplente', catedra, false);
      await expect(puesto('P-9007', 'Suplente', catedra)).resolves.toBeGreaterThan(0);
    });

    it('la secuencia de códigos empieza en 1 y falla al agotarse', async () => {
      const primero = await sql<{ n: string }[]>(`SELECT nextval('puesto_codigo_seq') AS n`);
      expect(primero[0].n).toBe('1');
      await sql(`ALTER SEQUENCE puesto_codigo_seq RESTART WITH 9999`);
      const ultimo = await sql<{ n: string }[]>(`SELECT nextval('puesto_codigo_seq') AS n`);
      expect(ultimo[0].n).toBe('9999');
      await expect(sql(`SELECT nextval('puesto_codigo_seq')`)).rejects.toThrow(/reached maximum value/);
    });
  });

  describe('script de cátedras de ejemplo', () => {
    it('carga tres cátedras bajo el departamento y se puede correr dos veces', async () => {
      const script = readFileSync(
        join(import.meta.dirname, '..', '..', '..', 'scripts', 'catedras-ejemplo.sql'),
        'utf8',
      );
      await sql(script);
      await sql(script);
      const filas = await sql<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM unidad_organizativa
         WHERE id_unidad_superior = $1 AND denominacion IN
           ('Algoritmos y Estructuras de Datos', 'Bases de Datos', 'Ingeniería de Software')`,
        [departamento],
      );
      expect(filas[0].n).toBe(3);
    });
  });
});
```

- [ ] **Paso 2: Verificar que falla**

Run: `docker compose exec -T backend npx vitest run --config vitest.integracion.config.ts src/infra/database/estructura.int.spec.ts`
Expected: FAIL (`relation "unidad_organizativa" does not exist`).

- [ ] **Paso 3: Crear las entidades**

`backend/src/modules/estructura/entities/unidad-organizativa.entity.ts`:

```ts
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { TipoUnidad } from '../../referencia/entities/tipo-unidad.entity.js';

/**
 * Departamento o cátedra (RF01). Las carga el DBA por SQL; la aplicación solo
 * las consulta. Las reglas de jerarquía las hace cumplir un trigger.
 */
@Entity('unidad_organizativa')
export class UnidadOrganizativa {
  @PrimaryGeneratedColumn({ name: 'id_unidad' })
  id: number;

  @Column({ type: 'varchar', length: 150 })
  denominacion: string;

  @Column({ name: 'id_tipo_unidad', type: 'int' })
  idTipoUnidad: number;

  @ManyToOne(() => TipoUnidad, { nullable: false })
  @JoinColumn({ name: 'id_tipo_unidad' })
  tipo: Relation<TipoUnidad>;

  @Column({ name: 'id_unidad_superior', type: 'int', nullable: true })
  idUnidadSuperior: number | null;

  @ManyToOne(() => UnidadOrganizativa, { nullable: true })
  @JoinColumn({ name: 'id_unidad_superior' })
  superior: Relation<UnidadOrganizativa> | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
```

`backend/src/modules/estructura/entities/puesto.entity.ts`:

```ts
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { NivelJerarquico } from '../../referencia/entities/nivel-jerarquico.entity.js';
import { TipoRelacionContractual } from '../../referencia/entities/tipo-relacion-contractual.entity.js';
import { UnidadOrganizativa } from './unidad-organizativa.entity.js';

/**
 * Puesto de una unidad (RF02). Es específico de su cátedra y no cambia de
 * unidad. El índice único de denominación por unidad (con lower()) se crea en
 * la migración y no está declarado acá.
 */
@Entity('puesto')
@Check('CK_puesto_dotacion_prevista', '"dotacion_prevista" >= 1')
@Check('CK_puesto_superior_distinto', '"id_puesto_superior" <> "id_puesto"')
@Index('IDX_puesto_unidad', ['idUnidad'])
@Index('IDX_puesto_superior', ['idPuestoSuperior'])
export class Puesto {
  @PrimaryGeneratedColumn({ name: 'id_puesto' })
  id: number;

  /** `P-0001`; lo genera la aplicación con `puesto_codigo_seq`. */
  @Column({ type: 'varchar', length: 10, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 150 })
  denominacion: string;

  @Column({ type: 'text', nullable: true })
  proposito: string | null;

  @Column({ type: 'text', nullable: true })
  condicionesTrabajo: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  rangoRetributivo: string | null;

  @Column({ type: 'int', default: 1 })
  dotacionPrevista: number;

  @Column({ name: 'id_unidad', type: 'int' })
  idUnidad: number;

  @ManyToOne(() => UnidadOrganizativa, { nullable: false })
  @JoinColumn({ name: 'id_unidad' })
  unidad: Relation<UnidadOrganizativa>;

  @Column({ name: 'id_nivel_jerarquico', type: 'int' })
  idNivelJerarquico: number;

  @ManyToOne(() => NivelJerarquico, { nullable: false })
  @JoinColumn({ name: 'id_nivel_jerarquico' })
  nivelJerarquico: Relation<NivelJerarquico>;

  @Column({ name: 'id_tipo_relacion_contractual', type: 'int', nullable: true })
  idTipoRelacionContractual: number | null;

  @ManyToOne(() => TipoRelacionContractual, { nullable: true })
  @JoinColumn({ name: 'id_tipo_relacion_contractual' })
  tipoRelacionContractual: Relation<TipoRelacionContractual> | null;

  @Column({ name: 'id_puesto_superior', type: 'int', nullable: true })
  idPuestoSuperior: number | null;

  @ManyToOne(() => Puesto, { nullable: true })
  @JoinColumn({ name: 'id_puesto_superior' })
  superior: Relation<Puesto> | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
```

En `backend/src/modules/estructura/estructura.module.ts` registrar las entidades (para que `autoLoadEntities` las cargue):

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Puesto } from './entities/puesto.entity.js';
import { UnidadOrganizativa } from './entities/unidad-organizativa.entity.js';

/**
 * Estructura y descripción de puestos (RF01–RF05): unidades organizativas,
 * puestos, funciones, tareas, responsabilidades, estándares de desempeño,
 * riesgos, relaciones de trabajo y relevamiento.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UnidadOrganizativa, Puesto])],
})
export class EstructuraModule {}
```

- [ ] **Paso 4: Generar la migración**

```bash
docker compose exec -T backend npm run migration:run
docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/CrearUnidadesYPuestos
```

Revisar el archivo generado: debe crear solo `unidad_organizativa` y `puesto` con sus claves foráneas, el `UNIQUE` de `codigo`, los dos `CHECK` y los dos índices; `down` debe eliminarlos. Si propone otras tablas, detenerse.

- [ ] **Paso 5: Completar la migración con el SQL manual**

Al final de `up` (después de las sentencias generadas) agregar:

```ts
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
```

Al principio de `down` (antes de las sentencias generadas) agregar:

```ts
    await queryRunner.query(
      `DROP TRIGGER "trg_validar_jerarquia_unidad" ON "unidad_organizativa"`,
    );
    await queryRunner.query(`DROP FUNCTION "validar_jerarquia_unidad"()`);
    await queryRunner.query(`DROP SEQUENCE "puesto_codigo_seq"`);
```

(los índices se eliminan con sus tablas).

- [ ] **Paso 6: Crear el script de cátedras de ejemplo**

`backend/scripts/catedras-ejemplo.sql`:

```sql
-- Cátedras de ejemplo para el entorno local. NO es una migración: en el uso real
-- las cátedras las carga el DBA. Se puede correr más de una vez.
-- Uso (desde la raíz del repositorio):
--   docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backend/scripts/catedras-ejemplo.sql
INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
SELECT c.denominacion, t.id_tipo_unidad, d.id_unidad
FROM (VALUES
  ('Algoritmos y Estructuras de Datos'),
  ('Bases de Datos'),
  ('Ingeniería de Software')
) AS c(denominacion)
CROSS JOIN tipo_unidad t
CROSS JOIN unidad_organizativa d
WHERE t.codigo = 'catedra'
  AND d.denominacion = 'Departamento de Sistemas'
  AND d.id_unidad_superior IS NULL
ON CONFLICT DO NOTHING;
```

- [ ] **Paso 7: Aplicar, revertir y reaplicar**

```bash
docker compose exec -T backend npm run migration:run
docker compose exec -T backend npm run migration:revert
docker compose exec -T backend npm run migration:run
```

Expected: sin errores en los tres.

- [ ] **Paso 8: Verificar que el test pasa**

Run: `docker compose exec -T backend npm run test:integracion`
Expected: PASS (incluye los 3 tests de la Tarea 2 y los 15 de este archivo). Si el mensaje de un índice o CHECK difiere del esperado en el test, ajustar el nombre en el test, no en la migración.

- [ ] **Paso 9: Sondear que `migration:generate` no propone cambios inesperados**

```bash
docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/SondaBorrar
```

Expected: "No changes in database schema were found", o un archivo cuyo único contenido son `DROP INDEX` de los tres índices con `lower()` (limitación documentada en la migración). Borrar el archivo `*-SondaBorrar.ts` si se generó. Cualquier otra diferencia indica que la entidad y la migración no coinciden: corregir antes de seguir.

- [ ] **Paso 10: Lint, formato y commit**

```bash
docker compose exec -T backend npm run lint
docker compose exec -T backend npm run format
docker compose exec -T backend npm test
git add backend/src backend/scripts
git commit -m "Crear las tablas de unidades y puestos con las reglas de jerarquía en la base"
```

---

### Tarea 4: Constantes, lectura de unidades y consultas jerárquicas

**Archivos:**
- Crear: `backend/src/modules/estructura/estructura.constantes.ts`, `transaccion.ts`, `transaccion.spec.ts`, `jerarquia.service.ts`, `jerarquia.service.int.spec.ts`, `arbol-unidades.ts`, `arbol-unidades.spec.ts`, `unidad.mapper.ts`, `unidades.service.ts`, `unidades.service.spec.ts`, `dto/unidad.dto.ts`

**Interfaces:**
- Produce: `TIPOS_UNIDAD`, `NIVELES_JERARQUICOS`, `DOMINIO_NIVEL_JERARQUICO`, `DOMINIO_TIPO_RELACION_CONTRACTUAL`; `enTransaccionDeEstructura<T>(repositorio: { manager: EntityManager }, trabajo: (manager: EntityManager) => Promise<T>): Promise<T>`; `siguienteCodigoPuesto(manager: EntityManager): Promise<string>`; `JerarquiaService.unidadesHastaRaiz(idUnidad: number, manager?: EntityManager): Promise<number[]>` y `cadenaDeSuperiores(idPuesto: number, manager?: EntityManager): Promise<number[]>` (ambos incluyen el id de partida); `armarArbol(unidades: UnidadDto[]): UnidadArbolDto[]`; `UnidadesService.listar(incluirInactivas?)`, `arbol(incluirInactivas?)`, `obtener(id): UnidadDetalleDto`, `exigirActiva(id): UnidadOrganizativa` (404 si no existe, 400 si está inactiva, con `tipo` cargado), `buscarPorIds(ids): UnidadOrganizativa[]` (con `tipo`); DTOs `UnidadDto`, `UnidadDetalleDto`, `UnidadArbolDto`.

- [ ] **Paso 1: Constantes**

`backend/src/modules/estructura/estructura.constantes.ts`:

```ts
/** Códigos de `tipo_unidad` que usa el código de la aplicación. */
export const TIPOS_UNIDAD = {
  departamento: 'departamento',
  catedra: 'catedra',
} as const;

/** Códigos de `nivel_jerarquico` que usan los puestos tipo. */
export const NIVELES_JERARQUICOS = {
  conduccionDepartamento: 'conduccion_departamento',
  conduccionCatedra: 'conduccion_catedra',
  coordinacionDocente: 'coordinacion_docente',
  operativoDocente: 'operativo_docente',
} as const;

/** Slugs de los dominios de referencia (`ReferenciaService.validarActivo`). */
export const DOMINIO_NIVEL_JERARQUICO = 'nivel-jerarquico';
export const DOMINIO_TIPO_RELACION_CONTRACTUAL = 'tipo-relacion-contractual';
```

- [ ] **Paso 2: Test de la transacción y el código**

`backend/src/modules/estructura/transaccion.spec.ts`:

```ts
import { ConflictException } from '@nestjs/common';
import { QueryFailedError, type EntityManager } from 'typeorm';
import {
  BLOQUEO_ESTRUCTURA,
  enTransaccionDeEstructura,
  siguienteCodigoPuesto,
} from './transaccion.js';

function repositorioCon(manager: Partial<EntityManager>) {
  const contenedor = {
    manager: {
      ...manager,
      transaction: async (trabajo: (m: EntityManager) => Promise<unknown>) =>
        trabajo(contenedor.manager as EntityManager),
    },
  };
  return contenedor as unknown as { manager: EntityManager };
}

describe('enTransaccionDeEstructura', () => {
  it('toma el bloqueo consultivo antes de ejecutar el trabajo', async () => {
    const orden: string[] = [];
    const repo = repositorioCon({
      query: vi.fn(async (sql: string, parametros?: unknown[]) => {
        orden.push(`${sql}|${JSON.stringify(parametros)}`);
        return [];
      }) as never,
    });
    const resultado = await enTransaccionDeEstructura(repo, async () => {
      orden.push('trabajo');
      return 42;
    });
    expect(resultado).toBe(42);
    expect(orden).toEqual([
      `SELECT pg_advisory_xact_lock($1)|[${BLOQUEO_ESTRUCTURA}]`,
      'trabajo',
    ]);
  });

  it('traduce una violación de unicidad a 409', async () => {
    const repo = repositorioCon({ query: vi.fn(async () => []) as never });
    const duplicado = new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('duplicate key'), { code: '23505' }),
    );
    await expect(
      enTransaccionDeEstructura(repo, async () => {
        throw duplicado;
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('deja pasar los demás errores', async () => {
    const repo = repositorioCon({ query: vi.fn(async () => []) as never });
    await expect(
      enTransaccionDeEstructura(repo, async () => {
        throw new Error('otro');
      }),
    ).rejects.toThrow('otro');
  });
});

describe('siguienteCodigoPuesto', () => {
  it('formatea el valor de la secuencia con cuatro dígitos', async () => {
    const manager = {
      query: vi.fn(async () => [{ n: '7' }]),
    } as unknown as EntityManager;
    expect(await siguienteCodigoPuesto(manager)).toBe('P-0007');
  });

  it('conserva los códigos de cuatro dígitos', async () => {
    const manager = {
      query: vi.fn(async () => [{ n: '9999' }]),
    } as unknown as EntityManager;
    expect(await siguienteCodigoPuesto(manager)).toBe('P-9999');
  });
});
```

Run: `docker compose exec -T backend npx vitest run src/modules/estructura/transaccion.spec.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Paso 3: Implementar `transaccion.ts`**

```ts
import { ConflictException } from '@nestjs/common';
import { QueryFailedError, type EntityManager } from 'typeorm';

/** Clave del bloqueo que serializa las escrituras de puestos (Usuarios usa 7001). */
export const BLOQUEO_ESTRUCTURA = 7002;

/**
 * Ejecuta el trabajo en una transacción que antes toma el bloqueo consultivo
 * de estructura: las altas, ediciones y bajas de puestos quedan serializadas,
 * así que dos pedidos simultáneos no pueden cerrar un ciclo ni dar de baja un
 * puesto mientras otro le asigna un subordinado.
 */
export async function enTransaccionDeEstructura<T>(
  repositorio: { manager: EntityManager },
  trabajo: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  try {
    return await repositorio.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [
        BLOQUEO_ESTRUCTURA,
      ]);
      return trabajo(manager);
    });
  } catch (error) {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string } | undefined)?.code === '23505'
    ) {
      throw new ConflictException(
        'Ya existe un puesto con esos datos (código o denominación repetidos en la unidad)',
      );
    }
    throw error;
  }
}

/** Próximo código de puesto: `P-0001`. La secuencia falla al llegar a 9999. */
export async function siguienteCodigoPuesto(
  manager: EntityManager,
): Promise<string> {
  const [fila] = await manager.query<{ n: string }[]>(
    `SELECT nextval('puesto_codigo_seq') AS n`,
  );
  return `P-${fila.n.padStart(4, '0')}`;
}
```

Run: `docker compose exec -T backend npx vitest run src/modules/estructura/transaccion.spec.ts`
Expected: PASS.

- [ ] **Paso 4: Test de integración de `JerarquiaService`**

`backend/src/modules/estructura/jerarquia.service.int.spec.ts`:

```ts
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { JerarquiaService } from './jerarquia.service.js';

describe('JerarquiaService (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let servicio: JerarquiaService;
  let departamento: number;
  let catedra: number;
  let otraCatedra: number;
  let a: number;
  let b: number;
  let c: number;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    base.dataSource.query(consulta, parametros) as Promise<T>;
  const unidad = async (denominacion: string, tipo: string, superior: number) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
         SELECT $1, id_tipo_unidad, $3 FROM tipo_unidad WHERE codigo = $2
         RETURNING id_unidad AS id`,
        [denominacion, tipo, superior],
      )
    )[0].id;
  const puesto = async (codigo: string, idUnidad: number, superior: number | null) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico, id_puesto_superior)
         SELECT $1, $1, $2, id_nivel_jerarquico, $3 FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
         RETURNING id_puesto AS id`,
        [codigo, idUnidad, superior],
      )
    )[0].id;

  beforeAll(async () => {
    base = await crearBaseTemporal();
    servicio = new JerarquiaService(base.dataSource);
    departamento = (
      await sql<{ id: number }[]>(
        `SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
      )
    )[0].id;
    catedra = await unidad('Cátedra 1', 'catedra', departamento);
    otraCatedra = await unidad('Cátedra 2', 'catedra', departamento);
    a = await puesto('A', catedra, null);
    b = await puesto('B', catedra, a);
    c = await puesto('C', catedra, b);
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('devuelve la unidad y sus ancestras hasta el departamento', async () => {
    expect((await servicio.unidadesHastaRaiz(catedra)).sort()).toEqual(
      [catedra, departamento].sort(),
    );
    expect(await servicio.unidadesHastaRaiz(departamento)).toEqual([departamento]);
  });

  it('no incluye unidades hermanas', async () => {
    expect(await servicio.unidadesHastaRaiz(otraCatedra)).not.toContain(catedra);
  });

  it('devuelve el puesto y toda su cadena de superiores', async () => {
    expect((await servicio.cadenaDeSuperiores(c)).sort()).toEqual([a, b, c].sort());
    expect(await servicio.cadenaDeSuperiores(a)).toEqual([a]);
  });

  it('termina aunque la cadena tenga un ciclo escrito directo en la base', async () => {
    await sql('UPDATE puesto SET id_puesto_superior = $1 WHERE id_puesto = $2', [c, a]);
    expect((await servicio.cadenaDeSuperiores(c)).sort()).toEqual([a, b, c].sort());
    await sql('UPDATE puesto SET id_puesto_superior = NULL WHERE id_puesto = $1', [a]);
  });
});
```

Run: `docker compose exec -T backend npx vitest run --config vitest.integracion.config.ts src/modules/estructura/jerarquia.service.int.spec.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Paso 5: Implementar `JerarquiaService`**

`backend/src/modules/estructura/jerarquia.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

/** La unidad y todas sus ancestras. `UNION` corta solo ante un ciclo. */
const SQL_UNIDADES_HASTA_RAIZ = `
  WITH RECURSIVE ascendentes AS (
    SELECT id_unidad, id_unidad_superior FROM unidad_organizativa WHERE id_unidad = $1
    UNION
    SELECT u.id_unidad, u.id_unidad_superior
    FROM unidad_organizativa u
    JOIN ascendentes a ON u.id_unidad = a.id_unidad_superior
  )
  SELECT id_unidad FROM ascendentes`;

/** El puesto y todos sus superiores, en cualquier unidad. */
const SQL_CADENA_DE_SUPERIORES = `
  WITH RECURSIVE ascendentes AS (
    SELECT id_puesto, id_puesto_superior FROM puesto WHERE id_puesto = $1
    UNION
    SELECT p.id_puesto, p.id_puesto_superior
    FROM puesto p
    JOIN ascendentes a ON p.id_puesto = a.id_puesto_superior
  )
  SELECT id_puesto FROM ascendentes`;

/** Consultas recursivas sobre las jerarquías de unidades y de puestos. */
@Injectable()
export class JerarquiaService {
  constructor(private readonly dataSource: DataSource) {}

  /** Incluye la unidad de partida. */
  async unidadesHastaRaiz(
    idUnidad: number,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<number[]> {
    const filas = await manager.query<{ id_unidad: number }[]>(
      SQL_UNIDADES_HASTA_RAIZ,
      [idUnidad],
    );
    return filas.map((f) => Number(f.id_unidad));
  }

  /** Incluye el puesto de partida. */
  async cadenaDeSuperiores(
    idPuesto: number,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<number[]> {
    const filas = await manager.query<{ id_puesto: number }[]>(
      SQL_CADENA_DE_SUPERIORES,
      [idPuesto],
    );
    return filas.map((f) => Number(f.id_puesto));
  }
}
```

Run el test de integración del paso 4. Expected: PASS.

- [ ] **Paso 6: DTOs de unidad y mapper**

`backend/src/modules/estructura/dto/unidad.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';

export class UnidadDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ example: 'Departamento de Sistemas' })
  denominacion: string;

  @ApiProperty({ example: 'catedra', description: 'Código del tipo de unidad' })
  tipo: string;

  @ApiProperty({ nullable: true, type: Number })
  idUnidadSuperior: number | null;

  @ApiProperty()
  activo: boolean;
}

export class UnidadDetalleDto extends UnidadDto {
  @ApiProperty({ description: 'Puestos activos de la unidad' })
  cantidadPuestosActivos: number;
}

export class UnidadArbolDto extends UnidadDto {
  @ApiProperty({ type: () => [UnidadArbolDto] })
  hijas: UnidadArbolDto[];
}
```

`backend/src/modules/estructura/unidad.mapper.ts`:

```ts
import type { UnidadDto } from './dto/unidad.dto.js';
import type { UnidadOrganizativa } from './entities/unidad-organizativa.entity.js';

/** La unidad debe venir con `tipo` cargado. */
export function aUnidadDto(unidad: UnidadOrganizativa): UnidadDto {
  return {
    id: unidad.id,
    denominacion: unidad.denominacion,
    tipo: unidad.tipo.codigo,
    idUnidadSuperior: unidad.idUnidadSuperior,
    activo: unidad.activo,
  };
}
```

- [ ] **Paso 7: Test y función del árbol**

`backend/src/modules/estructura/arbol-unidades.spec.ts`:

```ts
import type { UnidadDto } from './dto/unidad.dto.js';
import { armarArbol } from './arbol-unidades.js';

const unidad = (id: number, idUnidadSuperior: number | null): UnidadDto => ({
  id,
  denominacion: `U${id}`,
  tipo: idUnidadSuperior === null ? 'departamento' : 'catedra',
  idUnidadSuperior,
  activo: true,
});

describe('armarArbol', () => {
  it('cuelga las cátedras del departamento', () => {
    const arbol = armarArbol([unidad(1, null), unidad(2, 1), unidad(3, 1)]);
    expect(arbol).toHaveLength(1);
    expect(arbol[0].hijas.map((h) => h.id)).toEqual([2, 3]);
    expect(arbol[0].hijas[0].hijas).toEqual([]);
  });

  it('sube a la raíz una unidad cuyo superior no está en la lista', () => {
    const arbol = armarArbol([unidad(2, 1)]);
    expect(arbol.map((u) => u.id)).toEqual([2]);
  });

  it('devuelve un arreglo vacío si no hay unidades', () => {
    expect(armarArbol([])).toEqual([]);
  });
});
```

`backend/src/modules/estructura/arbol-unidades.ts`:

```ts
import type { UnidadArbolDto, UnidadDto } from './dto/unidad.dto.js';

/**
 * Arma el árbol a partir de la lista plana. Una unidad cuyo superior no está
 * en la lista (por ejemplo, porque está inactivo y se lo filtró) queda como raíz.
 */
export function armarArbol(unidades: UnidadDto[]): UnidadArbolDto[] {
  const nodos = new Map<number, UnidadArbolDto>(
    unidades.map((u) => [u.id, { ...u, hijas: [] }]),
  );
  const raices: UnidadArbolDto[] = [];
  for (const nodo of nodos.values()) {
    const padre =
      nodo.idUnidadSuperior === null
        ? undefined
        : nodos.get(nodo.idUnidadSuperior);
    (padre ? padre.hijas : raices).push(nodo);
  }
  return raices;
}
```

Run: `docker compose exec -T backend npx vitest run src/modules/estructura/arbol-unidades.spec.ts` (primero FAIL, luego de crear el archivo PASS).

- [ ] **Paso 8: Test de `UnidadesService`**

`backend/src/modules/estructura/unidades.service.spec.ts`:

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { Puesto } from './entities/puesto.entity.js';
import type { UnidadOrganizativa } from './entities/unidad-organizativa.entity.js';
import { UnidadesService } from './unidades.service.js';

const unidad = (parcial: Partial<UnidadOrganizativa> = {}): UnidadOrganizativa =>
  ({
    id: 1,
    denominacion: 'Departamento de Sistemas',
    idTipoUnidad: 1,
    tipo: { id: 1, codigo: 'departamento', denominacion: 'Departamento', activo: true },
    idUnidadSuperior: null,
    activo: true,
    ...parcial,
  }) as UnidadOrganizativa;

function crear(unidades: UnidadOrganizativa[], puestosActivos = 0) {
  const repoUnidades = {
    find: vi.fn(async ({ where }: { where: { activo?: boolean } }) =>
      unidades.filter((u) => where.activo === undefined || u.activo === where.activo),
    ),
    findOne: vi.fn(
      async ({ where }: { where: { id: number } }) =>
        unidades.find((u) => u.id === where.id) ?? null,
    ),
  } as unknown as Repository<UnidadOrganizativa>;
  const repoPuestos = {
    count: vi.fn(async () => puestosActivos),
  } as unknown as Repository<Puesto>;
  return {
    servicio: new UnidadesService(repoUnidades, repoPuestos),
    repoUnidades,
    repoPuestos,
  };
}

describe('UnidadesService', () => {
  const catedra = unidad({
    id: 2,
    denominacion: 'Bases de Datos',
    tipo: { id: 2, codigo: 'catedra', denominacion: 'Cátedra', activo: true },
    idUnidadSuperior: 1,
  });
  const inactiva = unidad({ id: 3, denominacion: 'Vieja', activo: false, idUnidadSuperior: 1 });

  it('lista solo las activas por defecto, con el código del tipo', async () => {
    const { servicio } = crear([unidad(), catedra, inactiva]);
    const lista = await servicio.listar();
    expect(lista.map((u) => [u.id, u.tipo])).toEqual([
      [1, 'departamento'],
      [2, 'catedra'],
    ]);
  });

  it('suma las inactivas si se piden', async () => {
    const { servicio } = crear([unidad(), catedra, inactiva]);
    expect(await servicio.listar(true)).toHaveLength(3);
  });

  it('arma el árbol con las cátedras bajo el departamento', async () => {
    const { servicio } = crear([unidad(), catedra]);
    const arbol = await servicio.arbol();
    expect(arbol).toHaveLength(1);
    expect(arbol[0].hijas.map((h) => h.id)).toEqual([2]);
  });

  it('obtiene una unidad con la cantidad de puestos activos', async () => {
    const { servicio } = crear([catedra], 4);
    expect(await servicio.obtener(2)).toMatchObject({
      id: 2,
      tipo: 'catedra',
      cantidadPuestosActivos: 4,
    });
  });

  it('responde 404 si la unidad no existe', async () => {
    const { servicio } = crear([]);
    await expect(servicio.obtener(9)).rejects.toThrow(NotFoundException);
    await expect(servicio.exigirActiva(9)).rejects.toThrow(NotFoundException);
  });

  it('exigirActiva rechaza una unidad inactiva con 400', async () => {
    const { servicio } = crear([inactiva]);
    await expect(servicio.exigirActiva(3)).rejects.toThrow(BadRequestException);
  });

  it('exigirActiva devuelve la unidad con su tipo', async () => {
    const { servicio } = crear([catedra]);
    expect((await servicio.exigirActiva(2)).tipo.codigo).toBe('catedra');
  });

  it('buscarPorIds no consulta la base si no hay ids', async () => {
    const { servicio, repoUnidades } = crear([catedra]);
    expect(await servicio.buscarPorIds([])).toEqual([]);
    expect(repoUnidades.find).not.toHaveBeenCalled();
  });
});
```

Run: `docker compose exec -T backend npx vitest run src/modules/estructura/unidades.service.spec.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Paso 9: Implementar `UnidadesService`**

`backend/src/modules/estructura/unidades.service.ts`:

```ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { armarArbol } from './arbol-unidades.js';
import type {
  UnidadArbolDto,
  UnidadDetalleDto,
  UnidadDto,
} from './dto/unidad.dto.js';
import { Puesto } from './entities/puesto.entity.js';
import { UnidadOrganizativa } from './entities/unidad-organizativa.entity.js';
import { aUnidadDto } from './unidad.mapper.js';

/** Consulta de unidades (RF01). Las unidades las carga el DBA: acá no se escribe. */
@Injectable()
export class UnidadesService {
  constructor(
    @InjectRepository(UnidadOrganizativa)
    private readonly unidades: Repository<UnidadOrganizativa>,
    @InjectRepository(Puesto)
    private readonly puestos: Repository<Puesto>,
  ) {}

  async listar(incluirInactivas = false): Promise<UnidadDto[]> {
    const filas = await this.unidades.find({
      where: incluirInactivas ? {} : { activo: true },
      relations: { tipo: true },
      order: { denominacion: 'ASC' },
    });
    return filas.map(aUnidadDto);
  }

  async arbol(incluirInactivas = false): Promise<UnidadArbolDto[]> {
    return armarArbol(await this.listar(incluirInactivas));
  }

  async obtener(id: number): Promise<UnidadDetalleDto> {
    const unidad = await this.buscar(id);
    const cantidadPuestosActivos = await this.puestos.count({
      where: { idUnidad: id, activo: true },
    });
    return { ...aUnidadDto(unidad), cantidadPuestosActivos };
  }

  /** 404 si no existe, 400 si está inactiva. Devuelve la unidad con su tipo. */
  async exigirActiva(id: number): Promise<UnidadOrganizativa> {
    const unidad = await this.buscar(id);
    if (!unidad.activo) {
      throw new BadRequestException(
        `La unidad "${unidad.denominacion}" está inactiva`,
      );
    }
    return unidad;
  }

  /** Con el tipo cargado; las que no existen simplemente no vuelven. */
  buscarPorIds(ids: number[]): Promise<UnidadOrganizativa[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.unidades.find({
      where: { id: In(ids) },
      relations: { tipo: true },
    });
  }

  private async buscar(id: number): Promise<UnidadOrganizativa> {
    const unidad = await this.unidades.findOne({
      where: { id },
      relations: { tipo: true },
    });
    if (!unidad) throw new NotFoundException(`No existe la unidad ${id}`);
    return unidad;
  }
}
```

Run los tests del paso 8. Expected: PASS.

- [ ] **Paso 10: Lint, formato y commit**

```bash
docker compose exec -T backend npm run lint
docker compose exec -T backend npm run format
docker compose exec -T backend npm test
docker compose exec -T backend npm run test:integracion
git add backend/src/modules/estructura
git commit -m "Agregar la lectura de unidades y las consultas recursivas de jerarquía"
```

---

### Tarea 5: Puestos: listar, obtener, crear y actualizar

**Archivos:**
- Crear: `backend/src/modules/estructura/dto/{puesto,crear-puesto,actualizar-puesto,filtro-puestos}.dto.ts`, `dto/puestos-dto.spec.ts`, `puesto.mapper.ts`, `puestos.service.ts`, `puestos.service.spec.ts`

**Interfaces:**
- Consume (Tarea 4): `enTransaccionDeEstructura`, `siguienteCodigoPuesto`, `JerarquiaService.unidadesHastaRaiz/cadenaDeSuperiores`, `UnidadesService.exigirActiva`, constantes `DOMINIO_NIVEL_JERARQUICO` y `DOMINIO_TIPO_RELACION_CONTRACTUAL`; `ReferenciaService.validarActivo(slug, id)`.
- Produce: `PuestoDto`, `PuestoResumenDto`, `PuestoDetalleDto`; `aPuestoDto(p: Puesto): PuestoDto`, `aResumen(p: Puesto): PuestoResumenDto`; `PuestosService` con `listar(filtro: FiltroPuestosDto): Promise<PuestoDto[]>`, `obtener(id): Promise<PuestoDetalleDto>`, `crear(dto: CrearPuestoDto): Promise<PuestoDetalleDto>`, `actualizar(id, dto: ActualizarPuestoDto): Promise<PuestoDetalleDto>` (la baja y la reactivación se agregan en la Tarea 6); helper exportado `escaparLike(texto: string): string`.

- [ ] **Paso 1: DTOs**

`backend/src/modules/estructura/dto/puesto.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';

export class PuestoDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ example: 'P-0001' })
  codigo: string;

  @ApiProperty({ example: 'Jefe de cátedra' })
  denominacion: string;

  @ApiProperty({ nullable: true, type: String })
  proposito: string | null;

  @ApiProperty({ nullable: true, type: String })
  condicionesTrabajo: string | null;

  @ApiProperty({ nullable: true, type: String })
  rangoRetributivo: string | null;

  @ApiProperty({ minimum: 1 })
  dotacionPrevista: number;

  @ApiProperty()
  idUnidad: number;

  @ApiProperty()
  idNivelJerarquico: number;

  @ApiProperty({ nullable: true, type: Number })
  idTipoRelacionContractual: number | null;

  @ApiProperty({ nullable: true, type: Number })
  idPuestoSuperior: number | null;

  @ApiProperty()
  activo: boolean;
}

export class PuestoResumenDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ example: 'P-0001' })
  codigo: string;

  @ApiProperty()
  denominacion: string;

  @ApiProperty()
  activo: boolean;
}

export class PuestoDetalleDto extends PuestoDto {
  @ApiProperty({ type: PuestoResumenDto, nullable: true })
  superior: PuestoResumenDto | null;

  @ApiProperty({ type: [PuestoResumenDto], description: 'Subordinados directos' })
  subordinados: PuestoResumenDto[];
}

export class PuestosTipoCreadosDto {
  @ApiProperty({ type: [PuestoDto] })
  puestos: PuestoDto[];

  @ApiProperty({ type: [String] })
  advertencias: string[];
}
```

`backend/src/modules/estructura/dto/crear-puesto.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearPuestoDto {
  @ApiProperty({ example: 'Jefe de cátedra', maxLength: 150 })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  denominacion: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  proposito?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  condicionesTrabajo?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    maxLength: 100,
    description: 'Texto descriptivo; no es un monto',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  rangoRetributivo?: string | null;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  dotacionPrevista?: number;

  @ApiProperty({ description: 'Unidad del puesto; no se puede cambiar después' })
  @IsInt()
  idUnidad: number;

  @ApiProperty()
  @IsInt()
  idNivelJerarquico: number;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  idTipoRelacionContractual?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: 'En la misma unidad o en una ancestra',
  })
  @IsOptional()
  @IsInt()
  idPuestoSuperior?: number | null;
}
```

`backend/src/modules/estructura/dto/actualizar-puesto.dto.ts`:

```ts
import { OmitType, PartialType } from '@nestjs/swagger';
import { CrearPuestoDto } from './crear-puesto.dto.js';

/** No admite `codigo` ni `idUnidad`: no se editan después del alta. */
export class ActualizarPuestoDto extends PartialType(
  OmitType(CrearPuestoDto, ['idUnidad'] as const),
) {}
```

`backend/src/modules/estructura/dto/filtro-puestos.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class FiltroPuestosDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idUnidad?: number;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const valor = obj[key];
    if (valor === 'true') return true;
    if (valor === 'false') return false;
    return valor;
  })
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ description: 'Texto contenido en el código o la denominación' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
```

- [ ] **Paso 2: Test de los DTOs**

`backend/src/modules/estructura/dto/puestos-dto.spec.ts`:

```ts
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ActualizarPuestoDto } from './actualizar-puesto.dto.js';
import { CrearPuestoDto } from './crear-puesto.dto.js';
import { FiltroPuestosDto } from './filtro-puestos.dto.js';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

describe('FiltroPuestosDto', () => {
  it('convierte idUnidad y activo desde el query string', async () => {
    const filtro = (await pipe.transform(
      { idUnidad: '12', activo: 'false', q: 'jefe' },
      { type: 'query', metatype: FiltroPuestosDto },
    )) as FiltroPuestosDto;
    expect(filtro).toMatchObject({ idUnidad: 12, activo: false, q: 'jefe' });
  });

  it('rechaza parámetros desconocidos', async () => {
    await expect(
      pipe.transform({ otro: '1' }, { type: 'query', metatype: FiltroPuestosDto }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza un activo que no es booleano', async () => {
    await expect(
      pipe.transform({ activo: 'tal vez' }, { type: 'query', metatype: FiltroPuestosDto }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('ActualizarPuestoDto', () => {
  it.each(['codigo', 'idUnidad'])('rechaza %s: no se edita después del alta', async (campo) => {
    await expect(
      pipe.transform({ [campo]: 'P-0009' }, { type: 'body', metatype: ActualizarPuestoDto }),
    ).rejects.toThrow(BadRequestException);
  });

  it('acepta quitar el superior con null', async () => {
    const dto = (await pipe.transform(
      { idPuestoSuperior: null },
      { type: 'body', metatype: ActualizarPuestoDto },
    )) as ActualizarPuestoDto;
    expect(dto.idPuestoSuperior).toBeNull();
  });
});

describe('CrearPuestoDto', () => {
  const base = { denominacion: '  Jefe de cátedra ', idUnidad: 2, idNivelJerarquico: 2 };

  it('recorta la denominación', async () => {
    const dto = (await pipe.transform(base, {
      type: 'body',
      metatype: CrearPuestoDto,
    })) as CrearPuestoDto;
    expect(dto.denominacion).toBe('Jefe de cátedra');
  });

  it('rechaza una denominación vacía o de solo espacios', async () => {
    await expect(
      pipe.transform({ ...base, denominacion: '   ' }, { type: 'body', metatype: CrearPuestoDto }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza una dotación menor a 1 y el campo codigo', async () => {
    await expect(
      pipe.transform({ ...base, dotacionPrevista: 0 }, { type: 'body', metatype: CrearPuestoDto }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      pipe.transform({ ...base, codigo: 'P-0001' }, { type: 'body', metatype: CrearPuestoDto }),
    ).rejects.toThrow(BadRequestException);
  });
});
```

Run: `docker compose exec -T backend npx vitest run src/modules/estructura/dto`
Expected: PASS (los DTOs ya existen). Si algún caso falla, corregir el DTO.

- [ ] **Paso 3: Mapper**

`backend/src/modules/estructura/puesto.mapper.ts`:

```ts
import type { PuestoDto, PuestoResumenDto } from './dto/puesto.dto.js';
import type { Puesto } from './entities/puesto.entity.js';

export function aPuestoDto(puesto: Puesto): PuestoDto {
  return {
    id: puesto.id,
    codigo: puesto.codigo,
    denominacion: puesto.denominacion,
    proposito: puesto.proposito,
    condicionesTrabajo: puesto.condicionesTrabajo,
    rangoRetributivo: puesto.rangoRetributivo,
    dotacionPrevista: puesto.dotacionPrevista,
    idUnidad: puesto.idUnidad,
    idNivelJerarquico: puesto.idNivelJerarquico,
    idTipoRelacionContractual: puesto.idTipoRelacionContractual,
    idPuestoSuperior: puesto.idPuestoSuperior,
    activo: puesto.activo,
  };
}

export function aResumen(puesto: Puesto): PuestoResumenDto {
  return {
    id: puesto.id,
    codigo: puesto.codigo,
    denominacion: puesto.denominacion,
    activo: puesto.activo,
  };
}
```

- [ ] **Paso 4: Tests de `PuestosService` (listar, obtener, crear, actualizar)**

`backend/src/modules/estructura/puestos.service.spec.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FindOperator, type Repository } from 'typeorm';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { Puesto } from './entities/puesto.entity.js';
import type { JerarquiaService } from './jerarquia.service.js';
import { escaparLike, PuestosService } from './puestos.service.js';
import type { UnidadesService } from './unidades.service.js';

function puesto(parcial: Partial<Puesto> = {}): Puesto {
  return {
    id: 1,
    codigo: 'P-0001',
    denominacion: 'Jefe de cátedra',
    proposito: null,
    condicionesTrabajo: null,
    rangoRetributivo: null,
    dotacionPrevista: 1,
    idUnidad: 10,
    idNivelJerarquico: 2,
    idTipoRelacionContractual: null,
    idPuestoSuperior: null,
    activo: true,
    ...parcial,
  } as Puesto;
}

interface Config {
  /** Unidades que devuelve `unidadesHastaRaiz`: la del puesto y sus ancestras. */
  ascendentes?: number[];
  /** Cadena de superiores por id de puesto (incluye el propio id). */
  cadenas?: Record<number, number[]>;
}

function crearEntorno(existentes: Puesto[], config: Config = {}) {
  const filas = existentes.map((p) => ({ ...p }));
  let proximoId = 100;
  let secuencia = 0;

  const coincide = (p: Puesto, donde: unknown): boolean =>
    Array.isArray(donde)
      ? donde.some((d) => coincide(p, d))
      : Object.entries(donde as Record<string, unknown>).every(
          ([clave, valor]) =>
            valor instanceof FindOperator ||
            p[clave as keyof Puesto] === valor,
        );

  const repo = {
    find: vi.fn(async ({ where }: { where: unknown }) =>
      filas.filter((p) => coincide(p, where)).map((p) => ({ ...p })),
    ),
    findOne: vi.fn(async ({ where }: { where: unknown }) => {
      const fila = filas.find((p) => coincide(p, where));
      return fila ? { ...fila } : null;
    }),
    create: vi.fn((datos: Partial<Puesto>) => ({ ...datos })),
    save: vi.fn(async (p: Partial<Puesto>) => {
      if (p.id === undefined) {
        const nuevo = { ...p, id: proximoId++ } as Puesto;
        filas.push(nuevo);
        return { ...nuevo };
      }
      const i = filas.findIndex((f) => f.id === p.id);
      filas[i] = { ...(p as Puesto) };
      return { ...(p as Puesto) };
    }),
  };
  const consultas: string[] = [];
  const manager = {
    query: vi.fn(async (sql: string) => {
      consultas.push(sql);
      return sql.includes('nextval') ? [{ n: String(++secuencia) }] : [];
    }),
    getRepository: () => repo,
    transaction: async (trabajo: (m: unknown) => Promise<unknown>) =>
      trabajo(manager),
  };
  (repo as unknown as { manager: unknown }).manager = manager;

  const unidades = {
    exigirActiva: vi.fn(async (id: number) => ({ id, activo: true })),
    obtener: vi.fn(async (id: number) => ({ id, activo: true })),
  };
  const jerarquia = {
    unidadesHastaRaiz: vi.fn(async () => config.ascendentes ?? [10]),
    cadenaDeSuperiores: vi.fn(async (id: number) => config.cadenas?.[id] ?? [id]),
  };
  const referencia = { validarActivo: vi.fn(async () => undefined) };

  const servicio = new PuestosService(
    repo as unknown as Repository<Puesto>,
    unidades as unknown as UnidadesService,
    jerarquia as unknown as JerarquiaService,
    referencia as unknown as ReferenciaService,
  );
  return { servicio, repo, consultas, unidades, jerarquia, referencia, filas };
}

const alta = {
  denominacion: 'Auxiliar de TP',
  idUnidad: 10,
  idNivelJerarquico: 4,
};

describe('PuestosService.crear', () => {
  it('genera el código con la secuencia y valida unidad y nivel', async () => {
    const { servicio, unidades, referencia } = crearEntorno([]);
    const creado = await servicio.crear(alta);
    expect(creado).toMatchObject({
      codigo: 'P-0001',
      denominacion: 'Auxiliar de TP',
      dotacionPrevista: 1,
      idPuestoSuperior: null,
      activo: true,
      subordinados: [],
    });
    expect(unidades.exigirActiva).toHaveBeenCalledWith(10);
    expect(referencia.validarActivo).toHaveBeenCalledWith('nivel-jerarquico', 4);
  });

  it('toma el bloqueo consultivo de estructura', async () => {
    const { servicio, consultas } = crearEntorno([]);
    await servicio.crear(alta);
    expect(consultas[0]).toContain('pg_advisory_xact_lock');
  });

  it('valida el tipo de relación contractual solo si viene', async () => {
    const { servicio, referencia } = crearEntorno([]);
    await servicio.crear(alta);
    expect(referencia.validarActivo).toHaveBeenCalledTimes(1);
    await servicio.crear({ ...alta, denominacion: 'Otro', idTipoRelacionContractual: 2 });
    expect(referencia.validarActivo).toHaveBeenCalledWith(
      'tipo-relacion-contractual',
      2,
    );
  });

  it('acepta un superior de la misma unidad', async () => {
    const { servicio } = crearEntorno([puesto({ id: 5, idUnidad: 10 })]);
    const creado = await servicio.crear({ ...alta, idPuestoSuperior: 5 });
    expect(creado.idPuestoSuperior).toBe(5);
    expect(creado.superior).toMatchObject({ id: 5 });
  });

  it('acepta un superior de una unidad ancestra', async () => {
    const { servicio } = crearEntorno([puesto({ id: 5, idUnidad: 1 })], {
      ascendentes: [10, 1],
    });
    await expect(
      servicio.crear({ ...alta, idPuestoSuperior: 5 }),
    ).resolves.toMatchObject({ idPuestoSuperior: 5 });
  });

  it('rechaza un superior de una unidad que no es la misma ni una ancestra', async () => {
    const { servicio } = crearEntorno([puesto({ id: 5, idUnidad: 20 })], {
      ascendentes: [10, 1],
    });
    await expect(servicio.crear({ ...alta, idPuestoSuperior: 5 })).rejects.toThrow(
      /misma unidad o en una unidad superior/,
    );
  });

  it('rechaza un superior inexistente o dado de baja', async () => {
    const { servicio } = crearEntorno([puesto({ id: 5, activo: false })]);
    await expect(servicio.crear({ ...alta, idPuestoSuperior: 5 })).rejects.toThrow(
      /dado de baja/,
    );
    await expect(servicio.crear({ ...alta, idPuestoSuperior: 77 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza una denominación repetida en la unidad, sin distinguir mayúsculas ni espacios', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 5, denominacion: 'Auxiliar de TP' }),
    ]);
    await expect(
      servicio.crear({ ...alta, denominacion: '  auxiliar DE tp ' }),
    ).rejects.toThrow(ConflictException);
  });

  it('permite la misma denominación si el otro puesto está dado de baja', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 5, denominacion: 'Auxiliar de TP', activo: false }),
    ]);
    await expect(servicio.crear(alta)).resolves.toMatchObject({ codigo: 'P-0001' });
  });
});

describe('PuestosService.actualizar', () => {
  it('modifica los campos enviados y deja el resto', async () => {
    const { servicio } = crearEntorno([puesto({ id: 1, rangoRetributivo: 'Cat. 5' })]);
    const actualizado = await servicio.actualizar(1, {
      proposito: 'Conducir la cátedra',
      dotacionPrevista: 2,
    });
    expect(actualizado).toMatchObject({
      proposito: 'Conducir la cátedra',
      dotacionPrevista: 2,
      rangoRetributivo: 'Cat. 5',
      codigo: 'P-0001',
    });
  });

  it('responde 404 si el puesto no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(servicio.actualizar(9, { proposito: 'x' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('no revalida el superior si no cambia', async () => {
    const { servicio, jerarquia } = crearEntorno([
      puesto({ id: 1, idPuestoSuperior: 5 }),
      puesto({ id: 5, codigo: 'P-0005', denominacion: 'Jefe' }),
    ]);
    await servicio.actualizar(1, { idPuestoSuperior: 5, proposito: 'x' });
    expect(jerarquia.cadenaDeSuperiores).not.toHaveBeenCalled();
  });

  it('rechaza que el puesto sea su propio superior', async () => {
    const { servicio } = crearEntorno([puesto({ id: 1 })]);
    await expect(servicio.actualizar(1, { idPuestoSuperior: 1 })).rejects.toThrow(
      /propio superior/,
    );
  });

  it('rechaza un ciclo indirecto: el superior elegido depende del puesto', async () => {
    // 1 es superior de 2 y 2 de 3; se intenta que 3 sea superior de 1.
    const { servicio } = crearEntorno(
      [
        puesto({ id: 1, codigo: 'P-0001', denominacion: 'A' }),
        puesto({ id: 2, codigo: 'P-0002', denominacion: 'B', idPuestoSuperior: 1 }),
        puesto({ id: 3, codigo: 'P-0003', denominacion: 'C', idPuestoSuperior: 2 }),
      ],
      { cadenas: { 3: [3, 2, 1] } },
    );
    await expect(servicio.actualizar(1, { idPuestoSuperior: 3 })).rejects.toThrow(
      /ciclo/,
    );
  });

  it('permite quitar el superior con null', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 1, idPuestoSuperior: 5 }),
      puesto({ id: 5, codigo: 'P-0005', denominacion: 'Jefe' }),
    ]);
    const actualizado = await servicio.actualizar(1, { idPuestoSuperior: null });
    expect(actualizado.idPuestoSuperior).toBeNull();
    expect(actualizado.superior).toBeNull();
  });

  it('rechaza null en un campo obligatorio sin modificar nada', async () => {
    const { servicio, repo } = crearEntorno([puesto({ id: 1 })]);
    await expect(
      servicio.actualizar(1, { denominacion: null as unknown as string }),
    ).rejects.toThrow(/no admite null/);
    await expect(
      servicio.actualizar(1, { idNivelJerarquico: null as unknown as number }),
    ).rejects.toThrow(/no admite null/);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('revalida nivel y tipo contractual solo si cambian', async () => {
    const { servicio, referencia } = crearEntorno([
      puesto({ id: 1, idNivelJerarquico: 2 }),
    ]);
    await servicio.actualizar(1, { idNivelJerarquico: 2, proposito: 'x' });
    expect(referencia.validarActivo).not.toHaveBeenCalled();
    await servicio.actualizar(1, { idNivelJerarquico: 3 });
    expect(referencia.validarActivo).toHaveBeenCalledWith('nivel-jerarquico', 3);
  });

  it('rechaza renombrar a una denominación que ya usa otro puesto activo de la unidad', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 1, denominacion: 'A' }),
      puesto({ id: 2, codigo: 'P-0002', denominacion: 'B' }),
    ]);
    await expect(servicio.actualizar(1, { denominacion: 'b' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('permite conservar la propia denominación con otras mayúsculas', async () => {
    const { servicio } = crearEntorno([puesto({ id: 1, denominacion: 'Jefe' })]);
    await expect(
      servicio.actualizar(1, { denominacion: 'JEFE' }),
    ).resolves.toMatchObject({ denominacion: 'JEFE' });
  });
});

describe('PuestosService.listar', () => {
  it('filtra por unidad y estado', async () => {
    const { servicio, repo } = crearEntorno([]);
    await servicio.listar({ idUnidad: 10, activo: true });
    expect(repo.find).toHaveBeenCalledWith({
      where: { idUnidad: 10, activo: true },
      order: { codigo: 'ASC' },
    });
  });

  it('busca el texto en código o denominación con ILIKE', async () => {
    const { servicio, repo } = crearEntorno([]);
    await servicio.listar({ q: ' jefe ' });
    const { where } = repo.find.mock.calls[0][0] as { where: Record<string, unknown>[] };
    expect(where).toHaveLength(2);
    expect((where[0].codigo as FindOperator<string>).value).toBe('%jefe%');
    expect((where[1].denominacion as FindOperator<string>).value).toBe('%jefe%');
  });

  it('escapa % y _ para que no actúen como comodines', async () => {
    expect(escaparLike('50%_\\')).toBe('50\\%\\_\\\\');
    const { servicio, repo } = crearEntorno([]);
    await servicio.listar({ q: '%' });
    const { where } = repo.find.mock.calls[0][0] as { where: Record<string, unknown>[] };
    expect((where[0].codigo as FindOperator<string>).value).toBe('%\\%%');
  });
});

describe('PuestosService.obtener', () => {
  it('devuelve el superior y los subordinados directos', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 1, codigo: 'P-0001', denominacion: 'Jefe' }),
      puesto({ id: 2, codigo: 'P-0002', denominacion: 'JTP', idPuestoSuperior: 1 }),
      puesto({ id: 3, codigo: 'P-0003', denominacion: 'ATP', idPuestoSuperior: 2 }),
    ]);
    const detalle = await servicio.obtener(2);
    expect(detalle.superior).toMatchObject({ id: 1, codigo: 'P-0001' });
    expect(detalle.subordinados.map((s) => s.id)).toEqual([3]);
  });

  it('responde 404 si no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(servicio.obtener(9)).rejects.toThrow(NotFoundException);
  });
});
```

Run: `docker compose exec -T backend npx vitest run src/modules/estructura/puestos.service.spec.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Paso 5: Implementar `PuestosService`**

`backend/src/modules/estructura/puestos.service.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ILike,
  type EntityManager,
  type FindOptionsWhere,
  Repository,
} from 'typeorm';
import { ReferenciaService } from '../referencia/referencia.service.js';
import type { ActualizarPuestoDto } from './dto/actualizar-puesto.dto.js';
import type { CrearPuestoDto } from './dto/crear-puesto.dto.js';
import type { FiltroPuestosDto } from './dto/filtro-puestos.dto.js';
import type { PuestoDetalleDto, PuestoDto } from './dto/puesto.dto.js';
import { Puesto } from './entities/puesto.entity.js';
import {
  DOMINIO_NIVEL_JERARQUICO,
  DOMINIO_TIPO_RELACION_CONTRACTUAL,
} from './estructura.constantes.js';
import { JerarquiaService } from './jerarquia.service.js';
import { aPuestoDto, aResumen } from './puesto.mapper.js';
import {
  enTransaccionDeEstructura,
  siguienteCodigoPuesto,
} from './transaccion.js';
import { UnidadesService } from './unidades.service.js';

/** Campos que admiten `null` en una modificación; el resto no se puede vaciar. */
const CAMPOS_NULABLES = new Set([
  'proposito',
  'condicionesTrabajo',
  'rangoRetributivo',
  'idTipoRelacionContractual',
  'idPuestoSuperior',
]);

/** Para `ILIKE`: `%`, `_` y `\` del texto buscado no son comodines. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, '\\$&');
}

const normalizar = (texto: string) => texto.trim().toLowerCase();

function cambios(dto: ActualizarPuestoDto): Partial<Puesto> {
  const resultado: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(dto)) {
    if (valor === undefined) continue;
    if (valor === null && !CAMPOS_NULABLES.has(campo)) {
      throw new BadRequestException(`${campo} no admite null`);
    }
    resultado[campo] = valor;
  }
  return resultado as Partial<Puesto>;
}

/** Inventario de puestos (RF02). Las escrituras corren con el bloqueo de estructura. */
@Injectable()
export class PuestosService {
  constructor(
    @InjectRepository(Puesto) private readonly puestos: Repository<Puesto>,
    private readonly unidades: UnidadesService,
    private readonly jerarquia: JerarquiaService,
    private readonly referencia: ReferenciaService,
  ) {}

  async listar(filtro: FiltroPuestosDto): Promise<PuestoDto[]> {
    const base: FindOptionsWhere<Puesto> = {};
    if (filtro.idUnidad !== undefined) base.idUnidad = filtro.idUnidad;
    if (filtro.activo !== undefined) base.activo = filtro.activo;
    const texto = filtro.q?.trim();
    const patron = texto ? `%${escaparLike(texto)}%` : undefined;
    const filas = await this.puestos.find({
      where: patron
        ? [
            { ...base, codigo: ILike(patron) },
            { ...base, denominacion: ILike(patron) },
          ]
        : base,
      order: { codigo: 'ASC' },
    });
    return filas.map(aPuestoDto);
  }

  async obtener(id: number): Promise<PuestoDetalleDto> {
    const puesto = await this.buscar(this.puestos, id);
    const superior =
      puesto.idPuestoSuperior === null
        ? null
        : await this.puestos.findOne({ where: { id: puesto.idPuestoSuperior } });
    const subordinados = await this.puestos.find({
      where: { idPuestoSuperior: id },
      order: { codigo: 'ASC' },
    });
    return {
      ...aPuestoDto(puesto),
      superior: superior ? aResumen(superior) : null,
      subordinados: subordinados.map(aResumen),
    };
  }

  async crear(dto: CrearPuestoDto): Promise<PuestoDetalleDto> {
    await this.unidades.exigirActiva(dto.idUnidad);
    await this.referencia.validarActivo(
      DOMINIO_NIVEL_JERARQUICO,
      dto.idNivelJerarquico,
    );
    if (dto.idTipoRelacionContractual != null) {
      await this.referencia.validarActivo(
        DOMINIO_TIPO_RELACION_CONTRACTUAL,
        dto.idTipoRelacionContractual,
      );
    }

    const id = await enTransaccionDeEstructura(this.puestos, async (manager) => {
      const repo = manager.getRepository(Puesto);
      await this.exigirDenominacionLibre(repo, dto.idUnidad, dto.denominacion);
      if (dto.idPuestoSuperior != null) {
        await this.validarSuperior(manager, null, dto.idUnidad, dto.idPuestoSuperior);
      }
      const creado = await repo.save(
        repo.create({
          codigo: await siguienteCodigoPuesto(manager),
          denominacion: dto.denominacion,
          proposito: dto.proposito ?? null,
          condicionesTrabajo: dto.condicionesTrabajo ?? null,
          rangoRetributivo: dto.rangoRetributivo ?? null,
          dotacionPrevista: dto.dotacionPrevista ?? 1,
          idUnidad: dto.idUnidad,
          idNivelJerarquico: dto.idNivelJerarquico,
          idTipoRelacionContractual: dto.idTipoRelacionContractual ?? null,
          idPuestoSuperior: dto.idPuestoSuperior ?? null,
          activo: true,
        }),
      );
      return creado.id;
    });
    return this.obtener(id);
  }

  async actualizar(
    id: number,
    dto: ActualizarPuestoDto,
  ): Promise<PuestoDetalleDto> {
    const nuevos = cambios(dto);
    await enTransaccionDeEstructura(this.puestos, async (manager) => {
      const repo = manager.getRepository(Puesto);
      const puesto = await this.buscar(repo, id);

      if (
        dto.idNivelJerarquico !== undefined &&
        dto.idNivelJerarquico !== puesto.idNivelJerarquico
      ) {
        await this.referencia.validarActivo(
          DOMINIO_NIVEL_JERARQUICO,
          dto.idNivelJerarquico,
        );
      }
      if (
        dto.idTipoRelacionContractual != null &&
        dto.idTipoRelacionContractual !== puesto.idTipoRelacionContractual
      ) {
        await this.referencia.validarActivo(
          DOMINIO_TIPO_RELACION_CONTRACTUAL,
          dto.idTipoRelacionContractual,
        );
      }
      if (dto.denominacion !== undefined && puesto.activo) {
        await this.exigirDenominacionLibre(
          repo,
          puesto.idUnidad,
          dto.denominacion,
          id,
        );
      }
      if (
        dto.idPuestoSuperior != null &&
        dto.idPuestoSuperior !== puesto.idPuestoSuperior
      ) {
        await this.validarSuperior(manager, id, puesto.idUnidad, dto.idPuestoSuperior);
      }

      await repo.save(Object.assign(puesto, nuevos));
    });
    return this.obtener(id);
  }

  /** `repo` puede ser el de una transacción en curso. */
  protected async buscar(repo: Repository<Puesto>, id: number): Promise<Puesto> {
    const puesto = await repo.findOne({ where: { id } });
    if (!puesto) throw new NotFoundException(`No existe el puesto ${id}`);
    return puesto;
  }

  /**
   * El superior debe existir, estar activo y estar en la unidad del puesto o en
   * una ancestra. Con `idPuesto` (modificación) también se descartan los ciclos.
   */
  protected async validarSuperior(
    manager: EntityManager,
    idPuesto: number | null,
    idUnidad: number,
    idSuperior: number,
  ): Promise<void> {
    if (idPuesto !== null && idSuperior === idPuesto) {
      throw new BadRequestException(
        'Un puesto no puede ser su propio superior',
      );
    }
    const superior = await manager
      .getRepository(Puesto)
      .findOne({ where: { id: idSuperior } });
    if (!superior) {
      throw new BadRequestException(`El puesto superior ${idSuperior} no existe`);
    }
    if (!superior.activo) {
      throw new BadRequestException(
        `El puesto superior ${superior.codigo} está dado de baja`,
      );
    }
    const unidadesValidas = await this.jerarquia.unidadesHastaRaiz(idUnidad, manager);
    if (!unidadesValidas.includes(superior.idUnidad)) {
      throw new BadRequestException(
        'El superior debe estar en la misma unidad o en una unidad superior',
      );
    }
    if (idPuesto !== null) {
      const cadena = await this.jerarquia.cadenaDeSuperiores(idSuperior, manager);
      if (cadena.includes(idPuesto)) {
        throw new BadRequestException(
          `El puesto ${superior.codigo} depende de este puesto: se formaría un ciclo`,
        );
      }
    }
  }

  /** Entre los puestos activos de la unidad, sin distinguir mayúsculas ni espacios. */
  protected async exigirDenominacionLibre(
    repo: Repository<Puesto>,
    idUnidad: number,
    denominacion: string,
    idExcluido?: number,
  ): Promise<void> {
    const activos = await repo.find({ where: { idUnidad, activo: true } });
    const repetido = activos.find(
      (p) =>
        p.id !== idExcluido &&
        normalizar(p.denominacion) === normalizar(denominacion),
    );
    if (repetido) {
      throw new ConflictException(
        `La unidad ya tiene el puesto ${repetido.codigo} "${repetido.denominacion}"`,
      );
    }
  }
}
```

- [ ] **Paso 6: Verificar que los tests pasan**

Run: `docker compose exec -T backend npx vitest run src/modules/estructura`
Expected: PASS.

- [ ] **Paso 7: Lint, formato y commit**

```bash
docker compose exec -T backend npm run lint
docker compose exec -T backend npm run format
docker compose exec -T backend npm test
git add backend/src/modules/estructura
git commit -m "Agregar alta, modificación y consulta de puestos con validación del superior"
```

---

### Tarea 6: Baja y reactivación de puestos

**Archivos:**
- Modificar: `backend/src/modules/estructura/puestos.service.ts`, `puestos.service.spec.ts`

**Interfaces:**
- Consume (Tarea 5): `PuestosService.buscar`, `exigirDenominacionLibre`, `obtener`; `UnidadesService.obtener(id)` (para saber si la unidad está activa).
- Produce: `PuestosService.darDeBaja(id: number): Promise<PuestoDetalleDto>` y `reactivar(id: number): Promise<PuestoDetalleDto>`; ambos idempotentes (si ya está en el estado pedido, devuelven el puesto sin cambios).

- [ ] **Paso 1: Agregar los tests**

Al final de `puestos.service.spec.ts`:

```ts
describe('PuestosService.darDeBaja', () => {
  it('desactiva el puesto y lo devuelve', async () => {
    const { servicio, filas } = crearEntorno([puesto({ id: 1 })]);
    const detalle = await servicio.darDeBaja(1);
    expect(detalle.activo).toBe(false);
    expect(filas[0].activo).toBe(false);
  });

  it('rechaza con 409 si tiene subordinados activos y los lista', async () => {
    const { servicio, filas } = crearEntorno([
      puesto({ id: 1, codigo: 'P-0001', denominacion: 'Jefe' }),
      puesto({ id: 2, codigo: 'P-0002', denominacion: 'JTP', idPuestoSuperior: 1 }),
      puesto({ id: 3, codigo: 'P-0003', denominacion: 'ATP', idPuestoSuperior: 1, activo: false }),
    ]);
    const error = await servicio.darDeBaja(1).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toContain('P-0002 JTP');
    expect((error as Error).message).not.toContain('P-0003');
    expect(filas[0].activo).toBe(true);
  });

  it('es idempotente con un puesto ya dado de baja', async () => {
    const { servicio, repo } = crearEntorno([puesto({ id: 1, activo: false })]);
    await expect(servicio.darDeBaja(1)).resolves.toMatchObject({ activo: false });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('responde 404 si no existe y toma el bloqueo consultivo', async () => {
    const { servicio, consultas } = crearEntorno([]);
    await expect(servicio.darDeBaja(9)).rejects.toThrow(NotFoundException);
    expect(consultas[0]).toContain('pg_advisory_xact_lock');
  });
});

describe('PuestosService.reactivar', () => {
  it('reactiva un puesto dado de baja', async () => {
    const { servicio } = crearEntorno([puesto({ id: 1, activo: false })]);
    await expect(servicio.reactivar(1)).resolves.toMatchObject({ activo: true });
  });

  it('rechaza con 409 si la unidad está inactiva', async () => {
    const { servicio, unidades } = crearEntorno([puesto({ id: 1, activo: false })]);
    unidades.obtener.mockResolvedValueOnce({ id: 10, activo: false });
    await expect(servicio.reactivar(1)).rejects.toThrow(/unidad.*inactiva/);
  });

  it('rechaza con 409 si el superior está dado de baja', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 1, activo: false, idPuestoSuperior: 5 }),
      puesto({ id: 5, codigo: 'P-0005', denominacion: 'Jefe', activo: false }),
    ]);
    await expect(servicio.reactivar(1)).rejects.toThrow(ConflictException);
  });

  it('rechaza con 409 si otro puesto activo ya usa la denominación', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 1, denominacion: 'Auxiliar', activo: false }),
      puesto({ id: 2, codigo: 'P-0002', denominacion: 'auxiliar' }),
    ]);
    await expect(servicio.reactivar(1)).rejects.toThrow(ConflictException);
  });

  it('es idempotente con un puesto ya activo', async () => {
    const { servicio, repo } = crearEntorno([puesto({ id: 1 })]);
    await expect(servicio.reactivar(1)).resolves.toMatchObject({ activo: true });
    expect(repo.save).not.toHaveBeenCalled();
  });
});
```

Run: `docker compose exec -T backend npx vitest run src/modules/estructura/puestos.service.spec.ts`
Expected: FAIL (`servicio.darDeBaja is not a function`).

- [ ] **Paso 2: Implementar**

En `puestos.service.ts`, agregar después de `actualizar` y antes de `buscar`:

```ts
  /** Baja lógica. Se bloquea mientras haya subordinados activos. */
  async darDeBaja(id: number): Promise<PuestoDetalleDto> {
    await enTransaccionDeEstructura(this.puestos, async (manager) => {
      const repo = manager.getRepository(Puesto);
      const puesto = await this.buscar(repo, id);
      if (!puesto.activo) return;

      const subordinados = await repo.find({
        where: { idPuestoSuperior: id, activo: true },
      });
      if (subordinados.length > 0) {
        throw new ConflictException(
          `No se puede dar de baja: tiene subordinados activos (${subordinados
            .map((s) => `${s.codigo} ${s.denominacion}`)
            .join(', ')}). Asignales otro superior primero`,
        );
      }
      puesto.activo = false;
      await repo.save(puesto);
    });
    return this.obtener(id);
  }

  /** Exige unidad y superior activos y que la denominación siga libre. */
  async reactivar(id: number): Promise<PuestoDetalleDto> {
    await enTransaccionDeEstructura(this.puestos, async (manager) => {
      const repo = manager.getRepository(Puesto);
      const puesto = await this.buscar(repo, id);
      if (puesto.activo) return;

      const unidad = await this.unidades.obtener(puesto.idUnidad);
      if (!unidad.activo) {
        throw new ConflictException(
          `No se puede reactivar: la unidad "${unidad.denominacion}" está inactiva`,
        );
      }
      if (puesto.idPuestoSuperior !== null) {
        const superior = await repo.findOne({
          where: { id: puesto.idPuestoSuperior },
        });
        if (!superior?.activo) {
          throw new ConflictException(
            'No se puede reactivar: su puesto superior está dado de baja',
          );
        }
      }
      await this.exigirDenominacionLibre(
        repo,
        puesto.idUnidad,
        puesto.denominacion,
        id,
      );
      puesto.activo = true;
      await repo.save(puesto);
    });
    return this.obtener(id);
  }
```

En el test, `unidades.obtener` devuelve `{ id, activo: true }` sin `denominacion`; el mensaje con `unidad.denominacion` mostraría `undefined` pero el test solo busca `/unidad.*inactiva/`, así que pasa.

- [ ] **Paso 3: Verificar, lint y commit**

```bash
docker compose exec -T backend npx vitest run src/modules/estructura
docker compose exec -T backend npm run lint
docker compose exec -T backend npm run format
git add backend/src/modules/estructura
git commit -m "Agregar la baja lógica y la reactivación de puestos"
```

Expected: PASS.

---

### Tarea 7: Puestos tipo de una cátedra

**Archivos:**
- Crear: `backend/src/modules/estructura/puestos-tipo.ts`, `puestos-tipo.service.ts`, `puestos-tipo.service.spec.ts`

**Interfaces:**
- Consume: `UnidadesService.exigirActiva` (devuelve la unidad con `tipo` e `idUnidadSuperior`), `ReferenciaService.listarValores('nivel-jerarquico')` (devuelve `{ id, codigo, ... }[]` solo activos), `enTransaccionDeEstructura`, `siguienteCodigoPuesto`, `aPuestoDto`, `TIPOS_UNIDAD`, `NIVELES_JERARQUICOS`.
- Produce: `PUESTOS_TIPO` (constante) y `PuestosTipoService.crear(idUnidad: number): Promise<PuestosTipoCreadosDto>`.

- [ ] **Paso 1: La constante de los cuatro cargos**

`backend/src/modules/estructura/puestos-tipo.ts`:

```ts
import { NIVELES_JERARQUICOS } from './estructura.constantes.js';

export type ClavePuestoTipo = 'jefe' | 'profesor' | 'jtp' | 'atp';

export interface PuestoTipo {
  clave: ClavePuestoTipo;
  denominacion: string;
  /** Código de `nivel_jerarquico`. */
  nivel: string;
  /** Clave del puesto tipo que es su superior; `null` si depende de la jefatura del departamento. */
  superior: ClavePuestoTipo | null;
}

/** Cargos de toda cátedra (primer avance, Alcance). El orden importa: cada superior va antes. */
export const PUESTOS_TIPO: readonly PuestoTipo[] = [
  {
    clave: 'jefe',
    denominacion: 'Jefe de cátedra',
    nivel: NIVELES_JERARQUICOS.conduccionCatedra,
    superior: null,
  },
  {
    clave: 'profesor',
    denominacion: 'Profesor auxiliar',
    nivel: NIVELES_JERARQUICOS.coordinacionDocente,
    superior: 'jefe',
  },
  {
    clave: 'jtp',
    denominacion: 'Jefe de trabajos prácticos',
    nivel: NIVELES_JERARQUICOS.coordinacionDocente,
    superior: 'jefe',
  },
  {
    clave: 'atp',
    denominacion: 'Auxiliar de trabajos prácticos',
    nivel: NIVELES_JERARQUICOS.operativoDocente,
    superior: 'jtp',
  },
];
```

- [ ] **Paso 2: Tests**

`backend/src/modules/estructura/puestos-tipo.service.spec.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { Puesto } from './entities/puesto.entity.js';
import type { UnidadOrganizativa } from './entities/unidad-organizativa.entity.js';
import { PuestosTipoService } from './puestos-tipo.service.js';
import type { UnidadesService } from './unidades.service.js';

const NIVELES = [
  { id: 11, codigo: 'conduccion_departamento' },
  { id: 12, codigo: 'conduccion_catedra' },
  { id: 13, codigo: 'coordinacion_docente' },
  { id: 14, codigo: 'operativo_docente' },
];

const catedra = (parcial: Partial<UnidadOrganizativa> = {}) =>
  ({
    id: 20,
    denominacion: 'Bases de Datos',
    activo: true,
    idUnidadSuperior: 1,
    tipo: { codigo: 'catedra' },
    ...parcial,
  }) as UnidadOrganizativa;

function puesto(parcial: Partial<Puesto>): Puesto {
  return {
    id: 1,
    codigo: 'P-0001',
    denominacion: 'Jefatura de Departamento',
    idUnidad: 1,
    idNivelJerarquico: 11,
    activo: true,
    idPuestoSuperior: null,
    ...parcial,
  } as Puesto;
}

function crearEntorno(
  existentes: Puesto[],
  opciones: { unidad?: UnidadOrganizativa; niveles?: typeof NIVELES } = {},
) {
  const filas = existentes.map((p) => ({ ...p }));
  let proximoId = 100;
  let secuencia = 0;
  const repo = {
    find: vi.fn(async ({ where }: { where: Partial<Puesto> }) =>
      filas.filter((p) =>
        Object.entries(where).every(([k, v]) => p[k as keyof Puesto] === v),
      ),
    ),
    create: vi.fn((datos: Partial<Puesto>) => ({ ...datos })),
    save: vi.fn(async (p: Partial<Puesto>) => {
      const nuevo = { ...p, id: proximoId++ } as Puesto;
      filas.push(nuevo);
      return nuevo;
    }),
  };
  const manager = {
    query: vi.fn(async (sql: string) =>
      sql.includes('nextval') ? [{ n: String(++secuencia) }] : [],
    ),
    getRepository: () => repo,
    transaction: async (trabajo: (m: unknown) => Promise<unknown>) => trabajo(manager),
  };
  (repo as unknown as { manager: unknown }).manager = manager;
  const unidades = {
    exigirActiva: vi.fn(async () => opciones.unidad ?? catedra()),
  };
  const referencia = {
    listarValores: vi.fn(async () => opciones.niveles ?? NIVELES),
  };
  return {
    servicio: new PuestosTipoService(
      repo as unknown as Repository<Puesto>,
      unidades as unknown as UnidadesService,
      referencia as unknown as ReferenciaService,
    ),
    repo,
    filas,
  };
}

describe('PuestosTipoService.crear', () => {
  it('crea los cuatro cargos con nivel, superior y códigos consecutivos', async () => {
    const { servicio } = crearEntorno([puesto({ id: 1 })]);
    const { puestos, advertencias } = await servicio.crear(20);

    expect(advertencias).toEqual([]);
    expect(puestos.map((p) => [p.codigo, p.denominacion, p.idNivelJerarquico])).toEqual([
      ['P-0001', 'Jefe de cátedra', 12],
      ['P-0002', 'Profesor auxiliar', 13],
      ['P-0003', 'Jefe de trabajos prácticos', 13],
      ['P-0004', 'Auxiliar de trabajos prácticos', 14],
    ]);
    const [jefe, profesor, jtp, atp] = puestos;
    expect(jefe.idPuestoSuperior).toBe(1); // jefatura del departamento
    expect(profesor.idPuestoSuperior).toBe(jefe.id);
    expect(jtp.idPuestoSuperior).toBe(jefe.id);
    expect(atp.idPuestoSuperior).toBe(jtp.id);
    expect(puestos.every((p) => p.idUnidad === 20 && p.dotacionPrevista === 1 && p.activo)).toBe(true);
  });

  it('crea el jefe sin superior y avisa si no hay jefatura de departamento', async () => {
    const { servicio } = crearEntorno([]);
    const { puestos, advertencias } = await servicio.crear(20);
    expect(puestos[0].idPuestoSuperior).toBeNull();
    expect(advertencias).toHaveLength(1);
    expect(advertencias[0]).toMatch(/jefatura de departamento/i);
  });

  it('avisa y deja al jefe sin superior si hay más de una jefatura activa', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 1 }),
      puesto({ id: 2, codigo: 'P-0002', denominacion: 'Jefatura bis' }),
    ]);
    const { puestos, advertencias } = await servicio.crear(20);
    expect(puestos[0].idPuestoSuperior).toBeNull();
    expect(advertencias[0]).toMatch(/más de un puesto/i);
  });

  it('ignora una jefatura dada de baja', async () => {
    const { servicio } = crearEntorno([puesto({ id: 1, activo: false })]);
    const { puestos, advertencias } = await servicio.crear(20);
    expect(puestos[0].idPuestoSuperior).toBeNull();
    expect(advertencias).toHaveLength(1);
  });

  it('rechaza con 409 y no crea nada si ya existe algún cargo, sin distinguir mayúsculas', async () => {
    const { servicio, repo } = crearEntorno([
      puesto({ id: 1 }),
      puesto({ id: 7, codigo: 'P-0007', denominacion: 'jefe de CÁTEDRA', idUnidad: 20 }),
    ]);
    await expect(servicio.crear(20)).rejects.toThrow(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('un cargo dado de baja no impide crear los puestos tipo', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 7, codigo: 'P-0007', denominacion: 'Jefe de cátedra', idUnidad: 20, activo: false }),
    ]);
    await expect(servicio.crear(20)).resolves.toMatchObject({
      puestos: expect.arrayContaining([expect.objectContaining({ denominacion: 'Jefe de cátedra' })]),
    });
  });

  it('rechaza con 400 una unidad que no es cátedra', async () => {
    const { servicio } = crearEntorno([], {
      unidad: catedra({ tipo: { codigo: 'departamento' } as never }),
    });
    await expect(servicio.crear(20)).rejects.toThrow(BadRequestException);
  });

  it('propaga el 404 de una unidad inexistente', async () => {
    const { servicio } = crearEntorno([]);
    // exigirActiva ya devuelve la unidad; simulamos su 404 reemplazando el mock.
    const falla = new NotFoundException('No existe la unidad 99');
    (servicio as unknown as { unidades: { exigirActiva: () => never } }).unidades.exigirActiva =
      () => {
        throw falla;
      };
    await expect(servicio.crear(99)).rejects.toBe(falla);
  });

  it('rechaza con 400 si falta algún nivel jerárquico activo', async () => {
    const { servicio, repo } = crearEntorno([], {
      niveles: NIVELES.filter((n) => n.codigo !== 'operativo_docente'),
    });
    await expect(servicio.crear(20)).rejects.toThrow(/operativo_docente/);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
```

Run: `docker compose exec -T backend npx vitest run src/modules/estructura/puestos-tipo.service.spec.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Paso 3: Implementar**

`backend/src/modules/estructura/puestos-tipo.service.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReferenciaService } from '../referencia/referencia.service.js';
import type { PuestosTipoCreadosDto } from './dto/puesto.dto.js';
import { Puesto } from './entities/puesto.entity.js';
import type { UnidadOrganizativa } from './entities/unidad-organizativa.entity.js';
import {
  DOMINIO_NIVEL_JERARQUICO,
  NIVELES_JERARQUICOS,
  TIPOS_UNIDAD,
} from './estructura.constantes.js';
import { aPuestoDto } from './puesto.mapper.js';
import {
  PUESTOS_TIPO,
  type ClavePuestoTipo,
} from './puestos-tipo.js';
import {
  enTransaccionDeEstructura,
  siguienteCodigoPuesto,
} from './transaccion.js';
import { UnidadesService } from './unidades.service.js';

const normalizar = (texto: string) => texto.trim().toLowerCase();

/** Crea de una vez los cuatro cargos de una cátedra. */
@Injectable()
export class PuestosTipoService {
  constructor(
    @InjectRepository(Puesto) private readonly puestos: Repository<Puesto>,
    private readonly unidades: UnidadesService,
    private readonly referencia: ReferenciaService,
  ) {}

  async crear(idUnidad: number): Promise<PuestosTipoCreadosDto> {
    const unidad = await this.unidades.exigirActiva(idUnidad);
    if (unidad.tipo.codigo !== TIPOS_UNIDAD.catedra) {
      throw new BadRequestException(
        'Los puestos tipo se crean solo en cátedras',
      );
    }
    const niveles = await this.idsDeNiveles();

    return enTransaccionDeEstructura(this.puestos, async (manager) => {
      const repo = manager.getRepository(Puesto);

      const activos = await repo.find({ where: { idUnidad, activo: true } });
      const repetidos = PUESTOS_TIPO.filter((tipo) =>
        activos.some(
          (p) => normalizar(p.denominacion) === normalizar(tipo.denominacion),
        ),
      );
      if (repetidos.length > 0) {
        throw new ConflictException(
          `La cátedra ya tiene: ${repetidos.map((r) => r.denominacion).join(', ')}`,
        );
      }

      const advertencias: string[] = [];
      const idJefatura = await this.jefaturaDelDepartamento(
        repo,
        unidad,
        niveles[NIVELES_JERARQUICOS.conduccionDepartamento],
        advertencias,
      );

      const creados = new Map<ClavePuestoTipo, Puesto>();
      for (const tipo of PUESTOS_TIPO) {
        const idSuperior =
          tipo.superior === null
            ? idJefatura
            : (creados.get(tipo.superior) as Puesto).id;
        creados.set(
          tipo.clave,
          await repo.save(
            repo.create({
              codigo: await siguienteCodigoPuesto(manager),
              denominacion: tipo.denominacion,
              proposito: null,
              condicionesTrabajo: null,
              rangoRetributivo: null,
              dotacionPrevista: 1,
              idUnidad,
              idNivelJerarquico: niveles[tipo.nivel],
              idTipoRelacionContractual: null,
              idPuestoSuperior: idSuperior,
              activo: true,
            }),
          ),
        );
      }
      return {
        puestos: PUESTOS_TIPO.map((t) =>
          aPuestoDto(creados.get(t.clave) as Puesto),
        ),
        advertencias,
      };
    });
  }

  /** Ids de los niveles activos que usan los puestos tipo y la jefatura. */
  private async idsDeNiveles(): Promise<Record<string, number>> {
    const valores = await this.referencia.listarValores(
      DOMINIO_NIVEL_JERARQUICO,
    );
    const porCodigo = Object.fromEntries(valores.map((v) => [v.codigo, v.id]));
    const requeridos = new Set<string>([
      NIVELES_JERARQUICOS.conduccionDepartamento,
      ...PUESTOS_TIPO.map((t) => t.nivel),
    ]);
    const faltan = [...requeridos].filter((codigo) => !(codigo in porCodigo));
    if (faltan.length > 0) {
      throw new BadRequestException(
        `Faltan niveles jerárquicos activos: ${faltan.join(', ')}`,
      );
    }
    return porCodigo;
  }

  /** Único puesto activo de nivel `conduccion_departamento` en el departamento. */
  private async jefaturaDelDepartamento(
    repo: Repository<Puesto>,
    catedra: UnidadOrganizativa,
    idNivelJefatura: number,
    advertencias: string[],
  ): Promise<number | null> {
    const jefaturas =
      catedra.idUnidadSuperior === null
        ? []
        : await repo.find({
            where: {
              idUnidad: catedra.idUnidadSuperior,
              idNivelJerarquico: idNivelJefatura,
              activo: true,
            },
          });
    if (jefaturas.length === 1) return jefaturas[0].id;
    advertencias.push(
      jefaturas.length === 0
        ? 'No hay un puesto activo de jefatura de departamento: el jefe de cátedra se creó sin superior'
        : 'Hay más de un puesto activo de jefatura de departamento: el jefe de cátedra se creó sin superior',
    );
    return null;
  }
}
```

- [ ] **Paso 4: Verificar, lint y commit**

```bash
docker compose exec -T backend npx vitest run src/modules/estructura
docker compose exec -T backend npm run lint
docker compose exec -T backend npm run format
git add backend/src/modules/estructura
git commit -m "Agregar la creación de los cuatro puestos tipo de una cátedra"
```

Expected: PASS.

---

### Tarea 8: Controllers, módulo y prueba de punta a punta

**Archivos:**
- Crear: `backend/src/modules/estructura/unidades.controller.ts`, `puestos.controller.ts`
- Modificar: `backend/src/modules/estructura/estructura.module.ts`

**Interfaces:**
- Consume: `UnidadesService`, `PuestosService`, `PuestosTipoService`, DTOs.
- Produce: endpoints `GET /api/unidades`, `GET /api/unidades/arbol`, `GET /api/unidades/:id`, `POST /api/unidades/:id/puestos-tipo`, `GET /api/puestos`, `GET /api/puestos/:id`, `POST /api/puestos`, `PATCH /api/puestos/:id`, `POST /api/puestos/:id/baja`, `POST /api/puestos/:id/reactivar`. `EstructuraModule` exporta `UnidadesService`.

- [ ] **Paso 1: Controller de unidades**

`backend/src/modules/estructura/unidades.controller.ts`:

```ts
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ROLES, TODOS_LOS_ROLES } from '../../common/roles.js';
import { PuestosTipoCreadosDto } from './dto/puesto.dto.js';
import {
  UnidadArbolDto,
  UnidadDetalleDto,
  UnidadDto,
} from './dto/unidad.dto.js';
import { PuestosTipoService } from './puestos-tipo.service.js';
import { UnidadesService } from './unidades.service.js';

/** Unidades organizativas (RF01): solo consulta; las carga el DBA. */
@ApiTags('estructura')
@Controller('unidades')
export class UnidadesController {
  constructor(
    private readonly unidades: UnidadesService,
    private readonly puestosTipo: PuestosTipoService,
  ) {}

  @Get()
  @Roles(...TODOS_LOS_ROLES)
  @ApiQuery({ name: 'incluirInactivas', required: false, type: Boolean })
  @ApiOkResponse({ type: UnidadDto, isArray: true })
  listar(
    @Query('incluirInactivas') incluirInactivas?: string,
  ): Promise<UnidadDto[]> {
    return this.unidades.listar(incluirInactivas === 'true');
  }

  // Va antes de ':id' para que "arbol" no se tome como identificador.
  @Get('arbol')
  @Roles(...TODOS_LOS_ROLES)
  @ApiQuery({ name: 'incluirInactivas', required: false, type: Boolean })
  @ApiOkResponse({ type: UnidadArbolDto, isArray: true })
  arbol(
    @Query('incluirInactivas') incluirInactivas?: string,
  ): Promise<UnidadArbolDto[]> {
    return this.unidades.arbol(incluirInactivas === 'true');
  }

  @Get(':id')
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: UnidadDetalleDto })
  @ApiNotFoundResponse({ description: 'La unidad no existe' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<UnidadDetalleDto> {
    return this.unidades.obtener(id);
  }

  @Post(':id/puestos-tipo')
  @Roles(ROLES.analistaPuestos)
  @ApiCreatedResponse({ type: PuestosTipoCreadosDto })
  @ApiBadRequestResponse({ description: 'La unidad no es una cátedra activa' })
  @ApiNotFoundResponse({ description: 'La unidad no existe' })
  @ApiConflictResponse({ description: 'La cátedra ya tiene alguno de los cargos' })
  crearPuestosTipo(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PuestosTipoCreadosDto> {
    return this.puestosTipo.crear(id);
  }
}
```

- [ ] **Paso 2: Controller de puestos**

`backend/src/modules/estructura/puestos.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ROLES, TODOS_LOS_ROLES } from '../../common/roles.js';
import { ActualizarPuestoDto } from './dto/actualizar-puesto.dto.js';
import { CrearPuestoDto } from './dto/crear-puesto.dto.js';
import { FiltroPuestosDto } from './dto/filtro-puestos.dto.js';
import { PuestoDetalleDto, PuestoDto } from './dto/puesto.dto.js';
import { PuestosService } from './puestos.service.js';

/** Inventario de puestos (RF02). */
@ApiTags('estructura')
@Controller('puestos')
export class PuestosController {
  constructor(private readonly servicio: PuestosService) {}

  @Get()
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: PuestoDto, isArray: true })
  listar(@Query() filtro: FiltroPuestosDto): Promise<PuestoDto[]> {
    return this.servicio.listar(filtro);
  }

  @Get(':id')
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: PuestoDetalleDto })
  @ApiNotFoundResponse({ description: 'El puesto no existe' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<PuestoDetalleDto> {
    return this.servicio.obtener(id);
  }

  @Post()
  @Roles(ROLES.analistaPuestos)
  @ApiCreatedResponse({ type: PuestoDetalleDto })
  @ApiBadRequestResponse({ description: 'Unidad, nivel o superior inválidos' })
  @ApiConflictResponse({ description: 'Denominación repetida en la unidad' })
  crear(@Body() dto: CrearPuestoDto): Promise<PuestoDetalleDto> {
    return this.servicio.crear(dto);
  }

  @Patch(':id')
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: PuestoDetalleDto })
  @ApiNotFoundResponse({ description: 'El puesto no existe' })
  @ApiBadRequestResponse({ description: 'Superior inválido o ciclo' })
  @ApiConflictResponse({ description: 'Denominación repetida en la unidad' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPuestoDto,
  ): Promise<PuestoDetalleDto> {
    return this.servicio.actualizar(id, dto);
  }

  @Post(':id/baja')
  @HttpCode(200)
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: PuestoDetalleDto })
  @ApiNotFoundResponse({ description: 'El puesto no existe' })
  @ApiConflictResponse({ description: 'Tiene subordinados activos' })
  darDeBaja(@Param('id', ParseIntPipe) id: number): Promise<PuestoDetalleDto> {
    return this.servicio.darDeBaja(id);
  }

  @Post(':id/reactivar')
  @HttpCode(200)
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: PuestoDetalleDto })
  @ApiNotFoundResponse({ description: 'El puesto no existe' })
  @ApiConflictResponse({ description: 'La unidad o el superior están inactivos' })
  reactivar(@Param('id', ParseIntPipe) id: number): Promise<PuestoDetalleDto> {
    return this.servicio.reactivar(id);
  }
}
```

- [ ] **Paso 3: Módulo**

`backend/src/modules/estructura/estructura.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferenciaModule } from '../referencia/referencia.module.js';
import { Puesto } from './entities/puesto.entity.js';
import { UnidadOrganizativa } from './entities/unidad-organizativa.entity.js';
import { JerarquiaService } from './jerarquia.service.js';
import { PuestosController } from './puestos.controller.js';
import { PuestosTipoService } from './puestos-tipo.service.js';
import { PuestosService } from './puestos.service.js';
import { UnidadesController } from './unidades.controller.js';
import { UnidadesService } from './unidades.service.js';

/**
 * Estructura y descripción de puestos (RF01–RF05). Por ahora: unidades
 * (solo consulta) y puestos (RF01, RF02). Funciones, tareas, responsabilidades,
 * estándares, riesgos, relaciones y relevamiento vendrán en bloques posteriores.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UnidadOrganizativa, Puesto]),
    ReferenciaModule,
  ],
  controllers: [UnidadesController, PuestosController],
  providers: [
    UnidadesService,
    JerarquiaService,
    PuestosService,
    PuestosTipoService,
  ],
  exports: [UnidadesService],
})
export class EstructuraModule {}
```

- [ ] **Paso 4: Verificar compilación y la cobertura de `@Roles`**

```bash
docker compose exec -T backend npm run build
docker compose exec -T backend npm test
```

Expected: build sin errores; `cobertura-roles.spec.ts` incluye `unidades.controller.ts` y `puestos.controller.ts` y pasa.

- [ ] **Paso 5: Prueba de punta a punta con curl**

```bash
docker compose up -d --build
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backend/scripts/catedras-ejemplo.sql
source .env
ADMIN=$(mktemp); ANA=$(mktemp)
curl -s -c "$ADMIN" -H 'Content-Type: application/json' -d "{\"nombreUsuario\":\"$ADMIN_USUARIO\",\"clave\":\"$ADMIN_CLAVE\"}" http://localhost:3000/api/auth/login
curl -s -b "$ADMIN" -H 'Content-Type: application/json' -d '{"nombreUsuario":"ana.analista","clave":"clave-larga-123","rol":"analista_puestos"}' http://localhost:3000/api/usuarios
curl -s -c "$ANA" -H 'Content-Type: application/json' -d '{"nombreUsuario":"ana.analista","clave":"clave-larga-123"}' http://localhost:3000/api/auth/login
curl -s -b "$ANA" http://localhost:3000/api/unidades/arbol
```

Expected: el árbol muestra "Departamento de Sistemas" con tres cátedras en `hijas`. Tomar de ahí el `id` de una cátedra (`CAT`) y el del departamento (`DEP`), luego:

```bash
curl -s -b "$ANA" -H 'Content-Type: application/json' -d '{"denominacion":"Jefatura de Departamento","idUnidad":'$DEP',"idNivelJerarquico":1}' http://localhost:3000/api/puestos
curl -s -b "$ANA" -X POST http://localhost:3000/api/unidades/$CAT/puestos-tipo
curl -s -b "$ANA" -X POST http://localhost:3000/api/unidades/$CAT/puestos-tipo
curl -s -b "$ADMIN" -H 'Content-Type: application/json' -d '{"denominacion":"x","idUnidad":'$CAT',"idNivelJerarquico":1}' http://localhost:3000/api/puestos
curl -s -b "$ANA" -X PATCH -H 'Content-Type: application/json' -d '{"idUnidad":1}' http://localhost:3000/api/puestos/2
```

Expected, en orden: puesto `P-0001` creado (el `idNivelJerarquico` 1 es `conduccion_departamento`); cuatro puestos tipo `P-0002` a `P-0005`, con el jefe de cátedra bajo `P-0001`; el segundo `puestos-tipo` responde 409 ("La cátedra ya tiene…"); el `POST` del administrador responde 403; el `PATCH` con `idUnidad` responde 400 ("property idUnidad should not exist").

- [ ] **Paso 6: Lint, formato y commit**

```bash
docker compose exec -T backend npm run lint
docker compose exec -T backend npm run format
git add backend/src/modules/estructura
git commit -m "Exponer unidades y puestos por la API"
```

---

### Tarea 9: Unidades asignadas a usuarios y clave foránea de `usuario_unidad`

**Archivos:**
- Modificar: `backend/src/modules/usuarios/entities/usuario-unidad.entity.ts`, `usuarios.service.ts`, `usuarios.service.spec.ts`, `usuarios.module.ts`
- Crear: `backend/src/modules/usuarios/alcance.service.int.spec.ts`, `backend/src/infra/database/fk-usuario-unidad.int.spec.ts`
- Crear (generada y editada): `backend/src/infra/database/migrations/<timestamp>-AgregarFkUsuarioUnidad.ts`

**Interfaces:**
- Consume: `UnidadesService.buscarPorIds(ids): Promise<UnidadOrganizativa[]>` (cada una con `tipo.codigo`), `TIPOS_UNIDAD`.
- Produce: `UsuariosService` con constructor `(usuarios, roles, passwords, sesiones, unidadesEstructura: UnidadesService)`; FK `usuario_unidad.id_unidad → unidad_organizativa.id_unidad`.

- [ ] **Paso 1: Actualizar `usuarios.service.spec.ts`**

En `crearServicio`, agregar antes del `return` final las unidades simuladas y pasarlas al constructor. Después de `const sesiones = { cerrarDe: ... };` insertar:

```ts
  const catedra = (id: number, denominacion: string, activo = true) => ({
    id,
    denominacion,
    activo,
    tipo: { codigo: 'catedra' },
  });
  const unidadesFake = [
    catedra(1, 'Cátedra A'),
    catedra(2, 'Cátedra B'),
    catedra(3, 'Cátedra inactiva', false),
    catedra(4, 'Cátedra C'),
    {
      id: 5,
      denominacion: 'Departamento de Sistemas',
      activo: true,
      tipo: { codigo: 'departamento' },
    },
  ];
  const unidadesEstructura = {
    buscarPorIds: vi.fn(async (ids: number[]) =>
      unidadesFake.filter((u) => ids.includes(u.id)),
    ),
  };
```

y reemplazar el `return { servicio: new UsuariosService(...), ... }` por:

```ts
  return {
    servicio: new UsuariosService(
      usuarios,
      rolesRepo,
      new PasswordService(),
      sesiones as unknown as SesionesService,
      unidadesEstructura as unknown as UnidadesService,
    ),
    usuarios,
    sesiones,
    consultas,
    unidadesEstructura,
  };
```

Agregar el import `import type { UnidadesService } from '../estructura/unidades.service.js';` junto a los otros. Dentro de `describe('UsuariosService.crear', ...)`, después del test `solo admite unidades para jefatura y jefe de cátedra`, agregar:

```ts
  it('rechaza una unidad inexistente', async () => {
    const { servicio } = crearServicio([]);
    await expect(
      servicio.crear({ ...base, rol: 'jefe_catedra', idUnidades: [99] }),
    ).rejects.toThrow(/La unidad 99 no existe/);
  });

  it('rechaza una unidad inactiva', async () => {
    const { servicio } = crearServicio([]);
    await expect(
      servicio.crear({ ...base, rol: 'jefe_catedra', idUnidades: [3] }),
    ).rejects.toThrow(/inactiva/);
  });

  it('el jefe de cátedra solo admite cátedras', async () => {
    const { servicio } = crearServicio([]);
    await expect(
      servicio.crear({ ...base, rol: 'jefe_catedra', idUnidades: [5] }),
    ).rejects.toThrow(/solo admite/);
  });

  it('la jefatura de departamento solo admite departamentos', async () => {
    const { servicio } = crearServicio([]);
    await expect(
      servicio.crear({ ...base, rol: 'jefatura_departamento', idUnidades: [1] }),
    ).rejects.toThrow(/solo admite/);
    const dto = await servicio.crear({
      ...base,
      rol: 'jefatura_departamento',
      idUnidades: [5],
    });
    expect(dto.idUnidades).toEqual([5]);
  });

  it('no consulta las unidades si no se asigna ninguna', async () => {
    const { servicio, unidadesEstructura } = crearServicio([]);
    await servicio.crear({ ...base, rol: 'recursos_humanos' });
    expect(unidadesEstructura.buscarPorIds).not.toHaveBeenCalled();
  });
```

Dentro de `describe('UsuariosService.actualizar', ...)`, después de `modifica el rol y las unidades`:

```ts
  it('rechaza asignar una unidad inactiva al modificar', async () => {
    const { servicio } = crearServicio([usuario({ id: 2, nombreUsuario: 'bea', rolCodigo: 'jefe_catedra' })]);
    await expect(servicio.actualizar(2, { idUnidades: [3] })).rejects.toThrow(/inactiva/);
  });

  it('revalida las unidades actuales cuando cambia el rol', async () => {
    const { servicio } = crearServicio([
      usuario({
        id: 2,
        nombreUsuario: 'bea',
        rolCodigo: 'jefe_catedra',
        unidades: [{ idUsuario: 2, idUnidad: 1 } as never],
      }),
    ]);
    await expect(
      servicio.actualizar(2, { rol: 'jefatura_departamento' }),
    ).rejects.toThrow(/solo admite/);
  });

  it('no consulta las unidades si solo cambia otro dato', async () => {
    const { servicio, unidadesEstructura } = crearServicio([
      usuario({ id: 2, nombreUsuario: 'bea' }),
    ]);
    await servicio.actualizar(2, { activo: false });
    expect(unidadesEstructura.buscarPorIds).not.toHaveBeenCalled();
  });
```

Run: `docker compose exec -T backend npx vitest run src/modules/usuarios/usuarios.service.spec.ts`
Expected: FAIL (el constructor y la validación todavía no existen).

- [ ] **Paso 2: Implementar la validación en `UsuariosService`**

En `usuarios.service.ts`: agregar los imports

```ts
import { TIPOS_UNIDAD } from '../estructura/estructura.constantes.js';
import { UnidadesService } from '../estructura/unidades.service.js';
```

agregar el parámetro al constructor: `private readonly unidadesEstructura: UnidadesService,` (después de `sesiones`). En `crear`, justo después de `this.validarReglasDeRol(dto.rol, idPersona, dto.idUnidades ?? []);` agregar `await this.validarUnidades(dto.rol, dto.idUnidades ?? []);`. En `actualizar`, justo después de `this.validarReglasDeRol(rolFinal, idPersonaFinal, unidadesFinales);` agregar:

```ts
    if (dto.idUnidades !== undefined || dto.rol !== undefined) {
      await this.validarUnidades(rolFinal, unidadesFinales);
    }
```

y agregar el método privado después de `validarReglasDeRol`:

```ts
  /**
   * Cada unidad debe existir, estar activa y ser del tipo que corresponde al rol:
   * cátedras para el jefe de cátedra, departamento para la jefatura.
   */
  private async validarUnidades(
    rol: CodigoRol,
    idUnidades: number[],
  ): Promise<void> {
    if (idUnidades.length === 0) return;
    const tipoEsperado =
      rol === ROLES.jefeCatedra
        ? TIPOS_UNIDAD.catedra
        : TIPOS_UNIDAD.departamento;
    const encontradas = new Map(
      (await this.unidadesEstructura.buscarPorIds(idUnidades)).map((u) => [
        u.id,
        u,
      ]),
    );
    for (const id of idUnidades) {
      const unidad = encontradas.get(id);
      if (!unidad) throw new BadRequestException(`La unidad ${id} no existe`);
      if (!unidad.activo) {
        throw new BadRequestException(
          `La unidad "${unidad.denominacion}" está inactiva`,
        );
      }
      if (unidad.tipo.codigo !== tipoEsperado) {
        throw new BadRequestException(
          `La unidad "${unidad.denominacion}" no es de tipo ${tipoEsperado}: el rol ${rol} solo admite unidades de ese tipo`,
        );
      }
    }
  }
```

En `usuarios.module.ts` agregar `import { EstructuraModule } from '../estructura/estructura.module.js';` y sumar `EstructuraModule` al arreglo `imports` (después de `TypeOrmModule.forFeature(...)`).

Run: `docker compose exec -T backend npx vitest run src/modules/usuarios`
Expected: PASS.

- [ ] **Paso 3: Test de integración de la FK (con unidades huérfanas)**

`backend/src/infra/database/fk-usuario-unidad.int.spec.ts`:

```ts
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';

describe('FK usuario_unidad → unidad_organizativa', () => {
  let base: BaseTemporal | undefined;
  afterEach(async () => {
    await base?.destruir();
    base = undefined;
  });

  const crearUsuario = async (b: BaseTemporal) =>
    (
      await b.dataSource.query(
        `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol)
         SELECT 'jefe', 'x', id_rol FROM rol WHERE codigo = 'jefe_catedra'
         RETURNING id_usuario AS id`,
      )
    )[0].id as number;

  it('la migración aborta y lista las unidades inexistentes', async () => {
    base = await crearBaseTemporal({ sin: ['AgregarFkUsuarioUnidad'] });
    const idUsuario = await crearUsuario(base);
    await base.dataSource.query(
      'INSERT INTO usuario_unidad (id_usuario, id_unidad) VALUES ($1, 999), ($1, 998)',
      [idUsuario],
    );
    await expect(base.aplicarTodas()).rejects.toThrow(/998, 999/);
  });

  it('con la FK aplicada, no se puede asignar una unidad inexistente', async () => {
    base = await crearBaseTemporal();
    const idUsuario = await crearUsuario(base);
    await expect(
      base.dataSource.query(
        'INSERT INTO usuario_unidad (id_usuario, id_unidad) VALUES ($1, 999)',
        [idUsuario],
      ),
    ).rejects.toThrow(/foreign key|viola la llave/i);
  });

  it('no se puede borrar una unidad asignada a un usuario', async () => {
    base = await crearBaseTemporal();
    const idUsuario = await crearUsuario(base);
    const [{ id }] = await base.dataSource.query(
      `SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
    );
    await base.dataSource.query(
      'INSERT INTO usuario_unidad (id_usuario, id_unidad) VALUES ($1, $2)',
      [idUsuario, id],
    );
    await expect(
      base.dataSource.query('DELETE FROM unidad_organizativa WHERE id_unidad = $1', [id]),
    ).rejects.toThrow(/foreign key|viola la llave/i);
  });
});
```

Run: `docker compose exec -T backend npx vitest run --config vitest.integracion.config.ts src/infra/database/fk-usuario-unidad.int.spec.ts`
Expected: FAIL (el primer test no encuentra la migración `AgregarFkUsuarioUnidad`, así que no hay nada que aplicar y no rechaza).

- [ ] **Paso 4: Test de integración de `AlcanceService` con la base real**

`backend/src/modules/usuarios/alcance.service.int.spec.ts`:

```ts
import { ForbiddenException } from '@nestjs/common';
import type { CodigoRol } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { AlcanceService } from './alcance.service.js';

const sesion = (rol: CodigoRol, unidades: number[] = []): SesionUsuario => ({
  id: 1,
  nombreUsuario: 'u',
  rol,
  idPersona: null,
  unidades,
});

describe('AlcanceService (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let servicio: AlcanceService;
  let departamento: number;
  let otroDepartamento: number;
  let catedraA: number;
  let catedraB: number;
  let catedraDelOtro: number;

  const unidad = async (denominacion: string, tipo: string, superior: number | null) =>
    (
      await base.dataSource.query(
        `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
         SELECT $1, id_tipo_unidad, $3 FROM tipo_unidad WHERE codigo = $2
         RETURNING id_unidad AS id`,
        [denominacion, tipo, superior],
      )
    )[0].id as number;

  beforeAll(async () => {
    base = await crearBaseTemporal();
    servicio = new AlcanceService(base.dataSource);
    departamento = (
      await base.dataSource.query(
        `SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
      )
    )[0].id;
    otroDepartamento = await unidad('Otro departamento', 'departamento', null);
    catedraA = await unidad('Cátedra A', 'catedra', departamento);
    catedraB = await unidad('Cátedra B', 'catedra', departamento);
    catedraDelOtro = await unidad('Cátedra X', 'catedra', otroDepartamento);
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('la jefatura ve su departamento y sus cátedras, no las de otro departamento', async () => {
    const visibles = await servicio.unidadesVisibles(
      sesion('jefatura_departamento', [departamento]),
    );
    expect(visibles?.sort()).toEqual([departamento, catedraA, catedraB].sort());
    expect(visibles).not.toContain(catedraDelOtro);
  });

  it('el jefe de cátedra ve solo su cátedra', async () => {
    expect(await servicio.unidadesVisibles(sesion('jefe_catedra', [catedraA]))).toEqual([
      catedraA,
    ]);
  });

  it('un jefe sin unidades asignadas no ve ninguna', async () => {
    expect(await servicio.unidadesVisibles(sesion('jefe_catedra'))).toEqual([]);
  });

  it('los roles globales no tienen restricción', async () => {
    expect(await servicio.unidadesVisibles(sesion('recursos_humanos'))).toBeNull();
  });

  it('exigirUnidad rechaza con 403 una unidad fuera del alcance', async () => {
    await expect(
      servicio.exigirUnidad(sesion('jefe_catedra', [catedraA]), catedraB),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      servicio.exigirUnidad(sesion('jefe_catedra', [catedraA]), catedraA),
    ).resolves.toBeUndefined();
  });
});
```

Run: `docker compose exec -T backend npx vitest run --config vitest.integracion.config.ts src/modules/usuarios/alcance.service.int.spec.ts`
Expected: PASS (la consulta recursiva ya existe y las tablas también).

- [ ] **Paso 5: Relación en la entidad y migración de la FK**

En `usuario-unidad.entity.ts`: reemplazar el comentario de `idUnidad` por `/** Unidad a cargo; ver la clave foránea hacia `unidad_organizativa`. */`, agregar los imports `import { UnidadOrganizativa } from '../../estructura/entities/unidad-organizativa.entity.js';` y, después de la relación `usuario`, agregar:

```ts
  @ManyToOne(() => UnidadOrganizativa, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_unidad' })
  unidad: Relation<UnidadOrganizativa>;
```

Generar la migración:

```bash
docker compose exec -T backend npm run migration:run
docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/AgregarFkUsuarioUnidad
```

Revisar que `up` solo agregue la `FOREIGN KEY` de `usuario_unidad.id_unidad` hacia `unidad_organizativa(id_unidad)` y `down` la elimine. Al principio de `up` agregar:

```ts
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
```

- [ ] **Paso 6: Verificar todo**

```bash
docker compose exec -T backend npm run migration:run
docker compose exec -T backend npm run migration:revert
docker compose exec -T backend npm run migration:run
docker compose exec -T backend npm test
docker compose exec -T backend npm run test:integracion
```

Expected: todo PASS (el test de la FK ahora aborta con `998, 999`).

- [ ] **Paso 7: Lint, formato y commit**

```bash
docker compose exec -T backend npm run lint
docker compose exec -T backend npm run format
git add backend/src
git commit -m "Validar las unidades de los usuarios y agregar la clave foránea de usuario_unidad"
```

---

### Tarea 10: Frontend: estructura y puestos

**Archivos:**
- Modificar: `frontend/src/api/esquema.d.ts` (regenerado), `frontend/src/auth/permisos.ts`, `frontend/src/features/estructura/pages/EstructuraPage.tsx`
- Crear: `frontend/src/features/estructura/hooks/useUnidades.ts`, `hooks/usePuestos.ts`, `components/ArbolUnidades.tsx`, `components/TablaPuestos.tsx`, `components/FormularioPuesto.tsx`, `components/arbol.ts`
- Eliminar: `frontend/src/features/estructura/components/.gitkeep`, `hooks/.gitkeep`

**Interfaces:**
- Consume: endpoints de la Tarea 8; `mensajeError` de `features/admin/hooks/useGuardarValor`; `useValoresReferencia(dominio, incluirInactivos)` de `features/admin/hooks/useValoresReferencia`; `useSesion`.
- Produce: `useArbolUnidades(incluirInactivas)`, `useUnidades()` (lista plana), `usePuestos(filtro)`, `useCrearPuesto()`, `useActualizarPuesto()`, `useCambiarEstadoPuesto()`, `useCrearPuestosTipo()`; helper `unidadesHastaRaiz(arbol, idUnidad): number[]`.

- [ ] **Paso 1: Regenerar los tipos y ajustar el menú**

```bash
docker compose up -d --build
cd frontend && npm run api:tipos && cd ..
git diff --stat frontend/src/api/esquema.d.ts
```

Expected: `esquema.d.ts` incluye `UnidadArbolDto`, `PuestoDto`, `PuestoDetalleDto`, `CrearPuestoDto`, `ActualizarPuestoDto`, `PuestosTipoCreadosDto` y las rutas `/api/unidades/arbol`, `/api/puestos`, etc.

En `frontend/src/auth/permisos.ts`, la sección de estructura queda visible para todos los roles (la estructura no es sensible):

```ts
  {
    ruta: '/estructura',
    nombre: 'Estructura y puestos',
  },
```

- [ ] **Paso 2: Hooks de unidades**

`frontend/src/features/estructura/hooks/useUnidades.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';

export type UnidadArbol = Esquemas['UnidadArbolDto'];
export type Unidad = Esquemas['UnidadDto'];

export function useArbolUnidades(incluirInactivas: boolean) {
  return useQuery({
    queryKey: ['unidades', 'arbol', incluirInactivas],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/unidades/arbol', {
        params: { query: { incluirInactivas } },
      });
      if (error || !data) throw new Error('No se pudo cargar la estructura');
      return data;
    },
  });
}

/** Lista plana de unidades activas (selectores). */
export function useUnidades() {
  return useQuery({
    queryKey: ['unidades', 'lista'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/unidades');
      if (error || !data) throw new Error('No se pudieron cargar las unidades');
      return data;
    },
  });
}
```

- [ ] **Paso 3: Hooks de puestos**

`frontend/src/features/estructura/hooks/usePuestos.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';

export type Puesto = Esquemas['PuestoDto'];
export type PuestoDetalle = Esquemas['PuestoDetalleDto'];
type CrearPuesto = Esquemas['CrearPuestoDto'];
type ActualizarPuesto = Esquemas['ActualizarPuestoDto'];

/** Los puestos de toda la estructura; el volumen es chico y se filtra en la pantalla. */
export function usePuestos() {
  return useQuery({
    queryKey: ['puestos'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/puestos');
      if (error || !data) throw new Error('No se pudieron cargar los puestos');
      return data;
    },
  });
}

function useInvalidar() {
  const cliente = useQueryClient();
  return () => {
    cliente.invalidateQueries({ queryKey: ['puestos'] });
    cliente.invalidateQueries({ queryKey: ['unidades'] });
  };
}

export function useCrearPuesto() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (cuerpo: CrearPuesto) => {
      const { data, error } = await api.POST('/api/puestos', { body: cuerpo });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useActualizarPuesto() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: { id: number; cuerpo: ActualizarPuesto }) => {
      const { data, error } = await api.PATCH('/api/puestos/{id}', {
        params: { path: { id: args.id } },
        body: args.cuerpo,
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useCambiarEstadoPuesto() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: { id: number; accion: 'baja' | 'reactivar' }) => {
      const { data, error } =
        args.accion === 'baja'
          ? await api.POST('/api/puestos/{id}/baja', {
              params: { path: { id: args.id } },
            })
          : await api.POST('/api/puestos/{id}/reactivar', {
              params: { path: { id: args.id } },
            });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useCrearPuestosTipo() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (idUnidad: number) => {
      const { data, error } = await api.POST('/api/unidades/{id}/puestos-tipo', {
        params: { path: { id: idUnidad } },
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}
```

- [ ] **Paso 4: Utilidades del árbol y de los superiores válidos**

`frontend/src/features/estructura/components/arbol.ts`:

```ts
import type { UnidadArbol } from '../hooks/useUnidades';
import type { Puesto } from '../hooks/usePuestos';

/** La unidad y todas sus ancestras, o [] si no está en el árbol. */
export function unidadesHastaRaiz(
  arbol: UnidadArbol[],
  idUnidad: number,
  ruta: number[] = [],
): number[] {
  for (const unidad of arbol) {
    const actual = [unidad.id, ...ruta];
    if (unidad.id === idUnidad) return actual;
    const dentro = unidadesHastaRaiz(unidad.hijas, idUnidad, actual);
    if (dentro.length > 0) return dentro;
  }
  return [];
}

export function buscarUnidad(
  arbol: UnidadArbol[],
  idUnidad: number,
): UnidadArbol | undefined {
  for (const unidad of arbol) {
    if (unidad.id === idUnidad) return unidad;
    const dentro = buscarUnidad(unidad.hijas, idUnidad);
    if (dentro) return dentro;
  }
  return undefined;
}

/**
 * Puestos que pueden ser superior de un puesto de la unidad `idUnidad`: activos,
 * de esa unidad o de una ancestra, y sin el propio puesto ni sus subordinados.
 */
export function superioresValidos(
  todos: Puesto[],
  actual: Puesto | undefined,
  unidadesValidas: number[],
): Puesto[] {
  const excluidos = new Set<number>();
  if (actual) {
    excluidos.add(actual.id);
    let crecio = true;
    while (crecio) {
      crecio = false;
      for (const p of todos) {
        if (
          p.idPuestoSuperior !== null &&
          excluidos.has(p.idPuestoSuperior) &&
          !excluidos.has(p.id)
        ) {
          excluidos.add(p.id);
          crecio = true;
        }
      }
    }
  }
  return todos.filter(
    (p) => p.activo && unidadesValidas.includes(p.idUnidad) && !excluidos.has(p.id),
  );
}
```

- [ ] **Paso 5: Árbol de unidades**

`frontend/src/features/estructura/components/ArbolUnidades.tsx`:

```tsx
import {
  Alert,
  CircularProgress,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Switch,
} from '@mui/material';
import { useArbolUnidades, type UnidadArbol } from '../hooks/useUnidades';

interface Props {
  seleccionada?: number;
  incluirInactivas: boolean;
  onAlternarInactivas: (valor: boolean) => void;
  onElegir: (unidad: UnidadArbol) => void;
}

function Nodo({
  unidad,
  nivel,
  seleccionada,
  onElegir,
}: {
  unidad: UnidadArbol;
  nivel: number;
  seleccionada?: number;
  onElegir: (unidad: UnidadArbol) => void;
}) {
  return (
    <>
      <ListItemButton
        selected={unidad.id === seleccionada}
        onClick={() => onElegir(unidad)}
        sx={{ pl: 2 + nivel * 3 }}
      >
        <ListItemText
          primary={unidad.denominacion}
          secondary={unidad.activo ? undefined : 'Inactiva'}
        />
      </ListItemButton>
      {unidad.hijas.map((hija) => (
        <Nodo
          key={hija.id}
          unidad={hija}
          nivel={nivel + 1}
          seleccionada={seleccionada}
          onElegir={onElegir}
        />
      ))}
    </>
  );
}

/** Árbol de solo lectura: las unidades las carga el DBA. */
export function ArbolUnidades({
  seleccionada,
  incluirInactivas,
  onAlternarInactivas,
  onElegir,
}: Props) {
  const { data, isLoading, isError } = useArbolUnidades(incluirInactivas);

  return (
    <Stack spacing={1}>
      <FormControlLabel
        control={
          <Switch
            checked={incluirInactivas}
            onChange={(e) => onAlternarInactivas(e.target.checked)}
          />
        }
        label="Mostrar inactivas"
      />
      {isLoading && <CircularProgress aria-label="Cargando" />}
      {isError && (
        <Alert severity="error">No se pudo cargar la estructura.</Alert>
      )}
      {data && data.length === 0 && (
        <Alert severity="info">
          No hay unidades cargadas. Las carga el DBA por SQL.
        </Alert>
      )}
      {data && (
        <List dense disablePadding>
          {data.map((unidad) => (
            <Nodo
              key={unidad.id}
              unidad={unidad}
              nivel={0}
              seleccionada={seleccionada}
              onElegir={onElegir}
            />
          ))}
        </List>
      )}
    </Stack>
  );
}
```

- [ ] **Paso 6: Formulario de puesto**

`frontend/src/features/estructura/components/FormularioPuesto.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import {
  useActualizarPuesto,
  useCrearPuesto,
  usePuestos,
  type Puesto,
} from '../hooks/usePuestos';
import { superioresValidos } from './arbol';

interface Props {
  idUnidad: number;
  /** Unidades donde puede estar el superior: la propia y sus ancestras. */
  unidadesValidas: number[];
  /** Sin puesto, el formulario crea uno nuevo. */
  puesto?: Puesto;
  onCerrar: () => void;
}

const esquema = z.object({
  denominacion: z.string().trim().min(1, 'Obligatoria').max(150, 'Hasta 150 caracteres'),
  idNivelJerarquico: z.string().min(1, 'Elegí un nivel'),
  idTipoRelacionContractual: z.string(),
  idPuestoSuperior: z.string(),
  dotacionPrevista: z.string().regex(/^[1-9]\d*$/, 'Un entero mayor o igual a 1'),
  rangoRetributivo: z.string().trim().max(100, 'Hasta 100 caracteres'),
  proposito: z.string().trim(),
  condicionesTrabajo: z.string().trim(),
});
type Datos = z.infer<typeof esquema>;

const numeroONulo = (valor: string) => (valor === '' ? null : Number(valor));
const textoONulo = (valor: string) => (valor === '' ? null : valor);

/** Se monta solo mientras está abierto, por lo que parte siempre de cero. */
export function FormularioPuesto({
  idUnidad,
  unidadesValidas,
  puesto,
  onCerrar,
}: Props) {
  const { data: niveles } = useValoresReferencia('nivel-jerarquico', false);
  const { data: contractuales } = useValoresReferencia(
    'tipo-relacion-contractual',
    false,
  );
  const { data: todos } = usePuestos();
  const crear = useCrearPuesto();
  const actualizar = useActualizarPuesto();
  const [error, setError] = useState<string>();

  const superiores = superioresValidos(todos ?? [], puesto, unidadesValidas);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      denominacion: puesto?.denominacion ?? '',
      idNivelJerarquico: puesto ? String(puesto.idNivelJerarquico) : '',
      idTipoRelacionContractual:
        puesto?.idTipoRelacionContractual != null
          ? String(puesto.idTipoRelacionContractual)
          : '',
      idPuestoSuperior:
        puesto?.idPuestoSuperior != null ? String(puesto.idPuestoSuperior) : '',
      dotacionPrevista: String(puesto?.dotacionPrevista ?? 1),
      rangoRetributivo: puesto?.rangoRetributivo ?? '',
      proposito: puesto?.proposito ?? '',
      condicionesTrabajo: puesto?.condicionesTrabajo ?? '',
    },
  });

  const guardar = handleSubmit(async (datos) => {
    setError(undefined);
    const comunes = {
      denominacion: datos.denominacion,
      idNivelJerarquico: Number(datos.idNivelJerarquico),
      idTipoRelacionContractual: numeroONulo(datos.idTipoRelacionContractual),
      idPuestoSuperior: numeroONulo(datos.idPuestoSuperior),
      dotacionPrevista: Number(datos.dotacionPrevista),
      rangoRetributivo: textoONulo(datos.rangoRetributivo),
      proposito: textoONulo(datos.proposito),
      condicionesTrabajo: textoONulo(datos.condicionesTrabajo),
    };
    try {
      if (puesto) {
        await actualizar.mutateAsync({ id: puesto.id, cuerpo: comunes });
      } else {
        await crear.mutateAsync({ ...comunes, idUnidad });
      }
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>
          {puesto ? `Editar puesto ${puesto.codigo}` : 'Nuevo puesto'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Denominación"
              {...register('denominacion')}
              error={!!errors.denominacion}
              helperText={errors.denominacion?.message}
              autoFocus
            />
            <TextField
              select
              label="Nivel jerárquico"
              defaultValue={puesto ? String(puesto.idNivelJerarquico) : ''}
              {...register('idNivelJerarquico')}
              error={!!errors.idNivelJerarquico}
              helperText={errors.idNivelJerarquico?.message}
            >
              {(niveles ?? []).map((n) => (
                <MenuItem key={n.id} value={String(n.id)}>
                  {n.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Puesto superior"
              defaultValue={
                puesto?.idPuestoSuperior != null
                  ? String(puesto.idPuestoSuperior)
                  : ''
              }
              {...register('idPuestoSuperior')}
              helperText="De esta unidad o de una unidad superior. Vacío si no tiene."
            >
              <MenuItem value="">Sin superior</MenuItem>
              {superiores.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.codigo} · {p.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Dotación prevista"
              {...register('dotacionPrevista')}
              error={!!errors.dotacionPrevista}
              helperText={errors.dotacionPrevista?.message}
            />
            <TextField
              select
              label="Relación contractual"
              defaultValue={
                puesto?.idTipoRelacionContractual != null
                  ? String(puesto.idTipoRelacionContractual)
                  : ''
              }
              {...register('idTipoRelacionContractual')}
            >
              <MenuItem value="">Sin especificar</MenuItem>
              {(contractuales ?? []).map((c) => (
                <MenuItem key={c.id} value={String(c.id)}>
                  {c.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Rango retributivo"
              {...register('rangoRetributivo')}
              error={!!errors.rangoRetributivo}
              helperText={
                errors.rangoRetributivo?.message ??
                'Texto descriptivo; no es un monto'
              }
            />
            <TextField
              label="Propósito"
              multiline
              minRows={2}
              {...register('proposito')}
            />
            <TextField
              label="Condiciones de trabajo"
              multiline
              minRows={2}
              {...register('condicionesTrabajo')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            Guardar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
```

- [ ] **Paso 7: Tabla de puestos**

`frontend/src/features/estructura/components/TablaPuestos.tsx`:

```tsx
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import {
  useCambiarEstadoPuesto,
  useCrearPuestosTipo,
  usePuestos,
  type Puesto,
} from '../hooks/usePuestos';
import type { UnidadArbol } from '../hooks/useUnidades';
import { FormularioPuesto } from './FormularioPuesto';

interface Props {
  unidad: UnidadArbol;
  unidadesValidas: number[];
  /** Solo el analista de puestos escribe. */
  puedeEditar: boolean;
}

export function TablaPuestos({ unidad, unidadesValidas, puedeEditar }: Props) {
  const { data: todos, isLoading, isError } = usePuestos();
  const { data: niveles } = useValoresReferencia('nivel-jerarquico', true);
  const cambiarEstado = useCambiarEstadoPuesto();
  const crearTipo = useCrearPuestosTipo();
  const [formulario, setFormulario] = useState<{ puesto?: Puesto } | null>(null);
  const [verBajas, setVerBajas] = useState(false);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string>();
  const [avisos, setAvisos] = useState<string[]>([]);

  if (isLoading) return <CircularProgress aria-label="Cargando" />;
  if (isError || !todos) {
    return <Alert severity="error">No se pudieron cargar los puestos.</Alert>;
  }

  const porId = new Map(todos.map((p) => [p.id, p]));
  const nombreNivel = (id: number) =>
    niveles?.find((n) => n.id === id)?.denominacion ?? String(id);
  const buscado = texto.trim().toLowerCase();
  const filas = todos.filter(
    (p) =>
      p.idUnidad === unidad.id &&
      (verBajas || p.activo) &&
      (buscado === '' ||
        p.codigo.toLowerCase().includes(buscado) ||
        p.denominacion.toLowerCase().includes(buscado)),
  );

  const alternar = async (puesto: Puesto) => {
    setError(undefined);
    try {
      await cambiarEstado.mutateAsync({
        id: puesto.id,
        accion: puesto.activo ? 'baja' : 'reactivar',
      });
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const crearPuestosTipo = async () => {
    setError(undefined);
    setAvisos([]);
    try {
      const resultado = await crearTipo.mutateAsync(unidad.id);
      setAvisos(resultado.advertencias);
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const esCatedra = unidad.tipo === 'catedra';

  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h2">
        Puestos de {unidad.denominacion}
      </Typography>
      {error && (
        <Alert severity="error" onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      {avisos.map((aviso) => (
        <Alert key={aviso} severity="warning">
          {aviso}
        </Alert>
      ))}
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <TextField
          size="small"
          label="Buscar por código o denominación"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <FormControlLabel
          control={
            <Switch
              checked={verBajas}
              onChange={(e) => setVerBajas(e.target.checked)}
            />
          }
          label="Ver dados de baja"
        />
        <span style={{ flexGrow: 1 }} />
        {puedeEditar && esCatedra && unidad.activo && (
          <Button onClick={crearPuestosTipo} disabled={crearTipo.isPending}>
            Crear puestos tipo
          </Button>
        )}
        {puedeEditar && unidad.activo && (
          <Button variant="contained" onClick={() => setFormulario({})}>
            Nuevo puesto
          </Button>
        )}
      </Stack>
      {filas.length === 0 ? (
        <Alert severity="info">Esta unidad no tiene puestos para mostrar.</Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Denominación</TableCell>
              <TableCell>Nivel</TableCell>
              <TableCell>Superior</TableCell>
              <TableCell>Estado</TableCell>
              {puedeEditar && <TableCell align="right">Acciones</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {filas.map((p) => {
              const superior =
                p.idPuestoSuperior === null ? undefined : porId.get(p.idPuestoSuperior);
              return (
                <TableRow key={p.id}>
                  <TableCell>{p.codigo}</TableCell>
                  <TableCell>{p.denominacion}</TableCell>
                  <TableCell>{nombreNivel(p.idNivelJerarquico)}</TableCell>
                  <TableCell>
                    {superior ? `${superior.codigo} · ${superior.denominacion}` : '—'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={p.activo ? 'Activo' : 'De baja'}
                      color={p.activo ? 'success' : 'default'}
                    />
                  </TableCell>
                  {puedeEditar && (
                    <TableCell align="right">
                      <Button size="small" onClick={() => setFormulario({ puesto: p })}>
                        Editar
                      </Button>
                      <Button size="small" onClick={() => alternar(p)}>
                        {p.activo ? 'Dar de baja' : 'Reactivar'}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {formulario && (
        <FormularioPuesto
          idUnidad={unidad.id}
          unidadesValidas={unidadesValidas}
          puesto={formulario.puesto}
          onCerrar={() => setFormulario(null)}
        />
      )}
    </Stack>
  );
}
```

- [ ] **Paso 8: La página**

`frontend/src/features/estructura/pages/EstructuraPage.tsx`:

```tsx
import { Alert, Box, Divider } from '@mui/material';
import { useState } from 'react';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { useSesion } from '../../../auth/useSesion';
import { buscarUnidad, unidadesHastaRaiz } from '../components/arbol';
import { ArbolUnidades } from '../components/ArbolUnidades';
import { TablaPuestos } from '../components/TablaPuestos';
import { useArbolUnidades } from '../hooks/useUnidades';

export function EstructuraPage() {
  const { data: sesion } = useSesion();
  const [incluirInactivas, setIncluirInactivas] = useState(false);
  const [idSeleccionada, setIdSeleccionada] = useState<number>();
  const { data: arbol } = useArbolUnidades(incluirInactivas);

  const seleccionada =
    arbol && idSeleccionada !== undefined
      ? buscarUnidad(arbol, idSeleccionada)
      : undefined;

  return (
    <PaginaEnConstruccion
      titulo="Estructura y puestos"
      descripcion="Unidades organizativas (solo consulta) e inventario de puestos (RF01, RF02). La descripción de cada puesto vendrá en un bloque posterior."
    >
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: '320px 1fr' },
        }}
      >
        <Box>
          <ArbolUnidades
            seleccionada={idSeleccionada}
            incluirInactivas={incluirInactivas}
            onAlternarInactivas={setIncluirInactivas}
            onElegir={(unidad) => setIdSeleccionada(unidad.id)}
          />
        </Box>
        <Box>
          <Divider sx={{ display: { md: 'none' }, mb: 2 }} />
          {seleccionada && arbol ? (
            <TablaPuestos
              key={seleccionada.id}
              unidad={seleccionada}
              unidadesValidas={unidadesHastaRaiz(arbol, seleccionada.id)}
              puedeEditar={sesion?.rol === 'analista_puestos'}
            />
          ) : (
            <Alert severity="info">Elegí una unidad para ver sus puestos.</Alert>
          )}
        </Box>
      </Box>
    </PaginaEnConstruccion>
  );
}
```

Eliminar los marcadores vacíos: `git rm frontend/src/features/estructura/components/.gitkeep frontend/src/features/estructura/hooks/.gitkeep`.

- [ ] **Paso 9: Compilar, lint y formato**

```bash
cd frontend && npm run build && npm run lint && npm run format && cd ..
```

Expected: `tsc -b` y `vite build` sin errores. Si `tsc` rechaza el tipo de `body` o de `params.query`, ajustar contra `esquema.d.ts` (no editarlo).

- [ ] **Paso 10: Escenarios de uso en el navegador**

Con `docker compose up -d` y las cátedras de ejemplo cargadas (Tarea 8, paso 5), abrir http://localhost:5173 e iniciar sesión como `ana.analista` (rol analista de puestos):

1. El menú muestra "Estructura y puestos"; el árbol lista el Departamento de Sistemas y tres cátedras, sin botones de alta ni edición de unidades.
2. Elegir el departamento → "Nuevo puesto": crear "Jefatura de Departamento" con nivel "Conducción de departamento". Aparece con código `P-xxxx`.
3. Elegir una cátedra → "Crear puestos tipo": aparecen los cuatro cargos con sus superiores; repetirlo muestra el error 409 en un `Alert`.
4. Editar el auxiliar: el selector de superior ofrece el JTP, el jefe y la jefatura del departamento, y no ofrece el propio auxiliar; editar el jefe: no ofrece sus subordinados.
5. Dar de baja el jefe de cátedra (con subordinados activos): error con la lista de subordinados. Dar de baja al auxiliar, activar "Ver dados de baja" y reactivarlo.
6. Cerrar sesión e ingresar como un usuario `recursos_humanos`: ve la estructura y los puestos pero ningún botón de escritura.

- [ ] **Paso 11: Commit**

```bash
git add frontend
git commit -m "Agregar la pantalla de estructura y puestos"
```

---

### Tarea 11: Frontend: asignar unidades a usuarios

**Archivos:**
- Modificar: `frontend/src/features/admin/components/FormularioUsuario.tsx`, `TablaUsuarios.tsx`

**Interfaces:**
- Consume: `useUnidades()` de la Tarea 10 (lista plana, con `tipo` por unidad); `Usuario.idUnidades` (ya existe en `UsuarioDto`).

- [ ] **Paso 1: Selector de unidades en el formulario**

En `FormularioUsuario.tsx`:

1. Agregar a los imports `Controller` (de `react-hook-form`) y `useWatch`, y `useUnidades` de `'../../estructura/hooks/useUnidades'`.
2. Agregar al esquema `idUnidades: z.array(z.number())`, con lo cual `crearEsquema` queda:

```ts
function crearEsquema(esAlta: boolean) {
  return z.object({
    nombreUsuario: z
      .string()
      .trim()
      .regex(
        /^[A-Za-z0-9._-]{3,50}$/,
        '3 a 50 caracteres: letras, números, punto, guion y guion bajo',
      ),
    clave: esAlta
      ? z.string().min(10, 'Al menos 10 caracteres')
      : z.string().optional(),
    rol: z.string().min(1, 'Elegí un rol'),
    idUnidades: z.array(z.number()),
  });
}
```

3. En el cuerpo del componente, cambiar el `useForm` para exponer `control` y los valores por defecto, y calcular las unidades elegibles:

```ts
  const { data: unidades } = useUnidades();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombreUsuario: usuario?.nombreUsuario ?? '',
      clave: '',
      rol: usuario?.rol ?? '',
      idUnidades: usuario?.idUnidades ?? [],
    },
  });
  const rol = useWatch({ control, name: 'rol' });
  const tipoUnidad =
    rol === 'jefe_catedra'
      ? 'catedra'
      : rol === 'jefatura_departamento'
        ? 'departamento'
        : undefined;
  const elegibles = (unidades ?? []).filter((u) => u.tipo === tipoUnidad);
```

4. En `guardar`, enviar `idUnidades` solo si el rol las admite (y `[]` si no, para que el backend no rechace unidades viejas al cambiar de rol):

```ts
  const guardar = handleSubmit(async (datos) => {
    const idUnidades = tipoUnidad ? datos.idUnidades : [];
    try {
      if (usuario) {
        await actualizar.mutateAsync({
          id: usuario.id,
          cuerpo: {
            nombreUsuario: datos.nombreUsuario,
            rol: datos.rol as never,
            idUnidades,
          },
        });
      } else {
        await crear.mutateAsync({
          nombreUsuario: datos.nombreUsuario,
          clave: datos.clave ?? '',
          rol: datos.rol as never,
          idUnidades,
        });
      }
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });
```

5. Después del `TextField` del rol, dentro del `Stack`, agregar el selector:

```tsx
            {tipoUnidad && (
              <Controller
                control={control}
                name="idUnidades"
                render={({ field }) => (
                  <TextField
                    select
                    label={
                      tipoUnidad === 'catedra' ? 'Cátedras a cargo' : 'Departamento a cargo'
                    }
                    value={field.value}
                    onChange={field.onChange}
                    slotProps={{ select: { multiple: true } }}
                    helperText={
                      elegibles.length === 0
                        ? 'No hay unidades de este tipo cargadas. Las carga el DBA.'
                        : 'Define qué unidades ve y gestiona este usuario'
                    }
                  >
                    {elegibles.map((u) => (
                      <MenuItem key={u.id} value={u.id}>
                        {u.denominacion}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            )}
```

- [ ] **Paso 2: Columna de unidades en la tabla**

En `TablaUsuarios.tsx`: importar `useUnidades` de `'../../estructura/hooks/useUnidades'`; dentro de `TablaUsuarios` agregar `const { data: unidades } = useUnidades();`; agregar la columna `<TableCell>Unidades</TableCell>` entre "Rol" y "Estado" en `TableHead`, y en cada fila, entre las celdas de rol y estado:

```tsx
              <TableCell>
                {u.idUnidades.length === 0
                  ? '—'
                  : u.idUnidades
                      .map(
                        (id) =>
                          unidades?.find((x) => x.id === id)?.denominacion ?? `#${id}`,
                      )
                      .join(', ')}
              </TableCell>
```

- [ ] **Paso 3: Compilar, lint, formato**

```bash
cd frontend && npm run build && npm run lint && npm run format && cd ..
```

Expected: sin errores.

- [ ] **Paso 4: Escenarios de uso en el navegador**

Iniciar sesión como administrador, en Administración → Usuarios:

1. "Nuevo usuario" con rol "Jefe de cátedra": aparece "Cátedras a cargo" con las tres cátedras de ejemplo. Elegir dos y guardar: la tabla muestra sus nombres.
2. Con rol "Jefatura de Departamento": aparece "Departamento a cargo" con el Departamento de Sistemas.
3. Con rol "Recursos Humanos" no aparece el selector.
4. Editar el jefe de cátedra y pasarlo a "Recursos Humanos": se guarda sin error y la tabla muestra `—` en unidades.
5. Iniciar sesión como el jefe de cátedra creado en (1): `GET /api/auth/yo` (visible en la pestaña Red del navegador) devuelve sus `unidades`.

- [ ] **Paso 5: Commit**

```bash
git add frontend
git commit -m "Permitir asignar unidades a jefes de cátedra y jefatura desde Administración"
```

---

### Tarea 12: Documentación y cierre

**Archivos:**
- Modificar: `docs/requerimientos.md`, `README.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-10-13-estructura-unidades-puestos-design.md` (Estado), este plan (Estado)

- [ ] **Paso 1: Actualizar `docs/requerimientos.md`**

En la fila de RF01 (tabla 2.1) reemplazar la fila completa por:

```md
| RF01 | Consultar las unidades organizativas (departamento y cátedras) con su jerarquía; las carga el DBA | Todos | OE1 |
```

En §5, debajo del párrafo `**Usuarios y roles:** …`, agregar:

```md
**Estructura:** `unidad_organizativa` (solo lectura para la aplicación, cargada por el DBA) y `puesto`; ver `docs/superpowers/specs/2026-10-13-estructura-unidades-puestos-design.md`. Suma tres dominios de referencia (`tipo_unidad`, `nivel_jerarquico`, `tipo_relacion_contractual`) a los administrados por RF23.
```

- [ ] **Paso 2: README: carga de cátedras y tests de integración**

En `README.md`, agregar antes de la sección `## Flujo de trabajo` una sección nueva:

```md
## Unidades organizativas

La aplicación **no** crea ni edita unidades: las carga el DBA por SQL. La migración deja solo el Departamento de Sistemas. Las cátedras se cargan con `INSERT` bajo ese departamento; el trigger `trg_validar_jerarquia_unidad` rechaza un departamento con superior, una cátedra sin superior y una cátedra cuyo superior no es un departamento.

```sql
INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
SELECT 'Bases de Datos', t.id_tipo_unidad, d.id_unidad
FROM tipo_unidad t, unidad_organizativa d
WHERE t.codigo = 'catedra'
  AND d.denominacion = 'Departamento de Sistemas' AND d.id_unidad_superior IS NULL;
```

Para el entorno local, `backend/scripts/catedras-ejemplo.sql` carga tres cátedras de ejemplo (se puede correr más de una vez):

```bash
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backend/scripts/catedras-ejemplo.sql
```

Cuidados del DBA: el trigger revisa la unidad, no sus puestos. Si se cambia el superior o el tipo de una unidad que ya tiene puestos, o se desactiva una cátedra con puestos activos o usuarios asignados, la aplicación no lo impide: conviene revisar los superiores de los puestos afectados.
```

En la sección `### Migraciones`, al final, agregar:

```md
Los índices con `lower()`, el trigger y la secuencia de `estructura` se escriben a mano en la migración y no están en las entidades: si `migration:generate` propone borrarlos, quitar esas líneas.

### Tests de integración

`npm test` corre solo tests unitarios. `npm run test:integracion` (requiere `docker compose up -d db`; dentro de Docker, `docker compose exec -T backend npm run test:integracion`) crea una base PostgreSQL temporal, le aplica las migraciones y prueba restricciones, triggers y consultas recursivas reales. Los archivos se llaman `*.int.spec.ts`.
```

- [ ] **Paso 3: CLAUDE.md**

En la sección `## Commands`, en la línea de Backend (`npm run lint (oxlint), …`), agregar al final de esa viñeta: ``, `npm run test:integracion` (contra PostgreSQL real, requiere `db`)``. En `## Conventions`, la línea "Antes de subir cambios…" pasa a: `Antes de subir cambios: \`npm run lint\` y \`npm run format\` en cada app, y \`npm test\` (más \`npm run test:integracion\` si tocaste migraciones o SQL) en el backend.`

- [ ] **Paso 4: Verificación final**

Usar superpowers:verification-before-completion y correr, con la salida a la vista:

```bash
docker compose exec -T backend npm run lint
docker compose exec -T backend npm run format
docker compose exec -T backend npm test
docker compose exec -T backend npm run test:integracion
docker compose exec -T backend npm run build
cd frontend && npm run lint && npm run format && npm run build && cd ..
git status --short
```

Expected: todo sin errores; `git status` solo muestra los archivos de documentación de este paso (el formato no debe dejar cambios sin commitear en el resto). Repasar los escenarios de uso de las Tareas 10 y 11 con una base nueva (`docker compose down -v && docker compose up -d --build`, luego cargar el script de cátedras) para confirmar que el entorno se arma de cero.

- [ ] **Paso 5: Cerrar los estados y commitear**

En la primera línea de la spec cambiar `Estado: Propuesta` por `Estado: Implementada`; en la primera línea de este plan cambiar `Estado: Pendiente` por `Estado: Implementado` (y completar `PR:` cuando exista el pull request).

```bash
git add docs README.md CLAUDE.md
git commit -m "Documentar estructura, carga de cátedras por el DBA y tests de integración"
```
