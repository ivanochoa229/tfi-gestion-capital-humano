Estado: En curso | Fecha: 2026-10-15 | PR: —

# Conocimiento: catálogo, requisitos y conocimiento de las personas: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** que el analista de puestos mantenga un catálogo único de conocimientos sin duplicados y los requisitos de cada puesto (RF08, RF09); que el docente declare lo que sabe y el jefe de cátedra o la jefatura lo acredite, con historial (RF10); y que el docente lo haga desde una sola pantalla precargada con los requisitos de sus puestos (RNF06).

**Arquitectura:** el módulo `conocimiento` suma las entidades `Conocimiento`, `RequisitoPuesto`, `ConocimientoPersona` (declaración vigente y reflejo de la acreditación vigente) y `Acreditacion` (historial de solo inserción), dos dominios de referencia (`area_tematica`, `tipo_evidencia`) y cinco servicios: catálogo (con fusión), requisitos, declaraciones, acreditaciones y lecturas de perfil. Todas las escrituras corren en una transacción con un bloqueo consultivo propio (7003). Las reglas de alcance reutilizan `AlcanceService`. Las consultas de detección futuras leerán solo el nivel acreditado vigente.

**Tech Stack:** NestJS 12, TypeORM 0.3, PostgreSQL 16, class-validator, vitest, React 19, MUI, TanStack Query, react-hook-form, zod.

**Spec:** `docs/superpowers/specs/2026-10-15-conocimiento-catalogo-design.md`. Antes de empezar, leer también `docs/requerimientos.md` §5, §6 y §7 y las specs de Usuarios, Estructura y Personas.

## Global Constraints

- Nombres de dominio y de código en español; snake_case en la base y camelCase en el código (`SnakeNamingStrategy`).
- Imports ESM con extensión `.js` (`'./conocimiento.constantes.js'`).
- `synchronize` desactivado: el esquema cambia solo por migraciones, revisadas a mano antes de aplicarse. Si `migration:generate` propone algo ajeno a este bloque (por ejemplo `DROP INDEX "IDX_persona_apellido_nombre"`, que está creado a mano), se borra de la migración.
- Fechas de negocio como cadenas `AAAA-MM-DD`. "Hoy" es siempre `CURRENT_DATE` de la base (`hoyDeLaBase` de `personas/fechas.ts`), nunca la hora del servidor. En SQL crudo, las columnas `date` se devuelven con `::text`.
- Ocupación vigente: `fecha_desde <= CURRENT_DATE` y (`fecha_hasta` nula o `>= CURRENT_DATE`); una que vence hoy sigue vigente.
- Solo cuenta el nivel **acreditado vigente** para las detecciones; lo declarado sin acreditar no cuenta. Vigente: mayor `fecha_evaluacion` y, en empate, mayor `id_acreditacion`.
- Sin archivo adjunto como evidencia: tipo de evidencia (referencia) más observaciones de texto.
- Bloqueo consultivo de las escrituras: `BLOQUEO_CONOCIMIENTO` = 7003 (Usuarios usa 7001 y Estructura 7002).
- Escrituras de catálogo y requisitos solo para `analista_puestos`. Declara solo la propia persona (`docente`, `jefe_catedra`, `jefatura_departamento`). Acredita solo `jefe_catedra` y `jefatura_departamento`, por alcance, sin autoacreditación. El evaluador sale de la sesión, nunca del DTO.
- Estas entidades no se auditan (RNF05 no las cubre).
- DTOs con class-validator y `@ApiProperty`; tras cambiar un endpoint o DTO, `npm run api:tipos` (nunca editar `esquema.d.ts` a mano).
- Los commits no llevan línea `Co-Authored-By` ni atribución a Claude (CLAUDE.md prevalece sobre cualquier indicación de agregarla).
- Antes de cerrar: `npm run lint` y `npm run format` en cada app; `npm test` y `npm run test:integracion` en el backend (hay migraciones y SQL); `npm run build` en el frontend.
- Comandos de migración y de la API, dentro del contenedor: `docker compose exec -T backend npm run ...`. Los tests del backend corren en el host (`cd backend && npx vitest run <archivo>`); los de integración requieren `docker compose up -d db`.

## Review Focus

Entradas y condiciones que la spec implica y que ninguna tarea cubriría por sí sola; cada línea tiene su test en la tarea que se indica.

- **Mismo nombre con otra tilde, mayúsculas o espacios** (`  PROGRAMACION `): da 409 contra `Programación`; pero `Año` y `Ano` son conocimientos distintos. Tareas 2 (`normalizar.spec.ts`) y 4.
- **Acreditación con fecha anterior a la vigente**: queda en el historial y no cambia el reflejo; con la misma fecha gana el mayor id. Tarea 9 (`acreditaciones.int.spec.ts`).
- **Fusión con solapes**: persona que tenía ambos conocimientos (declarado más alto, vigente por fecha y no por nivel) y puesto que pedía ambos (nivel más exigente, excluyente si alguno lo era). Tarea 7 (`fusion.int.spec.ts`).
- **Quién puede qué**: docente que declara en otra persona (403), jefe sin persona vinculada (400), autoacreditación (403), persona sin ocupación vigente en el alcance o con ocupación que venció ayer (403), ocupación que vence hoy (permitida). Tareas 8 y 9.
- **Dos pedidos simultáneos** (fusión contra acreditación o declaración sobre el conocimiento de origen): el bloqueo 7003 los serializa. Tarea 2 (`transaccion.spec.ts`) y tarea 9.

---

## Mapa de archivos

Backend (`backend/src/`):

| Archivo | Responsabilidad |
| --- | --- |
| `modules/referencia/entities/area-tematica.entity.ts`, `tipo-evidencia.entity.ts` | Dominios nuevos |
| `modules/referencia/dominios.ts`, `referencia.module.ts` | Registro de los diecisiete dominios |
| `modules/conocimiento/conocimiento.constantes.ts` | Slugs de dominios y clave del bloqueo |
| `modules/conocimiento/normalizar.ts` | `normalizarDenominacion` |
| `modules/conocimiento/transaccion.ts` | Transacción con bloqueo 7003 y traducción de errores a 409 |
| `modules/conocimiento/entities/*.ts` | `Conocimiento`, `RequisitoPuesto`, `ConocimientoPersona`, `Acreditacion` |
| `modules/conocimiento/sql.ts`, `fusion.sql.ts`, `perfil.sql.ts` | SQL compartido: reflejo de la acreditación vigente, pasos de la fusión, regla de "pendiente" |
| `modules/conocimiento/dto/catalogo.dto.ts`, `requisitos.dto.ts`, `perfil.dto.ts`, `trim.ts` | DTOs de entrada y salida |
| `modules/conocimiento/conocimiento.mapper.ts` | Entidad → DTO |
| `modules/conocimiento/conocimientos.service.ts` | Catálogo, baja, reactivación y fusión |
| `modules/conocimiento/requisitos.service.ts` | Requisitos de puesto y copia |
| `modules/conocimiento/acceso-perfil.service.ts` | Quién lee y quién evalúa el perfil de una persona |
| `modules/conocimiento/declaraciones.service.ts`, `acreditaciones.service.ts` | Declarar, retirar y acreditar |
| `modules/conocimiento/perfil.ts`, `perfil-conocimiento.service.ts` | `combinarRequisitos` (puro) y lecturas: perfil, historial, "mis conocimientos", pendientes |
| `modules/conocimiento/conocimientos.controller.ts`, `requisitos.controller.ts`, `perfil-conocimiento.controller.ts`, `conocimiento.module.ts` | HTTP y módulo |
| `common/roles.ts` | Grupos de roles nuevos |
| `infra/database/migrations/*` | Tres migraciones |
| `modules/conocimiento/*.int.spec.ts` | Pruebas del esquema y de la fusión contra PostgreSQL |

Frontend (`frontend/src/`): `features/conocimiento/{hooks,components,pages}`, `auth/permisos.ts`, `router.tsx`, `features/estructura/components/TablaPuestos.tsx`, `features/personas/components/FichaPersona.tsx`, `features/personas/pages/{PersonasPage,MiFichaPage}.tsx`.

---

## Tarea 1: Correcciones a la spec y dominios `area_tematica` y `tipo_evidencia`

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-conocimiento-catalogo-design.md`
- Create: `backend/src/modules/referencia/entities/area-tematica.entity.ts`
- Create: `backend/src/modules/referencia/entities/tipo-evidencia.entity.ts`
- Modify: `backend/src/modules/referencia/dominios.ts`
- Modify: `backend/src/modules/referencia/dominios.spec.ts`
- Modify: `backend/src/modules/referencia/referencia.module.ts`
- Create: `backend/src/infra/database/migrations/<timestamp>-CrearReferenciaConocimiento.ts` (lo genera TypeORM)

**Interfaces:**
- Produces: dominios `area-tematica` y `tipo-evidencia` (ambos simples) en `DOMINIOS`; tablas `area_tematica(id_area_tematica, codigo, denominacion, activo)` y `tipo_evidencia(id_tipo_evidencia, codigo, denominacion, activo)` con sus valores iniciales.

- [x] **Paso 1: Corregir la spec en cuatro puntos**

Al revisar el código real aparecen cuatro diferencias con la spec; se corrigen en el mismo commit para que la spec siga siendo la fuente de verdad. Con `Edit` sobre `docs/superpowers/specs/2026-10-15-conocimiento-catalogo-design.md`:

1. En la tabla de decisiones, fila 1, reemplazar `(minúsculas, sin tildes, espacios colapsados) calculada por la aplicación,` por `(minúsculas, sin tildes, espacios colapsados, **conservando la ñ**: `año` y `ano` son palabras distintas) calculada por la aplicación,`.
2. En Frontend, reemplazar `- **Catálogo** (`/conocimientos`, todos los roles menos `docente`)` por `- **Catálogo** (`/conocimiento`, la ruta que ya existe; todos los roles menos `docente`)` y `Un 409 por duplicado\n  muestra el conocimiento existente con un enlace.` por `Un 409 por duplicado\n  muestra el mensaje del servidor, que nombra el conocimiento existente.`
3. Reemplazar `- **Requisitos del puesto**: pestaña en el panel del puesto de `/estructura`, con tabla` por `- **Requisitos del puesto**: diálogo «Requisitos» que se abre desde la tabla de puestos de `/estructura` (como «Ocupantes»), con tabla`.
4. Reemplazar `(`/conocimientos/mios`)` por `(`/conocimiento/mios`)` y `bandeja `/conocimientos/pendientes`` por `bandeja `/conocimiento/pendientes``, y en la pestaña de la ficha de persona usar «sección» en lugar de «pestaña».

- [x] **Paso 2: Actualizar el test de dominios**

En `dominios.spec.ts`, cambiar el título `define los quince dominios cerrados` por `define los diecisiete dominios cerrados` y las apariciones de `15` por `17`. Agregar dentro del mismo `describe`:

```ts
  it('incluye los dominios de conocimiento', () => {
    const porSlug = new Map(DOMINIOS.map((d) => [d.slug, d]));
    expect(porSlug.get('area-tematica')).toMatchObject({
      tabla: 'area_tematica',
      ordinal: false,
    });
    expect(porSlug.get('tipo-evidencia')).toMatchObject({
      tabla: 'tipo_evidencia',
      ordinal: false,
    });
  });
```

- [x] **Paso 3: Verificar que falla**

Run: `cd backend && npx vitest run src/modules/referencia/dominios.spec.ts`
Expected: FAIL (`expected 15 to have a length of 17`).

- [x] **Paso 4: Crear las dos entidades**

`area-tematica.entity.ts`:

```ts
import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('area_tematica')
export class AreaTematica extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_area_tematica' })
  id: number;
}
```

`tipo-evidencia.entity.ts`:

```ts
import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('tipo_evidencia')
export class TipoEvidencia extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_tipo_evidencia' })
  id: number;
}
```

- [x] **Paso 5: Registrar los dominios**

En `dominios.ts`: importar las dos entidades (`'./entities/area-tematica.entity.js'` y `'./entities/tipo-evidencia.entity.js'`), cambiar el comentario `Los quince dominios` por `Los diecisiete dominios` y agregar al final del arreglo `DOMINIOS`:

```ts
  {
    slug: 'area-tematica',
    denominacion: 'Área temática',
    tabla: 'area_tematica',
    ordinal: false,
    entidad: AreaTematica,
  },
  {
    slug: 'tipo-evidencia',
    denominacion: 'Tipo de evidencia',
    tabla: 'tipo_evidencia',
    ordinal: false,
    entidad: TipoEvidencia,
  },
```

En `referencia.module.ts`, importar las dos entidades y sumarlas a `TypeOrmModule.forFeature([...])`.

- [x] **Paso 6: Generar la migración y cargar los valores**

Run: `docker compose up -d db && docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/CrearReferenciaConocimiento`

Revisar el archivo: debe contener solo los `CREATE TABLE` de `area_tematica` y `tipo_evidencia` (borrar cualquier otro cambio). Agregar, al final de `up` y antes de cerrar el método, los valores iniciales, y agregar arriba las constantes:

```ts
type Valor = [codigo: string, denominacion: string];

const AREAS_TEMATICAS: Valor[] = [
  ['programacion', 'Programación'],
  ['bases_de_datos', 'Bases de datos'],
  ['redes_y_comunicaciones', 'Redes y comunicaciones'],
  ['ingenieria_de_software', 'Ingeniería de software'],
  ['sistemas_operativos', 'Sistemas operativos'],
  ['matematica', 'Matemática'],
  ['gestion_y_organizacion', 'Gestión y organización'],
  ['docencia_universitaria', 'Docencia universitaria'],
];

const TIPOS_EVIDENCIA: Valor[] = [
  ['titulo', 'Título'],
  ['certificado', 'Certificado'],
  ['produccion', 'Producción académica'],
  ['observacion_directa', 'Observación directa'],
  ['entrevista', 'Entrevista'],
];
```

```ts
    for (const [codigo, denominacion] of AREAS_TEMATICAS) {
      await queryRunner.query(
        `INSERT INTO "area_tematica" ("codigo", "denominacion") VALUES ($1, $2)`,
        [codigo, denominacion],
      );
    }
    for (const [codigo, denominacion] of TIPOS_EVIDENCIA) {
      await queryRunner.query(
        `INSERT INTO "tipo_evidencia" ("codigo", "denominacion") VALUES ($1, $2)`,
        [codigo, denominacion],
      );
    }
```

Verificar que `down` borra las dos tablas.

- [x] **Paso 7: Aplicar y verificar**

Run: `docker compose exec -T backend npm run migration:run && cd backend && npx vitest run src/modules/referencia`
Expected: migración aplicada; tests de referencia PASS.

- [x] **Paso 8: Commit**

```bash
git add docs/superpowers/specs/2026-10-15-conocimiento-catalogo-design.md backend/src/modules/referencia backend/src/infra/database/migrations
git commit -m "Agregar los dominios area_tematica y tipo_evidencia y ajustar la spec de conocimiento"
```

---

## Tarea 2: Constantes, normalización de denominaciones y transacción con bloqueo

**Files:**
- Create: `backend/src/modules/conocimiento/conocimiento.constantes.ts`
- Create: `backend/src/modules/conocimiento/normalizar.ts`
- Create: `backend/src/modules/conocimiento/normalizar.spec.ts`
- Create: `backend/src/modules/conocimiento/transaccion.ts`
- Create: `backend/src/modules/conocimiento/transaccion.spec.ts`

**Interfaces:**
- Produces: `DOMINIO_TIPO_CONOCIMIENTO`, `DOMINIO_AREA_TEMATICA`, `DOMINIO_NIVEL_DOMINIO`, `DOMINIO_TIPO_EVIDENCIA` (slugs), `BLOQUEO_CONOCIMIENTO = 7003`; `normalizarDenominacion(texto: string): string`; `enTransaccionDeConocimiento<T>(repositorio: { manager: EntityManager }, trabajo: (manager: EntityManager) => Promise<T>): Promise<T>`; `traducirError(error: unknown): unknown`.

- [x] **Paso 1: Escribir los tests de normalización**

`normalizar.spec.ts`:

```ts
import { normalizarDenominacion } from './normalizar.js';

describe('normalizarDenominacion', () => {
  it.each([
    ['Programación', 'programacion'],
    ['  Bases   de  DATOS ', 'bases de datos'],
    ['ÁRBOLES y Grafos', 'arboles y grafos'],
    ['Análisis Matemático II', 'analisis matematico ii'],
    ['Pingüino', 'pinguino'],
    ['\tSQL\n', 'sql'],
  ])('%j da %j', (entrada, esperado) => {
    expect(normalizarDenominacion(entrada)).toBe(esperado);
  });

  it('conserva la ñ: año y ano son palabras distintas', () => {
    expect(normalizarDenominacion('Año')).toBe('año');
    expect(normalizarDenominacion('AÑO')).toBe('año');
    expect(normalizarDenominacion('Año')).not.toBe(
      normalizarDenominacion('Ano'),
    );
  });

  it('trata igual la ñ compuesta y la descompuesta', () => {
    expect(normalizarDenominacion('año')).toBe('año');
  });

  it('trata igual una tilde compuesta y una descompuesta', () => {
    expect(normalizarDenominacion('Programación')).toBe('programacion');
  });
});
```

- [x] **Paso 2: Verificar que falla**

Run: `cd backend && npx vitest run src/modules/conocimiento/normalizar.spec.ts`
Expected: FAIL (no se encuentra `./normalizar.js`).

- [x] **Paso 3: Implementar las constantes y la normalización**

`conocimiento.constantes.ts`:

```ts
/** Slugs de los dominios de referencia (`ReferenciaService.validarActivo`). */
export const DOMINIO_TIPO_CONOCIMIENTO = 'tipo-conocimiento';
export const DOMINIO_AREA_TEMATICA = 'area-tematica';
export const DOMINIO_NIVEL_DOMINIO = 'nivel-dominio';
export const DOMINIO_TIPO_EVIDENCIA = 'tipo-evidencia';

/** Clave del bloqueo que serializa las escrituras de conocimiento (Usuarios usa 7001, Estructura 7002). */
export const BLOQUEO_CONOCIMIENTO = 7003;
```

`normalizar.ts`:

```ts
/**
 * Clave de comparación de una denominación: minúsculas, sin tildes ni
 * diéresis, con los espacios colapsados. Conserva la ñ, porque `año` y `ano`
 * son palabras distintas. La calcula la aplicación y la guarda la columna
 * `denominacion_normalizada`, bajo un índice único por tipo.
 */
export function normalizarDenominacion(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/ñ|\p{M}/gu, (marca) => (marca === 'ñ' ? 'ñ' : ''))
    .replace(/\s+/g, ' ')
    .trim();
}
```

- [x] **Paso 4: Verificar que pasa**

Run: `cd backend && npx vitest run src/modules/conocimiento/normalizar.spec.ts`
Expected: PASS.

- [x] **Paso 5: Escribir los tests de la transacción**

`transaccion.spec.ts`:

```ts
import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { BLOQUEO_CONOCIMIENTO } from './conocimiento.constantes.js';
import { enTransaccionDeConocimiento, traducirError } from './transaccion.js';

const errorDeBase = (code: string) =>
  new QueryFailedError('INSERT', [], Object.assign(new Error('x'), { code }));

describe('enTransaccionDeConocimiento', () => {
  it('toma el bloqueo consultivo antes de correr el trabajo', async () => {
    const orden: string[] = [];
    const manager = {
      query: vi.fn(async (sql: string, parametros: unknown[]) => {
        orden.push(`${sql} ${String(parametros)}`);
      }),
    };
    const repositorio = {
      manager: { transaction: async (t: (m: unknown) => unknown) => t(manager) },
    };

    const resultado = await enTransaccionDeConocimiento(
      repositorio as never,
      async () => {
        orden.push('trabajo');
        return 42;
      },
    );

    expect(resultado).toBe(42);
    expect(orden).toEqual([
      `SELECT pg_advisory_xact_lock($1) ${BLOQUEO_CONOCIMIENTO}`,
      'trabajo',
    ]);
  });

  it('traduce el error de la base que sale del trabajo', async () => {
    const repositorio = {
      manager: {
        transaction: async () => {
          throw errorDeBase('23505');
        },
      },
    };
    await expect(
      enTransaccionDeConocimiento(repositorio as never, async () => 1),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('traducirError', () => {
  it('convierte una unicidad (23505) en 409', () => {
    expect(traducirError(errorDeBase('23505'))).toBeInstanceOf(
      ConflictException,
    );
  });

  it('deja pasar los demás errores sin cambios', () => {
    const otro = errorDeBase('23503');
    expect(traducirError(otro)).toBe(otro);
    const comun = new Error('x');
    expect(traducirError(comun)).toBe(comun);
  });
});
```

- [x] **Paso 6: Verificar que falla**

Run: `cd backend && npx vitest run src/modules/conocimiento/transaccion.spec.ts`
Expected: FAIL (no se encuentra `./transaccion.js`).

- [x] **Paso 7: Implementar la transacción**

`transaccion.ts`:

```ts
import { ConflictException } from '@nestjs/common';
import { QueryFailedError, type EntityManager } from 'typeorm';
import { BLOQUEO_CONOCIMIENTO } from './conocimiento.constantes.js';

/**
 * Convierte los errores de unicidad de la base en 409. Es el respaldo de las
 * validaciones previas de los servicios, que dan el mensaje que nombra al
 * conocimiento existente; el resto de los errores pasa sin cambios.
 */
export function traducirError(error: unknown): unknown {
  if (!(error instanceof QueryFailedError)) return error;
  const { code } = (error.driverError ?? {}) as { code?: string };
  if (code === '23505') {
    return new ConflictException(
      'Ya existe un registro con esos datos (conocimiento repetido para el mismo tipo)',
    );
  }
  return error;
}

/**
 * Ejecuta el trabajo en una transacción que antes toma el bloqueo consultivo
 * de conocimiento: altas, fusiones, requisitos, declaraciones y acreditaciones
 * quedan serializadas, así que una fusión no se cruza con una acreditación
 * sobre el conocimiento que desaparece.
 */
export async function enTransaccionDeConocimiento<T>(
  repositorio: { manager: EntityManager },
  trabajo: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  try {
    return await repositorio.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [
        BLOQUEO_CONOCIMIENTO,
      ]);
      return trabajo(manager);
    });
  } catch (error) {
    throw traducirError(error);
  }
}
```

- [x] **Paso 8: Verificar que pasa y commitear**

Run: `cd backend && npx vitest run src/modules/conocimiento`
Expected: PASS.

```bash
git add backend/src/modules/conocimiento
git commit -m "Agregar la normalización de denominaciones y la transacción con bloqueo de conocimiento"
```

---

## Tarea 3: Entidades `Conocimiento` y `RequisitoPuesto` y su migración

**Files:**
- Create: `backend/src/modules/conocimiento/entities/conocimiento.entity.ts`
- Create: `backend/src/modules/conocimiento/entities/requisito-puesto.entity.ts`
- Create: `backend/src/infra/database/migrations/<timestamp>-CrearConocimientoYRequisitos.ts` (lo genera TypeORM)
- Test: `backend/src/modules/conocimiento/conocimiento.int.spec.ts`

**Interfaces:**
- Consumes: `TipoConocimiento`, `AreaTematica`, `NivelDominio` (referencia), `Puesto` (estructura).
- Produces: `Conocimiento { id, denominacion, denominacionNormalizada, idTipoConocimiento, idAreaTematica, descripcion: string | null, activo, idFusionadoEn: number | null }`; `RequisitoPuesto { idPuesto, idConocimiento, idNivelRequerido, esExcluyente, conocimiento }`.

- [x] **Paso 1: Crear las entidades**

`conocimiento.entity.ts`:

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
import { AreaTematica } from '../../referencia/entities/area-tematica.entity.js';
import { TipoConocimiento } from '../../referencia/entities/tipo-conocimiento.entity.js';

/**
 * Catálogo único de conocimientos (RF08). `denominacionNormalizada` la calcula
 * la aplicación (`normalizarDenominacion`); el índice único parcial impide dos
 * conocimientos activos con la misma clave y el mismo tipo.
 */
@Entity('conocimiento')
@Check(
  'CK_conocimiento_fusion_distinta',
  '"id_fusionado_en" IS NULL OR "id_fusionado_en" <> "id_conocimiento"',
)
@Index(
  'UQ_conocimiento_tipo_denominacion_activo',
  ['idTipoConocimiento', 'denominacionNormalizada'],
  { unique: true, where: '"activo"' },
)
export class Conocimiento {
  @PrimaryGeneratedColumn({ name: 'id_conocimiento' })
  id: number;

  @Column({ type: 'varchar', length: 150 })
  denominacion: string;

  @Column({ type: 'varchar', length: 150 })
  denominacionNormalizada: string;

  @Column({ name: 'id_tipo_conocimiento', type: 'int' })
  idTipoConocimiento: number;

  @ManyToOne(() => TipoConocimiento, { nullable: false })
  @JoinColumn({ name: 'id_tipo_conocimiento' })
  tipoConocimiento: Relation<TipoConocimiento>;

  @Column({ name: 'id_area_tematica', type: 'int' })
  idAreaTematica: number;

  @ManyToOne(() => AreaTematica, { nullable: false })
  @JoinColumn({ name: 'id_area_tematica' })
  areaTematica: Relation<AreaTematica>;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  /** Conocimiento al que se fusionó este, si se retiró por duplicado. */
  @Column({ name: 'id_fusionado_en', type: 'int', nullable: true })
  idFusionadoEn: number | null;

  @ManyToOne(() => Conocimiento, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_fusionado_en' })
  fusionadoEn: Relation<Conocimiento> | null;
}
```

`requisito-puesto.entity.ts`:

```ts
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Puesto } from '../../estructura/entities/puesto.entity.js';
import { NivelDominio } from '../../referencia/entities/nivel-dominio.entity.js';
import { Conocimiento } from './conocimiento.entity.js';

/** Conocimiento que exige un puesto, con el nivel requerido (RF09). */
@Entity('requisito_puesto')
@Index('IDX_requisito_puesto_conocimiento', ['idConocimiento'])
export class RequisitoPuesto {
  @PrimaryColumn({ name: 'id_puesto', type: 'int' })
  idPuesto: number;

  @PrimaryColumn({ name: 'id_conocimiento', type: 'int' })
  idConocimiento: number;

  @Column({ name: 'id_nivel_requerido', type: 'int' })
  idNivelRequerido: number;

  @Column({ type: 'boolean' })
  esExcluyente: boolean;

  @ManyToOne(() => Puesto, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_puesto' })
  puesto: Relation<Puesto>;

  @ManyToOne(() => Conocimiento, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_conocimiento' })
  conocimiento: Relation<Conocimiento>;

  @ManyToOne(() => NivelDominio, { nullable: false })
  @JoinColumn({ name: 'id_nivel_requerido' })
  nivelRequerido: Relation<NivelDominio>;
}
```

- [x] **Paso 2: Generar y revisar la migración**

Registrar temporalmente las entidades para que TypeORM las vea: abrir `backend/src/infra/database/data-source.ts` y `database.module.ts` y comprobar cómo se descubren las entidades (si es por patrón de archivos `*.entity`, no hace falta nada; si es una lista, agregar `Conocimiento` y `RequisitoPuesto`).

Run: `docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/CrearConocimientoYRequisitos`

Revisar a mano. Debe contener solo: `CREATE TABLE "conocimiento"` (con el CHECK `CK_conocimiento_fusion_distinta`), `CREATE UNIQUE INDEX "UQ_conocimiento_tipo_denominacion_activo" ON "conocimiento" ("id_tipo_conocimiento", "denominacion_normalizada") WHERE "activo"`, `CREATE TABLE "requisito_puesto"` con clave `(id_puesto, id_conocimiento)`, el índice `IDX_requisito_puesto_conocimiento` y las FK (a `puesto` y `conocimiento` con `ON DELETE RESTRICT`, a `nivel_dominio`, `tipo_conocimiento`, `area_tematica` y la FK recursiva `id_fusionado_en`). Borrar cualquier otra sentencia.

- [x] **Paso 3: Escribir el test de integración del esquema**

`conocimiento.int.spec.ts`:

```ts
import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';

describe('Conocimiento: catálogo y requisitos (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let tipoTecnica: number;
  let tipoFormacion: number;
  let area: number;
  let nivel: number;
  let idPuesto: number;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const id = async (consulta: string) =>
    (await sql<{ id: number }[]>(consulta))[0].id;

  const insertar = (
    denominacion: string,
    normalizada: string,
    tipo = tipoTecnica,
    activo = true,
  ) =>
    sql(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica, activo)
       VALUES ($1, $2, $3, $4, $5) RETURNING id_conocimiento AS id`,
      [denominacion, normalizada, tipo, area, activo],
    );

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    tipoTecnica = await id(
      `SELECT id_tipo_conocimiento AS id FROM tipo_conocimiento WHERE codigo = 'competencia_tecnica'`,
    );
    tipoFormacion = await id(
      `SELECT id_tipo_conocimiento AS id FROM tipo_conocimiento WHERE codigo = 'formacion'`,
    );
    area = await id(
      `SELECT id_area_tematica AS id FROM area_tematica ORDER BY id_area_tematica LIMIT 1`,
    );
    nivel = await id(
      `SELECT id_nivel_dominio AS id FROM nivel_dominio WHERE codigo = 'basico'`,
    );
    const departamento = await id(
      `SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
    );
    idPuesto = (
      await sql<{ id: number }[]>(
        `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
         SELECT 'P-0001', 'Jefe', $1, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
         RETURNING id_puesto AS id`,
        [departamento],
      )
    )[0].id;
  });
  afterAll(async () => {
    await base.destruir();
  });
  afterEach(async () => {
    await sql('DELETE FROM requisito_puesto');
    await sql('DELETE FROM conocimiento');
  });

  it('rechaza dos conocimientos activos con la misma clave y el mismo tipo', async () => {
    await insertar('Programación', 'programacion');
    await expect(insertar('PROGRAMACION', 'programacion')).rejects.toThrow(
      /UQ_conocimiento_tipo_denominacion_activo/,
    );
  });

  it('permite la misma clave en otro tipo', async () => {
    await insertar('Estadística', 'estadistica');
    await expect(
      insertar('Estadística', 'estadistica', tipoFormacion),
    ).resolves.toBeDefined();
  });

  it('un conocimiento inactivo no bloquea un alta igual, ni a varios inactivos entre sí', async () => {
    await insertar('Redes', 'redes', tipoTecnica, false);
    await insertar('Redes', 'redes', tipoTecnica, false);
    await expect(insertar('Redes', 'redes')).resolves.toBeDefined();
  });

  it('no admite fusionarse consigo mismo', async () => {
    const [{ id: a }] = await insertar('Python', 'python');
    await expect(
      sql(
        `UPDATE conocimiento SET id_fusionado_en = id_conocimiento WHERE id_conocimiento = $1`,
        [a],
      ),
    ).rejects.toThrow(/CK_conocimiento_fusion_distinta/);
  });

  it('un puesto no repite el mismo requisito', async () => {
    const [{ id: a }] = await insertar('Python', 'python');
    const alta = () =>
      sql(
        `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente) VALUES ($1, $2, $3, true)`,
        [idPuesto, a, nivel],
      );
    await alta();
    await expect(alta()).rejects.toThrow(/duplicate key|PK_/);
  });

  it('no se borra un conocimiento que un puesto requiere', async () => {
    const [{ id: a }] = await insertar('Python', 'python');
    await sql(
      `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente) VALUES ($1, $2, $3, false)`,
      [idPuesto, a, nivel],
    );
    await expect(
      sql(`DELETE FROM conocimiento WHERE id_conocimiento = $1`, [a]),
    ).rejects.toThrow(/foreign key/);
  });
});
```

- [x] **Paso 4: Correr el test de integración**

Run: `docker compose up -d db && cd backend && npx vitest run --config vitest.integracion.config.ts src/modules/conocimiento/conocimiento.int.spec.ts`
Expected: PASS (6 tests). Si falla por el nombre de la restricción, ajustar la expresión regular al mensaje real, no la migración.

- [x] **Paso 5: Aplicar la migración al entorno y commitear**

Run: `docker compose exec -T backend npm run migration:run`

```bash
git add backend/src/modules/conocimiento backend/src/infra/database
git commit -m "Agregar las tablas conocimiento y requisito_puesto con su índice de duplicados"
```

---

## Tarea 4: Catálogo de conocimientos (`ConocimientosService`)

**Files:**
- Create: `backend/src/modules/conocimiento/dto/trim.ts`
- Create: `backend/src/modules/conocimiento/dto/catalogo.dto.ts`
- Create: `backend/src/modules/conocimiento/conocimiento.mapper.ts`
- Create: `backend/src/modules/conocimiento/conocimientos.service.ts`
- Test: `backend/src/modules/conocimiento/conocimientos.service.spec.ts`

