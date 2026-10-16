Estado: Implementado | Fecha: 2026-10-16 | PR: —

# Conocimiento: activos de conocimiento: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** que el analista de puestos, el administrador y las jefaturas (dentro de su alcance) registren manuales, instructivos y procedimientos vinculados a uno o más conocimientos y a la unidad que los mantiene, con su archivo en RustFS o un enlace externo, y que todo usuario autenticado pueda buscarlos y descargarlos (RF11, RNF08).

**Arquitectura:** el módulo `conocimiento` suma las entidades `ActivoConocimiento` y la tabla puente `activo_conocimiento_conocimiento`, el dominio de referencia `tipo_documento`, funciones puras de archivo (`archivo.ts`: tipo por firma de bytes, saneado de nombres, clave del objeto, SHA-256) y un `ActivosService` con SQL directo que coordina PostgreSQL y `StorageService`. Subir a RustFS y guardar en la base no es atómico: el servicio reserva el id con `nextval`, sube el objeto, guarda en transacción y, si la base falla, borra el objeto recién subido. El frontend suma una pantalla de activos y un diálogo de documentación por conocimiento, con subida multipart.

**Tech Stack:** NestJS 12 (Multer vía `@nestjs/platform-express`), TypeORM 0.3, PostgreSQL 16, `@aws-sdk/client-s3` (ya en `StorageService`), vitest, React 19, MUI, TanStack Query, react-hook-form, zod.

**Spec:** `docs/superpowers/specs/2026-10-16-conocimiento-activos-design.md`. Antes de empezar, leer también `docs/requerimientos.md` §3, §4, §5 y §7 y la spec del catálogo (`2026-10-15-conocimiento-catalogo-design.md`).

## Global Constraints

- Nombres de dominio y de código en español; snake_case en la base y camelCase en el código (`SnakeNamingStrategy`).
- Imports ESM con extensión `.js` (`'./archivo.js'`). Los tipos usados en firmas decoradas se importan con `import type`.
- `synchronize` desactivado: el esquema cambia solo por migraciones, generadas con `migration:generate` y revisadas a mano. Si propone algo ajeno a este bloque (por ejemplo `DROP INDEX "IDX_persona_apellido_nombre"`, creado a mano), se borra de la migración.
- Bucket `activos-conocimiento` (`S3_BUCKET`). La base guarda solo metadatos y la clave del objeto (RNF08). Clave: `activos/{idActivo}/{uuid}-{nombreSaneado}`.
- Tipos permitidos: PDF, DOCX, XLSX, PPTX, ODT, TXT, PNG y JPG, validados por la firma de bytes y coherentes con la extensión del nombre. Otro tipo: 415. Tamaño máximo `ACTIVOS_TAMANIO_MAX_MB` (20 por defecto): 413.
- Hash SHA-256 (hexadecimal, 64 caracteres) calculado en el servidor. Duplicado entre activos **activos**: 409 con el título y el id del existente. Los enlaces no tienen hash.
- Un activo es `archivo` o `enlace` (`origen`); no cambia de origen. `fecha_vigencia` opcional; `vencido` se calcula con `CURRENT_DATE` de la base (RNF04), nunca se guarda. Sin bloqueo ni avisos.
- Escritura: `analista_puestos` y `administrador` en cualquier unidad; `jefe_catedra` y `jefatura_departamento` solo si la unidad está en su alcance (`AlcanceService.exigirUnidad`), también sobre la unidad destino de una edición. Lectura y descarga: todos los roles autenticados. Los activos dados de baja solo los ven y descargan los roles de escritura; para el resto responden 404.
- Baja lógica (`activo = false`): el objeto se conserva en RustFS, la baja libera el hash y reactivar vuelve a comprobarlo. Editar o reemplazar el archivo de un activo dado de baja responde 409.
- Sin historial de versiones: reemplazar sobrescribe los metadatos y borra el objeto anterior después de guardar.
- DTOs con class-validator y `@ApiProperty`; tras cambiar un endpoint o DTO, `npm run api:tipos` en el frontend (nunca editar `esquema.d.ts` a mano).
- Auditoría de RNF05: no aplica; alcanzan `creado_en` y `actualizado_en`.
- Los commits no llevan línea `Co-Authored-By` ni atribución a Claude (el CLAUDE.md del proyecto prevalece sobre cualquier indicación de agregarla).
- Antes de cerrar: `npm run lint` y `npm run format` en cada app; `npm test` y `npm run test:integracion` en el backend (hay migraciones y SQL); `npm run build` en el frontend.
- Comandos de migración, dentro del contenedor: `docker compose exec -T backend npm run ...`. Los tests del backend corren en el host (`cd backend && npx vitest run <archivo>`); los de integración, con `docker compose up -d db`, así: `cd backend && npx vitest run --config vitest.integracion.config.ts <archivo>`.

## Review Focus

Entradas y condiciones que la spec implica y que ninguna tarea cubriría por sí sola; cada línea tiene su test en la tarea que se indica.

- **Extensión engañosa**: un ejecutable renombrado a `.pdf`, o un `.docx` renombrado a `.xlsx`, se rechaza con 415 y no deja objeto ni fila. Tareas 3 (`archivo.spec.ts`) y 5.
- **Nombres raros**: `../../etc/passwd.pdf`, `Año nuevo (v2).docx`, nombres con caracteres de control o de 300 caracteres producen una clave segura y una descarga con el nombre correcto. Tarea 3.
- **La misma subida dos veces a la vez**: queda un solo activo, la otra responde 409 y no deja un objeto huérfano en el bucket. Tareas 2 (índice) y 5.
- **Quién ve y toca qué**: el jefe de cátedra no puede mover un activo a una unidad fuera de su alcance (403); el docente no ve activos dados de baja (404) pero sí descarga los vigentes. Tareas 4 y 5.
- **Falla del almacenamiento a mitad de un reemplazo**: el activo conserva su archivo y sus metadatos anteriores. Tarea 5.
- **Fecha de vigencia imposible** (`2026-02-30`) o enlace con esquema no web (`javascript:`, `ftp:`): 400, no un error de la base. Tarea 4 (`activos.dto.spec.ts`).

---

## Mapa de archivos

Backend (`backend/src/`):

| Archivo | Responsabilidad |
| --- | --- |
| `modules/referencia/entities/tipo-documento.entity.ts`, `dominios.ts`, `referencia.module.ts` | Dominio `tipo_documento` (dieciocho dominios) |
| `modules/conocimiento/conocimiento.constantes.ts` | Slug del dominio nuevo |
| `modules/conocimiento/entities/activo-conocimiento.entity.ts`, `vinculo-activo-conocimiento.entity.ts` | Tablas `activo_conocimiento` y `activo_conocimiento_conocimiento` |
| `infra/database/migrations/*` | Dos migraciones (referencia; activos) |
| `modules/conocimiento/archivo.ts` | Funciones puras: tipo por contenido, nombres, clave, hash, `Content-Disposition` |
| `common/roles.ts` | Grupos de roles de escritura de activos |
| `infra/config/env.validation.ts` | `ACTIVOS_TAMANIO_MAX_MB` |
| `modules/conocimiento/dto/activos.dto.ts` | DTOs de entrada y salida |
| `modules/conocimiento/activos.sql.ts` | SQL de lectura y mapeo fila → DTO |
| `modules/conocimiento/activos.service.ts` | Lectura, descarga, alta, edición, reemplazo, baja y reactivación |
| `modules/conocimiento/activos.controller.ts`, `conocimiento.module.ts` | HTTP, Multer y módulo |
| `testing/almacen-falso.ts`, `testing/entorno-activos.ts` | Almacén en memoria y entorno de pruebas de integración |

Frontend (`frontend/src/`): `features/conocimiento/{activos.ts,hooks/useActivos.ts,components/{ChipVigencia,FormularioActivo,ReemplazarArchivoDialog,BajaActivoDialog,ActivosDeConocimientoDialog}.tsx,pages/ActivosPage.tsx}`, `features/conocimiento/pages/ConocimientoPage.tsx`, `auth/permisos.ts`, `router.tsx`.

---

## Tarea 1: Correcciones a la spec y dominio `tipo_documento`

**Files:**
- Modify: `docs/superpowers/specs/2026-10-16-conocimiento-activos-design.md`
- Create: `backend/src/modules/referencia/entities/tipo-documento.entity.ts`
- Modify: `backend/src/modules/referencia/dominios.ts`, `referencia.module.ts`, `dominios.spec.ts`, `referencia.service.spec.ts`
- Modify: `backend/src/modules/conocimiento/conocimiento.constantes.ts`
- Create: `backend/src/infra/database/migrations/<marca>-CrearReferenciaDocumentos.ts` (generada)

**Interfaces:**
- Produces: dominio `'tipo-documento'` (`DOMINIO_TIPO_DOCUMENTO`) con los valores `manual`, `instructivo`, `procedimiento`; tabla `tipo_documento (id_tipo_documento, codigo, denominacion, activo)`.

- [ ] **Step 1: Corregir la spec en cuatro puntos**

Editar `docs/superpowers/specs/2026-10-16-conocimiento-activos-design.md`:

1. En la sección Frontend, reemplazar el bloque "La ficha de cada conocimiento suma un bloque «Documentación»…" por: "`ConocimientoPage` es una tabla, no una ficha: suma una columna «Documentación» con un botón por fila que abre `ActivosDeConocimientoDialog` (lista de sus activos y botón «Agregar activo» con el conocimiento precargado)".
2. En Errores: reemplazar "409 por duplicado con el título del activo existente y enlace a su fila" por "409 por duplicado con el título y el id del activo existente en el mensaje"; y "413 y 415 con el tamaño máximo y los tipos permitidos leídos de la respuesta" queda como está. En `FormularioActivo`, reemplazar "validación previa de tamaño y tipo en el cliente" por "el selector de archivo solo ofrece las extensiones permitidas; el tamaño lo valida el servidor".
3. En la decisión 10, agregar al final: "El criterio de baja es por rol: los cuatro roles de escritura ven y descargan las bajas de cualquier unidad; el alcance por unidad solo limita escribir". Y en la sección Frontend, los botones de escritura se muestran por rol (el frontend no conoce los descendientes de la unidad); si el backend responde 403, se muestra el mensaje.
4. En la decisión 13, agregar: "Alta: el servicio reserva el id con `nextval` de la secuencia para armar la clave `activos/{idActivo}/…` antes de insertar. Editar o reemplazar un activo dado de baja responde 409".

- [ ] **Step 2: Escribir los tests que fallan**

En `backend/src/modules/referencia/dominios.spec.ts`: cambiar `'define los diecisiete dominios cerrados'` por `'define los dieciocho dominios cerrados'`, y los tres `17` por `18` (`toHaveLength(18)` y los dos `.size).toBe(18)`). Agregar dentro del `describe`:

```ts
  it('incluye el dominio de documentos', () => {
    const porSlug = new Map(DOMINIOS.map((d) => [d.slug, d]));
    expect(porSlug.get('tipo-documento')).toMatchObject({
      tabla: 'tipo_documento',
      ordinal: false,
    });
  });
```

En `referencia.service.spec.ts` (línea 67): `'lista los diecisiete dominios'` pasa a `'lista los dieciocho dominios'` y `toHaveLength(17)` a `toHaveLength(18)`.

- [ ] **Step 3: Verificar que fallan**

Run: `cd backend && npx vitest run src/modules/referencia`
Expected: FAIL (`expected 17 to have a length of 18`).

- [ ] **Step 4: Implementar el dominio**

`backend/src/modules/referencia/entities/tipo-documento.entity.ts`:

```ts
import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('tipo_documento')
export class TipoDocumento extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_tipo_documento' })
  id: number;
}
```

En `dominios.ts`: importar `import { TipoDocumento } from './entities/tipo-documento.entity.js';` junto a los otros, cambiar el comentario a `/** Los dieciocho dominios cerrados del modelo (RF23). */` y agregar al final del arreglo, después de `tipo-evidencia`:

```ts
  {
    slug: 'tipo-documento',
    denominacion: 'Tipo de documento',
    tabla: 'tipo_documento',
    ordinal: false,
    entidad: TipoDocumento,
  },
```

En `referencia.module.ts`: importar `TipoDocumento` y agregarlo al final de `TypeOrmModule.forFeature([...])`.

En `conocimiento.constantes.ts` agregar:

```ts
export const DOMINIO_TIPO_DOCUMENTO = 'tipo-documento';
```

- [ ] **Step 5: Generar y completar la migración**

Con el stack arriba (`docker compose up -d db backend`):

Run: `docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/CrearReferenciaDocumentos`

Revisar el archivo generado: debe crear solo `tipo_documento` (columnas `codigo`, `denominacion`, `activo`, `id_tipo_documento` y sus restricciones) y su `down` debe borrarla. Borrar cualquier sentencia ajena. Agregar al final de `up`, y la constante antes de la clase (mismo estilo que `1792095672541-CrearReferenciaConocimiento.ts`):

```ts
const TIPOS_DOCUMENTO: [codigo: string, denominacion: string][] = [
  ['manual', 'Manual'],
  ['instructivo', 'Instructivo'],
  ['procedimiento', 'Procedimiento'],
];
```

```ts
    for (const [codigo, denominacion] of TIPOS_DOCUMENTO) {
      await queryRunner.query(
        `INSERT INTO "tipo_documento" ("codigo", "denominacion") VALUES ($1, $2)`,
        [codigo, denominacion],
      );
    }
```

- [ ] **Step 6: Verificar**

Run: `cd backend && npx vitest run src/modules/referencia && npm run lint`
Expected: PASS.
Run: `docker compose exec -T backend npm run migration:run` y luego `docker compose exec -T backend npm run migration:show`
Expected: la migración nueva figura aplicada.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/specs backend/src
git commit -m "Agregar el dominio tipo_documento y ajustar la spec de activos"
```

---

## Tarea 2: Esquema de activos de conocimiento

**Files:**
- Create: `backend/src/modules/conocimiento/entities/activo-conocimiento.entity.ts`
- Create: `backend/src/modules/conocimiento/entities/vinculo-activo-conocimiento.entity.ts`
- Create: `backend/src/infra/database/migrations/<marca>-CrearActivosDeConocimiento.ts` (generada)
- Test: `backend/src/modules/conocimiento/activos.esquema.int.spec.ts`

**Interfaces:**
- Consumes: tablas `tipo_documento`, `unidad_organizativa`, `conocimiento`.
- Produces: tabla `activo_conocimiento (id_activo, titulo, id_tipo_documento, id_unidad, origen, ubicacion, nombre_original, tipo_mime, tamanio, hash, fecha_vigencia, activo, creado_en, actualizado_en)` con CHECK `CK_activo_origen_coherente` e índice único parcial `UQ_activo_hash_activo` sobre `hash` donde `activo AND hash IS NOT NULL`; tabla puente `activo_conocimiento_conocimiento (id_activo, id_conocimiento)`.

- [ ] **Step 1: Escribir el test de integración que falla**

`backend/src/modules/conocimiento/activos.esquema.int.spec.ts`:

```ts
import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