**Interfaces:**
- Consumes: `Conocimiento` (tarea 3), `normalizarDenominacion`, `enTransaccionDeConocimiento`, constantes (tarea 2), `ReferenciaService.validarActivo(slug, id)`, `escaparLike` de `common/like.ts`.
- Produces: `ConocimientosService` con `listar(filtro: FiltroConocimientosDto): Promise<ConocimientoDto[]>`, `crear(dto: CrearConocimientoDto)`, `actualizar(id: number, dto: ActualizarConocimientoDto)`, `baja(id)`, `reactivar(id)` (todos devuelven `ConocimientoDto`); DTOs `CrearConocimientoDto`, `ActualizarConocimientoDto`, `FiltroConocimientosDto`, `ConocimientoDto`, `FusionarConocimientoDto`, `ResultadoFusionDto` (la fusión se implementa en la tarea 7); `aConocimientoDto(c: Conocimiento): ConocimientoDto`.

- [x] **Paso 1: Crear los DTOs y el mapper**

`dto/trim.ts`:

```ts
import { Transform } from 'class-transformer';

/** Quita los espacios de los extremos antes de validar. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
```

`dto/catalogo.dto.ts`:

```ts
import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Trim } from './trim.js';

const MAX_INT4 = 2147483647;

export class CrearConocimientoDto {
  @ApiProperty({ maxLength: 150, example: 'PostgreSQL' })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  denominacion: string;

  @ApiProperty({ description: 'Tipo de conocimiento activo' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idTipoConocimiento: number;

  @ApiProperty({ description: 'Área temática activa' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idAreaTematica: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  descripcion?: string | null;
}

export class ActualizarConocimientoDto extends PartialType(
  CrearConocimientoDto,
) {}

const aBooleano = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class FiltroConocimientosDto {
  @ApiPropertyOptional({ description: 'Texto contenido en la denominación' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  idTipo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  idArea?: number;

  @ApiPropertyOptional({ description: 'Sin valor: activos e inactivos' })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  activo?: boolean;
}

export class ConocimientoDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  denominacion: string;

  @ApiProperty()
  idTipoConocimiento: number;

  @ApiProperty()
  idAreaTematica: number;

  @ApiProperty({ nullable: true, type: String })
  descripcion: string | null;

  @ApiProperty()
  activo: boolean;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Conocimiento al que se fusionó, si se retiró por duplicado',
  })
  idFusionadoEn: number | null;
}

export class FusionarConocimientoDto {
  @ApiProperty({ description: 'Conocimiento que se conserva' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idDestino: number;
}

export class ResultadoFusionDto {
  @ApiProperty()
  idOrigen: number;

  @ApiProperty()
  idDestino: number;

  @ApiProperty({ description: 'Requisitos de puesto que pedían el origen' })
  requisitosMovidos: number;

  @ApiProperty({ description: 'Personas con datos del origen' })
  personasMovidas: number;
}
```

`conocimiento.mapper.ts`:

```ts
import type { ConocimientoDto } from './dto/catalogo.dto.js';
import type { Conocimiento } from './entities/conocimiento.entity.js';

export function aConocimientoDto(c: Conocimiento): ConocimientoDto {
  return {
    id: c.id,
    denominacion: c.denominacion,
    idTipoConocimiento: c.idTipoConocimiento,
    idAreaTematica: c.idAreaTematica,
    descripcion: c.descripcion,
    activo: c.activo,
    idFusionadoEn: c.idFusionadoEn,
  };
}
```

- [x] **Paso 2: Escribir los tests del servicio**

`conocimientos.service.spec.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { Conocimiento } from './entities/conocimiento.entity.js';
import { ConocimientosService } from './conocimientos.service.js';

const existente = (parcial: Partial<Conocimiento> = {}): Conocimiento =>
  ({
    id: 1,
    denominacion: 'Programación',
    denominacionNormalizada: 'programacion',
    idTipoConocimiento: 3,
    idAreaTematica: 5,
    descripcion: null,
    activo: true,
    idFusionadoEn: null,
    ...parcial,
  }) as Conocimiento;

function crearEntorno(
  iniciales: Conocimiento[] = [],
  usos: { codigo: string }[] = [],
) {
  const filas = iniciales.map((f) => ({ ...f }));
  let siguiente = 100;
  const coincide = (f: Conocimiento, where: Record<string, unknown>) =>
    Object.entries(where).every(
      ([k, v]) => f[k as keyof Conocimiento] === v,
    );
  const repo = {
    find: vi.fn(async (o?: { where?: Record<string, unknown> }) =>
      filas.filter((f) => coincide(f, o?.where ?? {})).map((f) => ({ ...f })),
    ),
    findOne: vi.fn(async (o: { where: Record<string, unknown> }) => {
      const f = filas.find((x) => coincide(x, o.where));
      return f ? { ...f } : null;
    }),
    create: vi.fn((datos: Partial<Conocimiento>) => ({
      idFusionadoEn: null,
      activo: true,
      ...datos,
    })),
    save: vi.fn(async (c: Conocimiento) => {
      if (c.id === undefined) {
        c.id = siguiente++;
        filas.push({ ...c });
      } else {
        filas[filas.findIndex((f) => f.id === c.id)] = { ...c };
      }
      return { ...c };
    }),
  };
  const manager = {
    getRepository: () => repo,
    query: vi.fn(async (sql: string) =>
      sql.includes('requisito_puesto') ? usos : [],
    ),
    transaction: async (trabajo: (m: unknown) => Promise<unknown>) =>
      trabajo(manager),
  };
  (repo as unknown as { manager: unknown }).manager = manager;
  const referencia = { validarActivo: vi.fn(async () => undefined) };
  const servicio = new ConocimientosService(
    repo as unknown as Repository<Conocimiento>,
    referencia as unknown as ReferenciaService,
  );
  return { servicio, repo, referencia, filas, manager };
}

const alta = {
  denominacion: 'Bases de datos',
  idTipoConocimiento: 3,
  idAreaTematica: 5,
};

describe('ConocimientosService.crear', () => {
  it('guarda la denominación y su clave normalizada', async () => {
    const { servicio, repo } = crearEntorno();
    const creado = await servicio.crear({ ...alta, denominacion: 'Bases  de DATOS' });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        denominacion: 'Bases  de DATOS',
        denominacionNormalizada: 'bases de datos',
      }),
    );
    expect(creado).toMatchObject({ id: 100, activo: true });
  });

  it('valida el tipo y el área contra la referencia', async () => {
    const { servicio, referencia } = crearEntorno();
    await servicio.crear(alta);
    expect(referencia.validarActivo).toHaveBeenCalledWith('tipo-conocimiento', 3);
    expect(referencia.validarActivo).toHaveBeenCalledWith('area-tematica', 5);
  });

  it('rechaza con 409 un duplicado por tilde, mayúsculas o espacios y nombra el existente', async () => {
    const { servicio } = crearEntorno([existente()]);
    const intento = servicio.crear({ ...alta, denominacion: '  PROGRAMACION ' });
    await expect(intento).rejects.toBeInstanceOf(ConflictException);
    await expect(intento).rejects.toThrow(/Programación.*id 1/);
  });

  it('acepta el mismo nombre en otro tipo y cuando el existente está inactivo', async () => {
    const { servicio } = crearEntorno([
      existente({ id: 1 }),
      existente({ id: 2, idTipoConocimiento: 9 }),
    ]);
    await expect(
      servicio.crear({ ...alta, denominacion: 'Programación', idTipoConocimiento: 4 }),
    ).resolves.toBeDefined();
    const inactivo = crearEntorno([existente({ activo: false })]);
    await expect(
      inactivo.servicio.crear({ ...alta, denominacion: 'Programación' }),
    ).resolves.toBeDefined();
  });

  it('distingue año de ano', async () => {
    const { servicio } = crearEntorno([
      existente({ denominacion: 'Ano', denominacionNormalizada: 'ano' }),
    ]);
    await expect(
      servicio.crear({ ...alta, denominacion: 'Año' }),
    ).resolves.toBeDefined();
  });
});

describe('ConocimientosService.actualizar', () => {
  it('renombrar a otro existente da 409, pero cambiar solo tildes del propio no', async () => {
    const { servicio } = crearEntorno([
      existente({ id: 1 }),
      existente({
        id: 2,
        denominacion: 'Redes',
        denominacionNormalizada: 'redes',
      }),
    ]);
    await expect(
      servicio.actualizar(2, { denominacion: 'programación' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      servicio.actualizar(1, { denominacion: 'PROGRAMACIÓN' }),
    ).resolves.toMatchObject({ denominacion: 'PROGRAMACIÓN' });
  });

  it('da 404 si no existe y 409 si está dado de baja', async () => {
    const { servicio } = crearEntorno([existente({ id: 1, activo: false })]);
    await expect(servicio.actualizar(9, { descripcion: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(servicio.actualizar(1, { descripcion: 'x' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('ConocimientosService.baja y reactivar', () => {
  it('la baja se bloquea si lo piden puestos activos y los lista', async () => {
    const { servicio } = crearEntorno([existente()], [
      { codigo: 'P-0001' },
      { codigo: 'P-0002' },
    ]);
    const intento = servicio.baja(1);
    await expect(intento).rejects.toBeInstanceOf(ConflictException);
    await expect(intento).rejects.toThrow(/P-0001, P-0002/);
  });

  it('da de baja un conocimiento que ningún puesto pide', async () => {
    const { servicio } = crearEntorno([existente()]);
    await expect(servicio.baja(1)).resolves.toMatchObject({ activo: false });
  });

  it('no reactiva si ya hay uno activo con la misma clave', async () => {
    const { servicio } = crearEntorno([
      existente({ id: 1, activo: false }),
      existente({ id: 2 }),
    ]);
    await expect(servicio.reactivar(1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('reactiva si no hay conflicto', async () => {
    const { servicio } = crearEntorno([existente({ id: 1, activo: false })]);
    await expect(servicio.reactivar(1)).resolves.toMatchObject({ activo: true });
  });
});

describe('ConocimientosService.listar', () => {
  it('busca por la clave normalizada, así que ignora tildes y mayúsculas', async () => {
    const { servicio, repo } = crearEntorno();
    await servicio.listar({ q: ' Programación ', idTipo: 3 });
    const donde = repo.find.mock.calls[0][0]?.where as Record<string, unknown>;
    expect(donde.idTipoConocimiento).toBe(3);
    expect(String((donde.denominacionNormalizada as { _value: string })._value)).toBe(
      '%programacion%',
    );
  });

  it('sin filtros devuelve activos e inactivos', async () => {
    const { servicio, repo } = crearEntorno([existente({ activo: false })]);
    expect(await servicio.listar({})).toHaveLength(1);
    expect(repo.find.mock.calls[0][0]?.where).toEqual({});
  });
});

describe('validaciones de dominio', () => {
  it('una referencia inválida corta el alta', async () => {
    const { servicio, referencia } = crearEntorno();
    referencia.validarActivo.mockRejectedValueOnce(
      new BadRequestException('El valor 3 no existe'),
    );
    await expect(servicio.crear(alta)).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

- [x] **Paso 3: Verificar que falla**

Run: `cd backend && npx vitest run src/modules/conocimiento/conocimientos.service.spec.ts`
Expected: FAIL (no se encuentra `./conocimientos.service.js`).

- [x] **Paso 4: Implementar el servicio**

`conocimientos.service.ts`:

```ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, type Repository } from 'typeorm';
import { escaparLike } from '../../common/like.js';
import { ReferenciaService } from '../referencia/referencia.service.js';
import {
  DOMINIO_AREA_TEMATICA,
  DOMINIO_TIPO_CONOCIMIENTO,
} from './conocimiento.constantes.js';
import { aConocimientoDto } from './conocimiento.mapper.js';
import type {
  ActualizarConocimientoDto,
  ConocimientoDto,
  CrearConocimientoDto,
  FiltroConocimientosDto,
} from './dto/catalogo.dto.js';
import { Conocimiento } from './entities/conocimiento.entity.js';
import { normalizarDenominacion } from './normalizar.js';
import { enTransaccionDeConocimiento } from './transaccion.js';

/** Máximo de puestos que se nombran en el mensaje de una baja bloqueada. */
const MAX_PUESTOS_EN_MENSAJE = 10;

/** Catálogo único de conocimientos (RF08). Las escrituras corren con el bloqueo de conocimiento. */
@Injectable()
export class ConocimientosService {
  constructor(
    @InjectRepository(Conocimiento)
    private readonly conocimientos: Repository<Conocimiento>,
    private readonly referencia: ReferenciaService,
  ) {}

  async listar(filtro: FiltroConocimientosDto): Promise<ConocimientoDto[]> {
    const q = filtro.q ? normalizarDenominacion(filtro.q) : '';
    const filas = await this.conocimientos.find({
      where: {
        ...(filtro.idTipo !== undefined
          ? { idTipoConocimiento: filtro.idTipo }
          : {}),
        ...(filtro.idArea !== undefined
          ? { idAreaTematica: filtro.idArea }
          : {}),
        ...(filtro.activo !== undefined ? { activo: filtro.activo } : {}),
        ...(q
          ? { denominacionNormalizada: ILike(`%${escaparLike(q)}%`) }
          : {}),
      },
      order: { denominacion: 'ASC' },
    });
    return filas.map(aConocimientoDto);
  }

  async crear(dto: CrearConocimientoDto): Promise<ConocimientoDto> {
    await this.validarDominios(dto.idTipoConocimiento, dto.idAreaTematica);
    const normalizada = normalizarDenominacion(dto.denominacion);
    return enTransaccionDeConocimiento(this.conocimientos, async (manager) => {
      const repo = manager.getRepository(Conocimiento);
      await this.exigirSinDuplicado(repo, dto.idTipoConocimiento, normalizada);
      const creado = await repo.save(
        repo.create({
          denominacion: dto.denominacion,
          denominacionNormalizada: normalizada,
          idTipoConocimiento: dto.idTipoConocimiento,
          idAreaTematica: dto.idAreaTematica,
          descripcion: dto.descripcion ?? null,
        }),
      );
      return aConocimientoDto(creado);
    });
  }

  async actualizar(
    id: number,
    dto: ActualizarConocimientoDto,
  ): Promise<ConocimientoDto> {
    return enTransaccionDeConocimiento(this.conocimientos, async (manager) => {
      const repo = manager.getRepository(Conocimiento);
      const actual = await this.exigir(repo, id);
      if (!actual.activo) {
        throw new ConflictException(
          'El conocimiento está dado de baja: reactivalo antes de editarlo',
        );
      }
      if (
        (dto.idTipoConocimiento !== undefined &&
          dto.idTipoConocimiento !== actual.idTipoConocimiento) ||
        (dto.idAreaTematica !== undefined &&
          dto.idAreaTematica !== actual.idAreaTematica)
      ) {
        await this.validarDominios(
          dto.idTipoConocimiento ?? actual.idTipoConocimiento,
          dto.idAreaTematica ?? actual.idAreaTematica,
        );
      }
      const denominacion = dto.denominacion ?? actual.denominacion;
      const idTipo = dto.idTipoConocimiento ?? actual.idTipoConocimiento;
      const normalizada = normalizarDenominacion(denominacion);
      await this.exigirSinDuplicado(repo, idTipo, normalizada, id);
      const guardado = await repo.save({
        ...actual,
        denominacion,
        denominacionNormalizada: normalizada,
        idTipoConocimiento: idTipo,
        idAreaTematica: dto.idAreaTematica ?? actual.idAreaTematica,
        descripcion:
          dto.descripcion === undefined ? actual.descripcion : dto.descripcion,
      });
      return aConocimientoDto(guardado);
    });
  }

  async baja(id: number): Promise<ConocimientoDto> {
    return enTransaccionDeConocimiento(this.conocimientos, async (manager) => {
      const repo = manager.getRepository(Conocimiento);
      const actual = await this.exigir(repo, id);
      if (!actual.activo) return aConocimientoDto(actual);
      const usos = await manager.query<{ codigo: string }[]>(
        `SELECT p.codigo FROM requisito_puesto r
         JOIN puesto p ON p.id_puesto = r.id_puesto
         WHERE r.id_conocimiento = $1 AND p.activo
         ORDER BY p.codigo`,
        [id],
      );
      if (usos.length > 0) {
        const nombres = usos.slice(0, MAX_PUESTOS_EN_MENSAJE).map((u) => u.codigo);
        const resto = usos.length - nombres.length;
        throw new ConflictException(
          `No se puede dar de baja "${actual.denominacion}": lo piden los puestos ${nombres.join(', ')}${resto > 0 ? ` y ${resto} más` : ''}`,
        );
      }
      return aConocimientoDto(await repo.save({ ...actual, activo: false }));
    });
  }

  async reactivar(id: number): Promise<ConocimientoDto> {
    return enTransaccionDeConocimiento(this.conocimientos, async (manager) => {
      const repo = manager.getRepository(Conocimiento);
      const actual = await this.exigir(repo, id);
      if (actual.activo) return aConocimientoDto(actual);
      await this.validarDominios(actual.idTipoConocimiento, actual.idAreaTematica);
      await this.exigirSinDuplicado(
        repo,
        actual.idTipoConocimiento,
        actual.denominacionNormalizada,
        id,
      );
      return aConocimientoDto(await repo.save({ ...actual, activo: true }));
    });
  }

  private async validarDominios(idTipo: number, idArea: number): Promise<void> {
    await this.referencia.validarActivo(DOMINIO_TIPO_CONOCIMIENTO, idTipo);
    await this.referencia.validarActivo(DOMINIO_AREA_TEMATICA, idArea);
  }

  private async exigir(
    repo: Repository<Conocimiento>,
    id: number,
  ): Promise<Conocimiento> {
    const encontrado = await repo.findOne({ where: { id } });
    if (!encontrado) {
      throw new NotFoundException(`No existe el conocimiento ${id}`);
    }
    return encontrado;
  }

  /** Entre los activos del mismo tipo; `excluirId` evita chocar consigo mismo. */
  private async exigirSinDuplicado(
    repo: Repository<Conocimiento>,
    idTipo: number,
    normalizada: string,
    excluirId?: number,
  ): Promise<void> {
    const iguales = await repo.find({
      where: {
        idTipoConocimiento: idTipo,
        denominacionNormalizada: normalizada,
        activo: true,
      },
    });
    const otro = iguales.find((c) => c.id !== excluirId);
    if (otro) {
      throw new ConflictException(
        `Ya existe el conocimiento "${otro.denominacion}" (id ${otro.id}) con ese tipo`,
      );
    }
  }
}
```

- [x] **Paso 5: Verificar que pasa**

Run: `cd backend && npx vitest run src/modules/conocimiento/conocimientos.service.spec.ts`
Expected: PASS. Si el test de `listar` falla por la forma interna de `ILike` (`_value`), ajustar solo esa aserción para leer el valor del operador sin cambiar el servicio.

- [x] **Paso 6: Commit**

```bash
git add backend/src/modules/conocimiento
git commit -m "Implementar el catálogo de conocimientos con control de duplicados"
```

---

## Tarea 5: Requisitos de puesto (`RequisitosService`)

**Files:**
- Create: `backend/src/modules/conocimiento/dto/requisitos.dto.ts`
- Create: `backend/src/modules/conocimiento/requisitos.service.ts`
- Test: `backend/src/modules/conocimiento/requisitos.service.spec.ts`

**Interfaces:**
- Consumes: `RequisitoPuesto`, `Conocimiento` (tarea 3), `Puesto` de `estructura/entities/puesto.entity.js`, `enTransaccionDeConocimiento`, `DOMINIO_NIVEL_DOMINIO`.
- Produces: `RequisitosService` con `listar(idPuesto: number): Promise<RequisitoDto[]>`, `guardar(idPuesto: number, idConocimiento: number, dto: GuardarRequisitoDto): Promise<RequisitoDto>`, `quitar(idPuesto: number, idConocimiento: number): Promise<void>`, `copiar(idPuestoDestino: number, dto: CopiarRequisitosDto): Promise<ResultadoCopiaDto>`; DTOs `RequisitoDto { idPuesto, idConocimiento, denominacion, idTipoConocimiento, idNivelRequerido, esExcluyente }`, `GuardarRequisitoDto { idNivel, esExcluyente }`, `CopiarRequisitosDto { idPuestoOrigen }`, `ResultadoCopiaDto { copiados: number, omitidos: { idConocimiento, denominacion }[] }`.

- [x] **Paso 1: Crear los DTOs**

`dto/requisitos.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';

const MAX_INT4 = 2147483647;