describe('Activos de conocimiento: esquema (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let tipoDocumento: number;
  let unidad: number;
  let conocimiento: number;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const id = async (consulta: string) =>
    (await sql<{ id: number }[]>(consulta))[0].id;

  const archivo = (hash: string | null, activo = true, mime = 'application/pdf') =>
    sql<{ id: number }[]>(
      `INSERT INTO activo_conocimiento
         (titulo, id_tipo_documento, id_unidad, origen, ubicacion, nombre_original, tipo_mime, tamanio, hash, activo)
       VALUES ('Manual', $1, $2, 'archivo', 'activos/1/x-manual.pdf', 'manual.pdf', $3, 10, $4, $5)
       RETURNING id_activo AS id`,
      [tipoDocumento, unidad, mime, hash, activo],
    );
  const enlace = (hash: string | null = null) =>
    sql<{ id: number }[]>(
      `INSERT INTO activo_conocimiento
         (titulo, id_tipo_documento, id_unidad, origen, ubicacion, hash)
       VALUES ('Wiki', $1, $2, 'enlace', 'https://wiki.example/x', $3)
       RETURNING id_activo AS id`,
      [tipoDocumento, unidad, hash],
    );

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    tipoDocumento = await id(
      `SELECT id_tipo_documento AS id FROM tipo_documento WHERE codigo = 'manual'`,
    );
    unidad = await id(
      `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad)
       SELECT 'Departamento de Sistemas', id_tipo_unidad FROM tipo_unidad WHERE codigo = 'departamento'
       RETURNING id_unidad AS id`,
    );
    conocimiento = await id(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT 'SQL', 'sql', t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica'
       RETURNING id_conocimiento AS id`,
    );
  });
  afterAll(async () => {
    await base.destruir();
  });
  afterEach(async () => {
    await sql('DELETE FROM activo_conocimiento_conocimiento');
    await sql('DELETE FROM activo_conocimiento');
  });

  it('rechaza un archivo sin hash', async () => {
    await expect(archivo(null)).rejects.toThrow(/CK_activo_origen_coherente/);
  });

  it('rechaza un enlace con hash', async () => {
    await expect(enlace(HASH_A)).rejects.toThrow(/CK_activo_origen_coherente/);
  });

  it('acepta un enlace sin metadatos de archivo', async () => {
    await expect(enlace()).resolves.toHaveLength(1);
    await expect(enlace()).resolves.toHaveLength(1);
  });

  it('rechaza dos archivos activos con el mismo hash', async () => {
    await archivo(HASH_A);
    await expect(archivo(HASH_A)).rejects.toThrow(/UQ_activo_hash_activo/);
  });

  it('permite repetir el hash de un activo dado de baja', async () => {
    await archivo(HASH_A, false);
    await expect(archivo(HASH_A)).resolves.toHaveLength(1);
  });

  it('con dos altas simultáneas del mismo hash queda una sola', async () => {
    const resultados = await Promise.allSettled([archivo(HASH_B), archivo(HASH_B)]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(resultados.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('no repite el vínculo de un activo con un conocimiento', async () => {
    const [{ id: activo }] = await archivo(HASH_A);
    const vincular = () =>
      sql(
        `INSERT INTO activo_conocimiento_conocimiento (id_activo, id_conocimiento) VALUES ($1, $2)`,
        [activo, conocimiento],
      );
    await vincular();
    await expect(vincular()).rejects.toThrow();
  });

  it('rechaza un vínculo con un conocimiento inexistente', async () => {
    const [{ id: activo }] = await archivo(HASH_A);
    await expect(
      sql(
        `INSERT INTO activo_conocimiento_conocimiento (id_activo, id_conocimiento) VALUES ($1, 999999)`,
        [activo],
      ),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `cd backend && npx vitest run --config vitest.integracion.config.ts src/modules/conocimiento/activos.esquema.int.spec.ts`
Expected: FAIL (`relation "activo_conocimiento" does not exist`).

- [ ] **Step 3: Escribir las entidades**

`backend/src/modules/conocimiento/entities/activo-conocimiento.entity.ts`:

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
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { UnidadOrganizativa } from '../../estructura/entities/unidad-organizativa.entity.js';
import { TipoDocumento } from '../../referencia/entities/tipo-documento.entity.js';

/**
 * Activo de conocimiento (RF11): un archivo guardado en RustFS o un enlace
 * externo. `ubicacion` es la clave del objeto en el bucket o la URL
 * (RNF08). El CHECK mantiene coherentes origen y metadatos, y el índice único
 * parcial impide dos archivos activos con el mismo contenido.
 */
@Entity('activo_conocimiento')
@Check(
  'CK_activo_origen_coherente',
  `("origen" = 'archivo' AND "nombre_original" IS NOT NULL AND "tipo_mime" IS NOT NULL AND "tamanio" IS NOT NULL AND "hash" IS NOT NULL) OR ("origen" = 'enlace' AND "nombre_original" IS NULL AND "tipo_mime" IS NULL AND "tamanio" IS NULL AND "hash" IS NULL)`,
)
@Index('UQ_activo_hash_activo', ['hash'], {
  unique: true,
  where: '"activo" AND "hash" IS NOT NULL',
})
export class ActivoConocimiento {
  @PrimaryGeneratedColumn({ name: 'id_activo' })
  id: number;

  @Column({ type: 'varchar', length: 200 })
  titulo: string;

  @Column({ name: 'id_tipo_documento', type: 'int' })
  idTipoDocumento: number;

  @ManyToOne(() => TipoDocumento, { nullable: false })
  @JoinColumn({ name: 'id_tipo_documento' })
  tipoDocumento: Relation<TipoDocumento>;

  /** Unidad que mantiene el activo. */
  @Column({ name: 'id_unidad', type: 'int' })
  idUnidad: number;

  @ManyToOne(() => UnidadOrganizativa, { nullable: false })
  @JoinColumn({ name: 'id_unidad' })
  unidad: Relation<UnidadOrganizativa>;

  /** `archivo` o `enlace`; no cambia después del alta. */
  @Column({ type: 'varchar', length: 10 })
  origen: 'archivo' | 'enlace';

  /** Clave del objeto en el bucket (archivo) o URL http(s) (enlace). */
  @Column({ type: 'varchar', length: 2000 })
  ubicacion: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nombreOriginal: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tipoMime: string | null;

  @Column({ type: 'int', nullable: true })
  tamanio: number | null;

  /** SHA-256 hexadecimal del contenido. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  hash: string | null;

  @Column({ type: 'date', nullable: true })
  fechaVigencia: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}
```

`backend/src/modules/conocimiento/entities/vinculo-activo-conocimiento.entity.ts`:

```ts
import {
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { ActivoConocimiento } from './activo-conocimiento.entity.js';
import { Conocimiento } from './conocimiento.entity.js';

/** Conocimientos que documenta un activo (tabla puente). */
@Entity('activo_conocimiento_conocimiento')
@Index('IDX_activo_conocimiento_conocimiento', ['idConocimiento'])
export class VinculoActivoConocimiento {
  @PrimaryColumn({ name: 'id_activo', type: 'int' })
  idActivo: number;

  @PrimaryColumn({ name: 'id_conocimiento', type: 'int' })
  idConocimiento: number;

  @ManyToOne(() => ActivoConocimiento, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_activo' })
  activo: Relation<ActivoConocimiento>;

  @ManyToOne(() => Conocimiento, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_conocimiento' })
  conocimiento: Relation<Conocimiento>;
}
```

- [ ] **Step 4: Generar y revisar la migración**

Run: `docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/CrearActivosDeConocimiento`

Revisar que el archivo: crea las dos tablas; incluye `CONSTRAINT "CK_activo_origen_coherente" CHECK (...)`; incluye `CREATE UNIQUE INDEX "UQ_activo_hash_activo" ON "activo_conocimiento" ("hash") WHERE "activo" AND "hash" IS NOT NULL`; `creado_en`/`actualizado_en` con `DEFAULT now()`; las FK del puente con `ON DELETE RESTRICT`; y un `down` simétrico. Borrar toda sentencia ajena. Si la columna `activo` quedó antes del `WHERE` con otra sintaxis, dejarla equivalente a la de arriba.

- [ ] **Step 5: Verificar**

Run: `docker compose exec -T backend npm run migration:run`
Run: `cd backend && npx vitest run --config vitest.integracion.config.ts src/modules/conocimiento/activos.esquema.int.spec.ts && npm run lint`
Expected: PASS (8 tests). Después, `docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/Comprobacion` debe responder «No changes in database schema were found»; si genera un archivo, borrarlo y alinear las entidades con la migración (la única diferencia tolerable es el `DROP INDEX "IDX_persona_apellido_nombre"` ajeno, creado a mano).

- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "Agregar el esquema de activos de conocimiento y su tabla puente"
```

---

## Tarea 3: Funciones puras de archivo, roles y límite de tamaño

**Files:**
- Create: `backend/src/modules/conocimiento/archivo.ts`
- Test: `backend/src/modules/conocimiento/archivo.spec.ts`
- Modify: `backend/src/common/roles.ts`
- Modify: `backend/src/infra/config/env.validation.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces (`archivo.ts`):
  - `interface TipoArchivo { mime: string; extensiones: string[] }`
  - `detectarTipo(contenido: Buffer, nombre: string): TipoArchivo | null`
  - `decodificarNombre(original: string): string`
  - `limpiarNombre(nombre: string): string`
  - `nombreParaClave(nombre: string): string`
  - `claveObjeto(idActivo: number, nombre: string): string`
  - `hashSha256(contenido: Buffer): string`
  - `disposicionAdjunto(nombre: string): string`
- Produces (`roles.ts`): `ROLES_ESCRITORES_DE_ACTIVOS`, `ROLES_ESCRITORES_GLOBALES_DE_ACTIVOS`.
- Produces (env): `ACTIVOS_TAMANIO_MAX_MB: number` (1 a 100, 20 por defecto).

- [ ] **Step 1: Escribir los tests que fallan**

`backend/src/modules/conocimiento/archivo.spec.ts`:

```ts
import {
  claveObjeto,
  decodificarNombre,
  detectarTipo,
  disposicionAdjunto,
  hashSha256,
  limpiarNombre,
  nombreParaClave,
} from './archivo.js';

const PK = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const zip = (...nombres: string[]) =>
  Buffer.concat([PK, Buffer.alloc(26), Buffer.from(nombres.join('\0'))]);
const odt = (mime: string) =>
  Buffer.concat([
    PK,
    Buffer.alloc(26),
    Buffer.from('mimetype'),
    Buffer.from(mime),
    PK,
  ]);
const pdf = Buffer.from('%PDF-1.7\ncontenido');
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(8),
]);
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe('detectarTipo', () => {
  it.each([
    ['manual.pdf', pdf, 'application/pdf'],
    ['MANUAL.PDF', pdf, 'application/pdf'],
    ['foto.png', png, 'image/png'],
    ['foto.jpg', jpg, 'image/jpeg'],
    ['foto.jpeg', jpg, 'image/jpeg'],
    [
      'a.docx',
      zip('[Content_Types].xml', 'word/document.xml'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    [
      'a.xlsx',
      zip('[Content_Types].xml', 'xl/workbook.xml'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    [
      'a.pptx',
      zip('[Content_Types].xml', 'ppt/presentation.xml'),
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    [
      'a.odt',
      odt('application/vnd.oasis.opendocument.text'),
      'application/vnd.oasis.opendocument.text',
    ],
    ['notas.txt', Buffer.from('Año nuevo\nsegunda línea'), 'text/plain'],
  ])('acepta %s', (nombre, contenido, mime) => {
    expect(detectarTipo(contenido, nombre)?.mime).toBe(mime);
  });

  it('rechaza un ejecutable renombrado a .pdf', () => {
    expect(detectarTipo(Buffer.from('MZ\x90\x00 programa'), 'manual.pdf')).toBe(
      null,
    );
  });

  it('rechaza un PDF con extensión de ejecutable', () => {
    expect(detectarTipo(pdf, 'manual.exe')).toBe(null);
  });

  it('rechaza un docx renombrado a .xlsx', () => {
    expect(detectarTipo(zip('word/document.xml'), 'a.xlsx')).toBe(null);
  });

  it('rechaza un zip genérico con extensión de Office', () => {
    expect(detectarTipo(zip('cualquiera.txt'), 'a.docx')).toBe(null);
  });

  it('rechaza una hoja de cálculo ODF con extensión .odt', () => {
    expect(
      detectarTipo(
        odt('application/vnd.oasis.opendocument.spreadsheet'),
        'a.odt',
      ),
    ).toBe(null);
  });

  it('rechaza un texto con bytes nulos, con UTF-8 inválido o vacío', () => {
    expect(detectarTipo(Buffer.from('a\0b'), 'a.txt')).toBe(null);
    expect(detectarTipo(Buffer.from([0xff, 0xfe, 0x41]), 'a.txt')).toBe(null);
    expect(detectarTipo(Buffer.alloc(0), 'a.txt')).toBe(null);
  });

  it('rechaza un nombre sin extensión', () => {
    expect(detectarTipo(pdf, 'manual')).toBe(null);
  });
});

describe('nombres', () => {
  it('limpia rutas y caracteres de control', () => {
    expect(limpiarNombre('../../etc/passwd.pdf')).toBe('passwd.pdf');
    expect(limpiarNombre('C:\\docs\\manual.pdf')).toBe('manual.pdf');
    expect(limpiarNombre('a\u0000b\u001f.pdf')).toBe('ab.pdf');
    expect(limpiarNombre('   ')).toBe('archivo');
  });

  it('conserva tildes y ñ en el nombre legible y acota el largo', () => {
    expect(limpiarNombre('Año nuevo (v2).docx')).toBe('Año nuevo (v2).docx');
    const largo = limpiarNombre('a'.repeat(300) + '.pdf');
    expect(largo).toHaveLength(255);
    expect(largo.endsWith('.pdf')).toBe(true);
  });

  it('decodifica el nombre que Multer entrega como latin1', () => {
    const comoLlega = Buffer.from('Año.pdf', 'utf8').toString('latin1');
    expect(decodificarNombre(comoLlega)).toBe('Año.pdf');
    expect(decodificarNombre('Año.pdf')).toBe('Año.pdf');
    expect(decodificarNombre('plano.pdf')).toBe('plano.pdf');
  });

  it('arma un nombre ASCII seguro para la clave sin perder la extensión', () => {
    expect(nombreParaClave('Año nuevo (v2).docx')).toBe('Ano_nuevo_v2_.docx');
    expect(nombreParaClave('.htaccess')).toBe('htaccess');
    expect(nombreParaClave('???')).toBe('archivo');
    expect(nombreParaClave('x'.repeat(200) + '.pdf')).toHaveLength(100);
    expect(nombreParaClave('x'.repeat(200) + '.pdf').endsWith('.pdf')).toBe(
      true,
    );
  });

  it('arma la clave con el id del activo y un uuid', () => {
    const a = claveObjeto(12, 'Año.pdf');
    const b = claveObjeto(12, 'Año.pdf');
    expect(a).toMatch(
      /^activos\/12\/[0-9a-f-]{36}-Ano\.pdf$/,
    );
    expect(a).not.toBe(b);
  });
});

describe('hash y descarga', () => {
  it('calcula el SHA-256 hexadecimal', () => {
    expect(hashSha256(Buffer.from('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('arma el Content-Disposition con respaldo ASCII y nombre UTF-8', () => {
    const cabecera = disposicionAdjunto('Año "nuevo".pdf');
    expect(cabecera).toBe(
      `attachment; filename="A_o _nuevo_.pdf"; filename*=UTF-8''A%C3%B1o%20%22nuevo%22.pdf`,
    );
    expect(disposicionAdjunto("a'(b).pdf")).toContain(
      "filename*=UTF-8''a%27%28b%29.pdf",
    );
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `cd backend && npx vitest run src/modules/conocimiento/archivo.spec.ts`
Expected: FAIL (`Cannot find module './archivo.js'`).

- [ ] **Step 3: Implementar `archivo.ts`**

```ts
import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';

export interface TipoArchivo {
  mime: string;
  extensiones: string[];
}

const tipo = (mime: string, ...extensiones: string[]): TipoArchivo => ({
  mime,
  extensiones,
});

const PDF = tipo('application/pdf', 'pdf');
const PNG = tipo('image/png', 'png');
const JPG = tipo('image/jpeg', 'jpg', 'jpeg');
const TXT = tipo('text/plain', 'txt');
const DOCX = tipo(
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'docx',
);
const XLSX = tipo(
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'xlsx',
);
const PPTX = tipo(
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'pptx',
);
const ODT = tipo('application/vnd.oasis.opendocument.text', 'odt');

const empieza = (c: Buffer, firma: number[]) =>
  c.length >= firma.length && firma.every((b, i) => c[i] === b);

/** Los zip de Office guardan sin comprimir los nombres de sus partes: alcanza con buscarlos. */
function tipoZip(c: Buffer): TipoArchivo | null {
  if (c.includes('word/document.xml')) return DOCX;
  if (c.includes('xl/workbook.xml')) return XLSX;
  if (c.includes('ppt/presentation.xml')) return PPTX;
  // ODF: la primera entrada es `mimetype`, sin comprimir, y la sigue otra cabecera.
  if (c.toString('latin1', 30, 38) === 'mimetype') {
    const mime = ODT.mime;
    if (
      c.toString('latin1', 38, 38 + mime.length) === mime &&
      empieza(c.subarray(38 + mime.length), [0x50, 0x4b])
    ) {
      return ODT;
    }
  }
  return null;
}

function esTexto(c: Buffer): boolean {
  if (c.length === 0 || c.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(c);
    return true;
  } catch {
    return false;
  }
}

function tipoPorContenido(c: Buffer): TipoArchivo | null {
  if (empieza(c, [0x25, 0x50, 0x44, 0x46, 0x2d])) return PDF;
  if (empieza(c, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return PNG;
  if (empieza(c, [0xff, 0xd8, 0xff])) return JPG;
  if (empieza(c, [0x50, 0x4b, 0x03, 0x04])) return tipoZip(c);
  return esTexto(c) ? TXT : null;
}

/**
 * Tipo del archivo según sus bytes, siempre que la extensión del nombre sea la
 * que le corresponde. `null`: tipo no permitido o contenido que no coincide con
 * la extensión (un ejecutable renombrado a `.pdf`, un `.docx` llamado `.xlsx`).
 */
export function detectarTipo(
  contenido: Buffer,
  nombre: string,
): TipoArchivo | null {
  const detectado = tipoPorContenido(contenido);
  const extension = extname(nombre).toLowerCase().slice(1);
  return detectado && detectado.extensiones.includes(extension)
    ? detectado
    : null;
}

/**
 * Multer entrega `originalname` leyendo los bytes como latin1: si en realidad
 * eran UTF-8 (tildes, ñ), se recompone. Si el nombre ya viene bien, no cambia.
 */
export function decodificarNombre(original: string): string {
  if (!/^[\u0000-\u00ff]*$/.test(original)) return original;
  const decodificado = Buffer.from(original, 'latin1').toString('utf8');
  return decodificado.includes('\uFFFD') ? original : decodificado;
}

/** Nombre legible para mostrar: sin ruta, sin caracteres de control, de hasta 255 caracteres y conservando la extensión. */
export function limpiarNombre(nombre: string): string {
  const base = nombre.split(/[\\/]/).pop() ?? '';
  const limpio = base.normalize('NFC').replace(/\p{Cc}/gu, '').trim();
  if (limpio.length <= 255) return limpio || 'archivo';
  const extension = extname(limpio);
  return limpio.slice(0, 255 - extension.length) + extension;
}

/** Parte del nombre que va en la clave del objeto: solo ASCII seguro, hasta 100 caracteres y con la extensión al final. */
export function nombreParaClave(nombre: string): string {
  const seguro = nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[._]+/, '');
  return seguro.slice(-100) || 'archivo';
}

/** `activos/{idActivo}/{uuid}-{nombre}`: sin colisiones y legible en la consola de RustFS. */
export function claveObjeto(idActivo: number, nombre: string): string {
  return `activos/${idActivo}/${randomUUID()}-${nombreParaClave(nombre)}`;
}

export function hashSha256(contenido: Buffer): string {
  return createHash('sha256').update(contenido).digest('hex');
}

/** `Content-Disposition: attachment` con respaldo ASCII y el nombre real en `filename*` (RFC 5987). */
export function disposicionAdjunto(nombre: string): string {
  const ascii = nombre.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const utf8 = encodeURIComponent(nombre).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
```

- [ ] **Step 4: Verificar**

Run: `cd backend && npx vitest run src/modules/conocimiento/archivo.spec.ts`
Expected: PASS. Si `nombreParaClave('???')` no da `'_'` o `nombreParaClave('Año nuevo (v2).docx')` no da `'Ano_nuevo_v2_.docx'`, ajustar la expresión (no el test): `???` pasa a `_` por el reemplazo y el `slice(-100)` conserva el guion bajo; `(v2)` pasa a `_v2_`.

- [ ] **Step 5: Roles y variable de entorno**

En `backend/src/common/roles.ts`, al final:

```ts
/** Escriben activos de conocimiento (RF11): cualquier unidad o solo las de su alcance. */
export const ROLES_ESCRITORES_DE_ACTIVOS: CodigoRol[] = [
  ROLES.analistaPuestos,
  ROLES.administrador,
  ROLES.jefaturaDepartamento,
  ROLES.jefeCatedra,
];

/** Entre los escritores, los que no están limitados por alcance. */
export const ROLES_ESCRITORES_GLOBALES_DE_ACTIVOS: CodigoRol[] = [
  ROLES.analistaPuestos,
  ROLES.administrador,
];
```

En `env.validation.ts`: agregar `Max` y `Min` al import de `class-validator` (orden alfabético: `IsUrl, Max, MaxLength, Min, MinLength`) y, después de `S3_BUCKET`:

```ts
  /** Tamaño máximo de un archivo de activo de conocimiento, en MB. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  ACTIVOS_TAMANIO_MAX_MB: number = 20;
```

En `.env.example`, después de `S3_BUCKET=activos-conocimiento`:

```
# Tamaño máximo por archivo de un activo de conocimiento, en MB (1 a 100)
ACTIVOS_TAMANIO_MAX_MB=20
```

- [ ] **Step 6: Verificar y commit**

Run: `cd backend && npm test && npm run lint`
Expected: PASS (sin tests rotos por las variables nuevas; si `env.validation` tiene un spec que arma un entorno completo, el valor por defecto lo cubre).

```bash
git add backend/src .env.example
git commit -m "Agregar las funciones de archivo, los roles de escritura de activos y el límite de tamaño"
```

---

## Tarea 4: DTOs y lectura de activos (listar, detalle y descarga)

**Files:**
- Create: `backend/src/modules/conocimiento/dto/activos.dto.ts`
- Test: `backend/src/modules/conocimiento/dto/activos.dto.spec.ts`
- Modify: `backend/src/modules/conocimiento/dto/catalogo.dto.ts` (exportar `aBooleano`)
- Create: `backend/src/modules/conocimiento/activos.sql.ts`
- Create: `backend/src/modules/conocimiento/activos.service.ts` (lectura)
- Create: `backend/src/testing/almacen-falso.ts`, `backend/src/testing/entorno-activos.ts`
- Test: `backend/src/modules/conocimiento/activos.lectura.int.spec.ts`

**Interfaces:**
- Consumes: `ROLES_ESCRITORES_DE_ACTIVOS` (Tarea 3), `StorageService.obtener(clave): Promise<Readable>`, `AlcanceService`, `ReferenciaService`, tablas de la Tarea 2.
- Produces:
  - `CrearActivoDto`, `ActualizarActivoDto`, `FiltroActivosDto`, `ActivoDto`, `PaginaActivosDto`.
  - `ActivosService` con `listar(sesion: SesionUsuario, filtro: FiltroActivosDto): Promise<PaginaActivosDto>`, `obtener(sesion, id: number): Promise<ActivoDto>`, `descargar(sesion, id): Promise<DescargaActivo>`; `interface DescargaActivo { flujo: Readable; nombre: string; tipoMime: string; tamanio: number }`.
  - `SQL_SELECT_ACTIVO`, `interface FilaActivo`, `aActivoDto(fila: FilaActivo): ActivoDto`.
  - Testing: `AlmacenFalso` (`objetos: Map<string, { contenido: Buffer; tipoMime: string }>`, `falloSubida: boolean`, `subir`, `obtener`, `eliminar`) y `crearEntornoActivos()`.

- [ ] **Step 1: Escribir el test de los DTOs (falla)**

`backend/src/modules/conocimiento/dto/activos.dto.spec.ts`:

```ts
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  ActualizarActivoDto,
  CrearActivoDto,
  FiltroActivosDto,
} from './activos.dto.js';

const validar = <T extends object>(clase: new () => T, datos: object) => {
  const instancia = plainToInstance(clase, datos);
  const errores = validateSync(instancia, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { instancia, propiedades: errores.map((e) => e.property) };
};

const base = {
  titulo: 'Manual de bases de datos',
  idTipoDocumento: '1',
  idUnidad: '2',
  idsConocimiento: '3',
};

describe('CrearActivoDto (multipart)', () => {
  it('convierte los campos de texto y envuelve un solo id en un arreglo', () => {
    const { instancia, propiedades } = validar(CrearActivoDto, base);
    expect(propiedades).toEqual([]);
    expect(instancia.idTipoDocumento).toBe(1);
    expect(instancia.idUnidad).toBe(2);
    expect(instancia.idsConocimiento).toEqual([3]);
  });

  it('acepta el campo repetido como arreglo', () => {
    const { instancia, propiedades } = validar(CrearActivoDto, {
      ...base,
      idsConocimiento: ['1', '2'],
    });
    expect(propiedades).toEqual([]);
    expect(instancia.idsConocimiento).toEqual([1, 2]);
  });

  it('exige al menos un conocimiento y rechaza ids repetidos o no numéricos', () => {
    expect(
      validar(CrearActivoDto, { ...base, idsConocimiento: [] }).propiedades,
    ).toContain('idsConocimiento');
    expect(
      validar(CrearActivoDto, { ...base, idsConocimiento: ['1', '1'] })
        .propiedades,
    ).toContain('idsConocimiento');
    expect(
      validar(CrearActivoDto, { ...base, idsConocimiento: ['x'] }).propiedades,
    ).toContain('idsConocimiento');
  });

  it('rechaza una fecha de vigencia imposible o con formato distinto', () => {
    expect(
      validar(CrearActivoDto, { ...base, fechaVigencia: '2026-02-30' })
        .propiedades,
    ).toContain('fechaVigencia');
    expect(
      validar(CrearActivoDto, { ...base, fechaVigencia: '2026-02-28T10:00:00Z' })
        .propiedades,
    ).toContain('fechaVigencia');
    expect(
      validar(CrearActivoDto, { ...base, fechaVigencia: '2026-02-28' })
        .propiedades,
    ).toEqual([]);
  });

  it('solo admite enlaces http o https', () => {
    for (const enlace of ['javascript:alert(1)', 'ftp://host/x', 'wiki']) {
      expect(
        validar(CrearActivoDto, { ...base, enlace }).propiedades,
      ).toContain('enlace');
    }
    expect(
      validar(CrearActivoDto, { ...base, enlace: 'https://wiki.example/x' })
        .propiedades,
    ).toEqual([]);
  });

  it('recorta el título y rechaza uno demasiado corto o largo', () => {
    expect(validar(CrearActivoDto, { ...base, titulo: '  ab  ' }).instancia.titulo).toBe('ab');
    expect(validar(CrearActivoDto, { ...base, titulo: ' a ' }).propiedades).toContain('titulo');
    expect(validar(CrearActivoDto, { ...base, titulo: 'x'.repeat(201) }).propiedades).toContain('titulo');
  });
});

describe('ActualizarActivoDto', () => {
  it('todo es opcional y la fecha admite null para borrarla', () => {
    expect(validar(ActualizarActivoDto, {}).propiedades).toEqual([]);
    const { instancia, propiedades } = validar(ActualizarActivoDto, {
      fechaVigencia: null,
      idsConocimiento: [1, 2],
    });
    expect(propiedades).toEqual([]);
    expect(instancia.fechaVigencia).toBeNull();
  });
});

describe('FiltroActivosDto', () => {
  it('convierte la consulta y aplica pagina y tamanio por defecto', () => {
    const { instancia, propiedades } = validar(FiltroActivosDto, {
      idConocimiento: '4',
      vencido: 'true',
      incluirBajas: 'false',
    });
    expect(propiedades).toEqual([]);
    expect(instancia).toMatchObject({
      idConocimiento: 4,
      vencido: true,
      incluirBajas: false,
      pagina: 1,
      tamanio: 20,
    });
  });

  it('limita el tamaño de página a 100', () => {
    expect(validar(FiltroActivosDto, { tamanio: '101' }).propiedades).toContain('tamanio');
    expect(validar(FiltroActivosDto, { pagina: '0' }).propiedades).toContain('pagina');
  });
});
```

Run: `cd backend && npx vitest run src/modules/conocimiento/dto/activos.dto.spec.ts`
Expected: FAIL (`Cannot find module './activos.dto.js'`).

- [ ] **Step 2: Implementar los DTOs**

En `catalogo.dto.ts`, cambiar `const aBooleano = ...` por `export const aBooleano = ...`.

`backend/src/modules/conocimiento/dto/activos.dto.ts`:

```ts
import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { aBooleano } from './catalogo.dto.js';
import { Trim } from './trim.js';

const MAX_INT4 = 2147483647;

/** En multipart un campo repetido llega como arreglo y uno solo como texto. */
const aListaDeEnteros = ({ value }: { value: unknown }) => {
  if (value === undefined) return value;
  const lista: unknown[] = Array.isArray(value) ? value : [value];
  return lista.map((v) =>
    typeof v === 'string' && v.trim() !== '' ? Number(v) : v,
  );
};

export class CrearActivoDto {
  @ApiProperty({ maxLength: 200, example: 'Manual de administración de PostgreSQL' })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  titulo: string;

  @ApiProperty({ description: 'Tipo de documento activo' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idTipoDocumento: number;

  @ApiProperty({ description: 'Unidad que mantiene el activo' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idUnidad: number;

  @ApiProperty({
    type: [Number],
    description: 'Conocimientos que documenta (al menos uno); en multipart, el campo se repite',
  })
  @Transform(aListaDeEnteros)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT4, { each: true })
  idsConocimiento: number[];

  @ApiPropertyOptional({ example: '2027-03-31', nullable: true, type: String })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaVigencia debe ser AAAA-MM-DD' })
  @IsISO8601({ strict: true })
  fechaVigencia?: string | null;

  @ApiPropertyOptional({
    description: 'URL http(s) del activo; sin archivo es obligatoria',
  })
  @IsOptional()
  @Trim()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  @MaxLength(2000)
  enlace?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Archivo (campo multipart `archivo`); sin enlace es obligatorio',
  })
  @IsOptional()
  archivo?: unknown;
}

export class ActualizarActivoDto extends PartialType(
  OmitType(CrearActivoDto, ['archivo'] as const),
) {}

export class FiltroActivosDto {
  @ApiPropertyOptional({ description: 'Texto contenido en el título' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idConocimiento?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idUnidad?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idTipoDocumento?: number;

  @ApiPropertyOptional({ description: 'true: solo vencidos; false: solo vigentes o sin fecha' })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  vencido?: boolean;

  @ApiPropertyOptional({ description: 'Solo roles de escritura; el resto no ve las bajas' })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  incluirBajas?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  tamanio: number = 20;
}

export class ActivoDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  titulo: string;

  @ApiProperty()
  idTipoDocumento: number;

  @ApiProperty()
  idUnidad: number;

  @ApiProperty({ enum: ['archivo', 'enlace'] })
  origen: 'archivo' | 'enlace';

  @ApiProperty({ nullable: true, type: String, description: 'URL, solo en los enlaces' })
  enlace: string | null;

  @ApiProperty({ nullable: true, type: String })
  nombreOriginal: string | null;

  @ApiProperty({ nullable: true, type: String })
  tipoMime: string | null;

  @ApiProperty({ nullable: true, type: Number, description: 'Bytes' })
  tamanio: number | null;

  @ApiProperty({ nullable: true, type: String, example: '2027-03-31' })
  fechaVigencia: string | null;

  @ApiProperty({ description: 'La fecha de vigencia ya pasó (calculado al consultar)' })
  vencido: boolean;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Días hasta la fecha de vigencia; negativo si ya venció',
  })
  diasParaVencer: number | null;

  @ApiProperty()
  activo: boolean;

  @ApiProperty({ type: [Number] })
  idsConocimiento: number[];

  @ApiProperty()
  creadoEn: string;

  @ApiProperty()
  actualizadoEn: string;
}

export class PaginaActivosDto {
  @ApiProperty({ type: [ActivoDto] })
  items: ActivoDto[];

  @ApiProperty({ description: 'Total que cumple el filtro' })
  total: number;
}
```

Run: `cd backend && npx vitest run src/modules/conocimiento/dto/activos.dto.spec.ts`
Expected: PASS. Si `OmitType(...).PartialType` pierde el `Transform` de `idsConocimiento` (el test de `ActualizarActivoDto` lo detecta con `[1, 2]`), definir `ActualizarActivoDto` a mano.

- [ ] **Step 3: Almacén falso y entorno de pruebas**

`backend/src/testing/almacen-falso.ts`:

```ts
import { Readable } from 'node:stream';

/** Reemplazo en memoria de `StorageService` para las pruebas de integración. */
export class AlmacenFalso {
  readonly objetos = new Map<string, { contenido: Buffer; tipoMime: string }>();
  /** Con `true`, la próxima subida falla (simula RustFS caído). */
  falloSubida = false;

  async subir(clave: string, contenido: Buffer, tipoMime: string) {
    if (this.falloSubida) throw new Error('RustFS no disponible');
    this.objetos.set(clave, { contenido, tipoMime });
  }

  async obtener(clave: string): Promise<Readable> {
    const objeto = this.objetos.get(clave);
    if (!objeto) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
    return Readable.from([objeto.contenido]);
  }

  async eliminar(clave: string) {
    this.objetos.delete(clave);
  }
}
```

`backend/src/testing/entorno-activos.ts`:

```ts
import type { DataSource } from 'typeorm';
import { ROLES } from '../common/roles.js';
import type { SesionUsuario } from '../common/sesion-usuario.js';
import type { StorageService } from '../infra/storage/storage.service.js';
import { ActivosService } from '../modules/conocimiento/activos.service.js';
import type { ReferenciaService } from '../modules/referencia/referencia.service.js';
import { AlcanceService } from '../modules/usuarios/alcance.service.js';
import { AlmacenFalso } from './almacen-falso.js';
import { crearBaseTemporal, type BaseTemporal } from './base-temporal.js';

export interface EntornoActivos {
  base: BaseTemporal;
  ds: DataSource;
  servicio: ActivosService;
  almacen: AlmacenFalso;
  sql<T>(consulta: string, parametros?: unknown[]): Promise<T>;
  ids: {
    tipoDocumento: number;
    departamento: number;
    catedraA: number;
    catedraB: number;
    conocimientoA: number;
    conocimientoB: number;
  };
  sesiones: {
    analista: SesionUsuario;
    jefeA: SesionUsuario;
    docente: SesionUsuario;
  };
  destruir(): Promise<void>;
}

/** PDF mínimo: lo que importa para el servicio es la firma `%PDF-` y que el texto cambie el hash. */
export const pdf = (texto: string, nombre = 'manual.pdf') => ({
  originalname: nombre,
  buffer: Buffer.from(`%PDF-1.7\n${texto}`),
});

export async function crearEntornoActivos(): Promise<EntornoActivos> {
  const base = await crearBaseTemporal();
  const ds = base.dataSource;
  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const primero = async (consulta: string, parametros?: unknown[]) =>
    (await sql<{ id: number }[]>(consulta, parametros))[0].id;

  const unidad = (denominacion: string, tipo: string, superior: number | null) =>
    primero(
      `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
       SELECT $1, id_tipo_unidad, $3 FROM tipo_unidad WHERE codigo = $2
       RETURNING id_unidad AS id`,
      [denominacion, tipo, superior],
    );
  const conocimiento = (denominacion: string, normalizada: string) =>
    primero(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT $1, $2, t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica'
       RETURNING id_conocimiento AS id`,
      [denominacion, normalizada],
    );

  const departamento = await unidad('Departamento de Sistemas', 'departamento', null);
  const catedraA = await unidad('Cátedra A', 'catedra', departamento);
  const catedraB = await unidad('Cátedra B', 'catedra', departamento);
  const ids = {
    tipoDocumento: await primero(
      `SELECT id_tipo_documento AS id FROM tipo_documento WHERE codigo = 'manual'`,
    ),
    departamento,
    catedraA,
    catedraB,
    conocimientoA: await conocimiento('SQL', 'sql'),
    conocimientoB: await conocimiento('Redes', 'redes'),
  };

  const almacen = new AlmacenFalso();
  const referencia = {
    validarActivo: async () => undefined,
  } as unknown as ReferenciaService;
  const servicio = new ActivosService(
    ds,
    referencia,
    almacen as unknown as StorageService,
    new AlcanceService(ds),
  );

  const sesion = (
    id: number,
    rol: SesionUsuario['rol'],
    unidades: number[],
  ): SesionUsuario => ({
    id,
    nombreUsuario: `usuario${id}`,
    rol,
    idPersona: null,
    unidades,
  });

  return {
    base,
    ds,
    servicio,
    almacen,
    sql,
    ids,
    sesiones: {
      analista: sesion(1, ROLES.analistaPuestos, []),
      jefeA: sesion(2, ROLES.jefeCatedra, [catedraA]),
      docente: sesion(3, ROLES.docente, []),
    },
    destruir: () => base.destruir(),
  };
}
```

- [ ] **Step 4: Escribir el test de integración de lectura (falla)**

Como el alta se implementa en la Tarea 5, este test inserta con SQL. `backend/src/modules/conocimiento/activos.lectura.int.spec.ts`:

```ts
import { NotFoundException, ConflictException } from '@nestjs/common';
import {
  crearEntornoActivos,
  type EntornoActivos,
} from '../../testing/entorno-activos.js';

describe('Activos: lectura (PostgreSQL real)', () => {
  let e: EntornoActivos;

  const insertar = async (o: {
    titulo: string;
    unidad?: number;
    origen?: 'archivo' | 'enlace';
    hash?: string;
    vigencia?: string | null;
    activo?: boolean;
    conocimientos?: number[];
  }) => {
    const archivo = (o.origen ?? 'archivo') === 'archivo';
    const [{ id }] = await e.sql<{ id: number }[]>(
      `INSERT INTO activo_conocimiento
         (titulo, id_tipo_documento, id_unidad, origen, ubicacion, nombre_original, tipo_mime, tamanio, hash, fecha_vigencia, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id_activo AS id`,
      [
        o.titulo,
        e.ids.tipoDocumento,
        o.unidad ?? e.ids.catedraA,
        archivo ? 'archivo' : 'enlace',
        archivo ? `activos/9/${o.titulo}.pdf` : 'https://wiki.example/x',
        archivo ? `${o.titulo}.pdf` : null,
        archivo ? 'application/pdf' : null,
        archivo ? 12 : null,
        archivo ? (o.hash ?? o.titulo.padEnd(64, '0')) : null,
        o.vigencia ?? null,
        o.activo ?? true,
      ],
    );
    for (const c of o.conocimientos ?? [e.ids.conocimientoA]) {
      await e.sql(
        `INSERT INTO activo_conocimiento_conocimiento (id_activo, id_conocimiento) VALUES ($1, $2)`,
        [id, c],
      );
    }
    return id;
  };
  const dia = async (delta: number) =>
    (
      await e.sql<{ f: string }[]>(`SELECT (CURRENT_DATE + $1::int)::text AS f`, [
        delta,
      ])
    )[0].f;

  beforeAll(async () => {
    e = await crearEntornoActivos();
  });
  afterAll(async () => {
    await e.destruir();
  });
  afterEach(async () => {
    await e.sql('DELETE FROM activo_conocimiento_conocimiento');
    await e.sql('DELETE FROM activo_conocimiento');
    e.almacen.objetos.clear();
  });

  it('calcula vencido y días para vencer con la fecha de la base', async () => {
    await insertar({ titulo: 'ayer', vigencia: await dia(-1) });
    await insertar({ titulo: 'hoy', vigencia: await dia(0) });
    await insertar({ titulo: 'manana', vigencia: await dia(1) });
    await insertar({ titulo: 'sinfecha' });
    const { items } = await e.servicio.listar(e.sesiones.analista, {
      pagina: 1,
      tamanio: 20,
    } as never);
    const por = Object.fromEntries(items.map((a) => [a.titulo, a]));
    expect(por.ayer).toMatchObject({ vencido: true, diasParaVencer: -1 });
    expect(por.hoy).toMatchObject({ vencido: false, diasParaVencer: 0 });
    expect(por.manana).toMatchObject({ vencido: false, diasParaVencer: 1 });
    expect(por.sinfecha).toMatchObject({
      vencido: false,
      diasParaVencer: null,
      fechaVigencia: null,
    });
  });

  it('filtra por título, conocimiento, unidad, tipo y vigencia', async () => {
    await insertar({ titulo: 'Manual SQL', conocimientos: [e.ids.conocimientoA] });
    await insertar({
      titulo: 'Guía de redes',
      unidad: e.ids.catedraB,
      conocimientos: [e.ids.conocimientoB],
      vigencia: await dia(-5),
    });
    const lista = (filtro: object) =>
      e.servicio
        .listar(e.sesiones.analista, { pagina: 1, tamanio: 20, ...filtro } as never)
        .then((p) => p.items.map((a) => a.titulo));
    expect(await lista({ q: 'sql' })).toEqual(['Manual SQL']);
    expect(await lista({ q: '%' })).toEqual([]);
    expect(await lista({ idConocimiento: e.ids.conocimientoB })).toEqual(['Guía de redes']);
    expect(await lista({ idUnidad: e.ids.catedraA })).toEqual(['Manual SQL']);
    expect(await lista({ idTipoDocumento: e.ids.tipoDocumento })).toHaveLength(2);
    expect(await lista({ vencido: true })).toEqual(['Guía de redes']);
    expect(await lista({ vencido: false })).toEqual(['Manual SQL']);
  });

  it('pagina y devuelve el total', async () => {
    for (const t of ['a1', 'a2', 'a3']) await insertar({ titulo: t });
    const p = await e.servicio.listar(e.sesiones.analista, {
      pagina: 2,
      tamanio: 2,
    } as never);
    expect(p.total).toBe(3);
    expect(p.items.map((a) => a.titulo)).toEqual(['a3']);
  });

  it('lista los vínculos de cada activo', async () => {
    await insertar({
      titulo: 'Doble',
      conocimientos: [e.ids.conocimientoB, e.ids.conocimientoA],
    });
    const { items } = await e.servicio.listar(e.sesiones.analista, {
      pagina: 1,
      tamanio: 20,
    } as never);
    expect(items[0].idsConocimiento).toEqual(
      [e.ids.conocimientoA, e.ids.conocimientoB].sort((x, y) => x - y),
    );
  });

  it('oculta las bajas a quien no escribe y las muestra al escritor que las pide', async () => {
    const baja = await insertar({ titulo: 'vieja', activo: false });
    await insertar({ titulo: 'vigente' });
    const filtro = { pagina: 1, tamanio: 20, incluirBajas: true } as never;
    const docente = await e.servicio.listar(e.sesiones.docente, filtro);
    expect(docente.items.map((a) => a.titulo)).toEqual(['vigente']);
    const analista = await e.servicio.listar(e.sesiones.analista, filtro);
    expect(analista.items.map((a) => a.titulo).sort()).toEqual(['vieja', 'vigente']);
    const sinPedir = await e.servicio.listar(e.sesiones.analista, {
      pagina: 1,
      tamanio: 20,
    } as never);
    expect(sinPedir.items.map((a) => a.titulo)).toEqual(['vigente']);
    await expect(e.servicio.obtener(e.sesiones.docente, baja)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(e.servicio.obtener(e.sesiones.analista, baja)).resolves.toMatchObject({
      activo: false,
    });
  });

  it('no expone la clave del objeto ni el hash, y sí la URL de un enlace', async () => {
    const archivo = await insertar({ titulo: 'doc' });
    const enlace = await insertar({ titulo: 'wiki', origen: 'enlace' });
    const a = await e.servicio.obtener(e.sesiones.docente, archivo);
    expect(a.enlace).toBeNull();
    expect(JSON.stringify(a)).not.toContain('activos/9');
    expect(a).not.toHaveProperty('hash');
    const b = await e.servicio.obtener(e.sesiones.docente, enlace);
    expect(b.enlace).toBe('https://wiki.example/x');
  });

  it('responde 404 si el activo no existe', async () => {
    await expect(e.servicio.obtener(e.sesiones.analista, 999999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('descarga el contenido con su nombre y tipo, para cualquier rol', async () => {
    const id = await insertar({ titulo: 'doc' });
    e.almacen.objetos.set(`activos/9/doc.pdf`, {
      contenido: Buffer.from('%PDF-1.7 hola'),
      tipoMime: 'application/pdf',
    });
    const d = await e.servicio.descargar(e.sesiones.docente, id);
    const partes: Buffer[] = [];
    for await (const parte of d.flujo) partes.push(Buffer.from(parte as Buffer));
    expect(Buffer.concat(partes).toString()).toBe('%PDF-1.7 hola');
    expect(d).toMatchObject({
      nombre: 'doc.pdf',
      tipoMime: 'application/pdf',
      tamanio: 12,
    });
  });

  it('no descarga un enlace ni una baja ajena, y avisa si falta el objeto', async () => {
    const enlace = await insertar({ titulo: 'wiki', origen: 'enlace' });
    await expect(e.servicio.descargar(e.sesiones.docente, enlace)).rejects.toBeInstanceOf(
      ConflictException,
    );
    const baja = await insertar({ titulo: 'vieja', activo: false });
    await expect(e.servicio.descargar(e.sesiones.docente, baja)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    // El escritor sí la descarga, pero el objeto no está en el bucket.
    await expect(e.servicio.descargar(e.sesiones.analista, baja)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
```

Run: `cd backend && npx vitest run --config vitest.integracion.config.ts src/modules/conocimiento/activos.lectura.int.spec.ts`
Expected: FAIL (`Cannot find module '../modules/conocimiento/activos.service.js'`).

- [ ] **Step 5: Implementar `activos.sql.ts` y la lectura del servicio**

`backend/src/modules/conocimiento/activos.sql.ts`:

```ts
import type { ActivoDto } from './dto/activos.dto.js';

/** Fila de `SQL_SELECT_ACTIVO`: lo que el servicio necesita, incluidos `ubicacion` y `hash`, que no salen en el DTO. */
export interface FilaActivo {
  id: number;
  titulo: string;
  idTipoDocumento: number;
  idUnidad: number;
  origen: 'archivo' | 'enlace';
  ubicacion: string;
  nombreOriginal: string | null;
  tipoMime: string | null;
  tamanio: number | null;
  hash: string | null;
  fechaVigencia: string | null;
  vencido: boolean;
  diasParaVencer: number | null;
  activo: boolean;
  idsConocimiento: number[];
  creadoEn: Date;
  actualizadoEn: Date;
}

/** `vencido` y `diasParaVencer` se calculan con la fecha de la base (RNF04). */
export const SQL_SELECT_ACTIVO = `
  SELECT a.id_activo AS id, a.titulo,
         a.id_tipo_documento AS "idTipoDocumento", a.id_unidad AS "idUnidad",
         a.origen, a.ubicacion, a.nombre_original AS "nombreOriginal",
         a.tipo_mime AS "tipoMime", a.tamanio, a.hash,
         a.fecha_vigencia::text AS "fechaVigencia",
         COALESCE(a.fecha_vigencia < CURRENT_DATE, false) AS vencido,
         (a.fecha_vigencia - CURRENT_DATE) AS "diasParaVencer",
         a.activo, a.creado_en AS "creadoEn", a.actualizado_en AS "actualizadoEn",
         COALESCE((SELECT array_agg(v.id_conocimiento ORDER BY v.id_conocimiento)
                   FROM activo_conocimiento_conocimiento v
                   WHERE v.id_activo = a.id_activo), '{}') AS "idsConocimiento"
  FROM activo_conocimiento a`;

export function aActivoDto(f: FilaActivo): ActivoDto {
  return {
    id: f.id,
    titulo: f.titulo,
    idTipoDocumento: f.idTipoDocumento,
    idUnidad: f.idUnidad,
    origen: f.origen,
    enlace: f.origen === 'enlace' ? f.ubicacion : null,
    nombreOriginal: f.nombreOriginal,
    tipoMime: f.tipoMime,
    tamanio: f.tamanio,
    fechaVigencia: f.fechaVigencia,
    vencido: f.vencido,
    diasParaVencer: f.diasParaVencer,
    activo: f.activo,
    idsConocimiento: f.idsConocimiento,
    creadoEn: f.creadoEn.toISOString(),
    actualizadoEn: f.actualizadoEn.toISOString(),
  };
}
```

`backend/src/modules/conocimiento/activos.service.ts` (solo lectura por ahora; la Tarea 5 agrega la escritura):

```ts
import type { Readable } from 'node:stream';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { escaparLike } from '../../common/like.js';
import { ROLES_ESCRITORES_DE_ACTIVOS } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { ReferenciaService } from '../referencia/referencia.service.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import {
  aActivoDto,
  SQL_SELECT_ACTIVO,
  type FilaActivo,
} from './activos.sql.js';
import type {
  ActivoDto,
  FiltroActivosDto,
  PaginaActivosDto,
} from './dto/activos.dto.js';

export interface DescargaActivo {
  flujo: Readable;
  nombre: string;
  tipoMime: string;
  tamanio: number;
}

/**
 * Activos de conocimiento (RF11). Usa SQL directo: las consultas combinan la
 * tabla puente y fechas de la base. Los archivos viven en RustFS (RNF08).
 */
@Injectable()
export class ActivosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly referencia: ReferenciaService,
    private readonly almacenamiento: StorageService,
    private readonly alcance: AlcanceService,
  ) {}

  protected esEscritor(sesion: SesionUsuario): boolean {
    return ROLES_ESCRITORES_DE_ACTIVOS.includes(sesion.rol);
  }

  async listar(
    sesion: SesionUsuario,
    filtro: FiltroActivosDto,
  ): Promise<PaginaActivosDto> {
    const parametros: unknown[] = [];
    const param = (valor: unknown) => {
      parametros.push(valor);
      return `$${parametros.length}`;
    };
    const donde: string[] = [];
    if (!(filtro.incluirBajas && this.esEscritor(sesion))) donde.push('a.activo');
    if (filtro.q) {
      donde.push(`a.titulo ILIKE ${param(`%${escaparLike(filtro.q)}%`)}`);
    }
    if (filtro.idConocimiento !== undefined) {
      donde.push(
        `EXISTS (SELECT 1 FROM activo_conocimiento_conocimiento v
                 WHERE v.id_activo = a.id_activo AND v.id_conocimiento = ${param(filtro.idConocimiento)})`,
      );
    }
    if (filtro.idUnidad !== undefined) {
      donde.push(`a.id_unidad = ${param(filtro.idUnidad)}`);
    }
    if (filtro.idTipoDocumento !== undefined) {
      donde.push(`a.id_tipo_documento = ${param(filtro.idTipoDocumento)}`);
    }
    if (filtro.vencido === true) donde.push('a.fecha_vigencia < CURRENT_DATE');
    if (filtro.vencido === false) {
      donde.push('(a.fecha_vigencia IS NULL OR a.fecha_vigencia >= CURRENT_DATE)');
    }
    const clausula = donde.length ? `WHERE ${donde.join(' AND ')}` : '';

    const [{ total }] = await this.dataSource.query(
      `SELECT count(*)::int AS total FROM activo_conocimiento a ${clausula}`,
      parametros,
    );
    const filas: FilaActivo[] = await this.dataSource.query(
      `${SQL_SELECT_ACTIVO} ${clausula}
       ORDER BY a.titulo ASC, a.id_activo ASC
       LIMIT ${param(filtro.tamanio)} OFFSET ${param((filtro.pagina - 1) * filtro.tamanio)}`,
      parametros,
    );
    return { items: filas.map(aActivoDto), total };
  }

  async obtener(sesion: SesionUsuario, id: number): Promise<ActivoDto> {
    return aActivoDto(await this.exigirVisible(sesion, id));
  }

  async descargar(sesion: SesionUsuario, id: number): Promise<DescargaActivo> {
    const fila = await this.exigirVisible(sesion, id);
    if (fila.origen === 'enlace') {
      throw new ConflictException(
        'El activo es un enlace: no tiene archivo para descargar',
      );
    }
    try {
      const flujo = await this.almacenamiento.obtener(fila.ubicacion);
      return {
        flujo,
        nombre: fila.nombreOriginal ?? 'activo',
        tipoMime: fila.tipoMime ?? 'application/octet-stream',
        tamanio: fila.tamanio ?? 0,
      };
    } catch (error) {
      if ((error as { name?: string }).name === 'NoSuchKey') {
        throw new NotFoundException('El archivo no está en el almacenamiento');
      }
      throw error;
    }
  }

  /** Para el resto de los roles, una baja es como si no existiera. */
  protected async exigirVisible(
    sesion: SesionUsuario,
    id: number,
  ): Promise<FilaActivo> {
    const fila = await this.buscar(id);
    if (!fila || (!fila.activo && !this.esEscritor(sesion))) {
      throw new NotFoundException('El activo no existe');
    }
    return fila;
  }

  protected async buscar(id: number): Promise<FilaActivo | undefined> {
    const filas: FilaActivo[] = await this.dataSource.query(
      `${SQL_SELECT_ACTIVO} WHERE a.id_activo = $1`,
      [id],
    );
    return filas[0];
  }
}
```

Nota: `referencia` queda sin usar hasta la Tarea 5; `oxlint` no marca parámetros de constructor con `private readonly`. En el test, `descargar` de una baja por el analista sin objeto en el almacén cae en `NoSuchKey` → 404, que es lo que el último test espera.

- [ ] **Step 6: Verificar**

Run: `cd backend && npx vitest run --config vitest.integracion.config.ts src/modules/conocimiento/activos.lectura.int.spec.ts && npx vitest run src/modules/conocimiento/dto && npm run lint`
Expected: PASS. Si `diasParaVencer` llega como cadena, convertir en `aActivoDto` con `Number(...)` cuidando `null`.

- [ ] **Step 7: Commit**

```bash
git add backend/src
git commit -m "Agregar los DTOs de activos y la lectura: listado, detalle y descarga"
```

---

## Tarea 5: Escritura de activos (alta, edición, reemplazo, baja y reactivación)

**Files:**
- Modify: `backend/src/modules/conocimiento/activos.service.ts`
- Test: `backend/src/modules/conocimiento/activos.escritura.int.spec.ts`

**Interfaces:**
- Consumes: todo lo de las Tareas 1 a 4; `StorageService.subir(clave, contenido, tipoMime)` y `eliminar(clave)`.
- Produces: `interface ArchivoSubido { originalname: string; buffer: Buffer }`; en `ActivosService`: `crear(sesion, dto: CrearActivoDto, archivo?: ArchivoSubido): Promise<ActivoDto>`, `actualizar(sesion, id, dto: ActualizarActivoDto): Promise<ActivoDto>`, `reemplazarArchivo(sesion, id, archivo: ArchivoSubido): Promise<ActivoDto>`, `darDeBaja(sesion, id): Promise<ActivoDto>`, `reactivar(sesion, id): Promise<ActivoDto>`.

- [ ] **Step 1: Escribir el test de integración que falla**

`backend/src/modules/conocimiento/activos.escritura.int.spec.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  crearEntornoActivos,
  pdf,
  type EntornoActivos,
} from '../../testing/entorno-activos.js';
import { hashSha256 } from './archivo.js';
import type { CrearActivoDto } from './dto/activos.dto.js';

describe('Activos: escritura (PostgreSQL real)', () => {
  let e: EntornoActivos;

  const dto = (parcial: Partial<CrearActivoDto> = {}): CrearActivoDto => ({
    titulo: 'Manual de SQL',
    idTipoDocumento: e.ids.tipoDocumento,
    idUnidad: e.ids.catedraA,
    idsConocimiento: [e.ids.conocimientoA],
    ...parcial,
  });
  const filas = () =>
    e.sql<{ id: number }[]>(`SELECT id_activo AS id FROM activo_conocimiento`);

  beforeAll(async () => {
    e = await crearEntornoActivos();
  });
  afterAll(async () => {
    await e.destruir();
  });
  afterEach(async () => {
    await e.sql('DELETE FROM activo_conocimiento_conocimiento');
    await e.sql('DELETE FROM activo_conocimiento');
    e.almacen.objetos.clear();
    e.almacen.falloSubida = false;
  });

  describe('alta', () => {
    it('sube el archivo y guarda metadatos, hash y vínculos', async () => {
      const archivo = pdf('contenido uno', 'Año nuevo.pdf');
      const creado = await e.servicio.crear(e.sesiones.analista, dto(), archivo);

      expect(creado).toMatchObject({
        titulo: 'Manual de SQL',
        origen: 'archivo',
        nombreOriginal: 'Año nuevo.pdf',
        tipoMime: 'application/pdf',
        tamanio: archivo.buffer.length,
        enlace: null,
        activo: true,
        idsConocimiento: [e.ids.conocimientoA],
      });
      const [fila] = await e.sql<{ ubicacion: string; hash: string }[]>(
        `SELECT ubicacion, hash FROM activo_conocimiento WHERE id_activo = $1`,
        [creado.id],
      );
      expect(fila.hash).toBe(hashSha256(archivo.buffer));
      expect(fila.ubicacion).toMatch(
        new RegExp(`^activos/${creado.id}/[0-9a-f-]{36}-Ano_nuevo\\.pdf$`),
      );
      expect(e.almacen.objetos.get(fila.ubicacion)?.tipoMime).toBe('application/pdf');
    });

    it('registra un enlace sin tocar el almacén ni el hash', async () => {
      const creado = await e.servicio.crear(
        e.sesiones.analista,
        dto({ enlace: 'https://wiki.example/sql', fechaVigencia: '2030-01-01' }),
      );
      expect(creado).toMatchObject({
        origen: 'enlace',
        enlace: 'https://wiki.example/sql',
        tipoMime: null,
        fechaVigencia: '2030-01-01',
      });
      expect(e.almacen.objetos.size).toBe(0);
    });

    it('exige un archivo o un enlace, pero no ambos', async () => {
      await expect(e.servicio.crear(e.sesiones.analista, dto())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        e.servicio.crear(
          e.sesiones.analista,
          dto({ enlace: 'https://x.example' }),
          pdf('x'),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza con 415 una extensión engañosa y no deja objeto ni fila', async () => {
      const ejecutable = { originalname: 'manual.pdf', buffer: Buffer.from('MZ\x90 programa') };
      await expect(
        e.servicio.crear(e.sesiones.analista, dto(), ejecutable),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
      expect(await filas()).toHaveLength(0);
      expect(e.almacen.objetos.size).toBe(0);
    });

    it('rechaza con 400 conocimientos inexistentes o dados de baja y una unidad inexistente', async () => {
      await expect(
        e.servicio.crear(e.sesiones.analista, dto({ idsConocimiento: [999999] }), pdf('a')),
      ).rejects.toBeInstanceOf(BadRequestException);
      await e.sql(`UPDATE conocimiento SET activo = false WHERE id_conocimiento = $1`, [
        e.ids.conocimientoB,
      ]);
      await expect(
        e.servicio.crear(
          e.sesiones.analista,
          dto({ idsConocimiento: [e.ids.conocimientoB] }),
          pdf('a'),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await e.sql(`UPDATE conocimiento SET activo = true WHERE id_conocimiento = $1`, [
        e.ids.conocimientoB,
      ]);
      await expect(
        e.servicio.crear(e.sesiones.analista, dto({ idUnidad: 999999 }), pdf('a')),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(e.almacen.objetos.size).toBe(0);
    });

    it('rechaza con 409 el mismo archivo y nombra al existente', async () => {
      await e.servicio.crear(e.sesiones.analista, dto({ titulo: 'Original' }), pdf('igual'));
      const intento = e.servicio.crear(
        e.sesiones.analista,
        dto({ titulo: 'Copia' }),
        pdf('igual', 'otro-nombre.pdf'),
      );
      await expect(intento).rejects.toBeInstanceOf(ConflictException);
      await expect(intento).rejects.toThrow(/Original/);
      expect(e.almacen.objetos.size).toBe(1);
    });

    it('con la misma subida simultánea queda un solo activo y ningún objeto huérfano', async () => {
      const resultados = await Promise.allSettled([
        e.servicio.crear(e.sesiones.analista, dto({ titulo: 'Uno' }), pdf('carrera')),
        e.servicio.crear(e.sesiones.analista, dto({ titulo: 'Dos' }), pdf('carrera')),
      ]);
      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rechazo = resultados.find((r) => r.status === 'rejected');
      expect((rechazo as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
      expect(await filas()).toHaveLength(1);
      expect(e.almacen.objetos.size).toBe(1);
    });

    it('si falla la subida no escribe nada en la base', async () => {
      e.almacen.falloSubida = true;
      await expect(
        e.servicio.crear(e.sesiones.analista, dto(), pdf('a')),
      ).rejects.toThrow(/RustFS/);
      expect(await filas()).toHaveLength(0);
    });
  });

  describe('permisos', () => {
    it('el jefe de cátedra escribe en su unidad y no en otra', async () => {
      await expect(
        e.servicio.crear(e.sesiones.jefeA, dto({ idUnidad: e.ids.catedraA }), pdf('a')),
      ).resolves.toBeDefined();
      await expect(
        e.servicio.crear(e.sesiones.jefeA, dto({ idUnidad: e.ids.catedraB }), pdf('b')),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('el jefe no puede mover un activo a una unidad fuera de su alcance ni tocar uno ajeno', async () => {
      const propio = await e.servicio.crear(e.sesiones.jefeA, dto(), pdf('a'));
      await expect(
        e.servicio.actualizar(e.sesiones.jefeA, propio.id, { idUnidad: e.ids.catedraB }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      const ajeno = await e.servicio.crear(
        e.sesiones.analista,
        dto({ idUnidad: e.ids.catedraB }),
        pdf('b'),
      );
      await expect(
        e.servicio.actualizar(e.sesiones.jefeA, ajeno.id, { titulo: 'Robado' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        e.servicio.darDeBaja(e.sesiones.jefeA, ajeno.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        e.servicio.reemplazarArchivo(e.sesiones.jefeA, ajeno.id, pdf('c')),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('el docente no escribe', async () => {
      await expect(
        e.servicio.crear(e.sesiones.docente, dto(), pdf('a')),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('edición', () => {
    it('cambia metadatos y vínculos sin tocar el archivo', async () => {
      const creado = await e.servicio.crear(e.sesiones.analista, dto(), pdf('a'));
      const antes = await e.sql<{ ubicacion: string }[]>(
        `SELECT ubicacion FROM activo_conocimiento WHERE id_activo = $1`,
        [creado.id],
      );
      const editado = await e.servicio.actualizar(e.sesiones.analista, creado.id, {
        titulo: 'Título nuevo',
        idUnidad: e.ids.catedraB,
        fechaVigencia: '2031-05-05',
        idsConocimiento: [e.ids.conocimientoB, e.ids.conocimientoA],
      });
      expect(editado).toMatchObject({
        titulo: 'Título nuevo',
        idUnidad: e.ids.catedraB,
        fechaVigencia: '2031-05-05',
      });
      expect(editado.idsConocimiento).toHaveLength(2);
      const despues = await e.sql<{ ubicacion: string }[]>(
        `SELECT ubicacion FROM activo_conocimiento WHERE id_activo = $1`,
        [creado.id],
      );
      expect(despues[0].ubicacion).toBe(antes[0].ubicacion);
      const sinFecha = await e.servicio.actualizar(e.sesiones.analista, creado.id, {
        fechaVigencia: null,
      });
      expect(sinFecha.fechaVigencia).toBeNull();
    });

    it('edita la URL de un enlace pero no la de un archivo, y exige algún vínculo', async () => {
      const enlace = await e.servicio.crear(
        e.sesiones.analista,
        dto({ enlace: 'https://a.example' }),
      );
      const nuevo = await e.servicio.actualizar(e.sesiones.analista, enlace.id, {
        enlace: 'https://b.example',
      });
      expect(nuevo.enlace).toBe('https://b.example');
      const archivo = await e.servicio.crear(e.sesiones.analista, dto(), pdf('a'));
      await expect(
        e.servicio.actualizar(e.sesiones.analista, archivo.id, { enlace: 'https://c.example' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        e.servicio.actualizar(e.sesiones.analista, archivo.id, { idsConocimiento: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('responde 404 si no existe y 409 si está dado de baja', async () => {
      await expect(
        e.servicio.actualizar(e.sesiones.analista, 999999, { titulo: 'xx' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      const creado = await e.servicio.crear(e.sesiones.analista, dto(), pdf('a'));
      await e.servicio.darDeBaja(e.sesiones.analista, creado.id);
      await expect(
        e.servicio.actualizar(e.sesiones.analista, creado.id, { titulo: 'xx' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('reemplazo del archivo', () => {
    it('guarda el nuevo, actualiza hash y metadatos y borra el objeto anterior', async () => {
      const creado = await e.servicio.crear(e.sesiones.analista, dto(), pdf('viejo'));
      const [{ ubicacion: anterior }] = await e.sql<{ ubicacion: string }[]>(
        `SELECT ubicacion FROM activo_conocimiento WHERE id_activo = $1`,
        [creado.id],
      );
      const nuevo = pdf('nuevo y más largo', 'v2.pdf');
      const actualizado = await e.servicio.reemplazarArchivo(
        e.sesiones.analista,
        creado.id,
        nuevo,
      );
      expect(actualizado).toMatchObject({
        nombreOriginal: 'v2.pdf',
        tamanio: nuevo.buffer.length,
      });
      const [fila] = await e.sql<{ ubicacion: string; hash: string }[]>(
        `SELECT ubicacion, hash FROM activo_conocimiento WHERE id_activo = $1`,
        [creado.id],
      );
      expect(fila.hash).toBe(hashSha256(nuevo.buffer));
      expect(e.almacen.objetos.has(anterior)).toBe(false);
      expect(e.almacen.objetos.has(fila.ubicacion)).toBe(true);
      expect(e.almacen.objetos.size).toBe(1);
    });

    it('rechaza con 409 un archivo idéntico al actual o igual al de otro activo', async () => {
      const a = await e.servicio.crear(e.sesiones.analista, dto({ titulo: 'A' }), pdf('uno'));
      await e.servicio.crear(e.sesiones.analista, dto({ titulo: 'B' }), pdf('dos'));
      await expect(
        e.servicio.reemplazarArchivo(e.sesiones.analista, a.id, pdf('uno')),
      ).rejects.toThrow(/idéntico/);
      await expect(
        e.servicio.reemplazarArchivo(e.sesiones.analista, a.id, pdf('dos')),
      ).rejects.toThrow(/«B»/);
      expect(e.almacen.objetos.size).toBe(2);
    });

    it('rechaza una extensión engañosa, un enlace y una baja', async () => {
      const a = await e.servicio.crear(e.sesiones.analista, dto(), pdf('uno'));
      await expect(
        e.servicio.reemplazarArchivo(e.sesiones.analista, a.id, {
          originalname: 'x.pdf',
          buffer: Buffer.from('MZ'),
        }),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
      const enlace = await e.servicio.crear(
        e.sesiones.analista,
        dto({ enlace: 'https://a.example' }),
      );
      await expect(
        e.servicio.reemplazarArchivo(e.sesiones.analista, enlace.id, pdf('x')),
      ).rejects.toBeInstanceOf(BadRequestException);
      await e.servicio.darDeBaja(e.sesiones.analista, a.id);
      await expect(
        e.servicio.reemplazarArchivo(e.sesiones.analista, a.id, pdf('y')),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('si el almacén falla a mitad del reemplazo, el activo conserva su archivo', async () => {
      const creado = await e.servicio.crear(e.sesiones.analista, dto(), pdf('viejo'));
      const [antes] = await e.sql<{ ubicacion: string; hash: string }[]>(
        `SELECT ubicacion, hash FROM activo_conocimiento WHERE id_activo = $1`,
        [creado.id],
      );
      e.almacen.falloSubida = true;
      await expect(
        e.servicio.reemplazarArchivo(e.sesiones.analista, creado.id, pdf('nuevo')),
      ).rejects.toThrow(/RustFS/);
      const [despues] = await e.sql<{ ubicacion: string; hash: string }[]>(
        `SELECT ubicacion, hash FROM activo_conocimiento WHERE id_activo = $1`,
        [creado.id],
      );
      expect(despues).toEqual(antes);
      expect(e.almacen.objetos.has(antes.ubicacion)).toBe(true);
    });
  });

  describe('baja y reactivación', () => {
    it('la baja conserva el objeto y libera el hash', async () => {
      const a = await e.servicio.crear(e.sesiones.analista, dto({ titulo: 'A' }), pdf('uno'));
      const baja = await e.servicio.darDeBaja(e.sesiones.analista, a.id);
      expect(baja.activo).toBe(false);
      expect(e.almacen.objetos.size).toBe(1);
      await expect(
        e.servicio.crear(e.sesiones.analista, dto({ titulo: 'A bis' }), pdf('uno')),
      ).resolves.toBeDefined();
    });

    it('reactivar vuelve a comprobar el hash', async () => {
      const a = await e.servicio.crear(e.sesiones.analista, dto({ titulo: 'A' }), pdf('uno'));
      await e.servicio.darDeBaja(e.sesiones.analista, a.id);
      await e.servicio.crear(e.sesiones.analista, dto({ titulo: 'B' }), pdf('uno'));
      await expect(
        e.servicio.reactivar(e.sesiones.analista, a.id),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('reactiva si el hash está libre y rechaza dar de baja una baja o reactivar un activo', async () => {
      const a = await e.servicio.crear(e.sesiones.analista, dto(), pdf('uno'));
      await expect(
        e.servicio.reactivar(e.sesiones.analista, a.id),
      ).rejects.toBeInstanceOf(ConflictException);
      await e.servicio.darDeBaja(e.sesiones.analista, a.id);
      await expect(
        e.servicio.darDeBaja(e.sesiones.analista, a.id),
      ).rejects.toBeInstanceOf(ConflictException);
      const vuelto = await e.servicio.reactivar(e.sesiones.analista, a.id);
      expect(vuelto.activo).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `cd backend && npx vitest run --config vitest.integracion.config.ts src/modules/conocimiento/activos.escritura.int.spec.ts`
Expected: FAIL (`e.servicio.crear is not a function`).

- [ ] **Step 3: Implementar la escritura**

En `activos.service.ts`: ampliar los imports y agregar los métodos. Imports a sumar o reemplazar:

```ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { DataSource, QueryFailedError, type EntityManager } from 'typeorm';
import {
  ROLES_ESCRITORES_DE_ACTIVOS,
  ROLES_ESCRITORES_GLOBALES_DE_ACTIVOS,
} from '../../common/roles.js';
import {
  claveObjeto,
  decodificarNombre,
  detectarTipo,
  hashSha256,
  limpiarNombre,
} from './archivo.js';
import { DOMINIO_TIPO_DOCUMENTO } from './conocimiento.constantes.js';
import type {
  ActualizarActivoDto,
  ActivoDto,
  CrearActivoDto,
  FiltroActivosDto,
  PaginaActivosDto,
} from './dto/activos.dto.js';
```

Agregar antes de la clase:

```ts
/** Lo que Multer deja en `req.file` (en memoria) y que el servicio necesita. */
export interface ArchivoSubido {
  originalname: string;
  buffer: Buffer;
}

interface ArchivoPreparado {
  nombre: string;
  tipoMime: string;
  tamanio: number;
  hash: string;
}

const INDICE_HASH = 'UQ_activo_hash_activo';
const TIPOS_PERMITIDOS_MENSAJE =
  'PDF, DOCX, XLSX, PPTX, ODT, TXT, PNG y JPG';
```

Agregar `private readonly logger = new Logger(ActivosService.name);` como primer miembro de la clase, y estos métodos (después de `descargar`, antes de `exigirVisible`):

```ts
  async crear(
    sesion: SesionUsuario,
    dto: CrearActivoDto,
    archivo?: ArchivoSubido,
  ): Promise<ActivoDto> {
    await this.exigirEscritura(sesion, dto.idUnidad);
    if (archivo && dto.enlace) {
      throw new BadRequestException('Un activo es un archivo o un enlace, no ambos');
    }
    if (!archivo && !dto.enlace) {
      throw new BadRequestException('Subí un archivo o indicá un enlace');
    }
    await this.validarTipoDocumento(dto.idTipoDocumento);
    await this.validarUnidad(dto.idUnidad);
    const ids = await this.validarConocimientos(dto.idsConocimiento);
    const preparado = archivo ? this.prepararArchivo(archivo) : null;
    if (preparado) await this.exigirSinDuplicado(preparado.hash);

    // Se reserva el id para armar la clave antes de insertar.
    const [{ id }]: { id: number }[] = await this.dataSource.query(
      `SELECT nextval(pg_get_serial_sequence('activo_conocimiento', 'id_activo'))::int AS id`,
    );
    const clave =
      preparado && archivo ? claveObjeto(id, preparado.nombre) : null;
    if (clave && preparado && archivo) {
      await this.almacenamiento.subir(clave, archivo.buffer, preparado.tipoMime);
    }
    try {
      await this.enTransaccion(async (manager) => {
        await manager.query(
          `INSERT INTO activo_conocimiento
             (id_activo, titulo, id_tipo_documento, id_unidad, origen, ubicacion,
              nombre_original, tipo_mime, tamanio, hash, fecha_vigencia)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            id,
            dto.titulo,
            dto.idTipoDocumento,
            dto.idUnidad,
            preparado ? 'archivo' : 'enlace',
            clave ?? dto.enlace,
            preparado?.nombre ?? null,
            preparado?.tipoMime ?? null,
            preparado?.tamanio ?? null,
            preparado?.hash ?? null,
            dto.fechaVigencia ?? null,
          ],
        );
        await this.guardarVinculos(manager, id, ids);
      });
    } catch (error) {
      if (clave) await this.borrarObjeto(clave);
      throw error;
    }
    return this.obtener(sesion, id);
  }

  async actualizar(
    sesion: SesionUsuario,
    id: number,
    dto: ActualizarActivoDto,
  ): Promise<ActivoDto> {
    const actual = await this.exigirExistente(id);
    await this.exigirEscritura(sesion, actual.idUnidad);
    if (!actual.activo) throw this.estaDeBaja();
    if (dto.idUnidad !== undefined && dto.idUnidad !== actual.idUnidad) {
      await this.exigirEscritura(sesion, dto.idUnidad);
      await this.validarUnidad(dto.idUnidad);
    }
    if (dto.enlace !== undefined && actual.origen !== 'enlace') {
      throw new BadRequestException(
        'Solo los activos de tipo enlace tienen una URL editable',
      );
    }
    if (
      dto.idTipoDocumento !== undefined &&
      dto.idTipoDocumento !== actual.idTipoDocumento
    ) {
      await this.validarTipoDocumento(dto.idTipoDocumento);
    }
    const ids =
      dto.idsConocimiento !== undefined
        ? await this.validarConocimientos(dto.idsConocimiento)
        : null;

    await this.enTransaccion(async (manager) => {
      const fila = await this.bloquearActivo(manager, id);
      if (!fila.activo) throw this.estaDeBaja();
      await manager.query(
        `UPDATE activo_conocimiento
         SET titulo = $2, id_tipo_documento = $3, id_unidad = $4,
             fecha_vigencia = $5, ubicacion = $6, actualizado_en = now()
         WHERE id_activo = $1`,
        [
          id,
          dto.titulo ?? actual.titulo,
          dto.idTipoDocumento ?? actual.idTipoDocumento,
          dto.idUnidad ?? actual.idUnidad,
          dto.fechaVigencia === undefined ? actual.fechaVigencia : dto.fechaVigencia,
          dto.enlace ?? actual.ubicacion,
        ],
      );
      if (ids) await this.guardarVinculos(manager, id, ids);
    });
    return this.obtener(sesion, id);
  }

  async reemplazarArchivo(
    sesion: SesionUsuario,
    id: number,
    archivo: ArchivoSubido,
  ): Promise<ActivoDto> {
    const actual = await this.exigirExistente(id);
    await this.exigirEscritura(sesion, actual.idUnidad);
    if (!actual.activo) throw this.estaDeBaja();
    if (actual.origen !== 'archivo') {
      throw new BadRequestException(
        'Un activo de tipo enlace no tiene archivo para reemplazar',
      );
    }
    const preparado = this.prepararArchivo(archivo);
    if (preparado.hash === actual.hash) {
      throw new ConflictException('El archivo es idéntico al actual');
    }
    await this.exigirSinDuplicado(preparado.hash, id);

    const clave = claveObjeto(id, preparado.nombre);
    await this.almacenamiento.subir(clave, archivo.buffer, preparado.tipoMime);
    let anterior: string;
    try {
      anterior = await this.enTransaccion(async (manager) => {
        const fila = await this.bloquearActivo(manager, id);
        await manager.query(
          `UPDATE activo_conocimiento
           SET ubicacion = $2, nombre_original = $3, tipo_mime = $4,
               tamanio = $5, hash = $6, actualizado_en = now()
           WHERE id_activo = $1`,
          [id, clave, preparado.nombre, preparado.tipoMime, preparado.tamanio, preparado.hash],
        );
        return fila.ubicacion;
      });
    } catch (error) {
      await this.borrarObjeto(clave);
      throw error;
    }
    await this.borrarObjeto(anterior);
    return this.obtener(sesion, id);
  }

  async darDeBaja(sesion: SesionUsuario, id: number): Promise<ActivoDto> {
    const actual = await this.exigirExistente(id);
    await this.exigirEscritura(sesion, actual.idUnidad);
    await this.enTransaccion(async (manager) => {
      const fila = await this.bloquearActivo(manager, id);
      if (!fila.activo) throw this.estaDeBaja();
      await manager.query(
        `UPDATE activo_conocimiento SET activo = false, actualizado_en = now() WHERE id_activo = $1`,
        [id],
      );
    });
    return this.obtener(sesion, id);
  }

  async reactivar(sesion: SesionUsuario, id: number): Promise<ActivoDto> {
    const actual = await this.exigirExistente(id);
    await this.exigirEscritura(sesion, actual.idUnidad);
    if (actual.activo) {
      throw new ConflictException('El activo ya está activo');
    }
    if (actual.hash) await this.exigirSinDuplicado(actual.hash, id);
    await this.enTransaccion(async (manager) => {
      await this.bloquearActivo(manager, id);
      await manager.query(
        `UPDATE activo_conocimiento SET activo = true, actualizado_en = now() WHERE id_activo = $1`,
        [id],
      );
    });
    return this.obtener(sesion, id);
  }
```

Y estos métodos privados (después de `buscar`):

```ts
  private estaDeBaja(): ConflictException {
    return new ConflictException(
      'El activo está dado de baja: reactivalo antes de modificarlo',
    );
  }

  private async exigirExistente(id: number): Promise<FilaActivo> {
    const fila = await this.buscar(id);
    if (!fila) throw new NotFoundException('El activo no existe');
    return fila;
  }

  /** Analista y administrador escriben en cualquier unidad; las jefaturas, solo en su alcance. */
  private async exigirEscritura(
    sesion: SesionUsuario,
    idUnidad: number,
  ): Promise<void> {
    if (ROLES_ESCRITORES_GLOBALES_DE_ACTIVOS.includes(sesion.rol)) return;
    if (this.esEscritor(sesion)) {
      await this.alcance.exigirUnidad(sesion, idUnidad);
      return;
    }
    throw new ForbiddenException(
      'No tenés permiso para modificar activos de conocimiento',
    );
  }

  private async validarTipoDocumento(id: number): Promise<void> {
    await this.referencia.validarActivo(DOMINIO_TIPO_DOCUMENTO, id);
  }

  private async validarUnidad(id: number): Promise<void> {
    const filas: { activo: boolean }[] = await this.dataSource.query(
      `SELECT activo FROM unidad_organizativa WHERE id_unidad = $1`,
      [id],
    );
    if (!filas[0]) throw new BadRequestException(`La unidad ${id} no existe`);
    if (!filas[0].activo) {
      throw new BadRequestException('La unidad está dada de baja');
    }
  }

  /** Devuelve los ids sin repetir; todos deben existir y estar activos. */
  private async validarConocimientos(ids: number[]): Promise<number[]> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) {
      throw new BadRequestException('Vinculá al menos un conocimiento');
    }
    const activos: { id: number }[] = await this.dataSource.query(
      `SELECT id_conocimiento AS id FROM conocimiento WHERE id_conocimiento = ANY($1) AND activo`,
      [unicos],
    );
    if (activos.length !== unicos.length) {
      const validos = new Set(activos.map((f) => Number(f.id)));
      const faltan = unicos.filter((i) => !validos.has(i));
      throw new BadRequestException(
        `Conocimientos inexistentes o dados de baja: ${faltan.join(', ')}`,
      );
    }
    return unicos;
  }

  private prepararArchivo(archivo: ArchivoSubido): ArchivoPreparado {
    const nombre = limpiarNombre(decodificarNombre(archivo.originalname));
    const tipo = detectarTipo(archivo.buffer, nombre);
    if (!tipo) {
      throw new UnsupportedMediaTypeException(
        `El archivo no es de un tipo permitido (${TIPOS_PERMITIDOS_MENSAJE}) o su contenido no coincide con su extensión`,
      );
    }
    return {
      nombre,
      tipoMime: tipo.mime,
      tamanio: archivo.buffer.length,
      hash: hashSha256(archivo.buffer),
    };
  }

  /** Mensaje que nombra al activo existente; la base lo respalda con el índice único parcial. */
  private async exigirSinDuplicado(
    hash: string,
    excluirId = 0,
  ): Promise<void> {
    const filas: { id: number; titulo: string }[] = await this.dataSource.query(
      `SELECT id_activo AS id, titulo FROM activo_conocimiento
       WHERE hash = $1 AND activo AND id_activo <> $2 LIMIT 1`,
      [hash, excluirId],
    );
    if (filas[0]) {
      throw new ConflictException(
        `Ya existe el activo «${filas[0].titulo}» (id ${filas[0].id}) con el mismo archivo`,
      );
    }
  }

  private async guardarVinculos(
    manager: EntityManager,
    id: number,
    ids: number[],
  ): Promise<void> {
    await manager.query(
      `DELETE FROM activo_conocimiento_conocimiento WHERE id_activo = $1`,
      [id],
    );
    await manager.query(
      `INSERT INTO activo_conocimiento_conocimiento (id_activo, id_conocimiento)
       SELECT $1, unnest($2::int[])`,
      [id, ids],
    );
  }

  /** Toma la fila para escribir; las operaciones concurrentes sobre un mismo activo quedan en fila. */
  private async bloquearActivo(
    manager: EntityManager,
    id: number,
  ): Promise<FilaActivo> {
    const filas: FilaActivo[] = await manager.query(
      `${SQL_SELECT_ACTIVO} WHERE a.id_activo = $1 FOR UPDATE OF a`,
      [id],
    );
    if (!filas[0]) throw new NotFoundException('El activo no existe');
    return filas[0];
  }

  private async enTransaccion<T>(
    trabajo: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.dataSource.transaction(trabajo);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string; constraint?: string }).code ===
          '23505' &&
        (error.driverError as { constraint?: string }).constraint === INDICE_HASH
      ) {
        throw new ConflictException(
          'Otro activo ya tiene exactamente ese archivo',
        );
      }
      throw error;
    }
  }

  /** Borra sin propagar: un objeto que sobra no debe ocultar el resultado de la operación. */
  private async borrarObjeto(clave: string): Promise<void> {
    try {
      await this.almacenamiento.eliminar(clave);
    } catch (error) {
      this.logger.warn(
        `No se pudo borrar el objeto "${clave}": ${(error as Error).message}`,
      );
    }
  }
```

Dos puntos a respetar: `bloquearActivo` usa `FOR UPDATE OF a` para bloquear solo la fila de `activo_conocimiento` (la subconsulta de vínculos queda fuera del bloqueo). `actual.ubicacion` en `actualizar` conserva la clave del objeto en los activos de tipo archivo, porque `dto.enlace` se rechaza para ellos y solo cambia en los enlaces.

- [ ] **Step 4: Verificar**

Run: `cd backend && npx vitest run --config vitest.integracion.config.ts src/modules/conocimiento/activos && npm test && npm run lint`
Expected: PASS en lectura y escritura. Si el test de la carrera deja dos filas o un objeto huérfano, revisar que el `catch` de `crear` borre la clave y que `enTransaccion` traduzca el 23505 por nombre de índice.

- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "Agregar el alta, la edición, el reemplazo, la baja y la reactivación de activos"
```

---

## Tarea 6: Controller, Multer y módulo

**Files:**
- Create: `backend/src/modules/conocimiento/activos.controller.ts`
- Modify: `backend/src/modules/conocimiento/conocimiento.module.ts`

**Interfaces:**
- Consumes: `ActivosService` (Tareas 4 y 5), `ROLES_ESCRITORES_DE_ACTIVOS`, `TODOS_LOS_ROLES`, `disposicionAdjunto`.
- Produces: rutas `GET /api/activos`, `GET /api/activos/:id`, `GET /api/activos/:id/descarga`, `POST /api/activos` (multipart), `PATCH /api/activos/:id`, `PUT /api/activos/:id/archivo` (multipart), `POST /api/activos/:id/baja`, `POST /api/activos/:id/reactivar`.

- [ ] **Step 1: Escribir el controller**

`backend/src/modules/conocimiento/activos.controller.ts`:

```ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import {
  ROLES_ESCRITORES_DE_ACTIVOS,
  TODOS_LOS_ROLES,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { ActivosService } from './activos.service.js';
import { disposicionAdjunto } from './archivo.js';
import {
  ActivoDto,
  ActualizarActivoDto,
  CrearActivoDto,
  FiltroActivosDto,
  PaginaActivosDto,
} from './dto/activos.dto.js';

/** Activos de conocimiento (RF11): documentación vinculada a los conocimientos y a una unidad. */
@ApiTags('conocimiento')
@Controller('activos')
export class ActivosController {
  constructor(private readonly activos: ActivosService) {}

  @Get()
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: PaginaActivosDto })
  listar(
    @UsuarioActual() sesion: SesionUsuario,
    @Query() filtro: FiltroActivosDto,
  ): Promise<PaginaActivosDto> {
    return this.activos.listar(sesion, filtro);
  }

  @Get(':id')
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: ActivoDto })
  @ApiNotFoundResponse({ description: 'El activo no existe o está dado de baja' })
  obtener(
    @UsuarioActual() sesion: SesionUsuario,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActivoDto> {
    return this.activos.obtener(sesion, id);
  }

  @Get(':id/descarga')
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({
    description: 'Contenido del archivo',
    content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiNotFoundResponse({ description: 'El activo o su archivo no existen' })
  @ApiConflictResponse({ description: 'El activo es un enlace' })
  async descargar(
    @UsuarioActual() sesion: SesionUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<StreamableFile> {
    const descarga = await this.activos.descargar(sesion, id);
    respuesta.set('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(descarga.flujo, {
      type: descarga.tipoMime,
      disposition: disposicionAdjunto(descarga.nombre),
      length: descarga.tamanio,
    });
  }

  @Post()
  @Roles(...ROLES_ESCRITORES_DE_ACTIVOS)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiCreatedResponse({ type: ActivoDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos, o ni archivo ni enlace' })
  @ApiForbiddenResponse({ description: 'La unidad está fuera de tu alcance' })
  @ApiConflictResponse({ description: 'Ya hay un activo con el mismo archivo' })
  @ApiPayloadTooLargeResponse({ description: 'El archivo supera el tamaño máximo' })
  @ApiUnsupportedMediaTypeResponse({ description: 'Tipo de archivo no permitido' })
  crear(
    @UsuarioActual() sesion: SesionUsuario,
    @Body() dto: CrearActivoDto,
    @UploadedFile() archivo?: Express.Multer.File,
  ): Promise<ActivoDto> {
    return this.activos.crear(sesion, dto, archivo);
  }

  @Patch(':id')
  @Roles(...ROLES_ESCRITORES_DE_ACTIVOS)
  @ApiOkResponse({ type: ActivoDto })
  @ApiNotFoundResponse({ description: 'El activo no existe' })
  @ApiForbiddenResponse({ description: 'La unidad está fuera de tu alcance' })
  @ApiConflictResponse({ description: 'El activo está dado de baja' })
  actualizar(
    @UsuarioActual() sesion: SesionUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarActivoDto,
  ): Promise<ActivoDto> {
    return this.activos.actualizar(sesion, id, dto);
  }

  @Put(':id/archivo')
  @Roles(...ROLES_ESCRITORES_DE_ACTIVOS)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo'],
      properties: { archivo: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiOkResponse({ type: ActivoDto })
  @ApiBadRequestResponse({ description: 'Falta el archivo, o el activo es un enlace' })
  @ApiConflictResponse({ description: 'Archivo idéntico o repetido, o activo dado de baja' })
  @ApiPayloadTooLargeResponse({ description: 'El archivo supera el tamaño máximo' })
  @ApiUnsupportedMediaTypeResponse({ description: 'Tipo de archivo no permitido' })
  reemplazarArchivo(
    @UsuarioActual() sesion: SesionUsuario,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() archivo?: Express.Multer.File,
  ): Promise<ActivoDto> {
    if (!archivo) {
      throw new BadRequestException('Falta el campo "archivo"');
    }
    return this.activos.reemplazarArchivo(sesion, id, archivo);
  }

  @Post(':id/baja')
  @HttpCode(200)
  @Roles(...ROLES_ESCRITORES_DE_ACTIVOS)
  @ApiOkResponse({ type: ActivoDto })
  @ApiConflictResponse({ description: 'El activo ya está dado de baja' })
  baja(
    @UsuarioActual() sesion: SesionUsuario,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActivoDto> {
    return this.activos.darDeBaja(sesion, id);
  }

  @Post(':id/reactivar')
  @HttpCode(200)
  @Roles(...ROLES_ESCRITORES_DE_ACTIVOS)
  @ApiOkResponse({ type: ActivoDto })
  @ApiConflictResponse({ description: 'Ya está activo, o su archivo está repetido' })
  reactivar(
    @UsuarioActual() sesion: SesionUsuario,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActivoDto> {
    return this.activos.reactivar(sesion, id);
  }
}
```

Si `ApiPayloadTooLargeResponse` o `ApiUnsupportedMediaTypeResponse` no existieran en la versión instalada de `@nestjs/swagger`, reemplazarlos por `@ApiResponse({ status: 413, description })` y `@ApiResponse({ status: 415, description })`.

- [ ] **Step 2: Registrar en el módulo**

En `conocimiento.module.ts`: importar `ConfigService` de `@nestjs/config`, `MulterModule` de `@nestjs/platform-express`, `type Env` de `../../infra/config/env.validation.js`, `ActivosController` y `ActivosService`. Agregar a `imports`:

```ts
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        // Memoria por defecto: el servicio necesita los bytes para validar y calcular el hash.
        limits: {
          files: 1,
          fileSize:
            config.get('ACTIVOS_TAMANIO_MAX_MB', { infer: true }) * 1024 * 1024,
        },
      }),
    }),
```

Agregar `ActivosController` a `controllers` y `ActivosService` a `providers`. Actualizar el comentario del módulo: `(RF08–RF11)`. `StorageModule` es global, así que `StorageService` ya se inyecta.

- [ ] **Step 3: Verificar**

Run: `cd backend && npm run build && npm test && npm run lint`
Expected: PASS. `cobertura-roles.spec.ts` incluye el controller nuevo y exige `@Roles` en cada ruta.

Con el stack arriba (`docker compose up -d --build`):

Run: `curl -s localhost:3000/api/docs-json | python3 -c "import json,sys; d=json.load(sys.stdin); print(sorted(p for p in d['paths'] if p.startswith('/api/activos'))); print(d['paths']['/api/activos']['post']['requestBody']['content'].keys())"`
Expected: las cuatro rutas (`/api/activos`, `/api/activos/{id}`, `/api/activos/{id}/archivo`, `/api/activos/{id}/baja`, `/api/activos/{id}/descarga`, `/api/activos/{id}/reactivar`) y `dict_keys(['multipart/form-data'])`.

Comprobar a mano el límite de tamaño y el tipo con una sesión de analista (en el navegador: iniciar sesión y usar Swagger en `/api/docs`, "Try it out"): subir un `.pdf` real, uno renombrado (`.exe` → `.pdf`) y otro mayor que `ACTIVOS_TAMANIO_MAX_MB`. Esperado: 201, 415 y 413.

- [ ] **Step 4: Commit**

```bash
git add backend/src
git commit -m "Agregar el controller de activos con subida multipart"
```

---

## Tarea 7: Tipos de la API, hooks y componentes base del frontend

**Files:**
- Modify: `frontend/src/api/esquema.d.ts` (regenerado, no a mano)
- Create: `frontend/src/features/conocimiento/activos.ts`
- Create: `frontend/src/features/conocimiento/hooks/useActivos.ts`
- Create: `frontend/src/features/conocimiento/components/ChipVigencia.tsx`

**Interfaces:**
- Consumes: esquemas `ActivoDto`, `PaginaActivosDto`, `ActualizarActivoDto` (generados); `mensajeError` de `features/admin/hooks/useGuardarValor`.
- Produces:
  - `activos.ts`: `ROLES_ESCRITORES_ACTIVOS: string[]`, `puedeEscribirActivos(rol?: string): boolean`, `EXTENSIONES_ACTIVO: string` (para `accept`), `formatearTamanio(bytes: number): string`.
  - `useActivos.ts`: `type Activo`, `interface FiltroActivos`, `useActivos(filtro)`, `interface CuerpoActivo`, `useCrearActivo()` (mutación `{ cuerpo: CuerpoActivo; archivo?: File }`), `useActualizarActivo()` (`{ id; cuerpo }`), `useReemplazarArchivo()` (`{ id; archivo }`), `useCambiarEstadoActivo()` (`{ id; accion: 'baja' | 'reactivar' }`), `descargarActivo(activo: Activo): Promise<void>`.
  - `ChipVigencia({ activo })`.

- [ ] **Step 1: Regenerar los tipos**

Con el backend corriendo: `cd frontend && npm run api:tipos`
Verificar: `grep -n "ActivoDto\|PaginaActivosDto" src/api/esquema.d.ts | head` muestra los esquemas nuevos.

- [ ] **Step 2: `activos.ts`**

```ts
/** Roles que ven los botones de escritura de activos. El backend decide el alcance por unidad. */
export const ROLES_ESCRITORES_ACTIVOS = [
  'analista_puestos',
  'administrador',
  'jefatura_departamento',
  'jefe_catedra',
];

export const puedeEscribirActivos = (rol?: string): boolean =>
  !!rol && ROLES_ESCRITORES_ACTIVOS.includes(rol);

/** Extensiones que ofrece el selector de archivo; el servidor valida el contenido. */
export const EXTENSIONES_ACTIVO =
  '.pdf,.docx,.xlsx,.pptx,.odt,.txt,.png,.jpg,.jpeg';

export function formatearTamanio(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

- [ ] **Step 3: `hooks/useActivos.ts`**

```ts
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';

export type Activo = Esquemas['ActivoDto'];
type ActualizarActivo = Esquemas['ActualizarActivoDto'];

export interface FiltroActivos {
  q?: string;
  idConocimiento?: number;
  idUnidad?: number;
  idTipoDocumento?: number;
  vencido?: boolean;
  incluirBajas?: boolean;
  pagina?: number;
  tamanio?: number;
}

/** Datos del alta; el archivo viaja aparte (multipart). */
export interface CuerpoActivo {
  titulo: string;
  idTipoDocumento: number;
  idUnidad: number;
  idsConocimiento: number[];
  fechaVigencia?: string;
  enlace?: string;
}

const invalidarActivos = (cliente: QueryClient) =>
  cliente.invalidateQueries({ queryKey: ['activos'] });

export function useActivos(filtro: FiltroActivos = {}) {
  return useQuery({
    queryKey: ['activos', 'lista', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/activos', {
        params: { query: filtro },
      });
      if (error || !data) throw new Error('No se pudieron cargar los activos');
      return data;
    },
  });
}

/** `openapi-fetch` no arma multipart cómodamente: la subida usa `fetch` y deja que el navegador ponga el boundary. */
async function enviarMultipart(
  url: string,
  metodo: 'POST' | 'PUT',
  cuerpo: FormData,
): Promise<Activo> {
  const respuesta = await fetch(url, {
    method: metodo,
    body: cuerpo,
    credentials: 'include',
  });
  const datos: unknown = await respuesta.json().catch(() => null);
  if (!respuesta.ok) throw new Error(mensajeError(datos));
  return datos as Activo;
}

function aFormData(cuerpo: CuerpoActivo, archivo?: File): FormData {
  const formulario = new FormData();
  formulario.append('titulo', cuerpo.titulo);
  formulario.append('idTipoDocumento', String(cuerpo.idTipoDocumento));
  formulario.append('idUnidad', String(cuerpo.idUnidad));
  for (const id of cuerpo.idsConocimiento) {
    formulario.append('idsConocimiento', String(id));
  }
  if (cuerpo.fechaVigencia) {
    formulario.append('fechaVigencia', cuerpo.fechaVigencia);
  }
  if (cuerpo.enlace) formulario.append('enlace', cuerpo.enlace);
  if (archivo) formulario.append('archivo', archivo);
  return formulario;
}

export function useCrearActivo() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ cuerpo, archivo }: { cuerpo: CuerpoActivo; archivo?: File }) =>
      enviarMultipart('/api/activos', 'POST', aFormData(cuerpo, archivo)),
    onSuccess: () => invalidarActivos(cliente),
  });
}

export function useActualizarActivo() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      cuerpo,
    }: {
      id: number;
      cuerpo: ActualizarActivo;
    }) => {
      const { data, error } = await api.PATCH('/api/activos/{id}', {
        params: { path: { id } },
        body: cuerpo,
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarActivos(cliente),
  });
}

export function useReemplazarArchivo() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archivo }: { id: number; archivo: File }) => {
      const formulario = new FormData();
      formulario.append('archivo', archivo);
      return enviarMultipart(`/api/activos/${id}/archivo`, 'PUT', formulario);
    },
    onSuccess: () => invalidarActivos(cliente),
  });
}

export function useCambiarEstadoActivo() {
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
        accion === 'baja' ? '/api/activos/{id}/baja' : '/api/activos/{id}/reactivar';
      const { data, error } = await api.POST(ruta, {
        params: { path: { id } },
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => invalidarActivos(cliente),
  });
}

/** La descarga lleva la cookie de sesión, así que se pide por `fetch` y se guarda desde un `Blob`. */
export async function descargarActivo(activo: Activo): Promise<void> {
  const respuesta = await fetch(`/api/activos/${activo.id}/descarga`, {
    credentials: 'include',
  });
  if (!respuesta.ok) {
    const datos: unknown = await respuesta.json().catch(() => null);
    throw new Error(mensajeError(datos));
  }
  const url = URL.createObjectURL(await respuesta.blob());
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = activo.nombreOriginal ?? 'activo';
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

- [ ] **Step 4: `components/ChipVigencia.tsx`**

```tsx
import { Chip } from '@mui/material';
import type { Activo } from '../hooks/useActivos';

/** Desde cuántos días antes del vencimiento se avisa. */
const DIAS_DE_AVISO = 30;

/** La etiqueta lleva texto, no solo color. Vigente o sin fecha: no muestra nada. */
export function ChipVigencia({
  activo,
}: {
  activo: Pick<Activo, 'fechaVigencia' | 'vencido' | 'diasParaVencer'>;
}) {
  if (!activo.fechaVigencia) return null;
  if (activo.vencido) {
    return <Chip size="small" color="error" label="Vencido" />;
  }
  const dias = activo.diasParaVencer;
  if (dias === null || dias > DIAS_DE_AVISO) return null;
  const etiqueta =
    dias === 0
      ? 'Vence hoy'
      : dias === 1
        ? 'Vence en 1 día'
        : `Vence en ${dias} días`;
  return <Chip size="small" color="warning" label={etiqueta} />;
}
```

- [ ] **Step 5: Verificar y commit**

Run: `cd frontend && npm run lint && npm run format && npm run build`
Expected: PASS (los tipos de `api.POST(ruta, ...)` con una unión de rutas pueden quejarse: si `tsc` lo rechaza, separar en dos llamadas `api.POST('/api/activos/{id}/baja', ...)` y `api.POST('/api/activos/{id}/reactivar', ...)` dentro de un `if`).

```bash
git add frontend/src
git commit -m "Agregar los hooks de activos y el chip de vigencia en el frontend"
```

---

## Tarea 8: Pantalla de activos, formularios y diálogo en el catálogo

**Files:**
- Create: `frontend/src/features/conocimiento/components/FormularioActivo.tsx`
- Create: `frontend/src/features/conocimiento/components/ReemplazarArchivoDialog.tsx`
- Create: `frontend/src/features/conocimiento/components/BajaActivoDialog.tsx`
- Create: `frontend/src/features/conocimiento/components/ActivosDeConocimientoDialog.tsx`
- Create: `frontend/src/features/conocimiento/pages/ActivosPage.tsx`
- Modify: `frontend/src/features/conocimiento/pages/ConocimientoPage.tsx`
- Modify: `frontend/src/router.tsx`, `frontend/src/auth/permisos.ts`

**Interfaces:**
- Consumes: Tarea 7 completa; `useConocimientos`, `useUnidades`, `useValoresReferencia`, `useSesion`.
- Produces: `FormularioActivo({ activo?, conocimientoInicial?, onCerrar })`, `ReemplazarArchivoDialog({ activo, onCerrar })`, `BajaActivoDialog({ activo, onCerrar })`, `ActivosDeConocimientoDialog({ conocimiento, onCerrar })`, `ActivosPage`; ruta `/conocimiento/activos`.

- [ ] **Step 1: `FormularioActivo.tsx`**

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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { useUnidades } from '../../estructura/hooks/useUnidades';
import { EXTENSIONES_ACTIVO, formatearTamanio } from '../activos';
import {
  useActualizarActivo,
  useCrearActivo,
  type Activo,
} from '../hooks/useActivos';
import { useConocimientos, type Conocimiento } from '../hooks/useConocimientos';

interface Props {
  /** Sin activo, el formulario da de alta uno nuevo. */
  activo?: Activo;
  /** Conocimiento que se precarga al agregar desde el catálogo. */
  conocimientoInicial?: Conocimiento;
  onCerrar: () => void;
}

const esUrlWeb = (valor: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(valor).protocol);
  } catch {
    return false;
  }
};

const esquema = z
  .object({
    titulo: z
      .string()
      .trim()
      .min(2, 'Ingresá al menos 2 caracteres')
      .max(200, 'Máximo 200 caracteres'),
    idTipoDocumento: z.string().min(1, 'Elegí un tipo de documento'),
    idUnidad: z.string().min(1, 'Elegí la unidad que lo mantiene'),
    idsConocimiento: z
      .array(z.number())
      .min(1, 'Elegí al menos un conocimiento'),
    fechaVigencia: z.string(),
    origen: z.enum(['archivo', 'enlace']),
    enlace: z.string().trim(),
  })
  .superRefine((datos, ctx) => {
    if (datos.origen === 'enlace' && !esUrlWeb(datos.enlace)) {
      ctx.addIssue({
        code: 'custom',
        path: ['enlace'],
        message: 'Ingresá una URL que empiece con http:// o https://',
      });
    }
  });
type Datos = z.infer<typeof esquema>;

/** Se monta solo mientras está abierto, por lo que parte siempre de cero. El archivo de un activo existente se cambia con «Reemplazar archivo». */
export function FormularioActivo({
  activo,
  conocimientoInicial,
  onCerrar,
}: Props) {
  const { data: tipos } = useValoresReferencia('tipo-documento', false);
  const { data: unidades } = useUnidades();
  const { data: conocimientos } = useConocimientos({ activo: true });
  const crear = useCrearActivo();
  const actualizar = useActualizarActivo();
  const [archivo, setArchivo] = useState<File>();
  const [error, setError] = useState<string>();

  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      titulo: activo?.titulo ?? '',
      idTipoDocumento: activo ? String(activo.idTipoDocumento) : '',
      idUnidad: activo ? String(activo.idUnidad) : '',
      idsConocimiento: activo
        ? activo.idsConocimiento
        : conocimientoInicial
          ? [conocimientoInicial.id]
          : [],
      fechaVigencia: activo?.fechaVigencia ?? '',
      origen: activo?.origen ?? 'archivo',
      enlace: activo?.enlace ?? '',
    },
  });
  const origen = watch('origen');

  const guardar = handleSubmit(async (datos) => {
    setError(undefined);
    if (!activo && datos.origen === 'archivo' && !archivo) {
      setError('Elegí el archivo que querés subir');
      return;
    }
    try {
      if (activo) {
        await actualizar.mutateAsync({
          id: activo.id,
          cuerpo: {
            titulo: datos.titulo,
            idTipoDocumento: Number(datos.idTipoDocumento),
            idUnidad: Number(datos.idUnidad),
            idsConocimiento: datos.idsConocimiento,
            fechaVigencia: datos.fechaVigencia || null,
            ...(activo.origen === 'enlace' ? { enlace: datos.enlace } : {}),
          },
        });
      } else {
        await crear.mutateAsync({
          cuerpo: {
            titulo: datos.titulo,
            idTipoDocumento: Number(datos.idTipoDocumento),
            idUnidad: Number(datos.idUnidad),
            idsConocimiento: datos.idsConocimiento,
            fechaVigencia: datos.fechaVigencia || undefined,
            enlace: datos.origen === 'enlace' ? datos.enlace : undefined,
          },
          archivo: datos.origen === 'archivo' ? archivo : undefined,
        });
      }
      onCerrar();
    } catch (e) {
      // Un duplicado vuelve como 409 con el título del activo existente; 413 y 415 explican el límite y los tipos.
      setError((e as Error).message);
    }
  });

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>{activo ? 'Editar activo' : 'Nuevo activo'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Título"
              {...register('titulo')}
              error={!!errors.titulo}
              helperText={errors.titulo?.message}
            />
            <TextField
              select
              label="Tipo de documento"
              defaultValue={activo ? String(activo.idTipoDocumento) : ''}
              {...register('idTipoDocumento')}
              error={!!errors.idTipoDocumento}
              helperText={errors.idTipoDocumento?.message}
            >
              {(tipos ?? []).map((t) => (
                <MenuItem key={t.id} value={String(t.id)}>
                  {t.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Unidad que lo mantiene"
              defaultValue={activo ? String(activo.idUnidad) : ''}
              {...register('idUnidad')}
              error={!!errors.idUnidad}
              helperText={errors.idUnidad?.message}
            >
              {(unidades ?? []).map((u) => (
                <MenuItem key={u.id} value={String(u.id)}>
                  {u.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <Controller
              name="idsConocimiento"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  multiple
                  options={conocimientos ?? []}
                  getOptionLabel={(c) => c.denominacion}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  value={(conocimientos ?? []).filter((c) =>
                    field.value.includes(c.id),
                  )}
                  onChange={(_, elegidos) =>
                    field.onChange(elegidos.map((c) => c.id))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Conocimientos que documenta"
                      error={!!errors.idsConocimiento}
                      helperText={errors.idsConocimiento?.message}
                    />
                  )}
                />
              )}
            />
            <TextField
              type="date"
              label="Vigente hasta (opcional)"
              slotProps={{ inputLabel: { shrink: true } }}
              {...register('fechaVigencia')}
            />
            {!activo && (
              <ToggleButtonGroup
                exclusive
                size="small"
                value={origen}
                onChange={(_, valor: 'archivo' | 'enlace' | null) =>
                  valor && setValue('origen', valor)
                }
                aria-label="Origen del activo"
              >
                <ToggleButton value="archivo">Subir archivo</ToggleButton>
                <ToggleButton value="enlace">Enlace externo</ToggleButton>
              </ToggleButtonGroup>
            )}
            {origen === 'archivo' && !activo && (
              <Stack spacing={1}>
                <Button component="label" variant="outlined">
                  {archivo ? 'Cambiar archivo' : 'Elegir archivo'}
                  <input
                    hidden
                    type="file"
                    accept={EXTENSIONES_ACTIVO}
                    onChange={(e) => setArchivo(e.target.files?.[0])}
                  />
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {archivo
                    ? `${archivo.name} (${formatearTamanio(archivo.size)})`
                    : 'PDF, DOCX, XLSX, PPTX, ODT, TXT, PNG o JPG'}
                </Typography>
              </Stack>
            )}
            {origen === 'enlace' && (
              <TextField
                label="Enlace"
                placeholder="https://"
                {...register('enlace')}
                error={!!errors.enlace}
                helperText={errors.enlace?.message}
              />
            )}
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

El campo del enlace solo se muestra en alta de enlaces y en edición de un activo `enlace` (`origen` viene del activo); en edición de un activo `archivo`, `origen` es `'archivo'` y no se muestra ningún campo de archivo (se usa «Reemplazar archivo»). Un servidor que rechaza (409, 413, 415) deja el formulario con lo ingresado y permite reintentar.

- [ ] **Step 2: `ReemplazarArchivoDialog.tsx` y `BajaActivoDialog.tsx`**

```tsx
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { EXTENSIONES_ACTIVO, formatearTamanio } from '../activos';
import { useReemplazarArchivo, type Activo } from '../hooks/useActivos';

interface Props {
  activo: Activo;
  onCerrar: () => void;
}

export function ReemplazarArchivoDialog({ activo, onCerrar }: Props) {
  const reemplazar = useReemplazarArchivo();
  const [archivo, setArchivo] = useState<File>();
  const [error, setError] = useState<string>();

  const enviar = async () => {
    if (!archivo) return;
    setError(undefined);
    try {
      await reemplazar.mutateAsync({ id: activo.id, archivo });
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="xs">
      <DialogTitle>Reemplazar archivo</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2">
            Actual: {activo.nombreOriginal}
            {activo.tamanio !== null && ` (${formatearTamanio(activo.tamanio)})`}.
            El archivo anterior se borra y no se guarda su historial.
          </Typography>
          <Button component="label" variant="outlined">
            {archivo ? 'Cambiar archivo' : 'Elegir archivo'}
            <input
              hidden
              type="file"
              accept={EXTENSIONES_ACTIVO}
              onChange={(e) => setArchivo(e.target.files?.[0])}
            />
          </Button>
          {archivo && (
            <Typography variant="body2" color="text.secondary">
              {archivo.name} ({formatearTamanio(archivo.size)})
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={!archivo || reemplazar.isPending}
          onClick={enviar}
        >
          Reemplazar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

```tsx
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useCambiarEstadoActivo, type Activo } from '../hooks/useActivos';

interface Props {
  activo: Activo;
  onCerrar: () => void;
}

export function BajaActivoDialog({ activo, onCerrar }: Props) {
  const cambiar = useCambiarEstadoActivo();
  const [error, setError] = useState<string>();

  const confirmar = async () => {
    setError(undefined);
    try {
      await cambiar.mutateAsync({ id: activo.id, accion: 'baja' });
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="xs">
      <DialogTitle>Dar de baja el activo</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error">{error}</Alert>}
        <Typography>
          «{activo.titulo}» deja de aparecer para el resto de los usuarios. El
          archivo se conserva y podés reactivarlo cuando quieras.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button
          color="error"
          variant="contained"
          disabled={cambiar.isPending}
          onClick={confirmar}
        >
          Dar de baja
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 3: `ActivosPage.tsx`**

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
  TablePagination,
  TableRow,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { useSesion } from '../../../auth/useSesion';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { useUnidades } from '../../estructura/hooks/useUnidades';
import { puedeEscribirActivos } from '../activos';
import { BajaActivoDialog } from '../components/BajaActivoDialog';
import { ChipVigencia } from '../components/ChipVigencia';
import { FormularioActivo } from '../components/FormularioActivo';
import { ReemplazarArchivoDialog } from '../components/ReemplazarArchivoDialog';
import {
  descargarActivo,
  useActivos,
  useCambiarEstadoActivo,
  type Activo,
} from '../hooks/useActivos';
import { useConocimientos } from '../hooks/useConocimientos';

const TAMANIO_PAGINA = 20;

/** Documentación que respalda los conocimientos (RF11). Todos consultan y descargan; escriben los roles de `puedeEscribirActivos`. */
export function ActivosPage() {
  const { data: sesion } = useSesion();
  const puedeEscribir = puedeEscribirActivos(sesion?.rol);
  const { data: tipos } = useValoresReferencia('tipo-documento', true);
  const { data: unidades } = useUnidades(true);
  const { data: conocimientos } = useConocimientos({});
  const cambiarEstado = useCambiarEstadoActivo();

  const [texto, setTexto] = useState('');
  const [idTipo, setIdTipo] = useState('');
  const [idUnidad, setIdUnidad] = useState('');
  const [idConocimiento, setIdConocimiento] = useState('');
  const [soloVencidos, setSoloVencidos] = useState(false);
  const [verBajas, setVerBajas] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [formulario, setFormulario] = useState<{ activo?: Activo } | null>(null);
  const [reemplazando, setReemplazando] = useState<Activo>();
  const [dandoDeBaja, setDandoDeBaja] = useState<Activo>();
  const [error, setError] = useState<string>();

  const { data, isLoading, isError } = useActivos({
    q: texto.trim() || undefined,
    idTipoDocumento: idTipo ? Number(idTipo) : undefined,
    idUnidad: idUnidad ? Number(idUnidad) : undefined,
    idConocimiento: idConocimiento ? Number(idConocimiento) : undefined,
    vencido: soloVencidos ? true : undefined,
    incluirBajas: puedeEscribir && verBajas ? true : undefined,
    pagina: pagina + 1,
    tamanio: TAMANIO_PAGINA,
  });

  const nombre = (
    lista: { id: number; denominacion: string }[] | undefined,
    id: number,
  ) => lista?.find((v) => v.id === id)?.denominacion ?? String(id);

  const intentar = async (accion: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await accion();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const filtrar = (cambiar: () => void) => {
    cambiar();
    setPagina(0);
  };

  return (
    <PaginaEnConstruccion
      titulo="Activos de conocimiento"
      descripcion="Manuales, instructivos y procedimientos que documentan los conocimientos de la facultad."
    >
      <Stack spacing={2}>
        {error && (
          <Alert severity="error" onClose={() => setError(undefined)}>
            {error}
          </Alert>
        )}
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <TextField
            size="small"
            label="Buscar por título"
            value={texto}
            onChange={(e) => filtrar(() => setTexto(e.target.value))}
          />
          <TextField
            select
            size="small"
            label="Tipo"
            value={idTipo}
            onChange={(e) => filtrar(() => setIdTipo(e.target.value))}
            sx={{ minWidth: 160 }}
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
            label="Unidad"
            value={idUnidad}
            onChange={(e) => filtrar(() => setIdUnidad(e.target.value))}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Todas</MenuItem>
            {(unidades ?? []).map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>
                {u.denominacion}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Conocimiento"
            value={idConocimiento}
            onChange={(e) => filtrar(() => setIdConocimiento(e.target.value))}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {(conocimientos ?? []).map((c) => (
              <MenuItem key={c.id} value={String(c.id)}>
                {c.denominacion}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Switch
                checked={soloVencidos}
                onChange={(e) => filtrar(() => setSoloVencidos(e.target.checked))}
              />
            }
            label="Solo vencidos"
          />
          {puedeEscribir && (
            <FormControlLabel
              control={
                <Switch
                  checked={verBajas}
                  onChange={(e) => filtrar(() => setVerBajas(e.target.checked))}
                />
              }
              label="Ver dados de baja"
            />
          )}
          <span style={{ flexGrow: 1 }} />
          {puedeEscribir && (
            <Button variant="contained" onClick={() => setFormulario({})}>
              Nuevo activo
            </Button>
          )}
        </Stack>

        {isLoading && <CircularProgress aria-label="Cargando" />}
        {isError && <Alert severity="error">No se pudieron cargar los activos.</Alert>}
        {data && data.items.length === 0 && (
          <Alert severity="info">No hay activos para mostrar.</Alert>
        )}
        {data && data.items.length > 0 && (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Título</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Unidad</TableCell>
                  <TableCell>Conocimientos</TableCell>
                  <TableCell>Vigencia</TableCell>
                  <TableCell>Origen</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      {a.titulo}{' '}
                      {!a.activo && <Chip size="small" label="De baja" />}
                    </TableCell>
                    <TableCell>{nombre(tipos, a.idTipoDocumento)}</TableCell>
                    <TableCell>{nombre(unidades, a.idUnidad)}</TableCell>
                    <TableCell>
                      {a.idsConocimiento
                        .map((id) => nombre(conocimientos, id))
                        .join(', ')}
                    </TableCell>
                    <TableCell>
                      {a.fechaVigencia ?? '—'} <ChipVigencia activo={a} />
                    </TableCell>
                    <TableCell>
                      {a.origen === 'archivo' ? 'Archivo' : 'Enlace'}
                    </TableCell>
                    <TableCell align="right">
                      {a.origen === 'enlace' ? (
                        <Button
                          size="small"
                          component="a"
                          href={a.enlace ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Abrir
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          onClick={() => intentar(() => descargarActivo(a))}
                        >
                          Descargar
                        </Button>
                      )}
                      {puedeEscribir && (
                        <>
                          {a.activo && (
                            <Button
                              size="small"
                              onClick={() => setFormulario({ activo: a })}
                            >
                              Editar
                            </Button>
                          )}
                          {a.activo && a.origen === 'archivo' && (
                            <Button size="small" onClick={() => setReemplazando(a)}>
                              Reemplazar archivo
                            </Button>
                          )}
                          {a.activo ? (
                            <Button size="small" onClick={() => setDandoDeBaja(a)}>
                              Dar de baja
                            </Button>
                          ) : (
                            <Button
                              size="small"
                              onClick={() =>
                                intentar(() =>
                                  cambiarEstado.mutateAsync({
                                    id: a.id,
                                    accion: 'reactivar',
                                  }),
                                )
                              }
                            >
                              Reactivar
                            </Button>
                          )}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={data.total}
              page={pagina}
              rowsPerPage={TAMANIO_PAGINA}
              rowsPerPageOptions={[TAMANIO_PAGINA]}
              onPageChange={(_, p) => setPagina(p)}
              labelDisplayedRows={({ from, to, count }) =>
                `${from}–${to} de ${count}`
              }
            />
          </>
        )}
      </Stack>
      {formulario && (
        <FormularioActivo
          activo={formulario.activo}
          onCerrar={() => setFormulario(null)}
        />
      )}
      {reemplazando && (
        <ReemplazarArchivoDialog
          activo={reemplazando}
          onCerrar={() => setReemplazando(undefined)}
        />
      )}
      {dandoDeBaja && (
        <BajaActivoDialog
          activo={dandoDeBaja}
          onCerrar={() => setDandoDeBaja(undefined)}
        />
      )}
    </PaginaEnConstruccion>
  );
}
```

- [ ] **Step 4: `ActivosDeConocimientoDialog.tsx` y su botón en el catálogo**

```tsx
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Stack,
} from '@mui/material';
import { useState } from 'react';
import { useSesion } from '../../../auth/useSesion';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { puedeEscribirActivos } from '../activos';
import { descargarActivo, useActivos } from '../hooks/useActivos';
import type { Conocimiento } from '../hooks/useConocimientos';
import { ChipVigencia } from './ChipVigencia';
import { FormularioActivo } from './FormularioActivo';

interface Props {
  conocimiento: Conocimiento;
  onCerrar: () => void;
}

/** Documentación de un conocimiento, desde el catálogo. */
export function ActivosDeConocimientoDialog({ conocimiento, onCerrar }: Props) {
  const { data: sesion } = useSesion();
  const { data, isLoading, isError } = useActivos({
    idConocimiento: conocimiento.id,
    tamanio: 100,
  });
  const [agregando, setAgregando] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <DialogTitle>Documentación: {conocimiento.denominacion}</DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          {error && <Alert severity="error">{error}</Alert>}
          {isLoading && <CircularProgress aria-label="Cargando" />}
          {isError && (
            <Alert severity="error">No se pudieron cargar los activos.</Alert>
          )}
          {data && data.items.length === 0 && (
            <Alert severity="info">
              Este conocimiento todavía no tiene documentación.
            </Alert>
          )}
          <List dense>
            {(data?.items ?? []).map((a) => (
              <ListItem
                key={a.id}
                secondaryAction={
                  a.origen === 'enlace' ? (
                    <Button
                      size="small"
                      component="a"
                      href={a.enlace ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      onClick={async () => {
                        setError(undefined);
                        try {
                          await descargarActivo(a);
                        } catch (e) {
                          setError(mensajeError(e));
                        }
                      }}
                    >
                      Descargar
                    </Button>
                  )
                }
              >
                <ListItemText
                  primary={
                    <>
                      {a.titulo} <ChipVigencia activo={a} />
                    </>
                  }
                  secondary={a.origen === 'archivo' ? a.nombreOriginal : a.enlace}
                />
              </ListItem>
            ))}
          </List>
        </Stack>
      </DialogContent>
      <DialogActions>
        {puedeEscribirActivos(sesion?.rol) && (
          <Button onClick={() => setAgregando(true)}>Agregar activo</Button>
        )}
        <Button onClick={onCerrar}>Cerrar</Button>
      </DialogActions>
      {agregando && (
        <FormularioActivo
          conocimientoInicial={conocimiento}
          onCerrar={() => setAgregando(false)}
        />
      )}
    </Dialog>
  );
}
```

En `ConocimientoPage.tsx`: importar `ActivosDeConocimientoDialog`; agregar el estado `const [documentando, setDocumentando] = useState<Conocimiento>();` junto a los otros `useState`; agregar la columna visible para todos los roles, antes de la de acciones, en el encabezado `<TableCell>Documentación</TableCell>` (después de `Estado`) y en cada fila (después de la celda del estado):

```tsx
                  <TableCell>
                    <Button size="small" onClick={() => setDocumentando(c)}>
                      Documentación
                    </Button>
                  </TableCell>
```

y, antes del cierre de `</PaginaEnConstruccion>`:

```tsx
      {documentando && (
        <ActivosDeConocimientoDialog
          conocimiento={documentando}
          onCerrar={() => setDocumentando(undefined)}
        />
      )}
```

- [ ] **Step 5: Ruta y menú**

En `router.tsx`: `import { ActivosPage } from './features/conocimiento/pages/ActivosPage';` y, después de la ruta `conocimiento/pendientes`:

```tsx
      { path: 'conocimiento/activos', element: <ActivosPage /> },
```

En `auth/permisos.ts`, después de la sección `/conocimiento/pendientes`:

```ts
  { ruta: '/conocimiento/activos', nombre: 'Activos de conocimiento' },
```

(sin `roles`: la ve cualquier usuario autenticado).

- [ ] **Step 6: Verificar**

Run: `cd frontend && npm run lint && npm run format && npm run build`
Expected: PASS.

Pasada manual con el stack levantado (`docker compose up --build`), con un usuario de cada rol:
1. Como analista: «Activos de conocimiento» → «Nuevo activo» → subir un PDF real. Aparece en la tabla; «Descargar» baja el mismo archivo con su nombre (probar uno con tilde, `Año.pdf`).
2. Subir el mismo PDF con otro título → mensaje 409 con el título del existente; el formulario conserva lo escrito.
3. Subir un `.exe` renombrado a `.pdf` → mensaje de tipo no permitido (415). Subir un archivo mayor al límite → mensaje de tamaño (413).
4. Crear un enlace; «Abrir» abre la URL en otra pestaña. Cargar una fecha de ayer: chip «Vencido»; filtro «Solo vencidos» lo muestra.
5. «Reemplazar archivo» cambia nombre y tamaño; «Dar de baja» lo oculta; «Ver dados de baja» lo muestra con «Reactivar».
6. Como docente: lista y descarga, sin botones de escritura y sin ver bajas. Como jefe de cátedra: crear en su unidad funciona; en otra unidad, el mensaje de alcance.
7. En el catálogo: «Documentación» abre el diálogo con los activos del conocimiento; «Agregar activo» precarga el conocimiento.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "Agregar la pantalla de activos y el diálogo de documentación del catálogo"
```

---

## Tarea 9: Documentación y cierre

**Files:**
- Modify: `README.md`, `docs/requerimientos.md`
- Modify: `docs/superpowers/specs/2026-10-16-conocimiento-activos-design.md`, `docs/superpowers/plans/2026-10-16-conocimiento-activos.md`

- [ ] **Step 1: README**

En `README.md`, después de la sección «Catálogo de conocimientos» y antes de «Flujo de trabajo», agregar:

```markdown
### Activos de conocimiento

- **Qué son:** manuales, instructivos y procedimientos vinculados a uno o más conocimientos y a la unidad que los mantiene. Cada uno es un **archivo** (guardado en RustFS, bucket `activos-conocimiento`) o un **enlace** externo.
- **Archivos:** PDF, DOCX, XLSX, PPTX, ODT, TXT, PNG y JPG, hasta `ACTIVOS_TAMANIO_MAX_MB` (20 por defecto). El tipo se valida por el contenido y debe coincidir con la extensión. El servidor calcula el SHA-256: un archivo idéntico al de otro activo vigente se rechaza.
- **Clave del objeto:** `activos/{idActivo}/{uuid}-{nombre}`. La base guarda la clave en `ubicacion`; no hay URLs públicas, la descarga pasa por la API.
- **Vigencia:** `fecha_vigencia` es opcional e informativa. «Vencido» se calcula al consultar; no bloquea nada ni envía avisos.
- **Baja:** lógica. El objeto se conserva en RustFS y la baja libera el hash. Reemplazar un archivo borra el anterior, sin historial.
- **Quién escribe:** analista de puestos y administrador en cualquier unidad; jefe de cátedra y jefatura de departamento dentro de su alcance. Todos los usuarios consultan y descargan.
- **Si cargás datos por SQL:** respetá el CHECK (un `archivo` lleva `nombre_original`, `tipo_mime`, `tamanio` y `hash`; un `enlace`, ninguno) y subí el objeto con la clave que pongas en `ubicacion`.
```

- [ ] **Step 2: Requerimientos**

En `docs/requerimientos.md` §4, reemplazar la tabla «La decisión modifica la tabla `activo_conocimiento`» por una que describa el diseño final:

```markdown
La decisión modifica la tabla `activo_conocimiento` y agrega una tabla puente:

| Atributo | Cambio |
| --- | --- |
| ubicacion | Guarda la clave del objeto en el bucket, o la URL si el activo es un enlace |
| origen | Nuevo: `archivo` o `enlace` |
| nombre_original, tipo_mime, tamanio | Nuevos: nombre, formato y tamaño en bytes del archivo (nulos en un enlace) |
| hash | Nuevo: SHA-256 del contenido, para rechazar archivos duplicados (nulo en un enlace) |
| activo | Nuevo: baja lógica; el objeto se conserva en RustFS |
| id_tipo_documento | El tipo de documento pasa a una tabla de referencia (`tipo_documento`) |
| activo_conocimiento_conocimiento | Nueva tabla puente: un activo documenta uno o más conocimientos (reemplaza la FK `id_conocimiento`) |
```

En §7 (puntos abiertos), si la relación de activos con los conocimientos figura como abierta, quitarla de la tabla; si solo figura en el avance, dejar la nota «cerrado en `docs/superpowers/specs/2026-10-16-conocimiento-activos-design.md`».

- [ ] **Step 3: Verificación final**

Run: `cd backend && npm run lint && npm run format && npm test && npm run test:integracion`
Run: `cd frontend && npm run lint && npm run format && npm run build`
Expected: todo PASS. Si `format` modifica archivos, incluirlos en el commit.

Revisar la lista de requisitos de la spec contra el código (RF11, RF23, RNF01 a RNF04, RNF08) y el estado del árbol: `git status` limpio salvo lo que se va a commitear.

- [ ] **Step 4: Marcar como implementado y commit**

Cambiar la primera línea de la spec a `Estado: Implementada | Fecha: 2026-10-16 | Autor: IvanOchoa229` y la del plan a `Estado: Implementado | Fecha: 2026-10-16 | PR: —` (completar el PR cuando exista).

```bash
git add README.md docs backend/src frontend/src
git commit -m "Documentar los activos de conocimiento y marcar la spec y el plan como implementados"
```