export class GuardarRequisitoDto {
  @ApiProperty({ description: 'Nivel de dominio requerido (activo)' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idNivel: number;

  @ApiProperty({ description: 'true: excluyente; false: deseable' })
  @IsBoolean()
  esExcluyente: boolean;
}

export class CopiarRequisitosDto {
  @ApiProperty({ description: 'Puesto del que se copian los requisitos' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idPuestoOrigen: number;
}

export class RequisitoDto {
  @ApiProperty()
  idPuesto: number;

  @ApiProperty()
  idConocimiento: number;

  @ApiProperty()
  denominacion: string;

  @ApiProperty()
  idTipoConocimiento: number;

  @ApiProperty()
  idNivelRequerido: number;

  @ApiProperty()
  esExcluyente: boolean;
}

export class OmitidoDto {
  @ApiProperty()
  idConocimiento: number;

  @ApiProperty()
  denominacion: string;
}

export class ResultadoCopiaDto {
  @ApiProperty()
  copiados: number;

  @ApiProperty({
    type: OmitidoDto,
    isArray: true,
    description: 'Los que el puesto destino ya tenía; no se pisan',
  })
  omitidos: OmitidoDto[];
}
```

- [x] **Paso 2: Escribir los tests**

`requisitos.service.spec.ts`:

```ts
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { Puesto } from '../estructura/entities/puesto.entity.js';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { Conocimiento } from './entities/conocimiento.entity.js';
import type { RequisitoPuesto } from './entities/requisito-puesto.entity.js';
import { RequisitosService } from './requisitos.service.js';

const conocimiento = (id: number, activo = true) =>
  ({
    id,
    denominacion: `Conocimiento ${id}`,
    idTipoConocimiento: 3,
    activo,
  }) as Conocimiento;

const requisito = (
  idPuesto: number,
  idConocimiento: number,
  parcial: Partial<RequisitoPuesto> = {},
) =>
  ({
    idPuesto,
    idConocimiento,
    idNivelRequerido: 1,
    esExcluyente: false,
    conocimiento: conocimiento(idConocimiento),
    ...parcial,
  }) as RequisitoPuesto;

function crearEntorno(opciones: {
  requisitos?: RequisitoPuesto[];
  puestos?: Partial<Puesto>[];
  conocimientos?: Conocimiento[];
}) {
  const filas = (opciones.requisitos ?? []).map((r) => ({ ...r }));
  const puestos = opciones.puestos ?? [
    { id: 10, activo: true },
    { id: 11, activo: true },
  ];
  const conocimientos = opciones.conocimientos ?? [conocimiento(1), conocimiento(2)];
  const clave = (r: Partial<RequisitoPuesto>) => `${r.idPuesto}-${r.idConocimiento}`;
  const repoRequisitos = {
    find: vi.fn(async (o: { where: Partial<RequisitoPuesto> }) =>
      filas.filter((r) => r.idPuesto === o.where.idPuesto).map((r) => ({ ...r })),
    ),
    findOne: vi.fn(async (o: { where: Partial<RequisitoPuesto> }) => {
      const r = filas.find((x) => clave(x) === clave(o.where));
      return r ? { ...r } : null;
    }),
    save: vi.fn(async (r: RequisitoPuesto) => {
      const i = filas.findIndex((x) => clave(x) === clave(r));
      if (i >= 0) filas[i] = { ...filas[i], ...r };
      else filas.push({ ...r });
      return { ...r };
    }),
    insert: vi.fn(async (r: RequisitoPuesto) => {
      filas.push({ ...r });
    }),
    delete: vi.fn(async (k: Partial<RequisitoPuesto>) => {
      const i = filas.findIndex((x) => clave(x) === clave(k));
      if (i >= 0) filas.splice(i, 1);
    }),
  };
  const repoPuestos = {
    findOne: vi.fn(async (o: { where: { id: number } }) => {
      const p = puestos.find((x) => x.id === o.where.id);
      return p ? { ...p } : null;
    }),
  };
  const repoConocimientos = {
    findOne: vi.fn(async (o: { where: { id: number } }) => {
      const c = conocimientos.find((x) => x.id === o.where.id);
      return c ? { ...c } : null;
    }),
  };
  const manager = {
    getRepository: (entidad: { name: string }) =>
      entidad.name === 'RequisitoPuesto'
        ? repoRequisitos
        : entidad.name === 'Puesto'
          ? repoPuestos
          : repoConocimientos,
    query: vi.fn(async () => []),
    transaction: async (t: (m: unknown) => Promise<unknown>) => t(manager),
  };
  (repoRequisitos as unknown as { manager: unknown }).manager = manager;
  const referencia = { validarActivo: vi.fn(async () => undefined) };
  const servicio = new RequisitosService(
    repoRequisitos as unknown as Repository<RequisitoPuesto>,
    repoPuestos as unknown as Repository<Puesto>,
    repoConocimientos as unknown as Repository<Conocimiento>,
    referencia as unknown as ReferenciaService,
  );
  return { servicio, referencia, filas };
}

describe('RequisitosService.guardar', () => {
  it('da de alta el requisito y valida el nivel', async () => {
    const { servicio, referencia, filas } = crearEntorno({});
    const creado = await servicio.guardar(10, 1, { idNivel: 2, esExcluyente: true });
    expect(creado).toMatchObject({
      idPuesto: 10,
      idConocimiento: 1,
      idNivelRequerido: 2,
      esExcluyente: true,
      denominacion: 'Conocimiento 1',
    });
    expect(referencia.validarActivo).toHaveBeenCalledWith('nivel-dominio', 2);
    expect(filas).toHaveLength(1);
  });

  it('modifica el requisito existente en lugar de duplicarlo', async () => {
    const { servicio, filas } = crearEntorno({ requisitos: [requisito(10, 1)] });
    await servicio.guardar(10, 1, { idNivel: 4, esExcluyente: true });
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ idNivelRequerido: 4, esExcluyente: true });
  });

  it('rechaza un puesto inexistente (404), uno dado de baja (400) y un conocimiento inactivo (400)', async () => {
    const e = crearEntorno({
      puestos: [{ id: 10, activo: true }, { id: 12, activo: false }],
      conocimientos: [conocimiento(1), conocimiento(2, false)],
    });
    const dto = { idNivel: 1, esExcluyente: false };
    await expect(e.servicio.guardar(99, 1, dto)).rejects.toBeInstanceOf(NotFoundException);
    await expect(e.servicio.guardar(12, 1, dto)).rejects.toBeInstanceOf(BadRequestException);
    await expect(e.servicio.guardar(10, 2, dto)).rejects.toBeInstanceOf(BadRequestException);
    await expect(e.servicio.guardar(10, 77, dto)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('RequisitosService.quitar', () => {
  it('quita el requisito y da 404 si no existe', async () => {
    const { servicio, filas } = crearEntorno({ requisitos: [requisito(10, 1)] });
    await servicio.quitar(10, 1);
    expect(filas).toHaveLength(0);
    await expect(servicio.quitar(10, 1)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RequisitosService.copiar', () => {
  it('copia los requisitos del origen y omite, sin pisar, los que el destino ya tiene', async () => {
    const { servicio, filas } = crearEntorno({
      requisitos: [
        requisito(10, 1, { idNivelRequerido: 3, esExcluyente: true }),
        requisito(10, 2),
        requisito(11, 2, { idNivelRequerido: 4 }),
      ],
    });
    const resultado = await servicio.copiar(11, { idPuestoOrigen: 10 });
    expect(resultado.copiados).toBe(1);
    expect(resultado.omitidos).toEqual([
      { idConocimiento: 2, denominacion: 'Conocimiento 2' },
    ]);
    const destino = filas.filter((r) => r.idPuesto === 11);
    expect(destino).toHaveLength(2);
    expect(destino.find((r) => r.idConocimiento === 2)?.idNivelRequerido).toBe(4);
    expect(destino.find((r) => r.idConocimiento === 1)).toMatchObject({
      idNivelRequerido: 3,
      esExcluyente: true,
    });
  });

  it('no copia requisitos de conocimientos inactivos', async () => {
    const inactivo = requisito(10, 2);
    inactivo.conocimiento = conocimiento(2, false);
    const { servicio, filas } = crearEntorno({
      requisitos: [requisito(10, 1), inactivo],
    });
    const resultado = await servicio.copiar(11, { idPuestoOrigen: 10 });
    expect(resultado.copiados).toBe(1);
    expect(filas.filter((r) => r.idPuesto === 11)).toHaveLength(1);
  });

  it('rechaza copiar un puesto a sí mismo, un origen inexistente y un destino de baja', async () => {
    const e = crearEntorno({ puestos: [{ id: 10, activo: true }, { id: 12, activo: false }] });
    await expect(e.servicio.copiar(10, { idPuestoOrigen: 10 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(e.servicio.copiar(10, { idPuestoOrigen: 99 })).rejects.toBeInstanceOf(NotFoundException);
    await expect(e.servicio.copiar(12, { idPuestoOrigen: 10 })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('RequisitosService.listar', () => {
  it('ordena por denominación y da 404 si el puesto no existe', async () => {
    const { servicio } = crearEntorno({
      requisitos: [requisito(10, 2), requisito(10, 1)],
    });
    const lista = await servicio.listar(10);
    expect(lista.map((r) => r.idConocimiento)).toEqual([1, 2]);
    await expect(servicio.listar(99)).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [x] **Paso 3: Verificar que falla**

Run: `cd backend && npx vitest run src/modules/conocimiento/requisitos.service.spec.ts`
Expected: FAIL (no se encuentra `./requisitos.service.js`).

- [x] **Paso 4: Implementar el servicio**

`requisitos.service.ts`:

```ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Puesto } from '../estructura/entities/puesto.entity.js';
import { ReferenciaService } from '../referencia/referencia.service.js';
import { DOMINIO_NIVEL_DOMINIO } from './conocimiento.constantes.js';
import type {
  CopiarRequisitosDto,
  GuardarRequisitoDto,
  RequisitoDto,
  ResultadoCopiaDto,
} from './dto/requisitos.dto.js';
import { Conocimiento } from './entities/conocimiento.entity.js';
import { RequisitoPuesto } from './entities/requisito-puesto.entity.js';
import { enTransaccionDeConocimiento } from './transaccion.js';

function aRequisitoDto(
  r: RequisitoPuesto,
  c: Pick<Conocimiento, 'denominacion' | 'idTipoConocimiento'>,
): RequisitoDto {
  return {
    idPuesto: r.idPuesto,
    idConocimiento: r.idConocimiento,
    denominacion: c.denominacion,
    idTipoConocimiento: c.idTipoConocimiento,
    idNivelRequerido: r.idNivelRequerido,
    esExcluyente: r.esExcluyente,
  };
}

/** Requisitos de conocimiento de cada puesto (RF09). Las escrituras corren con el bloqueo de conocimiento. */
@Injectable()
export class RequisitosService {
  constructor(
    @InjectRepository(RequisitoPuesto)
    private readonly requisitos: Repository<RequisitoPuesto>,
    @InjectRepository(Puesto) private readonly puestos: Repository<Puesto>,
    @InjectRepository(Conocimiento)
    private readonly conocimientos: Repository<Conocimiento>,
    private readonly referencia: ReferenciaService,
  ) {}

  async listar(idPuesto: number): Promise<RequisitoDto[]> {
    await this.exigirPuesto(this.puestos, idPuesto);
    const filas = await this.requisitos.find({
      where: { idPuesto },
      relations: { conocimiento: true },
    });
    return filas
      .map((r) => aRequisitoDto(r, r.conocimiento))
      .sort((a, b) => a.denominacion.localeCompare(b.denominacion, 'es'));
  }

  async guardar(
    idPuesto: number,
    idConocimiento: number,
    dto: GuardarRequisitoDto,
  ): Promise<RequisitoDto> {
    await this.referencia.validarActivo(DOMINIO_NIVEL_DOMINIO, dto.idNivel);
    return enTransaccionDeConocimiento(this.requisitos, async (manager) => {
      const puesto = await this.exigirPuesto(manager.getRepository(Puesto), idPuesto);
      this.exigirPuestoActivo(puesto, idPuesto);
      const conocimiento = await manager
        .getRepository(Conocimiento)
        .findOne({ where: { id: idConocimiento } });
      if (!conocimiento || !conocimiento.activo) {
        throw new BadRequestException(
          `El conocimiento ${idConocimiento} no existe o está dado de baja`,
        );
      }
      const guardado = await manager.getRepository(RequisitoPuesto).save({
        idPuesto,
        idConocimiento,
        idNivelRequerido: dto.idNivel,
        esExcluyente: dto.esExcluyente,
      } as RequisitoPuesto);
      return aRequisitoDto(guardado, conocimiento);
    });
  }

  async quitar(idPuesto: number, idConocimiento: number): Promise<void> {
    await enTransaccionDeConocimiento(this.requisitos, async (manager) => {
      const repo = manager.getRepository(RequisitoPuesto);
      const actual = await repo.findOne({ where: { idPuesto, idConocimiento } });
      if (!actual) {
        throw new NotFoundException(
          `El puesto ${idPuesto} no tiene ese requisito`,
        );
      }
      await repo.delete({ idPuesto, idConocimiento });
    });
  }

  /** Copia puntual: los requisitos que el destino ya tiene no se pisan. */
  async copiar(
    idPuestoDestino: number,
    dto: CopiarRequisitosDto,
  ): Promise<ResultadoCopiaDto> {
    if (dto.idPuestoOrigen === idPuestoDestino) {
      throw new BadRequestException('El puesto de origen y el de destino son el mismo');
    }
    return enTransaccionDeConocimiento(this.requisitos, async (manager) => {
      const puestos = manager.getRepository(Puesto);
      const destino = await this.exigirPuesto(puestos, idPuestoDestino);
      this.exigirPuestoActivo(destino, idPuestoDestino);
      await this.exigirPuesto(puestos, dto.idPuestoOrigen);

      const repo = manager.getRepository(RequisitoPuesto);
      const delOrigen = await repo.find({
        where: { idPuesto: dto.idPuestoOrigen },
        relations: { conocimiento: true },
      });
      const yaTiene = new Set(
        (await repo.find({ where: { idPuesto: idPuestoDestino } })).map(
          (r) => r.idConocimiento,
        ),
      );

      const resultado: ResultadoCopiaDto = { copiados: 0, omitidos: [] };
      for (const r of delOrigen.filter((x) => x.conocimiento.activo)) {
        if (yaTiene.has(r.idConocimiento)) {
          resultado.omitidos.push({
            idConocimiento: r.idConocimiento,
            denominacion: r.conocimiento.denominacion,
          });
          continue;
        }
        await repo.insert({
          idPuesto: idPuestoDestino,
          idConocimiento: r.idConocimiento,
          idNivelRequerido: r.idNivelRequerido,
          esExcluyente: r.esExcluyente,
        });
        resultado.copiados += 1;
      }
      return resultado;
    });
  }

  private async exigirPuesto(
    repo: Repository<Puesto>,
    idPuesto: number,
  ): Promise<Puesto> {
    const puesto = await repo.findOne({ where: { id: idPuesto } });
    if (!puesto) throw new NotFoundException(`No existe el puesto ${idPuesto}`);
    return puesto;
  }

  private exigirPuestoActivo(puesto: Puesto, idPuesto: number): void {
    if (!puesto.activo) {
      throw new BadRequestException(`El puesto ${idPuesto} está dado de baja`);
    }
  }
}
```

- [x] **Paso 5: Verificar que pasa y commitear**

Run: `cd backend && npx vitest run src/modules/conocimiento/requisitos.service.spec.ts`
Expected: PASS.

```bash
git add backend/src/modules/conocimiento
git commit -m "Implementar los requisitos de puesto con copia entre puestos"
```

---

## Tarea 6: Entidades `ConocimientoPersona` y `Acreditacion` y su migración

**Files:**
- Create: `backend/src/modules/conocimiento/entities/conocimiento-persona.entity.ts`
- Create: `backend/src/modules/conocimiento/entities/acreditacion.entity.ts`
- Create: `backend/src/modules/conocimiento/sql.ts`
- Create: `backend/src/infra/database/migrations/<timestamp>-CrearConocimientoPersonaYAcreditacion.ts` (lo genera TypeORM)
- Test: `backend/src/modules/conocimiento/conocimiento-persona.int.spec.ts`

**Interfaces:**
- Consumes: `Persona` (`personas/entities/persona.entity.js`), `Conocimiento`, `NivelDominio`, `TipoEvidencia`.
- Produces: `ConocimientoPersona { idPersona, idConocimiento, idNivelDeclarado, fechaDeclaracion, idNivelAcreditado, fechaEvaluacion, idTipoEvidencia, idEvaluador }` (los seis últimos, anulables); `Acreditacion { id, idPersona, idConocimiento, idNivelAcreditado, idTipoEvidencia, fechaEvaluacion, idEvaluador, observaciones: string | null, registradaEn: Date }`; constantes SQL `SQL_ASEGURAR_FILA` (parámetros `[idPersona, idConocimiento, idNivel, fechaEvaluacion, idTipoEvidencia, idEvaluador]`) y `SQL_REFLEJAR_VIGENTE` (parámetros `[idPersona, idConocimiento]`).

- [x] **Paso 1: Crear las entidades**

`conocimiento-persona.entity.ts`:

```ts
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { NivelDominio } from '../../referencia/entities/nivel-dominio.entity.js';
import { TipoEvidencia } from '../../referencia/entities/tipo-evidencia.entity.js';
import { Persona } from '../../personas/entities/persona.entity.js';
import { Conocimiento } from './conocimiento.entity.js';

/**
 * Lo que una persona sabe de un conocimiento (RF10): el nivel que declara y
 * el reflejo de su acreditación vigente. El servicio es el único que escribe
 * los cuatro campos de acreditación, y siempre con el valor de la más reciente
 * de `acreditacion`. Las fechas son `AAAA-MM-DD`.
 */
@Entity('conocimiento_persona')
@Check(
  'CK_conocimiento_persona_algun_nivel',
  '"id_nivel_declarado" IS NOT NULL OR "id_nivel_acreditado" IS NOT NULL',
)
@Check(
  'CK_conocimiento_persona_declaracion_completa',
  '("id_nivel_declarado" IS NULL) = ("fecha_declaracion" IS NULL)',
)
@Check(
  'CK_conocimiento_persona_acreditacion_completa',
  '("id_nivel_acreditado" IS NULL) = ("fecha_evaluacion" IS NULL) AND ("id_nivel_acreditado" IS NULL) = ("id_tipo_evidencia" IS NULL) AND ("id_nivel_acreditado" IS NULL) = ("id_evaluador" IS NULL)',
)
@Index('IDX_conocimiento_persona_conocimiento', ['idConocimiento'])
export class ConocimientoPersona {
  @PrimaryColumn({ name: 'id_persona', type: 'int' })
  idPersona: number;

  @PrimaryColumn({ name: 'id_conocimiento', type: 'int' })
  idConocimiento: number;

  @Column({ name: 'id_nivel_declarado', type: 'int', nullable: true })
  idNivelDeclarado: number | null;

  @Column({ type: 'date', nullable: true })
  fechaDeclaracion: string | null;

  @Column({ name: 'id_nivel_acreditado', type: 'int', nullable: true })
  idNivelAcreditado: number | null;

  @Column({ type: 'date', nullable: true })
  fechaEvaluacion: string | null;

  @Column({ name: 'id_tipo_evidencia', type: 'int', nullable: true })
  idTipoEvidencia: number | null;

  @Column({ name: 'id_evaluador', type: 'int', nullable: true })
  idEvaluador: number | null;

  @ManyToOne(() => Persona, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_persona' })
  persona: Relation<Persona>;

  @ManyToOne(() => Conocimiento, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_conocimiento' })
  conocimiento: Relation<Conocimiento>;

  @ManyToOne(() => NivelDominio, { nullable: true })
  @JoinColumn({ name: 'id_nivel_declarado' })
  nivelDeclarado: Relation<NivelDominio> | null;

  @ManyToOne(() => NivelDominio, { nullable: true })
  @JoinColumn({ name: 'id_nivel_acreditado' })
  nivelAcreditado: Relation<NivelDominio> | null;

  @ManyToOne(() => TipoEvidencia, { nullable: true })
  @JoinColumn({ name: 'id_tipo_evidencia' })
  tipoEvidencia: Relation<TipoEvidencia> | null;

  @ManyToOne(() => Persona, { nullable: true })
  @JoinColumn({ name: 'id_evaluador' })
  evaluador: Relation<Persona> | null;
}
```

`acreditacion.entity.ts`:

```ts
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Persona } from '../../personas/entities/persona.entity.js';
import { NivelDominio } from '../../referencia/entities/nivel-dominio.entity.js';
import { TipoEvidencia } from '../../referencia/entities/tipo-evidencia.entity.js';
import { ConocimientoPersona } from './conocimiento-persona.entity.js';

/**
 * Una evaluación de un conocimiento de una persona. Solo se agregan filas:
 * un error se corrige con una acreditación nueva y más reciente. Es el
 * historial, por eso no se audita. Vigente: mayor `fechaEvaluacion` y, en
 * empate, mayor `id`.
 */
@Entity('acreditacion')
@Check('CK_acreditacion_fecha_no_futura', '"fecha_evaluacion" <= CURRENT_DATE')
@Index('IDX_acreditacion_persona_conocimiento', ['idPersona', 'idConocimiento'])
export class Acreditacion {
  @PrimaryGeneratedColumn({ name: 'id_acreditacion' })
  id: number;

  @Column({ name: 'id_persona', type: 'int' })
  idPersona: number;

  @Column({ name: 'id_conocimiento', type: 'int' })
  idConocimiento: number;

  @Column({ name: 'id_nivel_acreditado', type: 'int' })
  idNivelAcreditado: number;

  @Column({ name: 'id_tipo_evidencia', type: 'int' })
  idTipoEvidencia: number;

  @Column({ type: 'date' })
  fechaEvaluacion: string;

  @Column({ name: 'id_evaluador', type: 'int' })
  idEvaluador: number;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  registradaEn: Date;

  @ManyToOne(() => ConocimientoPersona, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn([
    { name: 'id_persona', referencedColumnName: 'idPersona' },
    { name: 'id_conocimiento', referencedColumnName: 'idConocimiento' },
  ])
  conocimientoPersona: Relation<ConocimientoPersona>;

  @ManyToOne(() => NivelDominio, { nullable: false })
  @JoinColumn({ name: 'id_nivel_acreditado' })
  nivelAcreditado: Relation<NivelDominio>;

  @ManyToOne(() => TipoEvidencia, { nullable: false })
  @JoinColumn({ name: 'id_tipo_evidencia' })
  tipoEvidencia: Relation<TipoEvidencia>;

  @ManyToOne(() => Persona, { nullable: false })
  @JoinColumn({ name: 'id_evaluador' })
  evaluador: Relation<Persona>;
}
```

- [x] **Paso 2: Crear el SQL compartido**

`sql.ts`:

```ts
/**
 * Crea la fila de `conocimiento_persona` cuando una persona recibe su primera
 * acreditación sin haber declarado. La fila nace con la acreditación misma
 * (la restricción exige al menos un nivel); si ya existía no hace nada.
 * Parámetros: persona, conocimiento, nivel, fecha, tipo de evidencia, evaluador.
 */
export const SQL_ASEGURAR_FILA = `
  INSERT INTO conocimiento_persona
    (id_persona, id_conocimiento, id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador)
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (id_persona, id_conocimiento) DO NOTHING`;

/**
 * Copia a `conocimiento_persona` la acreditación vigente de la persona:
 * la de mayor fecha de evaluación y, en empate, la de mayor id.
 * Parámetros: persona, conocimiento.
 */
export const SQL_REFLEJAR_VIGENTE = `
  UPDATE conocimiento_persona cp
  SET id_nivel_acreditado = v.id_nivel_acreditado,
      fecha_evaluacion = v.fecha_evaluacion,
      id_tipo_evidencia = v.id_tipo_evidencia,
      id_evaluador = v.id_evaluador
  FROM (
    SELECT id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador
    FROM acreditacion
    WHERE id_persona = $1 AND id_conocimiento = $2
    ORDER BY fecha_evaluacion DESC, id_acreditacion DESC
    LIMIT 1
  ) v
  WHERE cp.id_persona = $1 AND cp.id_conocimiento = $2`;
```

- [x] **Paso 3: Generar y revisar la migración**

Run: `docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/CrearConocimientoPersonaYAcreditacion`

Revisar a mano. Debe crear solo `conocimiento_persona` (clave `(id_persona, id_conocimiento)`, los tres CHECK, el índice por `id_conocimiento` y las FK) y `acreditacion` (con `CK_acreditacion_fecha_no_futura`, el índice `IDX_acreditacion_persona_conocimiento`, la FK compuesta `(id_persona, id_conocimiento) → conocimiento_persona` con `ON DELETE RESTRICT`, y las FK a niveles, tipo de evidencia y persona evaluadora). Verificar que `registrada_en` sea `TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`. Borrar cualquier otra sentencia.

- [x] **Paso 4: Escribir el test de integración**

`conocimiento-persona.int.spec.ts`:

```ts
import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { SQL_ASEGURAR_FILA, SQL_REFLEJAR_VIGENTE } from './sql.js';

describe('Conocimiento de las personas (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let persona: number;
  let evaluador: number;
  let conocimiento: number;
  let basico: number;
  let avanzado: number;
  let evidencia: number;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const id = async (consulta: string) =>
    (await sql<{ id: number }[]>(consulta))[0].id;
  const dia = async (delta: number) =>
    (
      await sql<{ f: string }[]>(`SELECT (CURRENT_DATE + $1::int)::text AS f`, [
        delta,
      ])
    )[0].f;

  const nuevaPersona = async (legajo: string, documento: string) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
         SELECT $1, 'Pérez', 'Ana', $2, '1980-01-01', '2005-03-01', id_situacion_revista
         FROM situacion_revista WHERE codigo = 'planta_permanente'
         RETURNING id_persona AS id`,
        [legajo, documento],
      )
    )[0].id;

  const acreditacion = (fecha: string, nivel: number) =>
    sql(
      `INSERT INTO acreditacion (id_persona, id_conocimiento, id_nivel_acreditado, id_tipo_evidencia, fecha_evaluacion, id_evaluador)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [persona, conocimiento, nivel, evidencia, fecha, evaluador],
    );

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    persona = await nuevaPersona('L-1', '30111111');
    evaluador = await nuevaPersona('L-2', '30222222');
    basico = await id(
      `SELECT id_nivel_dominio AS id FROM nivel_dominio WHERE codigo = 'basico'`,
    );
    avanzado = await id(
      `SELECT id_nivel_dominio AS id FROM nivel_dominio WHERE codigo = 'avanzado'`,
    );
    evidencia = await id(
      `SELECT id_tipo_evidencia AS id FROM tipo_evidencia WHERE codigo = 'titulo'`,
    );
    conocimiento = (
      await sql<{ id: number }[]>(
        `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
         SELECT 'SQL', 'sql', t.id_tipo_conocimiento, a.id_area_tematica
         FROM tipo_conocimiento t, area_tematica a
         WHERE t.codigo = 'competencia_tecnica' ORDER BY a.id_area_tematica LIMIT 1
         RETURNING id_conocimiento AS id`,
      )
    )[0].id;
  });
  afterAll(async () => {
    await base.destruir();
  });
  afterEach(async () => {
    await sql('DELETE FROM acreditacion');
    await sql('DELETE FROM conocimiento_persona');
  });

  const fila = (campos: string, valores: unknown[]) =>
    sql(
      `INSERT INTO conocimiento_persona (id_persona, id_conocimiento, ${campos})
       VALUES ($1, $2, ${valores.map((_, i) => `$${i + 3}`).join(', ')})`,
      [persona, conocimiento, ...valores],
    );

  it('rechaza una fila sin ningún nivel', async () => {
    await expect(
      sql(
        `INSERT INTO conocimiento_persona (id_persona, id_conocimiento) VALUES ($1, $2)`,
        [persona, conocimiento],
      ),
    ).rejects.toThrow(/CK_conocimiento_persona_algun_nivel/);
  });

  it('exige que el nivel declarado y su fecha estén juntos', async () => {
    await expect(fila('id_nivel_declarado', [basico])).rejects.toThrow(
      /CK_conocimiento_persona_declaracion_completa/,
    );
  });

  it('exige que los cuatro campos de acreditación estén juntos', async () => {
    await expect(
      fila('id_nivel_acreditado, fecha_evaluacion', [basico, await dia(-1)]),
    ).rejects.toThrow(/CK_conocimiento_persona_acreditacion_completa/);
  });

  it('una acreditación necesita su fila de conocimiento_persona', async () => {
    await expect(acreditacion(await dia(-1), basico)).rejects.toThrow(
      /foreign key/,
    );
  });

  it('rechaza una acreditación con fecha futura', async () => {
    await sql(SQL_ASEGURAR_FILA, [
      persona,
      conocimiento,
      basico,
      await dia(-5),
      evidencia,
      evaluador,
    ]);
    await expect(acreditacion(await dia(1), basico)).rejects.toThrow(
      /CK_acreditacion_fecha_no_futura/,
    );
  });

  it('asegurar la fila crea una vez; repetirlo no cambia nada', async () => {
    const parametros = [persona, conocimiento, basico, await dia(-5), evidencia, evaluador];
    await sql(SQL_ASEGURAR_FILA, parametros);
    await sql(SQL_ASEGURAR_FILA, [persona, conocimiento, avanzado, await dia(-1), evidencia, evaluador]);
    const filas = await sql<{ n: number }[]>(
      `SELECT id_nivel_acreditado AS n FROM conocimiento_persona`,
    );
    expect(filas).toEqual([{ n: basico }]);
  });

  describe('reflejo de la acreditación vigente', () => {
    const reflejado = async () =>
      (
        await sql<{ n: number; f: string }[]>(
          `SELECT id_nivel_acreditado AS n, fecha_evaluacion::text AS f FROM conocimiento_persona`,
        )
      )[0];

    beforeEach(async () => {
      await sql(SQL_ASEGURAR_FILA, [persona, conocimiento, basico, await dia(-10), evidencia, evaluador]);
      await acreditacion(await dia(-10), basico);
    });

    it('una acreditación más reciente reemplaza el reflejo', async () => {
      await acreditacion(await dia(-2), avanzado);
      await sql(SQL_REFLEJAR_VIGENTE, [persona, conocimiento]);
      expect(await reflejado()).toEqual({ n: avanzado, f: await dia(-2) });
    });

    it('una acreditación anterior queda en el historial y no cambia el reflejo', async () => {
      await acreditacion(await dia(-30), avanzado);
      await sql(SQL_REFLEJAR_VIGENTE, [persona, conocimiento]);
      expect(await reflejado()).toEqual({ n: basico, f: await dia(-10) });
      expect(await sql('SELECT 1 FROM acreditacion')).toHaveLength(2);
    });

    it('con la misma fecha gana la de mayor id', async () => {
      await acreditacion(await dia(-10), avanzado);
      await sql(SQL_REFLEJAR_VIGENTE, [persona, conocimiento]);
      expect((await reflejado()).n).toBe(avanzado);
    });
  });
});
```

- [x] **Paso 5: Correr el test de integración**

Run: `docker compose up -d db && cd backend && npx vitest run --config vitest.integracion.config.ts src/modules/conocimiento/conocimiento-persona.int.spec.ts`
Expected: PASS. Si el nombre de una restricción difiere en el mensaje, ajustar la expresión regular del test, no la migración.

- [x] **Paso 6: Aplicar y commitear**

Run: `docker compose exec -T backend npm run migration:run`

```bash
git add backend/src/modules/conocimiento backend/src/infra/database
git commit -m "Agregar conocimiento_persona y acreditacion con el reflejo de la acreditación vigente"
```

---

## Tarea 7: Fusión de conocimientos duplicados

**Files:**
- Create: `backend/src/modules/conocimiento/fusion.sql.ts`
- Modify: `backend/src/modules/conocimiento/conocimientos.service.ts`
- Modify: `backend/src/modules/conocimiento/conocimientos.service.spec.ts`
- Test: `backend/src/modules/conocimiento/fusion.int.spec.ts`

**Interfaces:**
- Consumes: `ConocimientosService` (tarea 4), `FusionarConocimientoDto` y `ResultadoFusionDto` (ya definidos), las tablas de la tarea 6.
- Produces: `ConocimientosService.fusionar(idOrigen: number, dto: FusionarConocimientoDto): Promise<ResultadoFusionDto>`; `PASOS_FUSION: string[]`, `SQL_CONTAR_REQUISITOS`, `SQL_CONTAR_PERSONAS`.

- [x] **Paso 1: Crear el SQL de la fusión**

`fusion.sql.ts`. Cada paso recibe `[idOrigen, idDestino]` y usa los dos parámetros (Postgres rechaza parámetros que la sentencia no referencia); donde un paso solo necesita uno, el otro se referencia con `$n::int IS NOT NULL`.

```ts
/** Cuántos requisitos de puesto pide el conocimiento (parámetro: id). */
export const SQL_CONTAR_REQUISITOS = `SELECT count(*)::int AS n FROM requisito_puesto WHERE id_conocimiento = $1`;

/** Cuántas personas tienen datos del conocimiento (parámetro: id). */
export const SQL_CONTAR_PERSONAS = `SELECT count(*)::int AS n FROM conocimiento_persona WHERE id_conocimiento = $1`;

/**
 * Pasos de la fusión, en orden, todos con `[idOrigen, idDestino]`.
 * Requisitos: donde un puesto pedía ambos queda el nivel más exigente y
 * excluyente si alguno lo era. Personas: el declarado más alto; las
 * acreditaciones del origen pasan al destino y el reflejo se recalcula con la
 * regla de siempre (la más reciente, no la de nivel más alto).
 */
export const PASOS_FUSION: string[] = [
  // 1. Puestos que pedían ambos: se endurece el requisito del destino.
  `UPDATE requisito_puesto rd
   SET id_nivel_requerido = CASE
         WHEN (SELECT orden FROM nivel_dominio WHERE id_nivel_dominio = ro.id_nivel_requerido)
            > (SELECT orden FROM nivel_dominio WHERE id_nivel_dominio = rd.id_nivel_requerido)
         THEN ro.id_nivel_requerido ELSE rd.id_nivel_requerido END,
       es_excluyente = rd.es_excluyente OR ro.es_excluyente
   FROM requisito_puesto ro
   WHERE ro.id_conocimiento = $1 AND rd.id_conocimiento = $2
     AND rd.id_puesto = ro.id_puesto`,
  // 2. Se descartan los requisitos del origen que ya quedaron absorbidos.
  `DELETE FROM requisito_puesto ro USING requisito_puesto rd
   WHERE ro.id_conocimiento = $1 AND rd.id_conocimiento = $2
     AND rd.id_puesto = ro.id_puesto`,
  // 3. Los demás requisitos del origen pasan al destino.
  `UPDATE requisito_puesto SET id_conocimiento = $2 WHERE id_conocimiento = $1`,
  // 4. Personas que solo tenían el origen: su fila se copia al destino.
  `INSERT INTO conocimiento_persona
     (id_persona, id_conocimiento, id_nivel_declarado, fecha_declaracion,
      id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador)
   SELECT co.id_persona, $2, co.id_nivel_declarado, co.fecha_declaracion,
          co.id_nivel_acreditado, co.fecha_evaluacion, co.id_tipo_evidencia, co.id_evaluador
   FROM conocimiento_persona co
   WHERE co.id_conocimiento = $1
     AND NOT EXISTS (
       SELECT 1 FROM conocimiento_persona cd
       WHERE cd.id_persona = co.id_persona AND cd.id_conocimiento = $2)`,
  // 5. Personas que tenían ambos: queda el nivel declarado más alto.
  `UPDATE conocimiento_persona cd
   SET id_nivel_declarado = co.id_nivel_declarado,
       fecha_declaracion = co.fecha_declaracion
   FROM conocimiento_persona co
   WHERE co.id_conocimiento = $1 AND cd.id_conocimiento = $2
     AND cd.id_persona = co.id_persona
     AND co.id_nivel_declarado IS NOT NULL
     AND (cd.id_nivel_declarado IS NULL
          OR (SELECT orden FROM nivel_dominio WHERE id_nivel_dominio = co.id_nivel_declarado)
           > (SELECT orden FROM nivel_dominio WHERE id_nivel_dominio = cd.id_nivel_declarado))`,
  // 6. El historial de acreditaciones pasa al destino.
  `UPDATE acreditacion SET id_conocimiento = $2 WHERE id_conocimiento = $1`,
  // 7. El reflejo del destino se recalcula: la acreditación más reciente.
  `UPDATE conocimiento_persona cp
   SET id_nivel_acreditado = v.id_nivel_acreditado,
       fecha_evaluacion = v.fecha_evaluacion,
       id_tipo_evidencia = v.id_tipo_evidencia,
       id_evaluador = v.id_evaluador
   FROM (
     SELECT DISTINCT ON (id_persona)
            id_persona, id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador
     FROM acreditacion
     WHERE id_conocimiento = $2
     ORDER BY id_persona, fecha_evaluacion DESC, id_acreditacion DESC
   ) v
   WHERE cp.id_conocimiento = $2 AND cp.id_persona = v.id_persona
     AND $1::int IS NOT NULL`,
  // 8. Las filas del origen ya no tienen nada que las sostenga.
  `DELETE FROM conocimiento_persona WHERE id_conocimiento = $1 AND $2::int IS NOT NULL`,
];
```

- [x] **Paso 2: Escribir los tests unitarios de la fusión**

Agregar al final de `conocimientos.service.spec.ts`:

```ts
import {
  PASOS_FUSION,
  SQL_CONTAR_PERSONAS,
  SQL_CONTAR_REQUISITOS,
} from './fusion.sql.js';

describe('ConocimientosService.fusionar', () => {
  const origen = existente({ id: 1, denominacion: 'Python 3' });
  const destino = existente({
    id: 2,
    denominacion: 'Python',
    denominacionNormalizada: 'python',
  });

  it('rechaza fusionar un conocimiento consigo mismo', async () => {
    const { servicio } = crearEntorno([origen]);
    await expect(servicio.fusionar(1, { idDestino: 1 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('da 404 si el origen o el destino no existen', async () => {
    const { servicio } = crearEntorno([origen]);
    await expect(servicio.fusionar(1, { idDestino: 9 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(servicio.fusionar(9, { idDestino: 1 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('exige que los dos estén activos y sean del mismo tipo', async () => {
    const inactivo = crearEntorno([origen, { ...destino, activo: false }]);
    await expect(
      inactivo.servicio.fusionar(1, { idDestino: 2 }),
    ).rejects.toThrow(/activos/);
    const otroTipo = crearEntorno([origen, { ...destino, idTipoConocimiento: 4 }]);
    await expect(
      otroTipo.servicio.fusionar(1, { idDestino: 2 }),
    ).rejects.toThrow(/mismo tipo/);
  });

  it('corre todos los pasos en orden, deja el origen inactivo y informa lo movido', async () => {
    const { servicio, manager, filas } = crearEntorno([origen, destino]);
    manager.query.mockImplementation(async (sql: string) => {
      if (sql === SQL_CONTAR_REQUISITOS) return [{ n: 3 }];
      if (sql === SQL_CONTAR_PERSONAS) return [{ n: 5 }];
      return [];
    });

    const resultado = await servicio.fusionar(1, { idDestino: 2 });

    const pasos = manager.query.mock.calls
      .filter(([sql]) => PASOS_FUSION.includes(sql as string))
      .map(([sql, parametros]) => [sql, parametros]);
    expect(pasos).toEqual(PASOS_FUSION.map((sql) => [sql, [1, 2]]));
    expect(resultado).toEqual({
      idOrigen: 1,
      idDestino: 2,
      requisitosMovidos: 3,
      personasMovidas: 5,
    });
    expect(filas.find((f) => f.id === 1)).toMatchObject({
      activo: false,
      idFusionadoEn: 2,
    });
    expect(filas.find((f) => f.id === 2)?.activo).toBe(true);
  });
});
```

(Los `import` van junto a los del encabezado del archivo.)

- [x] **Paso 3: Verificar que falla**

Run: `cd backend && npx vitest run src/modules/conocimiento/conocimientos.service.spec.ts -t fusionar`
Expected: FAIL (`servicio.fusionar is not a function`).

- [x] **Paso 4: Implementar `fusionar`**

En `conocimientos.service.ts`, importar `BadRequestException` (de `@nestjs/common`), `FusionarConocimientoDto` y `ResultadoFusionDto` (de `./dto/catalogo.dto.js`) y `{ PASOS_FUSION, SQL_CONTAR_PERSONAS, SQL_CONTAR_REQUISITOS }` (de `./fusion.sql.js`). Agregar el método después de `reactivar`:

```ts
  /**
   * Fusiona un duplicado (`idOrigen`) en el conocimiento que se conserva.
   * Todo o nada, bajo el bloqueo de conocimiento; no se puede deshacer.
   */
  async fusionar(
    idOrigen: number,
    dto: FusionarConocimientoDto,
  ): Promise<ResultadoFusionDto> {
    const idDestino = dto.idDestino;
    if (idOrigen === idDestino) {
      throw new BadRequestException(
        'El origen y el destino de la fusión son el mismo conocimiento',
      );
    }
    return enTransaccionDeConocimiento(this.conocimientos, async (manager) => {
      const repo = manager.getRepository(Conocimiento);
      const origen = await this.exigir(repo, idOrigen);
      const destino = await this.exigir(repo, idDestino);
      if (!origen.activo || !destino.activo) {
        throw new BadRequestException(
          'Los dos conocimientos deben estar activos para fusionarlos',
        );
      }
      if (origen.idTipoConocimiento !== destino.idTipoConocimiento) {
        throw new BadRequestException(
          'Solo se fusionan conocimientos del mismo tipo: corregí antes el tipo de uno de ellos',
        );
      }

      const [{ n: requisitosMovidos }] = await manager.query<{ n: number }[]>(
        SQL_CONTAR_REQUISITOS,
        [idOrigen],
      );
      const [{ n: personasMovidas }] = await manager.query<{ n: number }[]>(
        SQL_CONTAR_PERSONAS,
        [idOrigen],
      );
      for (const paso of PASOS_FUSION) {
        await manager.query(paso, [idOrigen, idDestino]);
      }
      await repo.save({ ...origen, activo: false, idFusionadoEn: idDestino });

      return { idOrigen, idDestino, requisitosMovidos, personasMovidas };
    });
  }
```

- [x] **Paso 5: Verificar los unitarios**

Run: `cd backend && npx vitest run src/modules/conocimiento/conocimientos.service.spec.ts`
Expected: PASS.

- [x] **Paso 6: Escribir el test de integración de la fusión**

`fusion.int.spec.ts`:

```ts
import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import { ConocimientosService } from './conocimientos.service.js';
import { Conocimiento } from './entities/conocimiento.entity.js';

describe('Fusión de conocimientos (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let servicio: ConocimientosService;
  let niveles: Record<string, number>;
  let evidencia: number;
  let tipo: number;
  let area: number;
  let puestoX: number;
  let puestoY: number;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;

  const nuevaPersona = async (n: number) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
         SELECT $1, 'Pérez', 'Ana', $2, '1980-01-01', '2005-03-01', id_situacion_revista
         FROM situacion_revista WHERE codigo = 'planta_permanente'
         RETURNING id_persona AS id`,
        [`L-${n}`, `3000000${n}`],
      )
    )[0].id;
  const nuevoConocimiento = async (denominacion: string, normalizada: string) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
         VALUES ($1, $2, $3, $4) RETURNING id_conocimiento AS id`,
        [denominacion, normalizada, tipo, area],
      )
    )[0].id;
  const nuevoPuesto = async (codigo: string) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
         SELECT $1, $1, (SELECT id_unidad FROM unidad_organizativa WHERE id_unidad_superior IS NULL),
                id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
         RETURNING id_puesto AS id`,
        [codigo],
      )
    )[0].id;
  const requisito = (puesto: number, conocimiento: number, nivel: string, excluyente: boolean) =>
    sql(
      `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente) VALUES ($1, $2, $3, $4)`,
      [puesto, conocimiento, niveles[nivel], excluyente],
    );
  /** Fila de conocimiento_persona; `acreditado` = [nivel, fecha, evaluador]. */
  const fila = (
    persona: number,
    conocimiento: number,
    declarado: [string, string] | null,
    acreditado: [string, string, number] | null,
  ) =>
    sql(
      `INSERT INTO conocimiento_persona
         (id_persona, id_conocimiento, id_nivel_declarado, fecha_declaracion,
          id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        persona,
        conocimiento,
        declarado ? niveles[declarado[0]] : null,
        declarado ? declarado[1] : null,
        acreditado ? niveles[acreditado[0]] : null,
        acreditado ? acreditado[1] : null,
        acreditado ? evidencia : null,
        acreditado ? acreditado[2] : null,
      ],
    );
  const acreditacion = (persona: number, conocimiento: number, nivel: string, fecha: string, evaluador: number) =>
    sql(
      `INSERT INTO acreditacion (id_persona, id_conocimiento, id_nivel_acreditado, id_tipo_evidencia, fecha_evaluacion, id_evaluador)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [persona, conocimiento, niveles[nivel], evidencia, fecha, evaluador],
    );

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    servicio = new ConocimientosService(
      ds.getRepository(Conocimiento),
      { validarActivo: async () => undefined } as unknown as ReferenciaService,
    );
    niveles = Object.fromEntries(
      (
        await sql<{ codigo: string; id: number }[]>(
          `SELECT codigo, id_nivel_dominio AS id FROM nivel_dominio`,
        )
      ).map((n) => [n.codigo, n.id]),
    );
    evidencia = (
      await sql<{ id: number }[]>(
        `SELECT id_tipo_evidencia AS id FROM tipo_evidencia WHERE codigo = 'titulo'`,
      )
    )[0].id;
    tipo = (
      await sql<{ id: number }[]>(
        `SELECT id_tipo_conocimiento AS id FROM tipo_conocimiento WHERE codigo = 'competencia_tecnica'`,
      )
    )[0].id;
    area = (
      await sql<{ id: number }[]>(
        `SELECT id_area_tematica AS id FROM area_tematica ORDER BY id_area_tematica LIMIT 1`,
      )
    )[0].id;
    puestoX = await nuevoPuesto('P-0001');
    puestoY = await nuevoPuesto('P-0002');
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('une requisitos, declaraciones y acreditaciones y retira el origen', async () => {
    const a = await nuevoConocimiento('Python 3', 'python 3'); // origen
    const b = await nuevoConocimiento('Python', 'python'); // destino
    const p1 = await nuevaPersona(1);
    const p2 = await nuevaPersona(2);
    const p3 = await nuevaPersona(3);
    const ev = await nuevaPersona(4);

    // El puesto X pedía ambos (origen más exigente y excluyente); el Y solo el origen.
    await requisito(puestoX, a, 'experto', true);
    await requisito(puestoX, b, 'avanzado', false);
    await requisito(puestoY, a, 'intermedio', false);

    // p1 solo tenía el origen; p2 ambos; p3 tenía ambos, acreditados.
    await fila(p1, a, ['basico', '2026-01-10'], null);
    await fila(p2, a, ['experto', '2026-01-11'], null);
    await fila(p2, b, ['basico', '2026-01-12'], null);
    await fila(p3, a, null, ['basico', '2023-05-01', ev]);
    await acreditacion(p3, a, 'basico', '2023-05-01', ev);
    await fila(p3, b, null, ['avanzado', '2022-01-01', ev]);
    await acreditacion(p3, b, 'avanzado', '2022-01-01', ev);

    const resultado = await servicio.fusionar(a, { idDestino: b });

    expect(resultado).toEqual({
      idOrigen: a,
      idDestino: b,
      requisitosMovidos: 2,
      personasMovidas: 3,
    });

    const requisitos = await sql<
      { p: number; c: number; n: number; e: boolean }[]
    >(
      `SELECT id_puesto AS p, id_conocimiento AS c, id_nivel_requerido AS n, es_excluyente AS e
       FROM requisito_puesto ORDER BY id_puesto`,
    );
    expect(requisitos).toEqual([
      { p: puestoX, c: b, n: niveles.experto, e: true },
      { p: puestoY, c: b, n: niveles.intermedio, e: false },
    ]);

    const personas = await sql<
      { p: number; c: number; d: number | null; a: number | null; f: string | null }[]
    >(
      `SELECT id_persona AS p, id_conocimiento AS c, id_nivel_declarado AS d,
              id_nivel_acreditado AS a, fecha_evaluacion::text AS f
       FROM conocimiento_persona ORDER BY id_persona`,
    );
    expect(personas).toEqual([
      { p: p1, c: b, d: niveles.basico, a: null, f: null },
      { p: p2, c: b, d: niveles.experto, a: null, f: null },
      // Vigente por fecha (2023, básico), no por nivel (2022, avanzado).
      { p: p3, c: b, d: null, a: niveles.basico, f: '2023-05-01' },
    ]);

    const historial = await sql<{ c: number }[]>(
      `SELECT id_conocimiento AS c FROM acreditacion`,
    );
    expect(historial).toEqual([{ c: b }, { c: b }]);

    const origen = await sql<{ activo: boolean; fusionado: number }[]>(
      `SELECT activo, id_fusionado_en AS fusionado FROM conocimiento WHERE id_conocimiento = $1`,
      [a],
    );
    expect(origen).toEqual([{ activo: false, fusionado: b }]);
  });
});
```

- [x] **Paso 7: Correr el test de integración**

Run: `cd backend && npx vitest run --config vitest.integracion.config.ts src/modules/conocimiento/fusion.int.spec.ts`
Expected: PASS. Si un paso del SQL falla (por ejemplo, un parámetro no referenciado), corregir `fusion.sql.ts` y repetir.

- [x] **Paso 8: Commit**

```bash
git add backend/src/modules/conocimiento
git commit -m "Agregar la fusión de conocimientos duplicados"
```

---

## Tarea 8: Grupos de roles, acceso al perfil y declaración del docente

**Files:**
- Modify: `backend/src/common/roles.ts`
- Modify: `backend/src/common/roles.spec.ts`
- Create: `backend/src/modules/conocimiento/dto/perfil.dto.ts`
- Modify: `backend/src/modules/conocimiento/conocimiento.mapper.ts`
- Create: `backend/src/modules/conocimiento/acceso-perfil.service.ts`
- Create: `backend/src/modules/conocimiento/declaraciones.service.ts`
- Test: `backend/src/modules/conocimiento/acceso-perfil.service.spec.ts`
- Test: `backend/src/modules/conocimiento/declaraciones.service.spec.ts`

**Interfaces:**
- Consumes: `AlcanceService.unidadesVisibles(usuario): Promise<number[] | null>` (`usuarios/alcance.service.js`), `SesionUsuario`, `ConocimientoPersona`, `enTransaccionDeConocimiento`, `hoyDeLaBase(manager)` de `personas/fechas.js`.
- Produces: `ROLES_DECLARANTES`, `ROLES_EVALUADORES`, `ROLES_LECTORES_DE_PERFIL` (`CodigoRol[]`); `AccesoPerfilService` con `exigirLectura(sesion, idPersona): Promise<void>`, `exigirEvaluacion(sesion, idPersona): Promise<void>`, `enAlcance(sesion, idPersona): Promise<boolean>`; `DeclaracionesService` con `declarar(idPersona, idConocimiento, dto: DeclararDto, sesion): Promise<ConocimientoPersonaDto>` y `retirar(idPersona, idConocimiento, sesion): Promise<void>`; DTOs `DeclararDto { idNivel }` y `ConocimientoPersonaDto`; `aConocimientoPersonaDto(f: ConocimientoPersona)`.

- [x] **Paso 1: Test y definición de los grupos de roles**

Agregar en `roles.spec.ts`, dentro del `describe('roles', …)`, y sumar los tres nombres al `import`:

```ts
  it('define quién declara, quién acredita y quién lee el perfil de conocimiento', () => {
    expect(ROLES_DECLARANTES).toEqual([
      ROLES.docente,
      ROLES.jefeCatedra,
      ROLES.jefaturaDepartamento,
    ]);
    expect(ROLES_EVALUADORES).toEqual([
      ROLES.jefeCatedra,
      ROLES.jefaturaDepartamento,
    ]);
    expect([...ROLES_LECTORES_DE_PERFIL].sort()).toEqual([
      'autoridad',
      'docente',
      'jefatura_departamento',
      'jefe_catedra',
      'recursos_humanos',
    ]);
    // El analista de puestos y el administrador no ven el conocimiento de las personas.
    expect(ROLES_LECTORES_DE_PERFIL).not.toContain(ROLES.analistaPuestos);
    expect(ROLES_LECTORES_DE_PERFIL).not.toContain(ROLES.administrador);
  });
```

Run: `cd backend && npx vitest run src/common/roles.spec.ts` → FAIL (exports inexistentes). Agregar al final de `roles.ts`:

```ts
/** Declaran su propio conocimiento: todos los que son personas con conocimientos que declarar. */
export const ROLES_DECLARANTES: CodigoRol[] = [
  ROLES.docente,
  ROLES.jefeCatedra,
  ROLES.jefaturaDepartamento,
];

/** Acreditan el conocimiento de otras personas, dentro de su alcance por unidad. */
export const ROLES_EVALUADORES: CodigoRol[] = [
  ROLES.jefeCatedra,
  ROLES.jefaturaDepartamento,
];

/** Leen el perfil de conocimiento de una persona (dato sensible, RNF02). */
export const ROLES_LECTORES_DE_PERFIL: CodigoRol[] = [
  ROLES.recursosHumanos,
  ROLES.autoridad,
  ROLES.jefaturaDepartamento,
  ROLES.jefeCatedra,
  ROLES.docente,
];
```

Run de nuevo: PASS.

- [x] **Paso 2: DTOs y mapper de la declaración**

`dto/perfil.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

const MAX_INT4 = 2147483647;

export class DeclararDto {
  @ApiProperty({ description: 'Nivel de dominio que declara (activo)' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idNivel: number;
}

/** Declaración vigente de una persona y reflejo de su acreditación vigente. */
export class ConocimientoPersonaDto {
  @ApiProperty()
  idPersona: number;

  @ApiProperty()
  idConocimiento: number;

  @ApiProperty({ nullable: true, type: Number })
  idNivelDeclarado: number | null;

  @ApiProperty({ format: 'date', nullable: true, type: String })
  fechaDeclaracion: string | null;

  @ApiProperty({ nullable: true, type: Number })
  idNivelAcreditado: number | null;

  @ApiProperty({ format: 'date', nullable: true, type: String })
  fechaEvaluacion: string | null;

  @ApiProperty({ nullable: true, type: Number })
  idTipoEvidencia: number | null;

  @ApiProperty({ nullable: true, type: Number })
  idEvaluador: number | null;
}
```

Agregar a `conocimiento.mapper.ts` (con sus `import type`):

```ts
import type { ConocimientoPersonaDto } from './dto/perfil.dto.js';
import type { ConocimientoPersona } from './entities/conocimiento-persona.entity.js';

export function aConocimientoPersonaDto(
  f: ConocimientoPersona,
): ConocimientoPersonaDto {
  return {
    idPersona: f.idPersona,
    idConocimiento: f.idConocimiento,
    idNivelDeclarado: f.idNivelDeclarado,
    fechaDeclaracion: f.fechaDeclaracion,
    idNivelAcreditado: f.idNivelAcreditado,
    fechaEvaluacion: f.fechaEvaluacion,
    idTipoEvidencia: f.idTipoEvidencia,
    idEvaluador: f.idEvaluador,
  };
}
```

- [x] **Paso 3: Escribir los tests de `AccesoPerfilService`**

`acceso-perfil.service.spec.ts`:

```ts
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import { AccesoPerfilService } from './acceso-perfil.service.js';

const sesion = (
  rol: SesionUsuario['rol'],
  idPersona: number | null = 7,
): SesionUsuario => ({ id: 1, nombreUsuario: 'u', rol, idPersona, unidades: [] });

function crear(visibles: number[] | null, ocupaciones: object[] = [{}]) {
  const alcance = { unidadesVisibles: vi.fn(async () => visibles) };
  const dataSource = { query: vi.fn(async () => ocupaciones) };
  const servicio = new AccesoPerfilService(
    dataSource as unknown as DataSource,
    alcance as unknown as AlcanceService,
  );
  return { servicio, dataSource, alcance };
}

describe('AccesoPerfilService.exigirLectura', () => {
  it('cualquiera lee su propio perfil', async () => {
    const { servicio, dataSource } = crear([]);
    await expect(servicio.exigirLectura(sesion('docente', 5), 5)).resolves.toBeUndefined();
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('recursos humanos y autoridad leen el de cualquiera', async () => {
    const { servicio } = crear([]);
    await expect(servicio.exigirLectura(sesion('recursos_humanos'), 99)).resolves.toBeUndefined();
    await expect(servicio.exigirLectura(sesion('autoridad'), 99)).resolves.toBeUndefined();
  });

  it('el docente no lee el de otra persona', async () => {
    const { servicio } = crear([]);
    await expect(servicio.exigirLectura(sesion('docente', 5), 6)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el analista de puestos y el administrador no leen el de otros', async () => {
    const { servicio } = crear([]);
    await expect(servicio.exigirLectura(sesion('analista_puestos'), 99)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(servicio.exigirLectura(sesion('administrador'), 99)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el jefe de cátedra lee si la persona ocupa hoy un puesto de su alcance, y no si no', async () => {
    const dentro = crear([10, 11], [{}]);
    await expect(dentro.servicio.exigirLectura(sesion('jefe_catedra'), 99)).resolves.toBeUndefined();
    expect(dentro.dataSource.query).toHaveBeenCalledWith(expect.any(String), [99, [10, 11]]);
    const fuera = crear([10, 11], []);
    await expect(fuera.servicio.exigirLectura(sesion('jefe_catedra'), 99)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('AccesoPerfilService.exigirEvaluacion', () => {
  it('solo evalúan la jefatura y los jefes de cátedra', async () => {
    const { servicio } = crear([10]);
    for (const rol of ['docente', 'recursos_humanos', 'autoridad', 'analista_puestos', 'administrador'] as const) {
      await expect(servicio.exigirEvaluacion(sesion(rol), 99)).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('sin persona vinculada da 400', async () => {
    const { servicio } = crear([10]);
    await expect(servicio.exigirEvaluacion(sesion('jefe_catedra', null), 99)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('nadie se acredita a sí mismo', async () => {
    const { servicio } = crear([10]);
    await expect(servicio.exigirEvaluacion(sesion('jefe_catedra', 7), 7)).rejects.toThrow(/propios/);
  });

  it('la persona debe tener una ocupación vigente en el alcance', async () => {
    const { servicio } = crear([10], []);
    await expect(servicio.exigirEvaluacion(sesion('jefatura_departamento'), 99)).rejects.toThrow(/alcance/);
  });

  it('con alcance vacío rechaza sin consultar la base', async () => {
    const { servicio, dataSource } = crear([]);
    await expect(servicio.exigirEvaluacion(sesion('jefe_catedra'), 99)).rejects.toBeInstanceOf(ForbiddenException);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('acepta a un jefe sobre alguien de su alcance', async () => {
    const { servicio } = crear([10], [{}]);
    await expect(servicio.exigirEvaluacion(sesion('jefe_catedra'), 99)).resolves.toBeUndefined();
  });
});
```

- [x] **Paso 4: Verificar que falla**

Run: `cd backend && npx vitest run src/modules/conocimiento/acceso-perfil.service.spec.ts`
Expected: FAIL (no se encuentra `./acceso-perfil.service.js`).

- [x] **Paso 5: Implementar `AccesoPerfilService`**

`acceso-perfil.service.ts`:

```ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ROLES, ROLES_CON_ALCANCE_POR_UNIDAD } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AlcanceService } from '../usuarios/alcance.service.js';

/** ¿Ocupa hoy la persona un puesto de alguna de las unidades? ("Hoy" es el de la base.) */
const SQL_OCUPACION_EN_UNIDADES = `
  SELECT 1
  FROM ocupacion o
  JOIN puesto p ON p.id_puesto = o.id_puesto
  WHERE o.id_persona = $1
    AND p.id_unidad = ANY($2)
    AND o.fecha_desde <= CURRENT_DATE
    AND (o.fecha_hasta IS NULL OR o.fecha_hasta >= CURRENT_DATE)
  LIMIT 1`;

/**
 * Quién lee y quién evalúa el conocimiento de una persona. El conocimiento
 * de las personas es un dato sensible: no se rige por `unidadesVisibles` de los
 * roles globales (el analista de puestos y el administrador no lo ven).
 */
@Injectable()
export class AccesoPerfilService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alcance: AlcanceService,
  ) {}

  /** Lectura: la propia persona; RR. HH. y autoridades; la jefatura y los jefes por alcance. */
  async exigirLectura(sesion: SesionUsuario, idPersona: number): Promise<void> {
    if (sesion.idPersona === idPersona) return;
    if (sesion.rol === ROLES.recursosHumanos || sesion.rol === ROLES.autoridad) {
      return;
    }
    if (
      ROLES_CON_ALCANCE_POR_UNIDAD.includes(sesion.rol) &&
      (await this.enAlcance(sesion, idPersona))
    ) {
      return;
    }
    throw new ForbiddenException(
      'No podés consultar el conocimiento de esta persona',
    );
  }

  /** Evaluación: jefatura o jefe de cátedra con persona vinculada, nunca sobre sí mismo. */
  async exigirEvaluacion(
    sesion: SesionUsuario,
    idPersona: number,
  ): Promise<void> {
    if (!ROLES_CON_ALCANCE_POR_UNIDAD.includes(sesion.rol)) {
      throw new ForbiddenException(
        'Solo la jefatura y los jefes de cátedra acreditan conocimientos',
      );
    }
    if (sesion.idPersona === null) {
      throw new BadRequestException(
        'Tu usuario no tiene una persona vinculada: pedile al administrador que la asigne',
      );
    }
    if (sesion.idPersona === idPersona) {
      throw new ForbiddenException(
        'No podés acreditar tus propios conocimientos',
      );
    }
    if (!(await this.enAlcance(sesion, idPersona))) {
      throw new ForbiddenException(
        'La persona no ocupa hoy ningún puesto dentro de tu alcance',
      );
    }
  }

  /** ¿Tiene la persona una ocupación vigente en una unidad del alcance del usuario? */
  async enAlcance(sesion: SesionUsuario, idPersona: number): Promise<boolean> {
    const visibles = await this.alcance.unidadesVisibles(sesion);
    if (visibles === null) return true;
    if (visibles.length === 0) return false;
    const filas: unknown[] = await this.dataSource.query(
      SQL_OCUPACION_EN_UNIDADES,
      [idPersona, visibles],
    );
    return filas.length > 0;
  }
}
```

- [x] **Paso 6: Verificar que pasa**

Run: `cd backend && npx vitest run src/modules/conocimiento/acceso-perfil.service.spec.ts`
Expected: PASS.

- [x] **Paso 7: Escribir los tests de `DeclaracionesService`**

`declaraciones.service.spec.ts`:

```ts
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { ConocimientoPersona } from './entities/conocimiento-persona.entity.js';
import { DeclaracionesService } from './declaraciones.service.js';

const HOY = '2026-06-15';
const docente = (idPersona: number | null): SesionUsuario => ({
  id: 1,
  nombreUsuario: 'u',
  rol: 'docente',
  idPersona,
  unidades: [],
});

function crearEntorno(opciones: {
  persona?: { activo: boolean } | null;
  conocimiento?: { activo: boolean } | null;
  fila?: Partial<ConocimientoPersona> | null;
}) {
  const persona = opciones.persona === undefined ? { activo: true } : opciones.persona;
  const conocimiento =
    opciones.conocimiento === undefined ? { activo: true } : opciones.conocimiento;
  const fila = opciones.fila ?? null;
  const repoFilas = {
    findOne: vi.fn(async () => (fila ? { ...fila } : null)),
    findOneByOrFail: vi.fn(async () => ({
      idPersona: 5,
      idConocimiento: 20,
      idNivelDeclarado: 2,
      fechaDeclaracion: HOY,
      idNivelAcreditado: null,
      fechaEvaluacion: null,
      idTipoEvidencia: null,
      idEvaluador: null,
    })),
    delete: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
  };
  const manager = {
    query: vi.fn(async (sql: string) =>
      sql.includes('CURRENT_DATE') ? [{ hoy: HOY }] : [],
    ),
    getRepository: (entidad: { name: string }) =>
      entidad.name === 'Persona'
        ? { findOne: vi.fn(async () => persona) }
        : entidad.name === 'Conocimiento'
          ? { findOne: vi.fn(async () => conocimiento) }
          : repoFilas,
    transaction: async (t: (m: unknown) => Promise<unknown>) => t(manager),
  };
  (repoFilas as unknown as { manager: unknown }).manager = manager;
  const referencia = { validarActivo: vi.fn(async () => undefined) };
  const servicio = new DeclaracionesService(
    repoFilas as unknown as Repository<ConocimientoPersona>,
    referencia as unknown as ReferenciaService,
  );
  return { servicio, manager, repoFilas, referencia };
}

describe('DeclaracionesService.declarar', () => {
  it('guarda el nivel declarado con la fecha de hoy de la base', async () => {
    const { servicio, manager, referencia } = crearEntorno({});
    const resultado = await servicio.declarar(5, 20, { idNivel: 2 }, docente(5));
    const insercion = manager.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO conocimiento_persona'),
    );
    expect(insercion?.[1]).toEqual([5, 20, 2, HOY]);
    expect(referencia.validarActivo).toHaveBeenCalledWith('nivel-dominio', 2);
    expect(resultado).toMatchObject({ idPersona: 5, idNivelDeclarado: 2 });
  });

  it('el primer comando de la transacción es el bloqueo consultivo', async () => {
    const { servicio, manager } = crearEntorno({});
    await servicio.declarar(5, 20, { idNivel: 2 }, docente(5));
    expect(manager.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
  });

  it('solo la propia persona: otra persona o un usuario sin persona da 403', async () => {
    const { servicio, manager } = crearEntorno({});
    await expect(servicio.declarar(6, 20, { idNivel: 2 }, docente(5))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(servicio.declarar(5, 20, { idNivel: 2 }, docente(null))).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('rechaza persona o conocimiento inexistentes (404) o dados de baja (400)', async () => {
    await expect(
      crearEntorno({ persona: null }).servicio.declarar(5, 20, { idNivel: 2 }, docente(5)),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      crearEntorno({ persona: { activo: false } }).servicio.declarar(5, 20, { idNivel: 2 }, docente(5)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      crearEntorno({ conocimiento: null }).servicio.declarar(5, 20, { idNivel: 2 }, docente(5)),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      crearEntorno({ conocimiento: { activo: false } }).servicio.declarar(5, 20, { idNivel: 2 }, docente(5)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('DeclaracionesService.retirar', () => {
  it('borra la fila si no tiene acreditación', async () => {
    const { servicio, repoFilas } = crearEntorno({
      fila: { idNivelDeclarado: 2, idNivelAcreditado: null },
    });
    await servicio.retirar(5, 20, docente(5));
    expect(repoFilas.delete).toHaveBeenCalledWith({ idPersona: 5, idConocimiento: 20 });
    expect(repoFilas.update).not.toHaveBeenCalled();
  });

  it('si tiene acreditación solo anula la declaración', async () => {
    const { servicio, repoFilas } = crearEntorno({
      fila: { idNivelDeclarado: 2, idNivelAcreditado: 3 },
    });
    await servicio.retirar(5, 20, docente(5));
    expect(repoFilas.update).toHaveBeenCalledWith(
      { idPersona: 5, idConocimiento: 20 },
      { idNivelDeclarado: null, fechaDeclaracion: null },
    );
    expect(repoFilas.delete).not.toHaveBeenCalled();
  });

  it('da 404 si no hay declaración que retirar y 403 si no es la propia', async () => {
    await expect(
      crearEntorno({ fila: null }).servicio.retirar(5, 20, docente(5)),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      crearEntorno({ fila: { idNivelDeclarado: null, idNivelAcreditado: 3 } }).servicio.retirar(5, 20, docente(5)),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      crearEntorno({}).servicio.retirar(6, 20, docente(5)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
```

- [x] **Paso 8: Verificar que falla**

Run: `cd backend && npx vitest run src/modules/conocimiento/declaraciones.service.spec.ts`
Expected: FAIL (no se encuentra `./declaraciones.service.js`).

- [x] **Paso 9: Implementar `DeclaracionesService`**

`declaraciones.service.ts`:

```ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { Persona } from '../personas/entities/persona.entity.js';
import { hoyDeLaBase } from '../personas/fechas.js';
import { ReferenciaService } from '../referencia/referencia.service.js';
import { DOMINIO_NIVEL_DOMINIO } from './conocimiento.constantes.js';
import { aConocimientoPersonaDto } from './conocimiento.mapper.js';
import type {
  ConocimientoPersonaDto,
  DeclararDto,
} from './dto/perfil.dto.js';
import { ConocimientoPersona } from './entities/conocimiento-persona.entity.js';
import { Conocimiento } from './entities/conocimiento.entity.js';
import { enTransaccionDeConocimiento } from './transaccion.js';

const SQL_DECLARAR = `
  INSERT INTO conocimiento_persona
    (id_persona, id_conocimiento, id_nivel_declarado, fecha_declaracion)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (id_persona, id_conocimiento) DO UPDATE
  SET id_nivel_declarado = EXCLUDED.id_nivel_declarado,
      fecha_declaracion = EXCLUDED.fecha_declaracion`;

/** Lo que cada persona declara saber (RF10). Solo la propia persona declara, nunca otra. */
@Injectable()
export class DeclaracionesService {
  constructor(
    @InjectRepository(ConocimientoPersona)
    private readonly filas: Repository<ConocimientoPersona>,
    private readonly referencia: ReferenciaService,
  ) {}

  /** Declara o corrige el nivel. No toca lo acreditado. */
  async declarar(
    idPersona: number,
    idConocimiento: number,
    dto: DeclararDto,
    sesion: SesionUsuario,
  ): Promise<ConocimientoPersonaDto> {
    this.exigirPropia(sesion, idPersona);
    await this.referencia.validarActivo(DOMINIO_NIVEL_DOMINIO, dto.idNivel);
    return enTransaccionDeConocimiento(this.filas, async (manager) => {
      await this.exigirActivos(manager, idPersona, idConocimiento);
      const hoy = await hoyDeLaBase(manager);
      await manager.query(SQL_DECLARAR, [
        idPersona,
        idConocimiento,
        dto.idNivel,
        hoy,
      ]);
      const fila = await manager
        .getRepository(ConocimientoPersona)
        .findOneByOrFail({ idPersona, idConocimiento });
      return aConocimientoPersonaDto(fila);
    });
  }

  /**
   * Retira la declaración. Sin acreditaciones se borra la fila; con ellas
   * queda la fila con el declarado en nulo (la acreditación no se pierde).
   */
  async retirar(
    idPersona: number,
    idConocimiento: number,
    sesion: SesionUsuario,
  ): Promise<void> {
    this.exigirPropia(sesion, idPersona);
    await enTransaccionDeConocimiento(this.filas, async (manager) => {
      const repo = manager.getRepository(ConocimientoPersona);
      const fila = await repo.findOne({ where: { idPersona, idConocimiento } });
      if (!fila || fila.idNivelDeclarado === null) {
        throw new NotFoundException(
          'No tenés una declaración para ese conocimiento',
        );
      }
      if (fila.idNivelAcreditado === null) {
        await repo.delete({ idPersona, idConocimiento });
      } else {
        await repo.update(
          { idPersona, idConocimiento },
          { idNivelDeclarado: null, fechaDeclaracion: null },
        );
      }
    });
  }

  private exigirPropia(sesion: SesionUsuario, idPersona: number): void {
    if (sesion.idPersona === null || sesion.idPersona !== idPersona) {
      throw new ForbiddenException('Solo podés declarar tus propios conocimientos');
    }
  }

  private async exigirActivos(
    manager: EntityManager,
    idPersona: number,
    idConocimiento: number,
  ): Promise<void> {
    const persona = await manager
      .getRepository(Persona)
      .findOne({ where: { id: idPersona } });
    if (!persona) throw new NotFoundException(`No existe la persona ${idPersona}`);
    if (!persona.activo) {
      throw new BadRequestException('La persona está dada de baja');
    }
    const conocimiento = await manager
      .getRepository(Conocimiento)
      .findOne({ where: { id: idConocimiento } });
    if (!conocimiento) {
      throw new NotFoundException(`No existe el conocimiento ${idConocimiento}`);
    }
    if (!conocimiento.activo) {
      throw new BadRequestException('El conocimiento está dado de baja');
    }
  }
}
```

- [x] **Paso 10: Verificar y commitear**

Run: `cd backend && npx vitest run src/modules/conocimiento src/common/roles.spec.ts`
Expected: PASS.

```bash
git add backend/src/common backend/src/modules/conocimiento
git commit -m "Agregar el acceso al perfil de conocimiento y la declaración del docente"
```

---

## Tarea 9: Acreditación del conocimiento (`AcreditacionesService`)

**Files:**
- Modify: `backend/src/modules/conocimiento/dto/perfil.dto.ts`
- Modify: `backend/src/modules/conocimiento/conocimiento.mapper.ts`
- Create: `backend/src/modules/conocimiento/acreditaciones.service.ts`
- Test: `backend/src/modules/conocimiento/acreditaciones.service.spec.ts`
- Test: `backend/src/modules/conocimiento/acreditaciones.int.spec.ts`

**Interfaces:**
- Consumes: `AccesoPerfilService.exigirEvaluacion` (tarea 8), `SQL_ASEGURAR_FILA` y `SQL_REFLEJAR_VIGENTE` (tarea 6), `Acreditacion`, `ConocimientosService.fusionar` (tarea 7, solo en el test de integración).
- Produces: `AcreditacionesService.acreditar(idPersona: number, idConocimiento: number, dto: AcreditarDto, sesion: SesionUsuario): Promise<AcreditacionDto>`; DTOs `AcreditarDto { idNivel, fechaEvaluacion, idTipoEvidencia, observaciones? }` y `AcreditacionDto { id, idPersona, idConocimiento, idNivelAcreditado, idTipoEvidencia, fechaEvaluacion, idEvaluador, observaciones, registradaEn }`; `aAcreditacionDto(a: Acreditacion)`.

- [x] **Paso 1: Agregar los DTOs y el mapper**

Al final de `dto/perfil.dto.ts` (ajustando el `import` de `class-validator` a `IsInt, IsOptional, IsString, Max, MaxLength, Min` y agregando `ApiPropertyOptional`, y `import { FechaIso } from '../../personas/dto/fecha-iso.decorator.js'; import { Trim } from './trim.js';`):

```ts
export class AcreditarDto {
  @ApiProperty({ description: 'Nivel de dominio que se acredita (activo)' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idNivel: number;

  @ApiProperty({ format: 'date', example: '2026-06-15', description: 'No futura' })
  @FechaIso()
  fechaEvaluacion: string;

  @ApiProperty({ description: 'Tipo de evidencia activo' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idTipoEvidencia: number;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 2000 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  observaciones?: string | null;
}

export class AcreditacionDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  idPersona: number;

  @ApiProperty()
  idConocimiento: number;

  @ApiProperty()
  idNivelAcreditado: number;

  @ApiProperty()
  idTipoEvidencia: number;

  @ApiProperty({ format: 'date' })
  fechaEvaluacion: string;

  @ApiProperty({ description: 'Persona que evaluó' })
  idEvaluador: number;

  @ApiProperty({ nullable: true, type: String })
  observaciones: string | null;

  @ApiProperty({ format: 'date-time' })
  registradaEn: string;
}
```

Al final de `conocimiento.mapper.ts`:

```ts
import type { AcreditacionDto } from './dto/perfil.dto.js';
import type { Acreditacion } from './entities/acreditacion.entity.js';

export function aAcreditacionDto(a: Acreditacion): AcreditacionDto {
  return {
    id: a.id,
    idPersona: a.idPersona,
    idConocimiento: a.idConocimiento,
    idNivelAcreditado: a.idNivelAcreditado,
    idTipoEvidencia: a.idTipoEvidencia,
    fechaEvaluacion: a.fechaEvaluacion,
    idEvaluador: a.idEvaluador,
    observaciones: a.observaciones,
    registradaEn: a.registradaEn.toISOString(),
  };
}
```

- [x] **Paso 2: Escribir los tests unitarios**

`acreditaciones.service.spec.ts`:

```ts
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { AccesoPerfilService } from './acceso-perfil.service.js';
import { AcreditacionesService } from './acreditaciones.service.js';
import type { Acreditacion } from './entities/acreditacion.entity.js';
import { SQL_ASEGURAR_FILA, SQL_REFLEJAR_VIGENTE } from './sql.js';

const HOY = '2026-06-15';
const jefe: SesionUsuario = {
  id: 1,
  nombreUsuario: 'jefe',
  rol: 'jefe_catedra',
  idPersona: 7,
  unidades: [10],
};
const dto = {
  idNivel: 3,
  fechaEvaluacion: '2026-06-01',
  idTipoEvidencia: 2,
  observaciones: 'Rindió el examen',
};

function crearEntorno(
  opciones: {
    persona?: { activo: boolean } | null;
    conocimiento?: { activo: boolean } | null;
    acceso?: () => Promise<void>;
  } = {},
) {
  const persona = opciones.persona === undefined ? { activo: true } : opciones.persona;
  const conocimiento =
    opciones.conocimiento === undefined ? { activo: true } : opciones.conocimiento;
  const guardadas: Partial<Acreditacion>[] = [];
  const repoAcreditaciones = {
    create: vi.fn((datos: Partial<Acreditacion>) => ({ ...datos })),
    save: vi.fn(async (datos: Partial<Acreditacion>) => {
      guardadas.push(datos);
      return { ...datos, id: 55, registradaEn: new Date('2026-06-15T12:00:00Z') };
    }),
  };
  const consultas: [string, unknown[] | undefined][] = [];
  const manager = {
    query: vi.fn(async (sql: string, parametros?: unknown[]) => {
      consultas.push([sql, parametros]);
      return sql.includes('CURRENT_DATE') ? [{ hoy: HOY }] : [];
    }),
    getRepository: (entidad: { name: string }) =>
      entidad.name === 'Persona'
        ? { findOne: vi.fn(async () => persona) }
        : entidad.name === 'Conocimiento'
          ? { findOne: vi.fn(async () => conocimiento) }
          : repoAcreditaciones,
    transaction: async (t: (m: unknown) => Promise<unknown>) => t(manager),
  };
  (repoAcreditaciones as unknown as { manager: unknown }).manager = manager;
  const referencia = { validarActivo: vi.fn(async () => undefined) };
  const acceso = {
    exigirEvaluacion: vi.fn(opciones.acceso ?? (async () => undefined)),
  };
  const servicio = new AcreditacionesService(
    repoAcreditaciones as unknown as Repository<Acreditacion>,
    referencia as unknown as ReferenciaService,
    acceso as unknown as AccesoPerfilService,
  );
  return { servicio, referencia, acceso, consultas, guardadas };
}

describe('AcreditacionesService.acreditar', () => {
  it('registra la acreditación con el evaluador de la sesión y refleja la vigente', async () => {
    const { servicio, consultas, guardadas, referencia, acceso } = crearEntorno();

    const resultado = await servicio.acreditar(5, 20, dto, jefe);

    expect(acceso.exigirEvaluacion).toHaveBeenCalledWith(jefe, 5);
    expect(referencia.validarActivo).toHaveBeenCalledWith('nivel-dominio', 3);
    expect(referencia.validarActivo).toHaveBeenCalledWith('tipo-evidencia', 2);
    expect(guardadas[0]).toMatchObject({
      idPersona: 5,
      idConocimiento: 20,
      idNivelAcreditado: 3,
      idTipoEvidencia: 2,
      fechaEvaluacion: '2026-06-01',
      idEvaluador: 7,
      observaciones: 'Rindió el examen',
    });
    const sqls = consultas.map(([sql]) => sql);
    expect(sqls[0]).toContain('pg_advisory_xact_lock');
    expect(sqls.indexOf(SQL_ASEGURAR_FILA)).toBeLessThan(
      sqls.indexOf(SQL_REFLEJAR_VIGENTE),
    );
    expect(consultas.find(([sql]) => sql === SQL_ASEGURAR_FILA)?.[1]).toEqual([
      5, 20, 3, '2026-06-01', 2, 7,
    ]);
    expect(consultas.find(([sql]) => sql === SQL_REFLEJAR_VIGENTE)?.[1]).toEqual([5, 20]);
    expect(resultado).toMatchObject({
      id: 55,
      idEvaluador: 7,
      registradaEn: '2026-06-15T12:00:00.000Z',
    });
  });

  it('no deja pasar nada si el acceso lo rechaza', async () => {
    const { servicio, consultas, guardadas } = crearEntorno({
      acceso: async () => {
        throw new ForbiddenException('No podés acreditar tus propios conocimientos');
      },
    });
    await expect(servicio.acreditar(7, 20, dto, jefe)).rejects.toBeInstanceOf(ForbiddenException);
    expect(consultas).toHaveLength(0);
    expect(guardadas).toHaveLength(0);
  });

  it('rechaza una fecha de evaluación futura (la de hoy sí se acepta)', async () => {
    await expect(
      crearEntorno().servicio.acreditar(5, 20, { ...dto, fechaEvaluacion: '2026-06-16' }, jefe),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      crearEntorno().servicio.acreditar(5, 20, { ...dto, fechaEvaluacion: HOY }, jefe),
    ).resolves.toBeDefined();
  });

  it('rechaza persona o conocimiento inexistentes (404) o dados de baja (400)', async () => {
    await expect(crearEntorno({ persona: null }).servicio.acreditar(5, 20, dto, jefe)).rejects.toBeInstanceOf(NotFoundException);
    await expect(crearEntorno({ persona: { activo: false } }).servicio.acreditar(5, 20, dto, jefe)).rejects.toBeInstanceOf(BadRequestException);
    await expect(crearEntorno({ conocimiento: null }).servicio.acreditar(5, 20, dto, jefe)).rejects.toBeInstanceOf(NotFoundException);
    await expect(crearEntorno({ conocimiento: { activo: false } }).servicio.acreditar(5, 20, dto, jefe)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('las observaciones son opcionales', async () => {
    const { servicio, guardadas } = crearEntorno();
    await servicio.acreditar(5, 20, { ...dto, observaciones: undefined }, jefe);
    expect(guardadas[0].observaciones).toBeNull();
  });
});
```

- [x] **Paso 3: Verificar que falla**

Run: `cd backend && npx vitest run src/modules/conocimiento/acreditaciones.service.spec.ts`
Expected: FAIL (no se encuentra `./acreditaciones.service.js`).

- [x] **Paso 4: Implementar el servicio**

`acreditaciones.service.ts`:

```ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { Persona } from '../personas/entities/persona.entity.js';
import { hoyDeLaBase } from '../personas/fechas.js';
import { ReferenciaService } from '../referencia/referencia.service.js';
import { AccesoPerfilService } from './acceso-perfil.service.js';
import {
  DOMINIO_NIVEL_DOMINIO,
  DOMINIO_TIPO_EVIDENCIA,
} from './conocimiento.constantes.js';
import { aAcreditacionDto } from './conocimiento.mapper.js';
import type { AcreditacionDto, AcreditarDto } from './dto/perfil.dto.js';
import { Acreditacion } from './entities/acreditacion.entity.js';
import { Conocimiento } from './entities/conocimiento.entity.js';
import { SQL_ASEGURAR_FILA, SQL_REFLEJAR_VIGENTE } from './sql.js';
import { enTransaccionDeConocimiento } from './transaccion.js';

/**
 * Acreditación del conocimiento de una persona (RF10). Solo agrega al
 * historial; el reflejo en `conocimiento_persona` siempre es el de la
 * acreditación vigente, así que una anterior no lo cambia.
 */
@Injectable()
export class AcreditacionesService {
  constructor(
    @InjectRepository(Acreditacion)
    private readonly acreditaciones: Repository<Acreditacion>,
    private readonly referencia: ReferenciaService,
    private readonly acceso: AccesoPerfilService,
  ) {}

  async acreditar(
    idPersona: number,
    idConocimiento: number,
    dto: AcreditarDto,
    sesion: SesionUsuario,
  ): Promise<AcreditacionDto> {
    await this.acceso.exigirEvaluacion(sesion, idPersona);
    await this.referencia.validarActivo(DOMINIO_NIVEL_DOMINIO, dto.idNivel);
    await this.referencia.validarActivo(
      DOMINIO_TIPO_EVIDENCIA,
      dto.idTipoEvidencia,
    );
    // `exigirEvaluacion` garantiza que la sesión tiene persona vinculada.
    const idEvaluador = sesion.idPersona as number;

    return enTransaccionDeConocimiento(this.acreditaciones, async (manager) => {
      const persona = await manager
        .getRepository(Persona)
        .findOne({ where: { id: idPersona } });
      if (!persona) {
        throw new NotFoundException(`No existe la persona ${idPersona}`);
      }
      if (!persona.activo) {
        throw new BadRequestException('La persona está dada de baja');
      }
      const conocimiento = await manager
        .getRepository(Conocimiento)
        .findOne({ where: { id: idConocimiento } });
      if (!conocimiento) {
        throw new NotFoundException(`No existe el conocimiento ${idConocimiento}`);
      }
      if (!conocimiento.activo) {
        throw new BadRequestException('El conocimiento está dado de baja');
      }
      const hoy = await hoyDeLaBase(manager);
      if (dto.fechaEvaluacion > hoy) {
        throw new BadRequestException(
          'La fecha de evaluación no puede ser futura',
        );
      }

      await manager.query(SQL_ASEGURAR_FILA, [
        idPersona,
        idConocimiento,
        dto.idNivel,
        dto.fechaEvaluacion,
        dto.idTipoEvidencia,
        idEvaluador,
      ]);
      const repo = manager.getRepository(Acreditacion);
      const creada = await repo.save(
        repo.create({
          idPersona,
          idConocimiento,
          idNivelAcreditado: dto.idNivel,
          idTipoEvidencia: dto.idTipoEvidencia,
          fechaEvaluacion: dto.fechaEvaluacion,
          idEvaluador,
          observaciones: dto.observaciones ?? null,
        }),
      );
      await manager.query(SQL_REFLEJAR_VIGENTE, [idPersona, idConocimiento]);
      return aAcreditacionDto(creada);
    });
  }
}
```

- [x] **Paso 5: Verificar los unitarios**

Run: `cd backend && npx vitest run src/modules/conocimiento/acreditaciones.service.spec.ts`
Expected: PASS.

- [x] **Paso 6: Escribir el test de integración del flujo y de la concurrencia**

`acreditaciones.int.spec.ts`:

```ts
import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { AccesoPerfilService } from './acceso-perfil.service.js';
import { AcreditacionesService } from './acreditaciones.service.js';
import { ConocimientosService } from './conocimientos.service.js';
import { Acreditacion } from './entities/acreditacion.entity.js';
import { Conocimiento } from './entities/conocimiento.entity.js';

describe('Acreditaciones (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let acreditaciones: AcreditacionesService;
  let catalogo: ConocimientosService;
  let persona: number;
  let evaluador: number;
  let a: number;
  let b: number;
  let basico: number;
  let avanzado: number;
  let evidencia: number;
  let jefe: SesionUsuario;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const dia = async (delta: number) =>
    (
      await sql<{ f: string }[]>(`SELECT (CURRENT_DATE + $1::int)::text AS f`, [delta])
    )[0].f;
  const nuevaPersona = async (legajo: string, documento: string) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
         SELECT $1, 'Pérez', 'Ana', $2, '1980-01-01', '2005-03-01', id_situacion_revista
         FROM situacion_revista WHERE codigo = 'planta_permanente' RETURNING id_persona AS id`,
        [legajo, documento],
      )
    )[0].id;
  const nuevoConocimiento = async (denominacion: string, normalizada: string) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
         SELECT $1, $2, t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
         FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
        [denominacion, normalizada],
      )
    )[0].id;
  const dto = (idNivel: number, fechaEvaluacion: string) => ({
    idNivel,
    fechaEvaluacion,
    idTipoEvidencia: evidencia,
  });
  const reflejo = async (conocimiento: number) =>
    (
      await sql<{ n: number | null; f: string | null; d: number | null }[]>(
        `SELECT id_nivel_acreditado AS n, fecha_evaluacion::text AS f, id_nivel_declarado AS d
         FROM conocimiento_persona WHERE id_persona = $1 AND id_conocimiento = $2`,
        [persona, conocimiento],
      )
    )[0];

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    const referencia = {
      validarActivo: async () => undefined,
    } as unknown as ReferenciaService;
    const acceso = {
      exigirEvaluacion: async () => undefined,
    } as unknown as AccesoPerfilService;
    acreditaciones = new AcreditacionesService(
      ds.getRepository(Acreditacion),
      referencia,
      acceso,
    );
    catalogo = new ConocimientosService(ds.getRepository(Conocimiento), referencia);
    persona = await nuevaPersona('L-1', '30111111');
    evaluador = await nuevaPersona('L-2', '30222222');
    jefe = {
      id: 1,
      nombreUsuario: 'jefe',
      rol: 'jefe_catedra',
      idPersona: evaluador,
      unidades: [],
    };
    basico = (await sql<{ id: number }[]>(`SELECT id_nivel_dominio AS id FROM nivel_dominio WHERE codigo = 'basico'`))[0].id;
    avanzado = (await sql<{ id: number }[]>(`SELECT id_nivel_dominio AS id FROM nivel_dominio WHERE codigo = 'avanzado'`))[0].id;
    evidencia = (await sql<{ id: number }[]>(`SELECT id_tipo_evidencia AS id FROM tipo_evidencia WHERE codigo = 'titulo'`))[0].id;
  });
  afterAll(async () => {
    await base.destruir();
  });
  beforeEach(async () => {
    await sql('DELETE FROM acreditacion');
    await sql('DELETE FROM conocimiento_persona');
    await sql('DELETE FROM conocimiento');
    a = await nuevoConocimiento('Python 3', 'python 3');
    b = await nuevoConocimiento('Python', 'python');
  });

  it('acreditar a alguien que nunca declaró crea su fila con la acreditación', async () => {
    await acreditaciones.acreditar(persona, a, dto(basico, await dia(-3)), jefe);
    expect(await reflejo(a)).toEqual({ n: basico, f: await dia(-3), d: null });
  });

  it('una acreditación más reciente reemplaza el reflejo y conserva lo declarado', async () => {
    await sql(
      `INSERT INTO conocimiento_persona (id_persona, id_conocimiento, id_nivel_declarado, fecha_declaracion) VALUES ($1, $2, $3, $4)`,
      [persona, a, avanzado, await dia(-20)],
    );
    await acreditaciones.acreditar(persona, a, dto(basico, await dia(-10)), jefe);
    await acreditaciones.acreditar(persona, a, dto(avanzado, await dia(-2)), jefe);
    expect(await reflejo(a)).toEqual({ n: avanzado, f: await dia(-2), d: avanzado });
  });

  it('una acreditación anterior a la vigente queda en el historial y no cambia el reflejo', async () => {
    await acreditaciones.acreditar(persona, a, dto(basico, await dia(-2)), jefe);
    await acreditaciones.acreditar(persona, a, dto(avanzado, await dia(-30)), jefe);
    expect(await reflejo(a)).toEqual({ n: basico, f: await dia(-2), d: null });
    expect(await sql('SELECT 1 FROM acreditacion')).toHaveLength(2);
  });

  it('la fecha de hoy se acepta y la de mañana se rechaza', async () => {
    await expect(
      acreditaciones.acreditar(persona, a, dto(basico, await dia(0)), jefe),
    ).resolves.toBeDefined();
    await expect(
      acreditaciones.acreditar(persona, a, dto(basico, await dia(1)), jefe),
    ).rejects.toThrow(/futura/);
  });

  it('una fusión y una acreditación simultáneas no dejan datos en el conocimiento retirado', async () => {
    await acreditaciones.acreditar(persona, a, dto(basico, await dia(-9)), jefe);

    const resultados = await Promise.allSettled([
      catalogo.fusionar(a, { idDestino: b }),
      acreditaciones.acreditar(persona, a, dto(avanzado, await dia(-1)), jefe),
    ]);

    // Si la acreditación llegó después de la fusión, el origen ya estaba inactivo: 400.
    expect(resultados[0].status).toBe('fulfilled');
    expect(
      await sql(`SELECT 1 FROM conocimiento_persona WHERE id_conocimiento = $1`, [a]),
    ).toHaveLength(0);
    expect(
      await sql(`SELECT 1 FROM acreditacion WHERE id_conocimiento = $1`, [a]),
    ).toHaveLength(0);
    const enDestino = await sql<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM acreditacion WHERE id_conocimiento = $1`,
      [b],
    );
    expect(enDestino[0].n).toBe(resultados[1].status === 'fulfilled' ? 2 : 1);
  });
});
```

- [x] **Paso 7: Correr el test de integración**

Run: `cd backend && npx vitest run --config vitest.integracion.config.ts src/modules/conocimiento/acreditaciones.int.spec.ts`
Expected: PASS.

- [x] **Paso 8: Commit**

```bash
git add backend/src/modules/conocimiento
git commit -m "Implementar la acreditación del conocimiento con historial y reflejo vigente"
```

---

## Tarea 10: Lecturas del perfil (`PerfilConocimientoService`)

**Files:**
- Modify: `backend/src/modules/conocimiento/dto/perfil.dto.ts`
- Create: `backend/src/modules/conocimiento/perfil.sql.ts`
- Create: `backend/src/modules/conocimiento/perfil.ts`
- Create: `backend/src/modules/conocimiento/perfil-conocimiento.service.ts`
- Test: `backend/src/modules/conocimiento/perfil.spec.ts`
- Test: `backend/src/modules/conocimiento/perfil-conocimiento.service.spec.ts`
- Test: `backend/src/modules/conocimiento/perfil.int.spec.ts`

**Interfaces:**
- Consumes: `AccesoPerfilService.exigirLectura` y `enAlcance` (tarea 8), `AlcanceService.unidadesVisibles`, `Acreditacion` y `aAcreditacionDto` (tarea 9).
- Produces: `PerfilConocimientoService` con `perfilDe(idPersona, sesion): Promise<PerfilConocimientoDto[]>`, `historial(idPersona, idConocimiento, sesion): Promise<AcreditacionDto[]>`, `mios(sesion): Promise<MiConocimientoDto[]>`, `pendientes(sesion): Promise<PendienteAcreditacionDto[]>`; `combinarRequisitos(filas: RequisitoDePuesto[]): RequisitoCombinado[]`; `SQL_PENDIENTE` (fragmento SQL con alias `cp`); DTOs `PerfilConocimientoDto`, `MiConocimientoDto`, `PuestoQuePideDto`, `PendienteAcreditacionDto`.

- [x] **Paso 1: Agregar los DTOs de salida**

Al final de `dto/perfil.dto.ts`:

```ts
/** Una fila del perfil de conocimiento de una persona. */
export class PerfilConocimientoDto extends ConocimientoPersonaDto {
  @ApiProperty()
  denominacion: string;

  @ApiProperty()
  idTipoConocimiento: number;

  @ApiProperty({
    description:
      'Declarado que todavía no tiene una acreditación que lo respalde o lo contradiga',
  })
  pendiente: boolean;
}

export class PuestoQuePideDto {
  @ApiProperty()
  idPuesto: number;

  @ApiProperty({ example: 'P-0001' })
  codigo: string;

  @ApiProperty()
  denominacion: string;
}

/** Fila de «Mis conocimientos»: un conocimiento una sola vez, aunque lo pidan varios puestos. */
export class MiConocimientoDto {
  @ApiProperty()
  idConocimiento: number;

  @ApiProperty()
  denominacion: string;

  @ApiProperty()
  idTipoConocimiento: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'El más exigente entre los puestos que ocupa; null si ninguno lo pide',
  })
  idNivelRequerido: number | null;

  @ApiProperty({ description: 'true si algún puesto lo pide como excluyente' })
  esExcluyente: boolean;

  @ApiProperty({ type: PuestoQuePideDto, isArray: true })
  puestos: PuestoQuePideDto[];

  @ApiProperty({ nullable: true, type: Number })
  idNivelDeclarado: number | null;

  @ApiProperty({ format: 'date', nullable: true, type: String })
  fechaDeclaracion: string | null;

  @ApiProperty({ nullable: true, type: Number })
  idNivelAcreditado: number | null;

  @ApiProperty({ format: 'date', nullable: true, type: String })
  fechaEvaluacion: string | null;

  @ApiProperty({ nullable: true, type: Number })
  idTipoEvidencia: number | null;
}

export class PendienteAcreditacionDto {
  @ApiProperty()
  idPersona: number;

  @ApiProperty()
  apellido: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  idConocimiento: number;

  @ApiProperty()
  denominacion: string;

  @ApiProperty()
  idNivelDeclarado: number;

  @ApiProperty({ nullable: true, type: Number })
  idNivelAcreditado: number | null;

  @ApiProperty({ format: 'date' })
  fechaDeclaracion: string;
}
```

- [x] **Paso 2: Escribir los tests de `combinarRequisitos`**

`perfil.spec.ts`:

```ts
import { combinarRequisitos, type RequisitoDePuesto } from './perfil.js';

const fila = (parcial: Partial<RequisitoDePuesto>): RequisitoDePuesto => ({
  idConocimiento: 1,
  denominacion: 'SQL',
  idTipoConocimiento: 3,
  idPuesto: 10,
  codigoPuesto: 'P-0010',
  denominacionPuesto: 'Jefe de cátedra',
  idNivelRequerido: 2,
  ordenNivel: 2,
  esExcluyente: false,
  ...parcial,
});

describe('combinarRequisitos', () => {
  it('devuelve un conocimiento una sola vez aunque lo pidan varios puestos', () => {
    const resultado = combinarRequisitos([
      fila({ idPuesto: 10, codigoPuesto: 'P-0010' }),
      fila({ idPuesto: 11, codigoPuesto: 'P-0011', denominacionPuesto: 'Auxiliar' }),
    ]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].puestos.map((p) => p.codigo)).toEqual(['P-0010', 'P-0011']);
  });

  it('queda con el nivel más exigente por orden, no por id', () => {
    const [r] = combinarRequisitos([
      fila({ idPuesto: 10, idNivelRequerido: 9, ordenNivel: 1 }),
      fila({ idPuesto: 11, idNivelRequerido: 4, ordenNivel: 3 }),
      fila({ idPuesto: 12, idNivelRequerido: 7, ordenNivel: 2 }),
    ]);
    expect(r.idNivelRequerido).toBe(4);
    expect(r.ordenNivel).toBe(3);
  });

  it('es excluyente si algún puesto lo pide como excluyente', () => {
    const [r] = combinarRequisitos([
      fila({ idPuesto: 10, esExcluyente: false }),
      fila({ idPuesto: 11, esExcluyente: true }),
    ]);
    expect(r.esExcluyente).toBe(true);
  });

  it('no repite un puesto que figura dos veces (dos ocupaciones vigentes en el mismo puesto)', () => {
    const [r] = combinarRequisitos([fila({}), fila({})]);
    expect(r.puestos).toHaveLength(1);
  });

  it('ordena por denominación, sin distinguir tildes de orden', () => {
    const resultado = combinarRequisitos([
      fila({ idConocimiento: 2, denominacion: 'Redes' }),
      fila({ idConocimiento: 1, denominacion: 'Álgebra' }),
    ]);
    expect(resultado.map((r) => r.denominacion)).toEqual(['Álgebra', 'Redes']);
  });

  it('sin filas devuelve una lista vacía', () => {
    expect(combinarRequisitos([])).toEqual([]);
  });
});
```

- [x] **Paso 3: Verificar que falla**

Run: `cd backend && npx vitest run src/modules/conocimiento/perfil.spec.ts`
Expected: FAIL (no se encuentra `./perfil.js`).

- [x] **Paso 4: Implementar `perfil.ts` y `perfil.sql.ts`**

`perfil.ts`:

```ts
export interface RequisitoDePuesto {
  idConocimiento: number;
  denominacion: string;
  idTipoConocimiento: number;
  idPuesto: number;
  codigoPuesto: string;
  denominacionPuesto: string;
  idNivelRequerido: number;
  /** Posición del nivel en la escala ordinal: mayor `orden`, más exigente. */
  ordenNivel: number;
  esExcluyente: boolean;
}

export interface PuestoQuePide {
  idPuesto: number;
  codigo: string;
  denominacion: string;
}

export interface RequisitoCombinado {
  idConocimiento: number;
  denominacion: string;
  idTipoConocimiento: number;
  idNivelRequerido: number;
  ordenNivel: number;
  esExcluyente: boolean;
  puestos: PuestoQuePide[];
}

/**
 * Junta los requisitos de todos los puestos que una persona ocupa: cada
 * conocimiento una vez, con el nivel más exigente, excluyente si algún puesto
 * lo es y la lista de puestos que lo piden.
 */
export function combinarRequisitos(
  filas: RequisitoDePuesto[],
): RequisitoCombinado[] {
  const porConocimiento = new Map<number, RequisitoCombinado>();
  for (const f of filas) {
    const puesto: PuestoQuePide = {
      idPuesto: f.idPuesto,
      codigo: f.codigoPuesto,
      denominacion: f.denominacionPuesto,
    };
    const actual = porConocimiento.get(f.idConocimiento);
    if (!actual) {
      porConocimiento.set(f.idConocimiento, {
        idConocimiento: f.idConocimiento,
        denominacion: f.denominacion,
        idTipoConocimiento: f.idTipoConocimiento,
        idNivelRequerido: f.idNivelRequerido,
        ordenNivel: f.ordenNivel,
        esExcluyente: f.esExcluyente,
        puestos: [puesto],
      });
      continue;
    }
    if (f.ordenNivel > actual.ordenNivel) {
      actual.idNivelRequerido = f.idNivelRequerido;
      actual.ordenNivel = f.ordenNivel;
    }
    actual.esExcluyente ||= f.esExcluyente;
    if (!actual.puestos.some((p) => p.idPuesto === f.idPuesto)) {
      actual.puestos.push(puesto);
    }
  }
  return [...porConocimiento.values()].sort((a, b) =>
    a.denominacion.localeCompare(b.denominacion, 'es'),
  );
}
```

`perfil.sql.ts`:

```ts
/**
 * Regla de «pendiente de acreditar», una sola vez para el perfil y la bandeja
 * (alias `cp` = `conocimiento_persona`): hay declaración y, o no hay
 * acreditación, o el declarado difiere del acreditado y se declaró después de
 * evaluar. Declarar y acreditar el mismo día no deja pendiente: caso borde aceptado.
 */
export const SQL_PENDIENTE = `(
  cp.id_nivel_declarado IS NOT NULL AND (
    cp.id_nivel_acreditado IS NULL
    OR (cp.id_nivel_declarado <> cp.id_nivel_acreditado AND cp.fecha_declaracion > cp.fecha_evaluacion)
  )
)`;

/** Parámetro: persona. */
export const SQL_PERFIL_DE_PERSONA = `
  SELECT cp.id_persona, cp.id_conocimiento, c.denominacion, c.id_tipo_conocimiento,
         cp.id_nivel_declarado, cp.fecha_declaracion::text AS fecha_declaracion,
         cp.id_nivel_acreditado, cp.fecha_evaluacion::text AS fecha_evaluacion,
         cp.id_tipo_evidencia, cp.id_evaluador,
         ${SQL_PENDIENTE} AS pendiente
  FROM conocimiento_persona cp
  JOIN conocimiento c ON c.id_conocimiento = cp.id_conocimiento
  WHERE cp.id_persona = $1
  ORDER BY c.denominacion`;

/** Parámetro: persona. Requisitos de los puestos con ocupación vigente (hoy de la base). */
export const SQL_REQUISITOS_VIGENTES = `
  SELECT r.id_conocimiento, c.denominacion, c.id_tipo_conocimiento,
         r.id_puesto, p.codigo AS codigo_puesto, p.denominacion AS denominacion_puesto,
         r.id_nivel_requerido, n.orden AS orden_nivel, r.es_excluyente
  FROM ocupacion o
  JOIN puesto p ON p.id_puesto = o.id_puesto
  JOIN requisito_puesto r ON r.id_puesto = p.id_puesto
  JOIN conocimiento c ON c.id_conocimiento = r.id_conocimiento AND c.activo
  JOIN nivel_dominio n ON n.id_nivel_dominio = r.id_nivel_requerido
  WHERE o.id_persona = $1
    AND o.fecha_desde <= CURRENT_DATE
    AND (o.fecha_hasta IS NULL OR o.fecha_hasta >= CURRENT_DATE)`;

/** Parámetro: persona. Lo que la persona ya tiene registrado, de conocimientos activos. */
export const SQL_FILAS_PROPIAS = `
  SELECT cp.id_conocimiento, c.denominacion, c.id_tipo_conocimiento,
         cp.id_nivel_declarado, cp.fecha_declaracion::text AS fecha_declaracion,
         cp.id_nivel_acreditado, cp.fecha_evaluacion::text AS fecha_evaluacion,
         cp.id_tipo_evidencia
  FROM conocimiento_persona cp
  JOIN conocimiento c ON c.id_conocimiento = cp.id_conocimiento AND c.activo
  WHERE cp.id_persona = $1`;

/** Parámetros: unidades del alcance, persona del evaluador (excluida: no se acredita a sí misma). */
export const SQL_PENDIENTES = `
  SELECT cp.id_persona, p.apellido, p.nombre, cp.id_conocimiento, c.denominacion,
         cp.id_nivel_declarado, cp.id_nivel_acreditado,
         cp.fecha_declaracion::text AS fecha_declaracion
  FROM conocimiento_persona cp
  JOIN persona p ON p.id_persona = cp.id_persona AND p.activo
  JOIN conocimiento c ON c.id_conocimiento = cp.id_conocimiento AND c.activo
  WHERE ${SQL_PENDIENTE}
    AND p.id_persona IS DISTINCT FROM $2
    AND EXISTS (
      SELECT 1
      FROM ocupacion o
      JOIN puesto pu ON pu.id_puesto = o.id_puesto
      WHERE o.id_persona = cp.id_persona
        AND pu.id_unidad = ANY($1)
        AND o.fecha_desde <= CURRENT_DATE
        AND (o.fecha_hasta IS NULL OR o.fecha_hasta >= CURRENT_DATE)
    )
  ORDER BY p.apellido, p.nombre, c.denominacion`;
```

- [x] **Paso 5: Verificar que pasa**

Run: `cd backend && npx vitest run src/modules/conocimiento/perfil.spec.ts`
Expected: PASS.

- [x] **Paso 6: Escribir los tests del servicio**

`perfil-conocimiento.service.spec.ts`:

```ts
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import type { AccesoPerfilService } from './acceso-perfil.service.js';
import type { Acreditacion } from './entities/acreditacion.entity.js';
import { PerfilConocimientoService } from './perfil-conocimiento.service.js';
import {
  SQL_FILAS_PROPIAS,
  SQL_PENDIENTES,
  SQL_PERFIL_DE_PERSONA,
  SQL_REQUISITOS_VIGENTES,
} from './perfil.sql.js';

const sesion = (
  rol: SesionUsuario['rol'],
  idPersona: number | null = 5,
): SesionUsuario => ({ id: 1, nombreUsuario: 'u', rol, idPersona, unidades: [] });

function crear(respuestas: Record<string, object[]> = {}, visibles: number[] | null = [10]) {
  const dataSource = {
    query: vi.fn(async (sql: string) => respuestas[sql] ?? []),
  };
  const acceso = { exigirLectura: vi.fn(async () => undefined) };
  const alcance = { unidadesVisibles: vi.fn(async () => visibles) };
  const acreditaciones = {
    find: vi.fn(async () => [
      {
        id: 2,
        idPersona: 5,
        idConocimiento: 20,
        idNivelAcreditado: 3,
        idTipoEvidencia: 1,
        fechaEvaluacion: '2026-05-01',
        idEvaluador: 7,
        observaciones: null,
        registradaEn: new Date('2026-05-01T10:00:00Z'),
      },
    ]),
  };
  const servicio = new PerfilConocimientoService(
    dataSource as unknown as DataSource,
    acreditaciones as unknown as Repository<Acreditacion>,
    acceso as unknown as AccesoPerfilService,
    alcance as unknown as AlcanceService,
  );
  return { servicio, dataSource, acceso, acreditaciones };
}

describe('PerfilConocimientoService.perfilDe y historial', () => {
  it('chequea el acceso de lectura antes de consultar', async () => {
    const { servicio, acceso, dataSource } = crear();
    acceso.exigirLectura.mockRejectedValueOnce(new ForbiddenException('no'));
    await expect(servicio.perfilDe(9, sesion('jefe_catedra'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('mapea las filas del perfil a camelCase con la bandera pendiente', async () => {
    const { servicio } = crear({
      [SQL_PERFIL_DE_PERSONA]: [
        {
          id_persona: 5,
          id_conocimiento: 20,
          denominacion: 'SQL',
          id_tipo_conocimiento: 3,
          id_nivel_declarado: 2,
          fecha_declaracion: '2026-06-01',
          id_nivel_acreditado: null,
          fecha_evaluacion: null,
          id_tipo_evidencia: null,
          id_evaluador: null,
          pendiente: true,
        },
      ],
    });
    expect(await servicio.perfilDe(5, sesion('docente'))).toEqual([
      {
        idPersona: 5,
        idConocimiento: 20,
        denominacion: 'SQL',
        idTipoConocimiento: 3,
        idNivelDeclarado: 2,
        fechaDeclaracion: '2026-06-01',
        idNivelAcreditado: null,
        fechaEvaluacion: null,
        idTipoEvidencia: null,
        idEvaluador: null,
        pendiente: true,
      },
    ]);
  });

  it('el historial pide lo más reciente primero y chequea el acceso', async () => {
    const { servicio, acceso, acreditaciones } = crear();
    const historial = await servicio.historial(5, 20, sesion('docente'));
    expect(acceso.exigirLectura).toHaveBeenCalledWith(expect.anything(), 5);
    expect(acreditaciones.find).toHaveBeenCalledWith({
      where: { idPersona: 5, idConocimiento: 20 },
      order: { fechaEvaluacion: 'DESC', id: 'DESC' },
    });
    expect(historial[0]).toMatchObject({ id: 2, registradaEn: '2026-05-01T10:00:00.000Z' });
  });
});

describe('PerfilConocimientoService.mios', () => {
  it('sin persona vinculada da 400', async () => {
    const { servicio } = crear();
    await expect(servicio.mios(sesion('docente', null))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('une los requisitos de los puestos con lo ya registrado, sin repetir conocimientos', async () => {
    const requisito = (idConocimiento: number, denominacion: string, idPuesto: number, orden: number) => ({
      id_conocimiento: idConocimiento,
      denominacion,
      id_tipo_conocimiento: 3,
      id_puesto: idPuesto,
      codigo_puesto: `P-000${idPuesto}`,
      denominacion_puesto: 'Puesto',
      id_nivel_requerido: orden,
      orden_nivel: orden,
      es_excluyente: idPuesto === 2,
    });
    const propia = (idConocimiento: number, denominacion: string, extra: object) => ({
      id_conocimiento: idConocimiento,
      denominacion,
      id_tipo_conocimiento: 3,
      id_nivel_declarado: null,
      fecha_declaracion: null,
      id_nivel_acreditado: null,
      fecha_evaluacion: null,
      id_tipo_evidencia: null,
      ...extra,
    });
    const { servicio } = crear({
      [SQL_REQUISITOS_VIGENTES]: [
        requisito(1, 'SQL', 1, 2),
        requisito(1, 'SQL', 2, 3),
        requisito(2, 'Redes', 1, 1),
      ],
      [SQL_FILAS_PROPIAS]: [
        propia(1, 'SQL', { id_nivel_declarado: 2, fecha_declaracion: '2026-06-01' }),
        propia(9, 'Docker', { id_nivel_declarado: 1, fecha_declaracion: '2026-06-02' }),
      ],
    });

    const filas = await servicio.mios(sesion('docente'));

    expect(filas.map((f) => f.denominacion)).toEqual(['Docker', 'Redes', 'SQL']);
    const sql = filas.find((f) => f.idConocimiento === 1)!;
    expect(sql).toMatchObject({
      idNivelRequerido: 3,
      esExcluyente: true,
      idNivelDeclarado: 2,
      fechaDeclaracion: '2026-06-01',
    });
    expect(sql.puestos.map((p) => p.idPuesto)).toEqual([1, 2]);
    expect(filas.find((f) => f.idConocimiento === 2)).toMatchObject({
      idNivelRequerido: 1,
      idNivelDeclarado: null,
    });
    // Un conocimiento fuera de los requisitos aparece sin nivel requerido ni puestos.
    expect(filas.find((f) => f.idConocimiento === 9)).toMatchObject({
      idNivelRequerido: null,
      esExcluyente: false,
      puestos: [],
      idNivelDeclarado: 1,
    });
  });
});

describe('PerfilConocimientoService.pendientes', () => {
  it('consulta con las unidades del alcance y la persona del evaluador', async () => {
    const { servicio, dataSource } = crear({ [SQL_PENDIENTES]: [] }, [10, 11]);
    await servicio.pendientes(sesion('jefe_catedra', 7));
    expect(dataSource.query).toHaveBeenCalledWith(SQL_PENDIENTES, [[10, 11], 7]);
  });

  it('sin unidades en el alcance devuelve vacío sin consultar', async () => {
    const { servicio, dataSource } = crear({}, []);
    expect(await servicio.pendientes(sesion('jefe_catedra'))).toEqual([]);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('mapea las filas', async () => {
    const { servicio } = crear({
      [SQL_PENDIENTES]: [
        {
          id_persona: 5,
          apellido: 'Pérez',
          nombre: 'Ana',
          id_conocimiento: 20,
          denominacion: 'SQL',
          id_nivel_declarado: 2,
          id_nivel_acreditado: null,
          fecha_declaracion: '2026-06-01',
        },
      ],
    });
    expect(await servicio.pendientes(sesion('jefe_catedra'))).toEqual([
      {
        idPersona: 5,
        apellido: 'Pérez',
        nombre: 'Ana',
        idConocimiento: 20,
        denominacion: 'SQL',
        idNivelDeclarado: 2,
        idNivelAcreditado: null,
        fechaDeclaracion: '2026-06-01',
      },
    ]);
  });
});
```

- [x] **Paso 7: Verificar que falla**

Run: `cd backend && npx vitest run src/modules/conocimiento/perfil-conocimiento.service.spec.ts`
Expected: FAIL (no se encuentra `./perfil-conocimiento.service.js`).

- [x] **Paso 8: Implementar el servicio**

`perfil-conocimiento.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { AccesoPerfilService } from './acceso-perfil.service.js';
import { aAcreditacionDto } from './conocimiento.mapper.js';
import type {
  AcreditacionDto,
  MiConocimientoDto,
  PendienteAcreditacionDto,
  PerfilConocimientoDto,
} from './dto/perfil.dto.js';
import { Acreditacion } from './entities/acreditacion.entity.js';
import { combinarRequisitos, type RequisitoDePuesto } from './perfil.js';
import {
  SQL_FILAS_PROPIAS,
  SQL_PENDIENTES,
  SQL_PERFIL_DE_PERSONA,
  SQL_REQUISITOS_VIGENTES,
} from './perfil.sql.js';

interface FilaPropia {
  id_conocimiento: number;
  denominacion: string;
  id_tipo_conocimiento: number;
  id_nivel_declarado: number | null;
  fecha_declaracion: string | null;
  id_nivel_acreditado: number | null;
  fecha_evaluacion: string | null;
  id_tipo_evidencia: number | null;
}

interface FilaPerfil extends FilaPropia {
  id_persona: number;
  id_evaluador: number | null;
  pendiente: boolean;
}

interface FilaRequisito {
  id_conocimiento: number;
  denominacion: string;
  id_tipo_conocimiento: number;
  id_puesto: number;
  codigo_puesto: string;
  denominacion_puesto: string;
  id_nivel_requerido: number;
  orden_nivel: number;
  es_excluyente: boolean;
}

interface FilaPendiente {
  id_persona: number;
  apellido: string;
  nombre: string;
  id_conocimiento: number;
  denominacion: string;
  id_nivel_declarado: number;
  id_nivel_acreditado: number | null;
  fecha_declaracion: string;
}

/** Lecturas del conocimiento de las personas (RF10, RNF06). Solo lectura. */
@Injectable()
export class PerfilConocimientoService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Acreditacion)
    private readonly acreditaciones: Repository<Acreditacion>,
    private readonly acceso: AccesoPerfilService,
    private readonly alcance: AlcanceService,
  ) {}

  async perfilDe(
    idPersona: number,
    sesion: SesionUsuario,
  ): Promise<PerfilConocimientoDto[]> {
    await this.acceso.exigirLectura(sesion, idPersona);
    const filas: FilaPerfil[] = await this.dataSource.query(
      SQL_PERFIL_DE_PERSONA,
      [idPersona],
    );
    return filas.map((f) => ({
      idPersona: f.id_persona,
      idConocimiento: f.id_conocimiento,
      denominacion: f.denominacion,
      idTipoConocimiento: f.id_tipo_conocimiento,
      idNivelDeclarado: f.id_nivel_declarado,
      fechaDeclaracion: f.fecha_declaracion,
      idNivelAcreditado: f.id_nivel_acreditado,
      fechaEvaluacion: f.fecha_evaluacion,
      idTipoEvidencia: f.id_tipo_evidencia,
      idEvaluador: f.id_evaluador,
      pendiente: f.pendiente,
    }));
  }

  /** Todas las acreditaciones del par, la más reciente primero. */
  async historial(
    idPersona: number,
    idConocimiento: number,
    sesion: SesionUsuario,
  ): Promise<AcreditacionDto[]> {
    await this.acceso.exigirLectura(sesion, idPersona);
    const filas = await this.acreditaciones.find({
      where: { idPersona, idConocimiento },
      order: { fechaEvaluacion: 'DESC', id: 'DESC' },
    });
    return filas.map(aAcreditacionDto);
  }

  /** «Mis conocimientos»: los requisitos de los puestos que ocupa hoy más lo que ya registró. */
  async mios(sesion: SesionUsuario): Promise<MiConocimientoDto[]> {
    if (sesion.idPersona === null) {
      throw new BadRequestException(
        'Tu usuario no tiene una persona vinculada: pedile al administrador que la asigne',
      );
    }
    const [requisitos, propias]: [FilaRequisito[], FilaPropia[]] =
      await Promise.all([
        this.dataSource.query(SQL_REQUISITOS_VIGENTES, [sesion.idPersona]),
        this.dataSource.query(SQL_FILAS_PROPIAS, [sesion.idPersona]),
      ]);

    const combinados = combinarRequisitos(
      requisitos.map(
        (r): RequisitoDePuesto => ({
          idConocimiento: r.id_conocimiento,
          denominacion: r.denominacion,
          idTipoConocimiento: r.id_tipo_conocimiento,
          idPuesto: r.id_puesto,
          codigoPuesto: r.codigo_puesto,
          denominacionPuesto: r.denominacion_puesto,
          idNivelRequerido: r.id_nivel_requerido,
          ordenNivel: r.orden_nivel,
          esExcluyente: r.es_excluyente,
        }),
      ),
    );
    const propiasPorId = new Map(propias.map((p) => [p.id_conocimiento, p]));
    const registro = (p: FilaPropia | undefined) => ({
      idNivelDeclarado: p?.id_nivel_declarado ?? null,
      fechaDeclaracion: p?.fecha_declaracion ?? null,
      idNivelAcreditado: p?.id_nivel_acreditado ?? null,
      fechaEvaluacion: p?.fecha_evaluacion ?? null,
      idTipoEvidencia: p?.id_tipo_evidencia ?? null,
    });

    const filas: MiConocimientoDto[] = combinados.map((r) => ({
      idConocimiento: r.idConocimiento,
      denominacion: r.denominacion,
      idTipoConocimiento: r.idTipoConocimiento,
      idNivelRequerido: r.idNivelRequerido,
      esExcluyente: r.esExcluyente,
      puestos: r.puestos,
      ...registro(propiasPorId.get(r.idConocimiento)),
    }));
    const pedidos = new Set(combinados.map((r) => r.idConocimiento));
    for (const p of propias) {
      if (pedidos.has(p.id_conocimiento)) continue;
      filas.push({
        idConocimiento: p.id_conocimiento,
        denominacion: p.denominacion,
        idTipoConocimiento: p.id_tipo_conocimiento,
        idNivelRequerido: null,
        esExcluyente: false,
        puestos: [],
        ...registro(p),
      });
    }
    return filas.sort((a, b) =>
      a.denominacion.localeCompare(b.denominacion, 'es'),
    );
  }

  /** Bandeja del evaluador: lo declarado por personas de su alcance que falta acreditar. */
  async pendientes(sesion: SesionUsuario): Promise<PendienteAcreditacionDto[]> {
    const visibles = await this.alcance.unidadesVisibles(sesion);
    if (!visibles || visibles.length === 0) return [];
    const filas: FilaPendiente[] = await this.dataSource.query(SQL_PENDIENTES, [
      visibles,
      sesion.idPersona,
    ]);
    return filas.map((f) => ({
      idPersona: f.id_persona,
      apellido: f.apellido,
      nombre: f.nombre,
      idConocimiento: f.id_conocimiento,
      denominacion: f.denominacion,
      idNivelDeclarado: f.id_nivel_declarado,
      idNivelAcreditado: f.id_nivel_acreditado,
      fechaDeclaracion: f.fecha_declaracion,
    }));
  }
}
```

- [x] **Paso 9: Verificar los unitarios**

Run: `cd backend && npx vitest run src/modules/conocimiento/perfil-conocimiento.service.spec.ts`
Expected: PASS.

- [x] **Paso 10: Escribir el test de integración de las consultas**

`perfil.int.spec.ts`:

```ts
import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { PerfilConocimientoService } from './perfil-conocimiento.service.js';
import { AccesoPerfilService } from './acceso-perfil.service.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { Acreditacion } from './entities/acreditacion.entity.js';

describe('Lecturas del perfil de conocimiento (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let servicio: PerfilConocimientoService;
  let niveles: Record<string, number>;
  let evidencia: number;
  let unidadCatedra: number;
  let otraCatedra: number;
  let puesto: number;
  let puestoAjeno: number;
  let conocimiento: number;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const dia = async (delta: number) =>
    (
      await sql<{ f: string }[]>(`SELECT (CURRENT_DATE + $1::int)::text AS f`, [delta])
    )[0].f;
  const nuevaPersona = async (n: number) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
         SELECT $1, $3, 'Ana', $2, '1980-01-01', '2005-03-01', id_situacion_revista
         FROM situacion_revista WHERE codigo = 'planta_permanente' RETURNING id_persona AS id`,
        [`L-${n}`, `3000000${n}`, `Apellido${n}`],
      )
    )[0].id;
  const ocupar = async (persona: number, idPuesto: number, desde: number, hasta: number | null) =>
    sql(
      `INSERT INTO ocupacion (id_persona, id_puesto, fecha_desde, fecha_hasta, id_caracter_ocupacion, id_dedicacion)
       SELECT $1, $2, $3, $4, (SELECT min(id_caracter_ocupacion) FROM caracter_ocupacion), (SELECT min(id_dedicacion) FROM dedicacion)`,
      [persona, idPuesto, await dia(desde), hasta === null ? null : await dia(hasta)],
    );
  const declarar = async (persona: number, nivel: string, fecha: number) =>
    sql(
      `INSERT INTO conocimiento_persona (id_persona, id_conocimiento, id_nivel_declarado, fecha_declaracion) VALUES ($1, $2, $3, $4)`,
      [persona, conocimiento, niveles[nivel], await dia(fecha)],
    );
  const jefe = (idPersona: number, unidades: number[]): SesionUsuario => ({
    id: 1,
    nombreUsuario: 'jefe',
    rol: 'jefe_catedra',
    idPersona,
    unidades,
  });

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    niveles = Object.fromEntries(
      (await sql<{ codigo: string; id: number }[]>(`SELECT codigo, id_nivel_dominio AS id FROM nivel_dominio`)).map((n) => [n.codigo, n.id]),
    );
    evidencia = (await sql<{ id: number }[]>(`SELECT id_tipo_evidencia AS id FROM tipo_evidencia WHERE codigo = 'titulo'`))[0].id;
    const alcance = new AlcanceService(ds);
    servicio = new PerfilConocimientoService(
      ds,
      ds.getRepository(Acreditacion),
      new AccesoPerfilService(ds, alcance),
      alcance,
    );
    const departamento = (await sql<{ id: number }[]>(`SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`))[0].id;
    const nuevaCatedra = async (nombre: string) =>
      (
        await sql<{ id: number }[]>(
          `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
           SELECT $1, id_tipo_unidad, $2 FROM tipo_unidad WHERE codigo = 'catedra' RETURNING id_unidad AS id`,
          [nombre, departamento],
        )
      )[0].id;
    unidadCatedra = await nuevaCatedra('Cátedra A');
    otraCatedra = await nuevaCatedra('Cátedra B');
    const nuevoPuesto = async (codigo: string, unidad: number) =>
      (
        await sql<{ id: number }[]>(
          `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
           SELECT $1, $1, $2, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente' RETURNING id_puesto AS id`,
          [codigo, unidad],
        )
      )[0].id;
    puesto = await nuevoPuesto('P-0001', unidadCatedra);
    puestoAjeno = await nuevoPuesto('P-0002', otraCatedra);
    conocimiento = (
      await sql<{ id: number }[]>(
        `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
         SELECT 'SQL', 'sql', t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
         FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
      )
    )[0].id;
  });
  afterAll(async () => {
    await base.destruir();
  });
  afterEach(async () => {
    await sql('DELETE FROM acreditacion');
    await sql('DELETE FROM conocimiento_persona');
    await sql('DELETE FROM requisito_puesto');
    await sql('DELETE FROM ocupacion');
    await sql('DELETE FROM persona');
  });

  describe('pendientes', () => {
    it('lista lo declarado sin acreditar por personas del alcance y excluye al propio evaluador', async () => {
      const evaluador = await nuevaPersona(1);
      const docente = await nuevaPersona(2);
      await ocupar(evaluador, puesto, -100, null);
      await ocupar(docente, puesto, -100, null);
      await declarar(evaluador, 'basico', -5);
      await declarar(docente, 'avanzado', -5);

      const pendientes = await servicio.pendientes(jefe(evaluador, [unidadCatedra]));

      expect(pendientes.map((p) => p.idPersona)).toEqual([docente]);
      expect(pendientes[0]).toMatchObject({ idNivelDeclarado: niveles.avanzado, idNivelAcreditado: null });
    });

    it('no incluye a personas de otra cátedra ni a quien ya no ocupa un puesto vigente', async () => {
      const evaluador = await nuevaPersona(1);
      const ajena = await nuevaPersona(2);
      const exOcupante = await nuevaPersona(3);
      await ocupar(ajena, puestoAjeno, -100, null);
      await ocupar(exOcupante, puesto, -100, -1);
      await declarar(ajena, 'basico', -5);
      await declarar(exOcupante, 'basico', -5);
      expect(await servicio.pendientes(jefe(evaluador, [unidadCatedra]))).toEqual([]);
    });

    it('una ocupación que vence hoy sigue contando', async () => {
      const evaluador = await nuevaPersona(1);
      const docente = await nuevaPersona(2);
      await ocupar(docente, puesto, -100, 0);
      await declarar(docente, 'basico', -5);
      expect(await servicio.pendientes(jefe(evaluador, [unidadCatedra]))).toHaveLength(1);
    });

    it('lo acreditado al nivel declarado, o evaluado después de declarar, ya no está pendiente', async () => {
      const evaluador = await nuevaPersona(1);
      const igual = await nuevaPersona(2);
      const posterior = await nuevaPersona(3);
      const redeclarado = await nuevaPersona(4);
      for (const p of [igual, posterior, redeclarado]) await ocupar(p, puesto, -100, null);
      const conAcreditacion = async (p: number, declarado: string, fechaDecl: number, acreditado: string, fechaEv: number) =>
        sql(
          `INSERT INTO conocimiento_persona (id_persona, id_conocimiento, id_nivel_declarado, fecha_declaracion, id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [p, conocimiento, niveles[declarado], await dia(fechaDecl), niveles[acreditado], await dia(fechaEv), evidencia, evaluador],
        );
      await conAcreditacion(igual, 'avanzado', -10, 'avanzado', -3);
      await conAcreditacion(posterior, 'avanzado', -10, 'basico', -3);
      // Re-declaró después de ser evaluado: vuelve a quedar pendiente.
      await conAcreditacion(redeclarado, 'experto', -2, 'basico', -9);

      const pendientes = await servicio.pendientes(jefe(evaluador, [unidadCatedra]));
      expect(pendientes.map((p) => p.idPersona)).toEqual([redeclarado]);
    });
  });

  describe('mios', () => {
    it('une los requisitos de dos puestos vigentes con el nivel más exigente y deja afuera los de ocupaciones pasadas', async () => {
      const persona = await nuevaPersona(1);
      await ocupar(persona, puesto, -100, null);
      await ocupar(persona, puestoAjeno, -100, null);
      const otroPasado = (await sql<{ id: number }[]>(
        `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
         SELECT 'P-0003', 'P-0003', $1, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente' RETURNING id_puesto AS id`,
        [unidadCatedra],
      ))[0].id;
      await ocupar(persona, otroPasado, -100, -1);
      const pide = (idPuesto: number, nivel: string, excluyente: boolean) =>
        sql(
          `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente) VALUES ($1, $2, $3, $4)`,
          [idPuesto, conocimiento, niveles[nivel], excluyente],
        );
      await pide(puesto, 'intermedio', false);
      await pide(puestoAjeno, 'avanzado', true);
      await pide(otroPasado, 'experto', true);

      const filas = await servicio.mios(jefe(persona, []));

      expect(filas).toHaveLength(1);
      expect(filas[0]).toMatchObject({
        idConocimiento: conocimiento,
        idNivelRequerido: niveles.avanzado,
        esExcluyente: true,
      });
      expect(filas[0].puestos.map((p) => p.codigo).sort()).toEqual(['P-0001', 'P-0002']);
    });
  });
});
```

- [x] **Paso 11: Correr el test de integración**

Run: `cd backend && npx vitest run --config vitest.integracion.config.ts src/modules/conocimiento/perfil.int.spec.ts`
Expected: PASS. Si `unidad_organizativa` exige otra columna al insertar una cátedra, completarla según `estructura.int.spec.ts`.

- [x] **Paso 12: Commit**

```bash
git add backend/src/modules/conocimiento
git commit -m "Agregar las lecturas del perfil de conocimiento, Mis conocimientos y la bandeja de pendientes"
```

---

## Tarea 11: Controllers, módulo y tipos del frontend

**Files:**
- Create: `backend/src/modules/conocimiento/conocimientos.controller.ts`
- Create: `backend/src/modules/conocimiento/requisitos.controller.ts`
- Create: `backend/src/modules/conocimiento/perfil-conocimiento.controller.ts`
- Modify: `backend/src/modules/conocimiento/conocimiento.module.ts`
- Modify: `frontend/src/api/esquema.d.ts` (lo regenera `npm run api:tipos`)

**Interfaces:**
- Consumes: todos los servicios de las tareas 4 a 10 y los grupos de roles de la tarea 8.
- Produces: los endpoints de la spec: `GET|POST /conocimientos`, `PATCH /conocimientos/:id`, `POST /conocimientos/:id/{baja,reactivar,fusionar}`, `GET /conocimientos/{mios,pendientes-acreditacion}`; `GET /puestos/:idPuesto/requisitos`, `PUT|DELETE /puestos/:idPuesto/requisitos/:idConocimiento`, `POST /puestos/:idPuesto/requisitos/copiar`; `GET /personas/:idPersona/conocimientos`, `GET …/:idConocimiento/acreditaciones`, `PUT|DELETE …/:idConocimiento/declaracion`, `POST …/:idConocimiento/acreditaciones`.

- [ ] **Paso 1: Crear el controller del catálogo**

`conocimientos.controller.ts`:

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
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import {
  ROLES,
  ROLES_DECLARANTES,
  ROLES_EVALUADORES,
  TODOS_LOS_ROLES,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { ConocimientosService } from './conocimientos.service.js';
import {
  ActualizarConocimientoDto,
  ConocimientoDto,
  CrearConocimientoDto,
  FiltroConocimientosDto,
  FusionarConocimientoDto,
  ResultadoFusionDto,
} from './dto/catalogo.dto.js';
import {
  MiConocimientoDto,
  PendienteAcreditacionDto,
} from './dto/perfil.dto.js';
import { PerfilConocimientoService } from './perfil-conocimiento.service.js';

/** Catálogo de conocimientos (RF08) y vistas propias del docente y del evaluador. */
@ApiTags('conocimiento')
@Controller('conocimientos')
export class ConocimientosController {
  constructor(
    private readonly catalogo: ConocimientosService,
    private readonly perfil: PerfilConocimientoService,
  ) {}

  @Get()
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: ConocimientoDto, isArray: true })
  listar(@Query() filtro: FiltroConocimientosDto): Promise<ConocimientoDto[]> {
    return this.catalogo.listar(filtro);
  }

  @Get('mios')
  @Roles(...ROLES_DECLARANTES)
  @ApiOkResponse({ type: MiConocimientoDto, isArray: true })
  @ApiBadRequestResponse({ description: 'El usuario no tiene persona vinculada' })
  mios(@UsuarioActual() sesion: SesionUsuario): Promise<MiConocimientoDto[]> {
    return this.perfil.mios(sesion);
  }

  @Get('pendientes-acreditacion')
  @Roles(...ROLES_EVALUADORES)
  @ApiOkResponse({ type: PendienteAcreditacionDto, isArray: true })
  pendientes(
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PendienteAcreditacionDto[]> {
    return this.perfil.pendientes(sesion);
  }

  @Post()
  @Roles(ROLES.analistaPuestos)
  @ApiCreatedResponse({ type: ConocimientoDto })
  @ApiBadRequestResponse({ description: 'Tipo o área inexistentes o inactivos' })
  @ApiConflictResponse({ description: 'Ya existe un conocimiento activo igual del mismo tipo' })
  crear(@Body() dto: CrearConocimientoDto): Promise<ConocimientoDto> {
    return this.catalogo.crear(dto);
  }

  @Patch(':id')
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: ConocimientoDto })
  @ApiNotFoundResponse({ description: 'El conocimiento no existe' })
  @ApiConflictResponse({ description: 'Duplicado o conocimiento dado de baja' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarConocimientoDto,
  ): Promise<ConocimientoDto> {
    return this.catalogo.actualizar(id, dto);
  }

  @Post(':id/baja')
  @HttpCode(200)
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: ConocimientoDto })
  @ApiNotFoundResponse({ description: 'El conocimiento no existe' })
  @ApiConflictResponse({ description: 'Lo piden puestos activos' })
  baja(@Param('id', ParseIntPipe) id: number): Promise<ConocimientoDto> {
    return this.catalogo.baja(id);
  }

  @Post(':id/reactivar')
  @HttpCode(200)
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: ConocimientoDto })
  @ApiNotFoundResponse({ description: 'El conocimiento no existe' })
  @ApiConflictResponse({ description: 'Ya hay uno activo igual' })
  reactivar(@Param('id', ParseIntPipe) id: number): Promise<ConocimientoDto> {
    return this.catalogo.reactivar(id);
  }

  @Post(':id/fusionar')
  @HttpCode(200)
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: ResultadoFusionDto })
  @ApiNotFoundResponse({ description: 'Origen o destino inexistentes' })
  @ApiBadRequestResponse({ description: 'Inactivos, de distinto tipo o el mismo' })
  fusionar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FusionarConocimientoDto,
  ): Promise<ResultadoFusionDto> {
    return this.catalogo.fusionar(id, dto);
  }
}
```

- [ ] **Paso 2: Crear el controller de requisitos**

`requisitos.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ROLES, ROLES_SIN_DOCENTE } from '../../common/roles.js';
import {
  CopiarRequisitosDto,
  GuardarRequisitoDto,
  RequisitoDto,
  ResultadoCopiaDto,
} from './dto/requisitos.dto.js';
import { RequisitosService } from './requisitos.service.js';

/** Requisitos de conocimiento de cada puesto (RF09). */
@ApiTags('conocimiento')
@Controller('puestos/:idPuesto/requisitos')
export class RequisitosController {
  constructor(private readonly servicio: RequisitosService) {}

  @Get()
  @Roles(...ROLES_SIN_DOCENTE)
  @ApiOkResponse({ type: RequisitoDto, isArray: true })
  @ApiNotFoundResponse({ description: 'El puesto no existe' })
  listar(
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
  ): Promise<RequisitoDto[]> {
    return this.servicio.listar(idPuesto);
  }

  @Put(':idConocimiento')
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: RequisitoDto })
  @ApiNotFoundResponse({ description: 'El puesto no existe' })
  @ApiBadRequestResponse({ description: 'Puesto de baja, conocimiento inactivo o nivel inválido' })
  guardar(
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
    @Body() dto: GuardarRequisitoDto,
  ): Promise<RequisitoDto> {
    return this.servicio.guardar(idPuesto, idConocimiento, dto);
  }

  @Delete(':idConocimiento')
  @HttpCode(204)
  @Roles(ROLES.analistaPuestos)
  @ApiNoContentResponse({ description: 'Requisito quitado' })
  @ApiNotFoundResponse({ description: 'El puesto no tiene ese requisito' })
  quitar(
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
  ): Promise<void> {
    return this.servicio.quitar(idPuesto, idConocimiento);
  }

  @Post('copiar')
  @HttpCode(200)
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: ResultadoCopiaDto })
  @ApiNotFoundResponse({ description: 'Puesto de origen o de destino inexistente' })
  @ApiBadRequestResponse({ description: 'Mismo puesto o destino de baja' })
  copiar(
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
    @Body() dto: CopiarRequisitosDto,
  ): Promise<ResultadoCopiaDto> {
    return this.servicio.copiar(idPuesto, dto);
  }
}
```

- [ ] **Paso 3: Crear el controller del perfil de la persona**

`perfil-conocimiento.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import {
  ROLES_DECLARANTES,
  ROLES_EVALUADORES,
  ROLES_LECTORES_DE_PERFIL,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AcreditacionesService } from './acreditaciones.service.js';
import { DeclaracionesService } from './declaraciones.service.js';
import {
  AcreditacionDto,
  AcreditarDto,
  ConocimientoPersonaDto,
  DeclararDto,
  PerfilConocimientoDto,
} from './dto/perfil.dto.js';
import { PerfilConocimientoService } from './perfil-conocimiento.service.js';

/** Conocimiento de una persona: lo que declara y lo que se le acredita (RF10). */
@ApiTags('conocimiento')
@Controller('personas/:idPersona/conocimientos')
export class PerfilConocimientoController {
  constructor(
    private readonly perfil: PerfilConocimientoService,
    private readonly declaraciones: DeclaracionesService,
    private readonly acreditaciones: AcreditacionesService,
  ) {}

  @Get()
  @Roles(...ROLES_LECTORES_DE_PERFIL)
  @ApiOkResponse({ type: PerfilConocimientoDto, isArray: true })
  @ApiForbiddenResponse({ description: 'Sin acceso al conocimiento de esa persona' })
  listar(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PerfilConocimientoDto[]> {
    return this.perfil.perfilDe(idPersona, sesion);
  }

  @Get(':idConocimiento/acreditaciones')
  @Roles(...ROLES_LECTORES_DE_PERFIL)
  @ApiOkResponse({ type: AcreditacionDto, isArray: true })
  @ApiForbiddenResponse({ description: 'Sin acceso al conocimiento de esa persona' })
  historial(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<AcreditacionDto[]> {
    return this.perfil.historial(idPersona, idConocimiento, sesion);
  }

  @Put(':idConocimiento/declaracion')
  @Roles(...ROLES_DECLARANTES)
  @ApiOkResponse({ type: ConocimientoPersonaDto })
  @ApiForbiddenResponse({ description: 'Solo la propia persona declara' })
  @ApiBadRequestResponse({ description: 'Persona, conocimiento o nivel inactivos' })
  declarar(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
    @Body() dto: DeclararDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<ConocimientoPersonaDto> {
    return this.declaraciones.declarar(idPersona, idConocimiento, dto, sesion);
  }

  @Delete(':idConocimiento/declaracion')
  @HttpCode(204)
  @Roles(...ROLES_DECLARANTES)
  @ApiNoContentResponse({ description: 'Declaración retirada' })
  @ApiNotFoundResponse({ description: 'No hay declaración que retirar' })
  @ApiForbiddenResponse({ description: 'Solo la propia persona' })
  retirar(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<void> {
    return this.declaraciones.retirar(idPersona, idConocimiento, sesion);
  }

  @Post(':idConocimiento/acreditaciones')
  @Roles(...ROLES_EVALUADORES)
  @ApiCreatedResponse({ type: AcreditacionDto })
  @ApiForbiddenResponse({ description: 'Fuera del alcance o autoacreditación' })
  @ApiBadRequestResponse({ description: 'Sin persona vinculada, fecha futura o datos inactivos' })
  acreditar(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
    @Body() dto: AcreditarDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<AcreditacionDto> {
    return this.acreditaciones.acreditar(idPersona, idConocimiento, dto, sesion);
  }
}
```

- [ ] **Paso 4: Registrar todo en el módulo**

Reemplazar `conocimiento.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Puesto } from '../estructura/entities/puesto.entity.js';
import { Persona } from '../personas/entities/persona.entity.js';
import { ReferenciaModule } from '../referencia/referencia.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { AccesoPerfilService } from './acceso-perfil.service.js';
import { AcreditacionesService } from './acreditaciones.service.js';
import { ConocimientosController } from './conocimientos.controller.js';
import { ConocimientosService } from './conocimientos.service.js';
import { DeclaracionesService } from './declaraciones.service.js';
import { Acreditacion } from './entities/acreditacion.entity.js';
import { ConocimientoPersona } from './entities/conocimiento-persona.entity.js';
import { Conocimiento } from './entities/conocimiento.entity.js';
import { RequisitoPuesto } from './entities/requisito-puesto.entity.js';
import { PerfilConocimientoController } from './perfil-conocimiento.controller.js';
import { PerfilConocimientoService } from './perfil-conocimiento.service.js';
import { RequisitosController } from './requisitos.controller.js';
import { RequisitosService } from './requisitos.service.js';

/**
 * Catálogo de conocimientos, requisitos de puesto y conocimiento de las
 * personas (RF08–RF10). Importa `UsuariosModule` por `AlcanceService`; no hay
 * ciclo, porque ningún módulo importa a este.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conocimiento,
      RequisitoPuesto,
      ConocimientoPersona,
      Acreditacion,
      Persona,
      Puesto,
    ]),
    ReferenciaModule,
    UsuariosModule,
  ],
  controllers: [
    ConocimientosController,
    RequisitosController,
    PerfilConocimientoController,
  ],
  providers: [
    ConocimientosService,
    RequisitosService,
    DeclaracionesService,
    AcreditacionesService,
    PerfilConocimientoService,
    AccesoPerfilService,
  ],
})
export class ConocimientoModule {}
```

- [ ] **Paso 5: Verificar que el backend completo pasa**

Run: `cd backend && npm run lint && npm test`
Expected: lint sin errores; todos los tests PASS, incluida `cobertura-roles.spec.ts` sobre los tres controllers nuevos (cada ruta con `@Roles`).

- [ ] **Paso 6: Levantar la API y comprobar las rutas**

Run: `docker compose up -d --build backend`, esperar a que arranque y:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/conocimientos
```

Expected: `401` (sin sesión; confirma que la ruta existe y está protegida). Revisar `docker compose logs backend` por errores de inyección de dependencias (por ejemplo un provider faltante en el módulo). Con sesión de `administrador` (o la del analista que se cree desde Administración), `GET /api/conocimientos/mios` debe responder 403 para el administrador y `GET /api/conocimientos/pendientes-acreditacion` también: confirma que `mios` no se confunde con un id.

- [ ] **Paso 7: Regenerar los tipos del frontend**

Run: `cd frontend && npm run api:tipos`
Expected: `src/api/esquema.d.ts` incluye `/api/conocimientos`, `/api/puestos/{idPuesto}/requisitos` y `/api/personas/{idPersona}/conocimientos/{idConocimiento}/declaracion`.

- [ ] **Paso 8: Commit**

```bash
git add backend/src frontend/src/api/esquema.d.ts
git commit -m "Exponer el catálogo, los requisitos y el conocimiento de las personas por la API"
```

---

## Tarea 12: Frontend, catálogo de conocimientos

**Files:**
- Create: `frontend/src/features/conocimiento/hooks/useConocimientos.ts`
- Create: `frontend/src/features/conocimiento/components/FormularioConocimiento.tsx`
- Create: `frontend/src/features/conocimiento/components/FusionarDialog.tsx`
- Modify: `frontend/src/features/conocimiento/pages/ConocimientoPage.tsx`
- Modify: `frontend/src/auth/permisos.ts`

**Interfaces:**
- Consumes: tipos generados (`ConocimientoDto`, `CrearConocimientoDto`, `ActualizarConocimientoDto`, `FusionarConocimientoDto`, `ResultadoFusionDto`), `useValoresReferencia(dominio, incluirInactivos)`, `mensajeError`, `useSesion()` (`rol`, `idPersona`).
- Produces: `useConocimientos(filtro)`, `useCrearConocimiento()`, `useActualizarConocimiento()`, `useCambiarEstadoConocimiento()`, `useFusionarConocimientos()`, `invalidarConocimiento(cliente)` (los demás hooks del feature la reutilizan); tipos `Conocimiento` y `FiltroConocimientos`.

- [ ] **Paso 1: Crear los hooks**

`hooks/useConocimientos.ts`:

```ts
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';

export type Conocimiento = Esquemas['ConocimientoDto'];
export type ResultadoFusion = Esquemas['ResultadoFusionDto'];
type CrearConocimiento = Esquemas['CrearConocimientoDto'];
type ActualizarConocimiento = Esquemas['ActualizarConocimientoDto'];

export interface FiltroConocimientos {
  q?: string;
  idTipo?: number;
  idArea?: number;
  /** Sin valor: activos e inactivos. */
  activo?: boolean;
}

/** Todo lo que depende del catálogo y de los datos de conocimiento se vuelve a pedir. */
export function invalidarConocimiento(cliente: QueryClient) {
  for (const clave of [
    'conocimientos',
    'requisitos',
    'mis-conocimientos',
    'pendientes-acreditacion',
    'perfil-conocimiento',
  ]) {
    cliente.invalidateQueries({ queryKey: [clave] });
  }
}

/** El catálogo es chico (cientos de filas): la pantalla filtra en el servidor pero sin paginar. */
export function useConocimientos(filtro: FiltroConocimientos = {}) {
  return useQuery({
    queryKey: ['conocimientos', 'lista', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/conocimientos', {
        params: { query: filtro },
      });
      if (error || !data) {
        throw new Error('No se pudo cargar el catálogo de conocimientos');
      }
      return data;
    },
  });
}

export function useCrearConocimiento() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (cuerpo: CrearConocimiento) => {
      const { data, error } = await api.POST('/api/conocimientos', {
        body: cuerpo,
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}

export function useActualizarConocimiento() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      cuerpo,
    }: {
      id: number;
      cuerpo: ActualizarConocimiento;
    }) => {
      const { data, error } = await api.PATCH('/api/conocimientos/{id}', {
        params: { path: { id } },
        body: cuerpo,
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}

export function useCambiarEstadoConocimiento() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      accion,
    }: {
      id: number;
      accion: 'baja' | 'reactivar';
    }) => {
      const ruta =
        accion === 'baja'
          ? '/api/conocimientos/{id}/baja'
          : '/api/conocimientos/{id}/reactivar';
      const { data, error } = await api.POST(ruta, {
        params: { path: { id } },
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}

export function useFusionarConocimientos() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({
      idOrigen,
      idDestino,
    }: {
      idOrigen: number;
      idDestino: number;
    }): Promise<ResultadoFusion> => {
      const { data, error } = await api.POST('/api/conocimientos/{id}/fusionar', {
        params: { path: { id: idOrigen } },
        body: { idDestino },
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}
```

- [ ] **Paso 2: Crear el formulario de alta y edición**

`components/FormularioConocimiento.tsx`:

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
  useActualizarConocimiento,
  useCrearConocimiento,
  type Conocimiento,
} from '../hooks/useConocimientos';

interface Props {
  /** Sin conocimiento, el formulario da de alta uno nuevo. */
  conocimiento?: Conocimiento;
  onCerrar: () => void;
}

const esquema = z.object({
  denominacion: z
    .string()
    .trim()
    .min(2, 'Ingresá al menos 2 caracteres')
    .max(150, 'Máximo 150 caracteres'),
  idTipoConocimiento: z.string().min(1, 'Elegí un tipo'),
  idAreaTematica: z.string().min(1, 'Elegí un área'),
  descripcion: z.string().max(2000, 'Máximo 2000 caracteres'),
});
type Datos = z.infer<typeof esquema>;

/** Se monta solo mientras está abierto, por lo que parte siempre de cero. */
export function FormularioConocimiento({ conocimiento, onCerrar }: Props) {
  const { data: tipos } = useValoresReferencia('tipo-conocimiento', false);
  const { data: areas } = useValoresReferencia('area-tematica', false);
  const crear = useCrearConocimiento();
  const actualizar = useActualizarConocimiento();
  const [error, setError] = useState<string>();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      denominacion: conocimiento?.denominacion ?? '',
      idTipoConocimiento: conocimiento ? String(conocimiento.idTipoConocimiento) : '',
      idAreaTematica: conocimiento ? String(conocimiento.idAreaTematica) : '',
      descripcion: conocimiento?.descripcion ?? '',
    },
  });

  const guardar = handleSubmit(async (datos) => {
    setError(undefined);
    const cuerpo = {
      denominacion: datos.denominacion,
      idTipoConocimiento: Number(datos.idTipoConocimiento),
      idAreaTematica: Number(datos.idAreaTematica),
      descripcion: datos.descripcion.trim() || null,
    };
    try {
      if (conocimiento) {
        await actualizar.mutateAsync({ id: conocimiento.id, cuerpo });
      } else {
        await crear.mutateAsync(cuerpo);
      }
      onCerrar();
    } catch (e) {
      // Un duplicado vuelve como 409 con el nombre y el id del conocimiento existente.
      setError((e as Error).message);
    }
  });

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>
          {conocimiento ? 'Editar conocimiento' : 'Nuevo conocimiento'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Denominación"
              {...register('denominacion')}
              error={!!errors.denominacion}
              helperText={
                errors.denominacion?.message ??
                'Mayúsculas, tildes y espacios no distinguen: «Programación» y «programacion» son el mismo conocimiento'
              }
            />
            <TextField
              select
              label="Tipo"
              defaultValue={conocimiento ? String(conocimiento.idTipoConocimiento) : ''}
              {...register('idTipoConocimiento')}
              error={!!errors.idTipoConocimiento}
              helperText={errors.idTipoConocimiento?.message}
            >
              {(tipos ?? []).map((t) => (
                <MenuItem key={t.id} value={String(t.id)}>
                  {t.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Área temática"
              defaultValue={conocimiento ? String(conocimiento.idAreaTematica) : ''}
              {...register('idAreaTematica')}
              error={!!errors.idAreaTematica}
              helperText={errors.idAreaTematica?.message}
            >
              {(areas ?? []).map((a) => (
                <MenuItem key={a.id} value={String(a.id)}>
                  {a.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Descripción (opcional)"
              multiline
              minRows={2}
              {...register('descripcion')}
              error={!!errors.descripcion}
              helperText={errors.descripcion?.message}
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

- [ ] **Paso 3: Crear el diálogo de fusión**

`components/FusionarDialog.tsx`:

```tsx
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import {
  useConocimientos,
  useFusionarConocimientos,
  type Conocimiento,
  type ResultadoFusion,
} from '../hooks/useConocimientos';

interface Props {
  /** El duplicado que se retira. */
  origen: Conocimiento;
  onCerrar: () => void;
}

/** Fusiona un duplicado en el conocimiento que se conserva; no se puede deshacer. */
export function FusionarDialog({ origen, onCerrar }: Props) {
  const { data: candidatos } = useConocimientos({
    activo: true,
    idTipo: origen.idTipoConocimiento,
  });
  const fusionar = useFusionarConocimientos();
  const [idDestino, setIdDestino] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState<string>();
  const [resultado, setResultado] = useState<ResultadoFusion>();

  const opciones = (candidatos ?? []).filter((c) => c.id !== origen.id);

  const confirmar = async () => {
    setError(undefined);
    try {
      setResultado(
        await fusionar.mutateAsync({
          idOrigen: origen.id,
          idDestino: Number(idDestino),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <DialogTitle>Fusionar «{origen.denominacion}»</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {resultado ? (
            <Alert severity="success">
              Listo. Se movieron {resultado.requisitosMovidos} requisitos de
              puesto y los datos de {resultado.personasMovidas} personas;
              «{origen.denominacion}» quedó dado de baja.
            </Alert>
          ) : (
            <>
              <Typography>
                Elegí el conocimiento que se conserva. Los requisitos y los
                datos de las personas del duplicado pasan a ese conocimiento.
                Si alguien tenía ambos, queda el nivel declarado más alto y la
                acreditación más reciente.
              </Typography>
              <TextField
                select
                label="Conocimiento que se conserva"
                value={idDestino}
                onChange={(e) => setIdDestino(e.target.value)}
                helperText="Solo aparecen conocimientos activos del mismo tipo"
              >
                {opciones.map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.denominacion}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={confirmado}
                    onChange={(e) => setConfirmado(e.target.checked)}
                  />
                }
                label="Entiendo que la fusión no se puede deshacer"
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>{resultado ? 'Cerrar' : 'Cancelar'}</Button>
        {!resultado && (
          <Button
            variant="contained"
            color="warning"
            disabled={!idDestino || !confirmado || fusionar.isPending}
            onClick={confirmar}
          >
            Fusionar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Paso 4: Reemplazar la página**

`pages/ConocimientoPage.tsx`:

```tsx
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { useSesion } from '../../../auth/useSesion';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { FormularioConocimiento } from '../components/FormularioConocimiento';
import { FusionarDialog } from '../components/FusionarDialog';
import {
  useCambiarEstadoConocimiento,
  useConocimientos,
  type Conocimiento,
} from '../hooks/useConocimientos';

/** Catálogo único de conocimientos (RF08). Solo el analista de puestos escribe. */
export function ConocimientoPage() {
  const { data: sesion } = useSesion();
  const puedeEditar = sesion?.rol === 'analista_puestos';
  const { data: tipos } = useValoresReferencia('tipo-conocimiento', true);
  const { data: areas } = useValoresReferencia('area-tematica', true);
  const cambiarEstado = useCambiarEstadoConocimiento();

  const [texto, setTexto] = useState('');
  const [idTipo, setIdTipo] = useState('');
  const [idArea, setIdArea] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);
  const [formulario, setFormulario] = useState<{ conocimiento?: Conocimiento } | null>(null);
  const [fusionando, setFusionando] = useState<Conocimiento>();
  const [error, setError] = useState<string>();

  const { data, isLoading, isError } = useConocimientos({
    q: texto.trim() || undefined,
    idTipo: idTipo ? Number(idTipo) : undefined,
    idArea: idArea ? Number(idArea) : undefined,
    activo: verInactivos ? undefined : true,
  });

  const nombre = (
    lista: { id: number; denominacion: string }[] | undefined,
    id: number,
  ) => lista?.find((v) => v.id === id)?.denominacion ?? String(id);

  const alternar = async (c: Conocimiento) => {
    setError(undefined);
    try {
      await cambiarEstado.mutateAsync({
        id: c.id,
        accion: c.activo ? 'baja' : 'reactivar',
      });
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <PaginaEnConstruccion
      titulo="Catálogo de conocimientos"
      descripcion="Un solo catálogo para toda la facultad: los puestos lo usan para pedir conocimientos y las personas para declararlos."
    >
      <Stack spacing={2}>
        {error && (
          <Alert severity="error" onClose={() => setError(undefined)}>
            {error}
          </Alert>
        )}
        <Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Buscar por denominación"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <TextField
            select
            size="small"
            label="Tipo"
            value={idTipo}
            onChange={(e) => setIdTipo(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {(tipos ?? []).map((t) => (
              <MenuItem key={t.id} value={String(t.id)}>
                {t.denominacion}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Área temática"
            value={idArea}
            onChange={(e) => setIdArea(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Todas</MenuItem>
            {(areas ?? []).map((a) => (
              <MenuItem key={a.id} value={String(a.id)}>
                {a.denominacion}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Switch
                checked={verInactivos}
                onChange={(e) => setVerInactivos(e.target.checked)}
              />
            }
            label="Ver dados de baja"
          />
          <span style={{ flexGrow: 1 }} />
          {puedeEditar && (
            <Button variant="contained" onClick={() => setFormulario({})}>
              Nuevo conocimiento
            </Button>
          )}
        </Stack>

        {isLoading && <CircularProgress aria-label="Cargando" />}
        {isError && (
          <Alert severity="error">No se pudo cargar el catálogo.</Alert>
        )}
        {data && data.length === 0 && (
          <Alert severity="info">No hay conocimientos para mostrar.</Alert>
        )}
        {data && data.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Denominación</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Área temática</TableCell>
                <TableCell>Estado</TableCell>
                {puedeEditar && <TableCell align="right">Acciones</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.denominacion}</TableCell>
                  <TableCell>{nombre(tipos, c.idTipoConocimiento)}</TableCell>
                  <TableCell>{nombre(areas, c.idAreaTematica)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={c.activo ? 'Activo' : 'De baja'}
                      color={c.activo ? 'success' : 'default'}
                    />
                  </TableCell>
                  {puedeEditar && (
                    <TableCell align="right">
                      {c.activo && (
                        <>
                          <Button size="small" onClick={() => setFormulario({ conocimiento: c })}>
                            Editar
                          </Button>
                          <Button size="small" onClick={() => setFusionando(c)}>
                            Fusionar
                          </Button>
                        </>
                      )}
                      <Button size="small" onClick={() => alternar(c)}>
                        {c.activo ? 'Dar de baja' : 'Reactivar'}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Stack>
      {formulario && (
        <FormularioConocimiento
          conocimiento={formulario.conocimiento}
          onCerrar={() => setFormulario(null)}
        />
      )}
      {fusionando && (
        <FusionarDialog origen={fusionando} onCerrar={() => setFusionando(undefined)} />
      )}
    </PaginaEnConstruccion>
  );
}
```

- [ ] **Paso 5: Ajustar el menú**

En `auth/permisos.ts`, reemplazar la entrada de `/conocimiento` por una que la vean todos los roles menos el docente (el docente usa «Mis conocimientos», que se agrega en la tarea 14):

```ts
  {
    ruta: '/conocimiento',
    nombre: 'Catálogo de conocimientos',
    roles: [
      'analista_puestos',
      'recursos_humanos',
      'autoridad',
      'jefatura_departamento',
      'jefe_catedra',
      'administrador',
    ],
  },
```

- [ ] **Paso 6: Verificar**

Run: `cd frontend && npm run lint && npm run build`
Expected: sin errores de tipos ni de lint. Si `api.POST(ruta, …)` con la ruta elegida en una variable no tipa, separar `baja` y `reactivar` en dos llamadas explícitas.

Escenario manual (`docker compose up`, entrar como `analista_puestos`): crear «Programación»; intentar crear «  programacion » del mismo tipo (409 con el mensaje que nombra al existente); crear «Año» y «Ano» (ambos se aceptan); fusionar un duplicado; dar de baja otro; con un rol que no sea analista, los botones de escritura no aparecen.

- [ ] **Paso 7: Commit**

```bash
git add frontend/src
git commit -m "Agregar la pantalla del catálogo de conocimientos con alta, edición, baja y fusión"
```

---

## Tarea 13: Frontend, requisitos del puesto

**Files:**
- Create: `frontend/src/features/conocimiento/hooks/useRequisitos.ts`
- Create: `frontend/src/features/conocimiento/components/RequisitosPuestoDialog.tsx`
- Modify: `frontend/src/features/estructura/components/TablaPuestos.tsx`

**Interfaces:**
- Consumes: `invalidarConocimiento` y `useConocimientos` (tarea 12), `usePuestos()` y el tipo `Puesto` de `estructura/hooks/usePuestos`, tipos generados `RequisitoDto`, `GuardarRequisitoDto`, `ResultadoCopiaDto`.
- Produces: `useRequisitos(idPuesto)`, `useGuardarRequisito()`, `useQuitarRequisito()`, `useCopiarRequisitos()`; componente `RequisitosPuestoDialog({ puesto, puedeEditar, onCerrar })`.

- [ ] **Paso 1: Crear los hooks**

`hooks/useRequisitos.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { invalidarConocimiento } from './useConocimientos';

export type Requisito = Esquemas['RequisitoDto'];
export type ResultadoCopia = Esquemas['ResultadoCopiaDto'];

export function useRequisitos(idPuesto: number | undefined) {
  return useQuery({
    queryKey: ['requisitos', idPuesto],
    enabled: idPuesto !== undefined,
    queryFn: async () => {
      const { data, error } = await api.GET('/api/puestos/{idPuesto}/requisitos', {
        params: { path: { idPuesto: idPuesto as number } },
      });
      if (error || !data) throw new Error('No se pudieron cargar los requisitos');
      return data;
    },
  });
}

export function useGuardarRequisito() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (a: {
      idPuesto: number;
      idConocimiento: number;
      idNivel: number;
      esExcluyente: boolean;
    }) => {
      const { data, error } = await api.PUT(
        '/api/puestos/{idPuesto}/requisitos/{idConocimiento}',
        {
          params: { path: { idPuesto: a.idPuesto, idConocimiento: a.idConocimiento } },
          body: { idNivel: a.idNivel, esExcluyente: a.esExcluyente },
        },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}

export function useQuitarRequisito() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (a: { idPuesto: number; idConocimiento: number }) => {
      const { error } = await api.DELETE(
        '/api/puestos/{idPuesto}/requisitos/{idConocimiento}',
        { params: { path: a } },
      );
      if (error) throw new Error(mensajeError(error));
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}

export function useCopiarRequisitos() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (a: {
      idPuestoDestino: number;
      idPuestoOrigen: number;
    }): Promise<ResultadoCopia> => {
      const { data, error } = await api.POST('/api/puestos/{idPuesto}/requisitos/copiar', {
        params: { path: { idPuesto: a.idPuestoDestino } },
        body: { idPuestoOrigen: a.idPuestoOrigen },
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}
```

- [ ] **Paso 2: Crear el diálogo**

`components/RequisitosPuestoDialog.tsx`:

```tsx
import {
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
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
import { usePuestos, type Puesto } from '../../estructura/hooks/usePuestos';
import { useConocimientos, type Conocimiento } from '../hooks/useConocimientos';
import {
  useCopiarRequisitos,
  useGuardarRequisito,
  useQuitarRequisito,
  useRequisitos,
  type ResultadoCopia,
} from '../hooks/useRequisitos';

interface Props {
  puesto: Puesto;
  /** Solo el analista de puestos escribe. */
  puedeEditar: boolean;
  onCerrar: () => void;
}

/** Conocimientos que exige el puesto, con nivel y carácter (RF09). */
export function RequisitosPuestoDialog({ puesto, puedeEditar, onCerrar }: Props) {
  const { data: requisitos, isLoading, isError } = useRequisitos(puesto.id);
  const { data: niveles } = useValoresReferencia('nivel-dominio', false);
  const { data: catalogo } = useConocimientos({ activo: true });
  const { data: puestos } = usePuestos();
  const guardar = useGuardarRequisito();
  const quitar = useQuitarRequisito();
  const copiar = useCopiarRequisitos();

  const [nuevo, setNuevo] = useState<Conocimiento | null>(null);
  const [nivelNuevo, setNivelNuevo] = useState('');
  const [excluyenteNuevo, setExcluyenteNuevo] = useState(false);
  const [origen, setOrigen] = useState('');
  const [resultado, setResultado] = useState<ResultadoCopia>();
  const [error, setError] = useState<string>();

  const envolver = async (accion: () => Promise<unknown>) => {
    setError(undefined);
    setResultado(undefined);
    try {
      await accion();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const yaPedidos = new Set((requisitos ?? []).map((r) => r.idConocimiento));
  const ofrecidos = (catalogo ?? []).filter((c) => !yaPedidos.has(c.id));
  const otrosPuestos = (puestos ?? []).filter((p) => p.activo && p.id !== puesto.id);
  const ordenados = [...(niveles ?? [])].sort(
    (a, b) => (a.orden ?? a.id) - (b.orden ?? b.id),
  );

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="md">
      <DialogTitle>
        Requisitos de {puesto.codigo} · {puesto.denominacion}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(undefined)}>
              {error}
            </Alert>
          )}
          {resultado && (
            <Alert severity="success" onClose={() => setResultado(undefined)}>
              Se copiaron {resultado.copiados} requisitos.
              {resultado.omitidos.length > 0 &&
                ` No se tocaron los que el puesto ya tenía: ${resultado.omitidos
                  .map((o) => o.denominacion)
                  .join(', ')}.`}
            </Alert>
          )}
          {isLoading && <CircularProgress aria-label="Cargando" />}
          {isError && <Alert severity="error">No se pudieron cargar los requisitos.</Alert>}
          {requisitos && requisitos.length === 0 && (
            <Alert severity="info">Este puesto todavía no tiene requisitos.</Alert>
          )}
          {requisitos && requisitos.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Conocimiento</TableCell>
                  <TableCell>Nivel requerido</TableCell>
                  <TableCell>Excluyente</TableCell>
                  {puedeEditar && <TableCell align="right">Acciones</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {requisitos.map((r) => (
                  <TableRow key={r.idConocimiento}>
                    <TableCell>{r.denominacion}</TableCell>
                    <TableCell>
                      {puedeEditar ? (
                        <TextField
                          select
                          size="small"
                          value={String(r.idNivelRequerido)}
                          onChange={(e) =>
                            envolver(() =>
                              guardar.mutateAsync({
                                idPuesto: puesto.id,
                                idConocimiento: r.idConocimiento,
                                idNivel: Number(e.target.value),
                                esExcluyente: r.esExcluyente,
                              }),
                            )
                          }
                        >
                          {ordenados.map((n) => (
                            <MenuItem key={n.id} value={String(n.id)}>
                              {n.denominacion}
                            </MenuItem>
                          ))}
                        </TextField>
                      ) : (
                        (niveles?.find((n) => n.id === r.idNivelRequerido)?.denominacion ??
                        r.idNivelRequerido)
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={r.esExcluyente}
                        disabled={!puedeEditar}
                        slotProps={{ input: { 'aria-label': `Excluyente: ${r.denominacion}` } }}
                        onChange={(e) =>
                          envolver(() =>
                            guardar.mutateAsync({
                              idPuesto: puesto.id,
                              idConocimiento: r.idConocimiento,
                              idNivel: r.idNivelRequerido,
                              esExcluyente: e.target.checked,
                            }),
                          )
                        }
                      />
                    </TableCell>
                    {puedeEditar && (
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          aria-label={`Quitar ${r.denominacion}`}
                          onClick={() =>
                            envolver(() =>
                              quitar.mutateAsync({
                                idPuesto: puesto.id,
                                idConocimiento: r.idConocimiento,
                              }),
                            )
                          }
                        >
                          ✕
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {puedeEditar && (
            <>
              <Typography variant="subtitle2">Agregar un requisito</Typography>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Autocomplete
                  sx={{ flexGrow: 1 }}
                  size="small"
                  options={ofrecidos}
                  value={nuevo}
                  onChange={(_, v) => setNuevo(v)}
                  getOptionLabel={(c) => c.denominacion}
                  noOptionsText="No hay más conocimientos en el catálogo"
                  renderInput={(p) => <TextField {...p} label="Conocimiento" />}
                />
                <TextField
                  select
                  size="small"
                  label="Nivel"
                  value={nivelNuevo}
                  onChange={(e) => setNivelNuevo(e.target.value)}
                  sx={{ minWidth: 160 }}
                >
                  {ordenados.map((n) => (
                    <MenuItem key={n.id} value={String(n.id)}>
                      {n.denominacion}
                    </MenuItem>
                  ))}
                </TextField>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={excluyenteNuevo}
                      onChange={(e) => setExcluyenteNuevo(e.target.checked)}
                    />
                  }
                  label="Excluyente"
                />
                <Button
                  variant="contained"
                  disabled={!nuevo || !nivelNuevo || guardar.isPending}
                  onClick={() =>
                    envolver(async () => {
                      await guardar.mutateAsync({
                        idPuesto: puesto.id,
                        idConocimiento: (nuevo as Conocimiento).id,
                        idNivel: Number(nivelNuevo),
                        esExcluyente: excluyenteNuevo,
                      });
                      setNuevo(null);
                      setNivelNuevo('');
                      setExcluyenteNuevo(false);
                    })
                  }
                >
                  Agregar
                </Button>
              </Stack>

              <Typography variant="subtitle2">Copiar de otro puesto</Typography>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <TextField
                  select
                  size="small"
                  label="Puesto de origen"
                  value={origen}
                  onChange={(e) => setOrigen(e.target.value)}
                  sx={{ flexGrow: 1 }}
                  helperText="Se copian una sola vez; los que este puesto ya tiene no se modifican"
                >
                  {otrosPuestos.map((p) => (
                    <MenuItem key={p.id} value={String(p.id)}>
                      {p.codigo} · {p.denominacion}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  disabled={!origen || copiar.isPending}
                  onClick={() =>
                    envolver(async () => {
                      setResultado(
                        await copiar.mutateAsync({
                          idPuestoDestino: puesto.id,
                          idPuestoOrigen: Number(origen),
                        }),
                      );
                    })
                  }
                >
                  Copiar requisitos
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
```

El mensaje de `envolver` limpia `resultado` antes de cada acción, y `copiar` lo fija después: así el aviso de copia no queda pegado a la siguiente operación.

- [ ] **Paso 3: Enganchar el diálogo en la tabla de puestos**

En `TablaPuestos.tsx`:
1. Importar `import { RequisitosPuestoDialog } from '../../conocimiento/components/RequisitosPuestoDialog';`.
2. Junto a `const [verOcupantes, setVerOcupantes] = useState<Puesto>();` agregar `const [verRequisitos, setVerRequisitos] = useState<Puesto>();`.
3. En la celda de acciones, dentro de `{puedeVerOcupantes && ( … )}`, agregar después del botón «Ocupantes»:

```tsx
                      {puedeVerOcupantes && (
                        <Button size="small" onClick={() => setVerRequisitos(p)}>
                          Requisitos
                        </Button>
                      )}
```

   (El docente no ve el botón: `puedeVerOcupantes` es falso para él, y `GET /puestos/:id/requisitos` excluye al rol `docente`.)
4. Después del bloque `{verOcupantes && ( … )}` agregar:

```tsx
      {verRequisitos && (
        <RequisitosPuestoDialog
          puesto={verRequisitos}
          puedeEditar={puedeEditar}
          onCerrar={() => setVerRequisitos(undefined)}
        />
      )}
```

- [ ] **Paso 4: Verificar**

Run: `cd frontend && npm run lint && npm run build`
Expected: sin errores.

Escenario manual como `analista_puestos`: en Estructura, abrir «Requisitos» de un puesto tipo; agregar dos requisitos; cambiar el nivel de uno y marcarlo excluyente; copiar los requisitos a otro puesto (la segunda vez muestra todos como omitidos); quitar uno. Como `recursos_humanos`: ve la tabla en solo lectura.

- [ ] **Paso 5: Commit**

```bash
git add frontend/src
git commit -m "Agregar los requisitos de puesto a la pantalla de estructura"
```

---

## Tarea 14: Frontend, «Mis conocimientos» (RNF06)

**Files:**
- Create: `frontend/src/features/conocimiento/niveles.ts`
- Create: `frontend/src/features/conocimiento/hooks/useMisConocimientos.ts`
- Create: `frontend/src/features/conocimiento/components/FilaMiConocimiento.tsx`
- Create: `frontend/src/features/conocimiento/pages/MisConocimientosPage.tsx`
- Modify: `frontend/src/router.tsx`
- Modify: `frontend/src/auth/permisos.ts`

**Interfaces:**
- Consumes: `invalidarConocimiento` (tarea 12), `useConocimientos` (tarea 12), `useValoresReferencia`, `useSesion`, tipos generados `MiConocimientoDto`.
- Produces: `useMisConocimientos(habilitado: boolean)`, `useDeclarar()`, `useRetirarDeclaracion()`; tipo `MiConocimiento`; `descripcionNivel(codigo)`; ruta `/conocimiento/mios`.

- [ ] **Paso 1: Textos de los niveles**

`niveles.ts`: el docente elige un nivel sin capacitación previa, así que cada nivel lleva una frase en lenguaje llano. Los códigos son los de la tabla `nivel_dominio` cargada por migración.

```ts
const DESCRIPCION: Record<string, string> = {
  basico: 'Conozco los conceptos y resuelvo tareas simples con ayuda.',
  intermedio: 'Resuelvo por mi cuenta las tareas habituales.',
  avanzado: 'Resuelvo casos complejos y puedo orientar a otras personas.',
  experto: 'Soy referente: diseño soluciones y formo a otras personas.',
};

/** Frase que explica un nivel de dominio; vacía si el administrador agregó uno propio. */
export function descripcionNivel(codigo: string | undefined): string {
  return (codigo && DESCRIPCION[codigo]) || '';
}
```

- [ ] **Paso 2: Hooks**

`hooks/useMisConocimientos.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { invalidarConocimiento } from './useConocimientos';

export type MiConocimiento = Esquemas['MiConocimientoDto'];

/** Requisitos de los puestos que ocupa hoy más lo que ya registró. */
export function useMisConocimientos(habilitado: boolean) {
  return useQuery({
    queryKey: ['mis-conocimientos'],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await api.GET('/api/conocimientos/mios');
      if (error || !data) throw new Error('No se pudieron cargar tus conocimientos');
      return data;
    },
  });
}

export function useDeclarar() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (a: {
      idPersona: number;
      idConocimiento: number;
      idNivel: number;
    }) => {
      const { data, error } = await api.PUT(
        '/api/personas/{idPersona}/conocimientos/{idConocimiento}/declaracion',
        {
          params: { path: { idPersona: a.idPersona, idConocimiento: a.idConocimiento } },
          body: { idNivel: a.idNivel },
        },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}

export function useRetirarDeclaracion() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (a: { idPersona: number; idConocimiento: number }) => {
      const { error } = await api.DELETE(
        '/api/personas/{idPersona}/conocimientos/{idConocimiento}/declaracion',
        { params: { path: a } },
      );
      if (error) throw new Error(mensajeError(error));
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}
```

- [ ] **Paso 3: Fila de un conocimiento**

`components/FilaMiConocimiento.tsx`:

```tsx
import { Alert, Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import type { Valor } from '../../admin/hooks/useValoresReferencia';
import { descripcionNivel } from '../niveles';
import {
  useDeclarar,
  useRetirarDeclaracion,
  type MiConocimiento,
} from '../hooks/useMisConocimientos';

interface Props {
  fila: MiConocimiento;
  idPersona: number;
  /** Niveles activos, de menor a mayor. */
  niveles: Valor[];
  /** Todos los niveles (activos o no), para nombrar lo ya registrado. */
  todosLosNiveles: Valor[];
  tiposEvidencia: Valor[];
}

/** Una fila: lo que pide el puesto, lo que declaré y, si existe, lo que me acreditaron. */
export function FilaMiConocimiento({
  fila,
  idPersona,
  niveles,
  todosLosNiveles,
  tiposEvidencia,
}: Props) {
  const declarar = useDeclarar();
  const retirar = useRetirarDeclaracion();
  const [error, setError] = useState<string>();

  const nombre = (lista: Valor[], id: number | null) =>
    id === null ? '' : (lista.find((v) => v.id === id)?.denominacion ?? String(id));
  const elegido = niveles.find((n) => n.id === fila.idNivelDeclarado);

  const cambiar = async (idNivel: number) => {
    setError(undefined);
    try {
      await declarar.mutateAsync({ idPersona, idConocimiento: fila.idConocimiento, idNivel });
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const quitar = async () => {
    setError(undefined);
    try {
      await retirar.mutateAsync({ idPersona, idConocimiento: fila.idConocimiento });
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const acreditado = fila.idNivelAcreditado !== null;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" component="h3" sx={{ flexGrow: 1 }}>
            {fila.denominacion}
          </Typography>
          {fila.idNivelRequerido !== null && (
            <Chip
              size="small"
              color={fila.esExcluyente ? 'warning' : 'default'}
              label={`Se pide: ${nombre(todosLosNiveles, fila.idNivelRequerido)}${fila.esExcluyente ? ' (excluyente)' : ''}`}
            />
          )}
          {acreditado ? (
            <Chip
              size="small"
              color="success"
              label={`Acreditado: ${nombre(todosLosNiveles, fila.idNivelAcreditado)} · ${fila.fechaEvaluacion ?? ''}${
                fila.idTipoEvidencia !== null
                  ? ` · ${nombre(tiposEvidencia, fila.idTipoEvidencia)}`
                  : ''
              }`}
            />
          ) : (
            fila.idNivelDeclarado !== null && (
              <Chip size="small" label="Declarado, esperando acreditación" />
            )
          )}
        </Stack>
        {fila.puestos.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            Lo piden: {fila.puestos.map((p) => `${p.codigo} · ${p.denominacion}`).join('; ')}
          </Typography>
        )}
        {error && (
          <Alert severity="error" onClose={() => setError(undefined)}>
            {error}
          </Alert>
        )}
        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
          <TextField
            select
            size="small"
            label="Mi nivel"
            value={fila.idNivelDeclarado === null ? '' : String(fila.idNivelDeclarado)}
            onChange={(e) => cambiar(Number(e.target.value))}
            disabled={declarar.isPending}
            sx={{ minWidth: 200 }}
            helperText={descripcionNivel(elegido?.codigo) || 'Elegí el nivel que te describe'}
          >
            {niveles.map((n) => (
              <MenuItem key={n.id} value={String(n.id)}>
                {n.denominacion}
              </MenuItem>
            ))}
          </TextField>
          {fila.idNivelDeclarado !== null && (
            <Button size="small" onClick={quitar} disabled={retirar.isPending}>
              Quitar mi declaración
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
```

- [ ] **Paso 4: Página**

`pages/MisConocimientosPage.tsx`:

```tsx
import { Alert, Autocomplete, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useSesion } from '../../../auth/useSesion';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { FilaMiConocimiento } from '../components/FilaMiConocimiento';
import { useConocimientos, type Conocimiento } from '../hooks/useConocimientos';
import { useMisConocimientos, type MiConocimiento } from '../hooks/useMisConocimientos';
import { descripcionNivel } from '../niveles';

/** Una fila sin nada registrado, para un conocimiento que la persona suma a mano. */
const filaVacia = (c: Conocimiento): MiConocimiento => ({
  idConocimiento: c.id,
  denominacion: c.denominacion,
  idTipoConocimiento: c.idTipoConocimiento,
  idNivelRequerido: null,
  esExcluyente: false,
  puestos: [],
  idNivelDeclarado: null,
  fechaDeclaracion: null,
  idNivelAcreditado: null,
  fechaEvaluacion: null,
  idTipoEvidencia: null,
});

/**
 * Una sola pantalla para declarar los conocimientos, sin pasos ni vocabulario
 * técnico (RNF06). Parte de los requisitos de los puestos que la persona ocupa hoy.
 */
export function MisConocimientosPage() {
  const { data: sesion } = useSesion();
  const idPersona = sesion?.idPersona ?? null;
  const { data: filas, isLoading, isError } = useMisConocimientos(idPersona !== null);
  const { data: activos } = useValoresReferencia('nivel-dominio', false);
  const { data: todos } = useValoresReferencia('nivel-dominio', true);
  const { data: evidencias } = useValoresReferencia('tipo-evidencia', true);
  const { data: catalogo } = useConocimientos({ activo: true });
  const [extras, setExtras] = useState<Conocimiento[]>([]);

  if (idPersona === null) {
    return (
      <PaginaEnConstruccion titulo="Mis conocimientos" descripcion="">
        <Alert severity="warning">
          Tu usuario todavía no tiene una persona vinculada. Pedile al
          administrador que la asigne.
        </Alert>
      </PaginaEnConstruccion>
    );
  }

  const niveles = [...(activos ?? [])].sort((a, b) => (a.orden ?? a.id) - (b.orden ?? b.id));
  const registrados = new Set((filas ?? []).map((f) => f.idConocimiento));
  const sumados = extras.filter((c) => !registrados.has(c.id));
  const todasLasFilas = [...(filas ?? []), ...sumados.map(filaVacia)];
  const ofrecidos = (catalogo ?? []).filter(
    (c) => !registrados.has(c.id) && !extras.some((e) => e.id === c.id),
  );

  return (
    <PaginaEnConstruccion
      titulo="Mis conocimientos"
      descripcion="Elegí el nivel que te describe en cada conocimiento. Tu jefe de cátedra lo va a confirmar más adelante."
    >
      <Stack spacing={2}>
        <Alert severity="info" icon={false}>
          <Typography variant="subtitle2" gutterBottom>
            Qué significa cada nivel
          </Typography>
          {niveles.map((n) => (
            <Typography key={n.id} variant="body2">
              <strong>{n.denominacion}:</strong> {descripcionNivel(n.codigo)}
            </Typography>
          ))}
        </Alert>

        {isLoading && <CircularProgress aria-label="Cargando" />}
        {isError && <Alert severity="error">No se pudieron cargar tus conocimientos.</Alert>}
        {filas && filas.length === 0 && sumados.length === 0 && (
          <Alert severity="info">
            Tus puestos todavía no tienen requisitos cargados. Podés sumar
            conocimientos a mano desde el buscador de abajo.
          </Alert>
        )}

        {todasLasFilas.map((fila) => (
          <FilaMiConocimiento
            key={fila.idConocimiento}
            fila={fila}
            idPersona={idPersona}
            niveles={niveles}
            todosLosNiveles={todos ?? []}
            tiposEvidencia={evidencias ?? []}
          />
        ))}

        <Autocomplete
          size="small"
          options={ofrecidos}
          value={null}
          onChange={(_, c) => c && setExtras((anteriores) => [...anteriores, c])}
          getOptionLabel={(c) => c.denominacion}
          noOptionsText="No hay más conocimientos en el catálogo"
          renderInput={(p) => (
            <TextField
              {...p}
              label="Sumar otro conocimiento del catálogo"
              helperText="Si no lo encontrás, pedile al analista de puestos que lo agregue al catálogo"
            />
          )}
        />
      </Stack>
    </PaginaEnConstruccion>
  );
}
```

- [ ] **Paso 5: Ruta y menú**

En `router.tsx`: importar `MisConocimientosPage` (`'./features/conocimiento/pages/MisConocimientosPage'`) y agregar, después de la ruta `conocimiento`:

```tsx
      {
        path: 'conocimiento/mios',
        element: (
          <RutaProtegida roles={['docente', 'jefe_catedra', 'jefatura_departamento']}>
            <MisConocimientosPage />
          </RutaProtegida>
        ),
      },
```

En `auth/permisos.ts`, después de la entrada de `/conocimiento`:

```ts
  {
    ruta: '/conocimiento/mios',
    nombre: 'Mis conocimientos',
    roles: ['docente', 'jefe_catedra', 'jefatura_departamento'],
  },
```

- [ ] **Paso 6: Verificar**

Run: `cd frontend && npm run lint && npm run build`
Expected: sin errores.

Escenario manual: con un usuario `docente` vinculado a una persona que ocupa un puesto con requisitos (cargarlos como analista), entrar a «Mis conocimientos»: aparecen los requisitos precargados; elegir un nivel lo guarda en el acto y muestra «Declarado, esperando acreditación»; sumar un conocimiento del buscador; «Quitar mi declaración». Un usuario sin persona vinculada ve el aviso.

- [ ] **Paso 7: Commit**

```bash
git add frontend/src
git commit -m "Agregar la pantalla Mis conocimientos precargada con los requisitos de los puestos"
```

---

## Tarea 15: Frontend, acreditar (bandeja y ficha de la persona)

**Files:**
- Create: `frontend/src/features/conocimiento/hooks/useAcreditaciones.ts`
- Create: `frontend/src/features/conocimiento/components/AcreditarDialog.tsx`
- Create: `frontend/src/features/conocimiento/components/HistorialAcreditacionesDialog.tsx`
- Create: `frontend/src/features/conocimiento/components/ConocimientosDePersona.tsx`
- Create: `frontend/src/features/conocimiento/pages/PendientesAcreditacionPage.tsx`
- Modify: `frontend/src/features/personas/components/FichaPersona.tsx`
- Modify: `frontend/src/features/personas/pages/PersonasPage.tsx`
- Modify: `frontend/src/features/personas/pages/MiFichaPage.tsx`
- Modify: `frontend/src/router.tsx`
- Modify: `frontend/src/auth/permisos.ts`

**Interfaces:**
- Consumes: `invalidarConocimiento` y `useConocimientos` (tarea 12), `Valor` de `useValoresReferencia`, tipos generados `PerfilConocimientoDto`, `AcreditacionDto`, `PendienteAcreditacionDto`.
- Produces: `usePerfilDePersona(idPersona)`, `useHistorialAcreditaciones(idPersona, idConocimiento)`, `usePendientesAcreditacion()`, `useAcreditar()`; componentes `AcreditarDialog({ idPersona, nombrePersona?, conocimiento?, onCerrar })` y `ConocimientosDePersona({ idPersona, puedeAcreditar })`; ruta `/conocimiento/pendientes`; `FichaPersona` suma la prop `verConocimientos?: boolean` y `puedeAcreditar?: boolean`.

- [ ] **Paso 1: Hooks**

`hooks/useAcreditaciones.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { invalidarConocimiento } from './useConocimientos';

export type FilaPerfil = Esquemas['PerfilConocimientoDto'];
export type Acreditacion = Esquemas['AcreditacionDto'];
export type Pendiente = Esquemas['PendienteAcreditacionDto'];

export function usePerfilDePersona(idPersona: number) {
  return useQuery({
    queryKey: ['perfil-conocimiento', idPersona],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/personas/{idPersona}/conocimientos', {
        params: { path: { idPersona } },
      });
      if (error || !data) throw new Error('No se pudo cargar el conocimiento de la persona');
      return data;
    },
    retry: false,
  });
}

export function useHistorialAcreditaciones(idPersona: number, idConocimiento: number) {
  return useQuery({
    queryKey: ['perfil-conocimiento', idPersona, 'historial', idConocimiento],
    queryFn: async () => {
      const { data, error } = await api.GET(
        '/api/personas/{idPersona}/conocimientos/{idConocimiento}/acreditaciones',
        { params: { path: { idPersona, idConocimiento } } },
      );
      if (error || !data) throw new Error('No se pudo cargar el historial');
      return data;
    },
  });
}

export function usePendientesAcreditacion() {
  return useQuery({
    queryKey: ['pendientes-acreditacion'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/conocimientos/pendientes-acreditacion');
      if (error || !data) throw new Error('No se pudo cargar la bandeja');
      return data;
    },
  });
}

export function useAcreditar() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (a: {
      idPersona: number;
      idConocimiento: number;
      idNivel: number;
      fechaEvaluacion: string;
      idTipoEvidencia: number;
      observaciones: string | null;
    }) => {
      const { data, error } = await api.POST(
        '/api/personas/{idPersona}/conocimientos/{idConocimiento}/acreditaciones',
        {
          params: { path: { idPersona: a.idPersona, idConocimiento: a.idConocimiento } },
          body: {
            idNivel: a.idNivel,
            fechaEvaluacion: a.fechaEvaluacion,
            idTipoEvidencia: a.idTipoEvidencia,
            observaciones: a.observaciones,
          },
        },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarConocimiento(cliente),
  });
}
```

- [ ] **Paso 2: Diálogo para acreditar**

`components/AcreditarDialog.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Autocomplete,
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
import { useAcreditar } from '../hooks/useAcreditaciones';
import { useConocimientos, type Conocimiento } from '../hooks/useConocimientos';

interface Props {
  idPersona: number;
  nombrePersona?: string;
  /** Sin conocimiento, el diálogo ofrece elegirlo del catálogo. */
  conocimiento?: { id: number; denominacion: string };
  onCerrar: () => void;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
/** Hoy en el calendario local, `AAAA-MM-DD`. El servidor valida contra el de la base. */
const hoyLocal = () => new Date().toLocaleDateString('en-CA');

const esquema = z
  .object({
    idNivel: z.string().min(1, 'Elegí un nivel'),
    fechaEvaluacion: z.string().regex(FECHA, 'Elegí una fecha'),
    idTipoEvidencia: z.string().min(1, 'Elegí un tipo de evidencia'),
    observaciones: z.string().max(2000, 'Máximo 2000 caracteres'),
  })
  .refine((d) => d.fechaEvaluacion <= hoyLocal(), {
    path: ['fechaEvaluacion'],
    message: 'No puede ser futura',
  });
type Datos = z.infer<typeof esquema>;

/** Se monta solo mientras está abierto, por lo que parte siempre de cero. */
export function AcreditarDialog({ idPersona, nombrePersona, conocimiento, onCerrar }: Props) {
  const { data: niveles } = useValoresReferencia('nivel-dominio', false);
  const { data: evidencias } = useValoresReferencia('tipo-evidencia', false);
  const { data: catalogo } = useConocimientos({ activo: true });
  const acreditar = useAcreditar();
  const [elegido, setElegido] = useState<Conocimiento | null>(null);
  const [error, setError] = useState<string>();

  const destino = conocimiento ?? (elegido && { id: elegido.id, denominacion: elegido.denominacion });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      idNivel: '',
      fechaEvaluacion: hoyLocal(),
      idTipoEvidencia: '',
      observaciones: '',
    },
  });

  const guardar = handleSubmit(async (datos) => {
    if (!destino) {
      setError('Elegí el conocimiento que vas a acreditar');
      return;
    }
    setError(undefined);
    try {
      await acreditar.mutateAsync({
        idPersona,
        idConocimiento: destino.id,
        idNivel: Number(datos.idNivel),
        fechaEvaluacion: datos.fechaEvaluacion,
        idTipoEvidencia: Number(datos.idTipoEvidencia),
        observaciones: datos.observaciones.trim() || null,
      });
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="xs">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>
          Acreditar conocimiento{nombrePersona ? ` de ${nombrePersona}` : ''}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {conocimiento ? (
              <TextField label="Conocimiento" value={conocimiento.denominacion} disabled />
            ) : (
              <Autocomplete
                options={catalogo ?? []}
                value={elegido}
                onChange={(_, c) => setElegido(c)}
                getOptionLabel={(c) => c.denominacion}
                renderInput={(p) => <TextField {...p} label="Conocimiento" />}
              />
            )}
            <TextField
              select
              label="Nivel acreditado"
              defaultValue=""
              {...register('idNivel')}
              error={!!errors.idNivel}
              helperText={errors.idNivel?.message}
            >
              {(niveles ?? []).map((n) => (
                <MenuItem key={n.id} value={String(n.id)}>
                  {n.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Fecha de evaluación"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...register('fechaEvaluacion')}
              error={!!errors.fechaEvaluacion}
              helperText={errors.fechaEvaluacion?.message}
            />
            <TextField
              select
              label="Tipo de evidencia"
              defaultValue=""
              {...register('idTipoEvidencia')}
              error={!!errors.idTipoEvidencia}
              helperText={errors.idTipoEvidencia?.message}
            >
              {(evidencias ?? []).map((t) => (
                <MenuItem key={t.id} value={String(t.id)}>
                  {t.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Observaciones (opcional)"
              multiline
              minRows={2}
              {...register('observaciones')}
              error={!!errors.observaciones}
              helperText={
                errors.observaciones?.message ??
                'Por ejemplo, dónde está el comprobante. No se adjuntan archivos.'
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            Acreditar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
```

- [ ] **Paso 3: Historial y sección de la ficha**

`components/HistorialAcreditacionesDialog.tsx`:

```tsx
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { useHistorialAcreditaciones } from '../hooks/useAcreditaciones';

interface Props {
  idPersona: number;
  idConocimiento: number;
  denominacion: string;
  onCerrar: () => void;
}

/** Todas las acreditaciones del par; la primera es la vigente. */
export function HistorialAcreditacionesDialog({ idPersona, idConocimiento, denominacion, onCerrar }: Props) {
  const { data, isLoading, isError } = useHistorialAcreditaciones(idPersona, idConocimiento);
  const { data: niveles } = useValoresReferencia('nivel-dominio', true);
  const { data: evidencias } = useValoresReferencia('tipo-evidencia', true);
  const nombre = (lista: { id: number; denominacion: string }[] | undefined, id: number) =>
    lista?.find((v) => v.id === id)?.denominacion ?? String(id);

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="md">
      <DialogTitle>Historial de acreditaciones: {denominacion}</DialogTitle>
      <DialogContent>
        {isLoading && <CircularProgress aria-label="Cargando" />}
        {isError && <Alert severity="error">No se pudo cargar el historial.</Alert>}
        {data && data.length === 0 && <Alert severity="info">Todavía no hay acreditaciones.</Alert>}
        {data && data.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Nivel</TableCell>
                <TableCell>Evidencia</TableCell>
                <TableCell>Observaciones</TableCell>
                <TableCell>Vigente</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((a, i) => (
                <TableRow key={a.id}>
                  <TableCell>{a.fechaEvaluacion}</TableCell>
                  <TableCell>{nombre(niveles, a.idNivelAcreditado)}</TableCell>
                  <TableCell>{nombre(evidencias, a.idTipoEvidencia)}</TableCell>
                  <TableCell>{a.observaciones ?? '—'}</TableCell>
                  <TableCell>{i === 0 ? 'Sí' : ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
```

`components/ConocimientosDePersona.tsx`:

```tsx
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useSesion } from '../../../auth/useSesion';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { usePerfilDePersona, type FilaPerfil } from '../hooks/useAcreditaciones';
import { AcreditarDialog } from './AcreditarDialog';
import { HistorialAcreditacionesDialog } from './HistorialAcreditacionesDialog';

interface Props {
  idPersona: number;
  /** Jefatura y jefes de cátedra; el botón no aparece en el perfil propio. */
  puedeAcreditar: boolean;
}

/** Declarado, acreditado vigente e historial del conocimiento de una persona (RF10). */
export function ConocimientosDePersona({ idPersona, puedeAcreditar }: Props) {
  const { data: sesion } = useSesion();
  const { data: filas, isLoading, isError } = usePerfilDePersona(idPersona);
  const { data: niveles } = useValoresReferencia('nivel-dominio', true);
  const { data: evidencias } = useValoresReferencia('tipo-evidencia', true);
  const [acreditando, setAcreditando] = useState<{ fila?: FilaPerfil } | null>(null);
  const [historial, setHistorial] = useState<FilaPerfil>();

  const acreditaAqui = puedeAcreditar && sesion?.idPersona !== idPersona;
  const nombre = (lista: { id: number; denominacion: string }[] | undefined, id: number | null) =>
    id === null ? '—' : (lista?.find((v) => v.id === id)?.denominacion ?? String(id));

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center' }}>
        <Typography variant="h6" component="h3" sx={{ flexGrow: 1 }}>
          Conocimientos
        </Typography>
        {acreditaAqui && (
          <Button onClick={() => setAcreditando({})}>Acreditar otro conocimiento</Button>
        )}
      </Stack>
      {isLoading && <CircularProgress aria-label="Cargando" />}
      {isError && (
        <Alert severity="warning">No tenés acceso al conocimiento de esta persona.</Alert>
      )}
      {filas && filas.length === 0 && (
        <Alert severity="info">Esta persona todavía no declaró ni tiene conocimientos acreditados.</Alert>
      )}
      {filas && filas.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Conocimiento</TableCell>
              <TableCell>Declarado</TableCell>
              <TableCell>Acreditado</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filas.map((f) => (
              <TableRow key={f.idConocimiento}>
                <TableCell>{f.denominacion}</TableCell>
                <TableCell>{nombre(niveles, f.idNivelDeclarado)}</TableCell>
                <TableCell>
                  {f.idNivelAcreditado === null
                    ? '—'
                    : `${nombre(niveles, f.idNivelAcreditado)} · ${f.fechaEvaluacion} · ${nombre(evidencias, f.idTipoEvidencia)}`}
                </TableCell>
                <TableCell>
                  {f.pendiente ? (
                    <Chip size="small" color="warning" label="Pendiente de acreditar" />
                  ) : f.idNivelAcreditado !== null ? (
                    <Chip size="small" color="success" label="Acreditado" />
                  ) : null}
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setHistorial(f)}>
                    Historial
                  </Button>
                  {acreditaAqui && (
                    <Button size="small" onClick={() => setAcreditando({ fila: f })}>
                      Acreditar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {acreditando && (
        <AcreditarDialog
          idPersona={idPersona}
          conocimiento={
            acreditando.fila && {
              id: acreditando.fila.idConocimiento,
              denominacion: acreditando.fila.denominacion,
            }
          }
          onCerrar={() => setAcreditando(null)}
        />
      )}
      {historial && (
        <HistorialAcreditacionesDialog
          idPersona={idPersona}
          idConocimiento={historial.idConocimiento}
          denominacion={historial.denominacion}
          onCerrar={() => setHistorial(undefined)}
        />
      )}
    </Stack>
  );
}
```

- [ ] **Paso 4: Bandeja de pendientes**

`pages/PendientesAcreditacionPage.tsx`:

```tsx
import {
  Alert,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { useState } from 'react';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { AcreditarDialog } from '../components/AcreditarDialog';
import { usePendientesAcreditacion, type Pendiente } from '../hooks/useAcreditaciones';

/** Lo que las personas de tu equipo declararon y todavía falta acreditar. */
export function PendientesAcreditacionPage() {
  const { data, isLoading, isError } = usePendientesAcreditacion();
  const { data: niveles } = useValoresReferencia('nivel-dominio', true);
  const [elegido, setElegido] = useState<Pendiente>();
  const nombre = (id: number | null) =>
    id === null ? '—' : (niveles?.find((n) => n.id === id)?.denominacion ?? String(id));

  return (
    <PaginaEnConstruccion
      titulo="Conocimientos por acreditar"
      descripcion="Lo que declaró tu equipo y todavía no tiene una acreditación que lo respalde."
    >
      {isLoading && <CircularProgress aria-label="Cargando" />}
      {isError && <Alert severity="error">No se pudo cargar la bandeja.</Alert>}
      {data && data.length === 0 && <Alert severity="success">No hay nada pendiente.</Alert>}
      {data && data.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Persona</TableCell>
              <TableCell>Conocimiento</TableCell>
              <TableCell>Declaró</TableCell>
              <TableCell>Desde</TableCell>
              <TableCell>Acreditado hasta ahora</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((p) => (
              <TableRow key={`${p.idPersona}-${p.idConocimiento}`}>
                <TableCell>
                  {p.apellido}, {p.nombre}
                </TableCell>
                <TableCell>{p.denominacion}</TableCell>
                <TableCell>{nombre(p.idNivelDeclarado)}</TableCell>
                <TableCell>{p.fechaDeclaracion}</TableCell>
                <TableCell>{nombre(p.idNivelAcreditado)}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setElegido(p)}>
                    Acreditar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {elegido && (
        <AcreditarDialog
          idPersona={elegido.idPersona}
          nombrePersona={`${elegido.apellido}, ${elegido.nombre}`}
          conocimiento={{ id: elegido.idConocimiento, denominacion: elegido.denominacion }}
          onCerrar={() => setElegido(undefined)}
        />
      )}
    </PaginaEnConstruccion>
  );
}
```

- [ ] **Paso 5: Enganchar la sección en la ficha**

En `FichaPersona.tsx`:
1. Importar `import { ConocimientosDePersona } from '../../conocimiento/components/ConocimientosDePersona';`.
2. En `interface Props` agregar:

```ts
  /** Quien puede leer el conocimiento de la persona (RR. HH., autoridad, jefatura, jefes, la propia persona). */
  verConocimientos?: boolean;
  /** Jefatura y jefes de cátedra. */
  puedeAcreditar?: boolean;
```

3. En la firma: `export function FichaPersona({ idPersona, puedeEditar, verConocimientos = false, puedeAcreditar = false }: Props)`.
4. Después de `<TablaOcupaciones … />` agregar:

```tsx
      {verConocimientos && (
        <ConocimientosDePersona idPersona={persona.id} puedeAcreditar={puedeAcreditar} />
      )}
```

En `PersonasPage.tsx`, después de `const puedeEditar = …`:

```tsx
  const rol = sesion?.rol;
  const puedeAcreditar = rol === 'jefe_catedra' || rol === 'jefatura_departamento';
  const verConocimientos =
    puedeAcreditar || rol === 'recursos_humanos' || rol === 'autoridad';
```

y pasar a `FichaPersona`: `verConocimientos={verConocimientos} puedeAcreditar={puedeAcreditar}`. En `MiFichaPage.tsx`, pasar `verConocimientos` (la propia persona lee su perfil) a `<FichaPersona idPersona={sesion.idPersona} puedeEditar={false} verConocimientos />`.

- [ ] **Paso 6: Ruta y menú**

En `router.tsx`: importar `PendientesAcreditacionPage` y agregar, junto a las rutas de conocimiento:

```tsx
      {
        path: 'conocimiento/pendientes',
        element: (
          <RutaProtegida roles={['jefe_catedra', 'jefatura_departamento']}>
            <PendientesAcreditacionPage />
          </RutaProtegida>
        ),
      },
```

En `auth/permisos.ts`:

```ts
  {
    ruta: '/conocimiento/pendientes',
    nombre: 'Por acreditar',
    roles: ['jefe_catedra', 'jefatura_departamento'],
  },
```

- [ ] **Paso 7: Verificar**

Run: `cd frontend && npm run lint && npm run build`
Expected: sin errores.

Escenario manual de punta a punta (vincular los usuarios a personas desde Administración → Usuarios y asignar la cátedra al jefe):
1. El analista carga requisitos de un puesto de la cátedra.
2. El docente (ocupa ese puesto) declara «Avanzado» en «Mis conocimientos».
3. El jefe de cátedra abre «Por acreditar»: aparece la declaración; acredita «Intermedio» con evidencia «Observación directa». Desaparece de la bandeja (el nivel declarado difiere del acreditado, pero se evaluó después de declarar).
4. El docente ve «Acreditado: Intermedio». El docente declara de nuevo «Experto»: vuelve a la bandeja del jefe.
5. En `/personas`, el jefe abre la ficha: ve la sección Conocimientos con el historial; no ve «Acreditar» en su propia ficha; en la ficha de una persona de otra cátedra ve el aviso de acceso.
6. `analista_puestos` y `administrador` no ven la sección de conocimientos en `/personas`.

- [ ] **Paso 8: Commit**

```bash
git add frontend/src
git commit -m "Agregar la acreditación de conocimientos: bandeja de pendientes y sección en la ficha"
```

---

## Tarea 16: Documentos y cierre

**Files:**
- Modify: `docs/requerimientos.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-10-15-conocimiento-catalogo-design.md`
- Modify: `docs/superpowers/plans/2026-10-15-conocimiento-catalogo.md`

- [ ] **Paso 1: Actualizar `docs/requerimientos.md`**

Leer el archivo y editar con `Edit`:
1. En §5, después del párrafo `**Personas:** …`, agregar:

```
**Conocimiento:** `conocimiento`, `requisito_puesto`, `conocimiento_persona` y `acreditacion` (historial de solo inserción; el reflejo de la acreditación vigente vive en `conocimiento_persona`); ver `docs/superpowers/specs/2026-10-15-conocimiento-catalogo-design.md`. Suma dos dominios de referencia (`area_tematica`, `tipo_evidencia`) a los administrados por RF23. Las consultas de detección cuentan solo el nivel acreditado vigente.
```

2. En la fila de la tabla de stack `Base de datos`, cambiar `Modelo relacional de veinticuatro tablas (RNF07)` por `Modelo relacional de veinticinco tablas (RNF07)`.
3. En §7, borrar las dos filas `Historial de evaluaciones` y `Declarado y acreditado` (puntos cerrados por la spec de conocimiento, como se hizo con los de bloques anteriores).

- [ ] **Paso 2: Documentar en el README**

Leer `README.md`, ubicar la sección de personas (notas sobre datos personales y `btree_gist`) y agregar a continuación una sección «Catálogo de conocimientos»:

```markdown
### Catálogo de conocimientos

- **Duplicados:** dos conocimientos activos del mismo tipo no pueden tener la misma `denominacion_normalizada` (minúsculas, sin tildes, espacios colapsados; la `ñ` se conserva). La calcula la aplicación al dar de alta o editar. Si cargás conocimientos con `INSERT` directo en la base, tenés que completar vos esa columna con la misma regla, o el control de duplicados no te protege.
- **Fusión:** un duplicado se retira con «Fusionar» en la pantalla del catálogo (no se puede deshacer). Pasa sus requisitos y los datos de las personas al conocimiento que se conserva.
- **Acreditar:** solo lo hacen la jefatura y los jefes de cátedra, sobre personas con una ocupación vigente en sus unidades. Para que un jefe pueda acreditar, el administrador tiene que vincular su usuario con su persona y asignarle sus unidades. La persona que ocupa la jefatura de departamento no puede ser acreditada por nadie en esta etapa.
```

- [ ] **Paso 3: Verificación final**

Run, en orden:

```bash
cd backend && npm run lint && npm run format && npm test && npm run test:integracion
cd ../frontend && npm run lint && npm run format && npm run build
```

Expected: todo en verde (`npm run format` no debe dejar archivos modificados sin commitear; si los deja, revisar el diff y commitearlos). Revisar `docker compose logs backend` por errores al arrancar con las migraciones aplicadas desde cero: `docker compose down -v && docker compose up --build`, esperar el arranque y repetir el escenario manual de la tarea 15.

- [ ] **Paso 4: Marcar el estado de la spec y del plan**

La spec pasa a `Estado: Implementada | Fecha: 2026-10-15 | Autor: IvanOchoa229`. El plan pasa a `Estado: Implementado | Fecha: 2026-10-15 | PR: #<número>` una vez abierto el pull request (si todavía no hay número, dejar `En curso` con `PR: —` y completarlo en un commit aparte).

- [ ] **Paso 5: Commit**

```bash
git add docs README.md
git commit -m "Documentar el catálogo de conocimientos y marcar la spec y el plan como implementados"
```
