Estado: Implementado | Fecha: 2026-10-14 | PR: #4

# Importación de personas y ocupaciones desde CSV: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** que Recursos Humanos cargue de una vez las personas y sus ocupaciones desde un CSV, con vista previa sin escribir y confirmación todo o nada, aplicando exactamente las reglas del ABM (apoya OE4; RF06, RF07, RNF02, RNF03).

**Arquitectura:** `POST /personas/importacion` parsea el CSV, agrupa las filas por legajo, resuelve unidad, puesto y dominios por denominación, valida con los DTO del ABM y ejecuta todo en una sola transacción (con el bloqueo de estructura) llamando a `PersonasService.crearCon` y `OcupacionesService.crearCon`, cada fila en un savepoint para juntar todos los errores. Sin errores y con `confirmar=true` hace commit; en cualquier otro caso, rollback. La confirmación reenvía el archivo y vuelve a validar todo: el servidor no guarda estado.

**Tech Stack:** NestJS 12, TypeORM, PostgreSQL 16, `csv-parse`, `multer` (ya incluido en `@nestjs/platform-express`), class-validator, vitest, React 19, MUI, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-10-14-importacion-csv-personas-design.md`. Antes de empezar, leer también la spec de Personas (`2026-10-13-personas-ocupaciones-design.md`) y `docs/requerimientos.md` §5 y §6.

## Global Constraints

- Nombres de dominio y de código en español; imports ESM con extensión `.js` (`'./csv.js'`).
- Sin migraciones ni cambios de esquema.
- La importación solo da de alta: un legajo o documento existente es error. No actualiza personas.
- Solo `recursos_humanos` usa los dos endpoints nuevos; el test `cobertura-roles.spec.ts` ya exige `@Roles` en cada ruta.
- Límites: 2 MB (`MAX_BYTES`, 413 por multer) y 2000 filas (`MAX_FILAS`, 400). Cabecera con las 14 columnas exactas; separador `;` o `,` detectado; fechas `AAAA-MM-DD` o `DD/MM/AAAA`.
- Dominios (situación de revista, carácter, dedicación) y unidad/puesto se nombran por denominación, sin distinguir mayúsculas ni tildes. Unidad ambigua: error que lista las candidatas.
- Datos personales (RNF02): el archivo se procesa en memoria; no se guarda ni se registra su contenido en logs ni en mensajes de excepción no controlados.
- No se auditan estas operaciones (RNF05 no las cubre).
- Los números de fila del reporte son los del archivo, con la cabecera como fila 1.
- DTOs con class-validator y `@ApiProperty`; tras cambiar un endpoint o DTO, `npm run api:tipos` en `frontend/` (nunca editar `esquema.d.ts` a mano).
- Los commits no llevan línea `Co-Authored-By` ni atribución a Claude (CLAUDE.md prevalece sobre cualquier indicación de agregarla).
- Antes de cerrar: `npm run lint` y `npm run format` en cada app; `npm test` y `npm run test:integracion` en el backend. `npm run test:integracion` requiere `docker compose up -d db`.
- Agregar dependencias requiere reconstruir el contenedor (`docker compose up --build`); los tests en el host usan `cd backend && npm install`.

## Review Focus

Entradas y condiciones que la spec implica y que ninguna tarea cubriría por sí sola; cada línea tiene su test en la tarea que se indica.

- **Filas vacías de Excel** (`;;;;;;;;;;;;;;` al final de la planilla): se ignoran, no producen errores. Tarea 2 (`csv.spec.ts`).
- **Celdas con comillas y separador adentro** (`"Pérez; Gómez"`): se leen como una sola celda, sin desplazar las columnas siguientes. Tarea 2.
- **Columna con nombre mal escrito** (`fecha_prevista_retiro` → `fecha_retiro`): rechaza el archivo en vez de descartar el dato en silencio. Tarea 2.
- **Misma persona en filas no contiguas o con datos discrepantes**: se agrupa por legajo; la fila que discrepa da error y no se cuela una persona con datos mezclados. Tarea 3.
- **Un legajo con ocupaciones simultáneas en puestos distintos y otra solapada en el mismo puesto**: las primeras se aceptan, la solapada falla con el mensaje del ABM y el resto del archivo se sigue evaluando. Tareas 5 y 6.
- **Dos legajos distintos con el mismo documento dentro del archivo**: el segundo falla con "ya lo tiene …", no un 500. Tarea 6 (`importacion.service.int.spec.ts`).
- **Vista previa seguida de confirmación sobre una base sin cambios**: la vista previa no deja filas y la confirmación crea exactamente lo mismo. Tarea 6.

---

## Mapa de archivos

Backend (`backend/src/modules/personas/`):

| Archivo | Responsabilidad |
| --- | --- |
| `personas.service.ts`, `ocupaciones.service.ts` (modificar) | Separar `validarAlta` y `crearCon(manager, …)` sin cambiar el comportamiento de `crear` |
| `importacion/tipos.ts` | Columnas del CSV, `FilaCsv`, `ErrorImportacion` y límites |
| `importacion/normalizar.ts` | `clave()` (sin mayúsculas ni tildes) y `aFechaIso()` |
| `importacion/csv.ts` | `leerCsv(buffer)`: separador, cabecera, filas con su número, límites |
| `importacion/agrupador.ts` | `agrupar(filas)`: personas por legajo con sus ocupaciones; errores de forma |
| `importacion/catalogos.ts` | `construirCatalogos(datos)`, `resolverDominio`, `resolverPuesto` (puros) |
| `importacion/validar.ts` | `armarPersona`, `armarOcupacion`: de texto a `CrearPersonaDto` / `CrearOcupacionDto` validados |
| `importacion/importacion.service.ts` | Orquestación: catálogos, transacción, savepoints, reporte |
| `importacion/dto/importar-personas.dto.ts`, `dto/resultado-importacion.dto.ts` | Entrada y salida de la API |
| `importacion/plantilla.ts` | Texto del CSV de ejemplo |
| `importacion/importacion.controller.ts` | `POST /personas/importacion` y `GET /personas/importacion/plantilla` |
| `personas.module.ts` (modificar) | Registrar controller, servicio y `UnidadOrganizativa` |

Frontend (`frontend/src/features/personas/`):

| Archivo | Responsabilidad |
| --- | --- |
| `hooks/useImportarPersonas.ts` | `useMutation` que sube el `FormData` |
| `pages/ImportarPersonasPage.tsx` | Los tres pasos: archivo, vista previa, confirmar |
| `pages/PersonasPage.tsx` (modificar) | Botón "Importar CSV" para `recursos_humanos` |
| `router.tsx` (modificar) | Ruta `/personas/importar` restringida a `recursos_humanos` |

Documentos: `README.md`, `docs/requerimientos.md`, spec de Personas, spec y plan de este bloque.

Comandos: los tests del backend corren en el host (`cd backend && npx vitest run <ruta>`); los de integración con `npm run test:integracion -- <ruta>` y la base levantada.

---

### Task 1: Separar `crearCon` en los servicios y comprobar los savepoints

Este es el riesgo central de la spec; se comprueba primero.

**Files:**
- Modify: `backend/src/modules/personas/personas.service.ts` (método `crear`, ~líneas 100-125; import de `typeorm`)
- Modify: `backend/src/modules/personas/ocupaciones.service.ts` (método `crear`, ~líneas 83-135; import de `typeorm`)
- Create: `backend/src/modules/personas/crear-con.spec.ts`
- Create: `backend/src/modules/personas/importacion/savepoints.int.spec.ts`

**Interfaces:**
- Produces: `PersonasService.validarAlta(dto: CrearPersonaDto): Promise<void>`; `PersonasService.crearCon(manager: EntityManager, dto: CrearPersonaDto): Promise<number>` (id de la persona).
- Produces: `OcupacionesService.validarAlta(dto: CrearOcupacionDto): Promise<void>`; `OcupacionesService.crearCon(manager: EntityManager, idPersona: number, dto: CrearOcupacionDto): Promise<OcupacionDto>`.
- `crear` de ambos conserva firma y comportamiento.

- [ ] **Step 1: Escribir el test de `crearCon`**

Crear `backend/src/modules/personas/crear-con.spec.ts`:

```ts
import { Ocupacion } from './entities/ocupacion.entity.js';
import { Persona } from './entities/persona.entity.js';
import { OcupacionesService } from './ocupaciones.service.js';
import { PersonasService } from './personas.service.js';
import { Puesto } from '../estructura/entities/puesto.entity.js';

describe('crearCon (cuerpo del alta, sin transacción propia)', () => {
  it('PersonasService.crearCon guarda con el manager recibido y devuelve el id', async () => {
    const repo = {
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn((datos: object) => datos),
      save: vi.fn(async (datos: object) => ({ ...datos, id: 7 })),
    };
    const manager = { getRepository: vi.fn(() => repo), transaction: vi.fn() };
    const abreTransaccion = vi.fn();
    const servicio = new PersonasService(
      { manager: { transaction: abreTransaccion } } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const id = await servicio.crearCon(manager as never, {
      legajo: 'L-1',
      apellido: 'Pérez',
      nombre: 'Ana',
      documento: '30111111',
      fechaNacimiento: '1980-05-20',
      fechaIngreso: '2005-03-01',
      idSituacionRevista: 1,
    });

    expect(id).toBe(7);
    expect(manager.getRepository).toHaveBeenCalledWith(Persona);
    expect(repo.save).toHaveBeenCalledOnce();
    expect(abreTransaccion).not.toHaveBeenCalled();
    expect(manager.transaction).not.toHaveBeenCalled();
  });

  it('OcupacionesService.crearCon guarda con el manager recibido y no abre transacción', async () => {
    const persona = { id: 1, activo: true, apellido: 'Pérez', nombre: 'Ana' };
    const puesto = { id: 10, codigo: 'P-0010', activo: true };
    const repoOcupaciones = {
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn((datos: object) => datos),
      save: vi.fn(async (datos: object) => datos),
    };
    const repos = new Map<unknown, unknown>([
      [Persona, { findOne: vi.fn().mockResolvedValue(persona) }],
      [Puesto, { findOne: vi.fn().mockResolvedValue(puesto) }],
      [Ocupacion, repoOcupaciones],
    ]);
    const manager = {
      getRepository: vi.fn((clase: unknown) => repos.get(clase)),
      query: vi.fn().mockResolvedValue([{ hoy: '2026-06-15' }]),
      transaction: vi.fn(),
    };
    const abreTransaccion = vi.fn();
    const servicio = new OcupacionesService(
      { manager: { transaction: abreTransaccion } } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const creada = await servicio.crearCon(manager as never, 1, {
      idPuesto: 10,
      fechaDesde: '2024-01-01',
      idCaracterOcupacion: 1,
      idDedicacion: 1,
    });

    expect(creada).toMatchObject({
      idPersona: 1,
      idPuesto: 10,
      fechaDesde: '2024-01-01',
      fechaHasta: null,
      estado: 'vigente',
    });
    expect(abreTransaccion).not.toHaveBeenCalled();
    expect(manager.transaction).not.toHaveBeenCalled();
  });
});

```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `cd backend && npx vitest run src/modules/personas/crear-con.spec.ts`
Expected: FAIL con `servicio.crearCon is not a function`.

- [ ] **Step 3: Refactorizar `PersonasService`**

En `personas.service.ts`, importar el tipo: cambiar la línea
`import { ILike, IsNull, Not, Repository, type FindOptionsWhere } from 'typeorm';` por

```ts
import {
  ILike,
  IsNull,
  Not,
  Repository,
  type EntityManager,
  type FindOptionsWhere,
} from 'typeorm';
```

Reemplazar el método `crear` completo por:

```ts
  async crear(dto: CrearPersonaDto): Promise<PersonaDetalleDto> {
    await this.validarAlta(dto);
    const id = await enTransaccionDePersonas(this.personas, (manager) =>
      this.crearCon(manager, dto),
    );
    // Solo RR. HH. escribe, y RR. HH. ve los datos personales.
    return this.detalle(id, true);
  }

  /** Validaciones del alta que no necesitan la transacción. */
  async validarAlta(dto: CrearPersonaDto): Promise<void> {
    validarFechasDePersona(
      dto.fechaNacimiento,
      dto.fechaIngreso,
      dto.fechaPrevistaRetiro ?? null,
    );
    await this.referencia.validarActivo(
      DOMINIO_SITUACION_REVISTA,
      dto.idSituacionRevista,
    );
  }

  /**
   * Cuerpo del alta: corre sobre el `manager` recibido y no abre transacción
   * propia, para que la importación masiva lo use dentro de la suya. Devuelve
   * el id de la persona creada. Llamar antes a `validarAlta`.
   */
  async crearCon(
    manager: EntityManager,
    dto: CrearPersonaDto,
  ): Promise<number> {
    const repo = manager.getRepository(Persona);
    await this.exigirIdentidadLibre(repo, dto.legajo, dto.documento);
    const creada = await repo.save(
      repo.create({
        legajo: dto.legajo,
        apellido: dto.apellido,
        nombre: dto.nombre,
        documento: dto.documento,
        fechaNacimiento: dto.fechaNacimiento,
        fechaIngreso: dto.fechaIngreso,
        idSituacionRevista: dto.idSituacionRevista,
        fechaPrevistaRetiro: dto.fechaPrevistaRetiro ?? null,
        activo: true,
      }),
    );
    return creada.id;
  }
```

- [ ] **Step 4: Refactorizar `OcupacionesService`**

En `ocupaciones.service.ts`, cambiar `import type { Repository } from 'typeorm';` por `import type { EntityManager, Repository } from 'typeorm';` y reemplazar el método `crear` completo por:

```ts
  async crear(
    idPersona: number,
    dto: CrearOcupacionDto,
  ): Promise<OcupacionDto> {
    await this.validarAlta(dto);
    return enTransaccionDePersonas(this.ocupaciones, (manager) =>
      this.crearCon(manager, idPersona, dto),
    );
  }

  /** Validaciones del alta que no necesitan la transacción. */
  async validarAlta(dto: CrearOcupacionDto): Promise<void> {
    validarRango(dto.fechaDesde, dto.fechaHasta ?? null);
    await this.referencia.validarActivo(
      DOMINIO_CARACTER_OCUPACION,
      dto.idCaracterOcupacion,
    );
    await this.referencia.validarActivo(DOMINIO_DEDICACION, dto.idDedicacion);
  }

  /**
   * Cuerpo del alta: corre sobre el `manager` recibido y no abre transacción
   * propia (lo usa la importación masiva dentro de la suya). Llamar antes a
   * `validarAlta`.
   */
  async crearCon(
    manager: EntityManager,
    idPersona: number,
    dto: CrearOcupacionDto,
  ): Promise<OcupacionDto> {
    const fechaHasta = dto.fechaHasta ?? null;
    const persona = await this.exigirPersona(
      manager.getRepository(Persona),
      idPersona,
    );
    if (!persona.activo) {
      throw new BadRequestException(
        `${persona.apellido}, ${persona.nombre} está dada de baja y no admite ocupaciones nuevas`,
      );
    }
    const puesto = await manager
      .getRepository(Puesto)
      .findOne({ where: { id: dto.idPuesto } });
    if (!puesto) {
      throw new BadRequestException(`El puesto ${dto.idPuesto} no existe`);
    }
    if (!puesto.activo) {
      throw new BadRequestException(
        `El puesto ${puesto.codigo} está dado de baja`,
      );
    }

    const repo = manager.getRepository(Ocupacion);
    await this.exigirSinSolape(repo, {
      idPersona,
      idPuesto: dto.idPuesto,
      fechaDesde: dto.fechaDesde,
      fechaHasta,
    });
    const creada = await repo.save(
      repo.create({
        idPersona,
        idPuesto: dto.idPuesto,
        fechaDesde: dto.fechaDesde,
        fechaHasta,
        idCaracterOcupacion: dto.idCaracterOcupacion,
        idDedicacion: dto.idDedicacion,
      }),
    );
    return aOcupacionDto(creada, await hoyDeLaBase(manager));
  }
```

- [ ] **Step 5: Verificar que el test nuevo y los existentes pasan**

Run: `cd backend && npx vitest run src/modules/personas/`
Expected: PASS, incluidos `personas.service.spec.ts` y `ocupaciones.service.spec.ts` sin modificar. Si alguno falla, la refactorización cambió el comportamiento: corregirla, no el test.

- [ ] **Step 6: Escribir el test de integración de savepoints**

Crear `backend/src/modules/personas/importacion/savepoints.int.spec.ts`:

```ts
import type { DataSource, EntityManager } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../../testing/base-temporal.js';

/**
 * La importación depende de que un error de la base dentro de un savepoint
 * (por ejemplo la exclusión de solapes, 23P01) no deje abortada la
 * transacción externa.
 */
describe('Savepoints anidados de TypeORM (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let idPuesto: number;
  let caracter: number;
  let dedicacion: number;
  let personaA: number;
  let personaB: number;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;

  const insertarOcupacion = (
    m: EntityManager,
    idPersona: number,
    desde: string,
    hasta: string | null,
  ) =>
    m.query(
      `INSERT INTO ocupacion (id_persona, id_puesto, fecha_desde, fecha_hasta, id_caracter_ocupacion, id_dedicacion)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [idPersona, idPuesto, desde, hasta, caracter, dedicacion],
    );

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    caracter = (
      await sql<{ id: number }[]>(
        `SELECT id_caracter_ocupacion AS id FROM caracter_ocupacion WHERE codigo = 'titular'`,
      )
    )[0].id;
    dedicacion = (
      await sql<{ id: number }[]>(
        `SELECT id_dedicacion AS id FROM dedicacion WHERE codigo = 'simple'`,
      )
    )[0].id;
    const revista = (
      await sql<{ id: number }[]>(
        `SELECT id_situacion_revista AS id FROM situacion_revista WHERE codigo = 'planta_permanente'`,
      )
    )[0].id;
    const insertarPersona = async (legajo: string, documento: string) =>
      (
        await sql<{ id: number }[]>(
          `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
           VALUES ($1, 'Pérez', 'Ana', $2, '1980-01-01', '2005-03-01', $3) RETURNING id_persona AS id`,
          [legajo, documento, revista],
        )
      )[0].id;
    personaA = await insertarPersona('L-1', '30111111');
    personaB = await insertarPersona('L-2', '30222222');
    const [{ id: unidad }] = await sql<{ id: number }[]>(
      `SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
    );
    idPuesto = (
      await sql<{ id: number }[]>(
        `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
         SELECT 'P-0001', 'Jefe', $1, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
         RETURNING id_puesto AS id`,
        [unidad],
      )
    )[0].id;
  });
  afterAll(async () => {
    await base.destruir();
  });
  afterEach(async () => {
    await sql('DELETE FROM ocupacion');
  });

  it('un 23P01 dentro de un savepoint no aborta la transacción externa', async () => {
    await ds.transaction(async (manager) => {
      await insertarOcupacion(manager, personaA, '2024-01-01', null);

      await expect(
        manager.transaction((m) =>
          insertarOcupacion(m, personaA, '2025-01-01', null),
        ),
      ).rejects.toMatchObject({ driverError: { code: '23P01' } });

      // La transacción externa sigue viva y la primera ocupación sigue ahí.
      await insertarOcupacion(manager, personaB, '2024-01-01', null);
      const [{ n }] = await manager.query<{ n: number }[]>(
        'SELECT count(*)::int AS n FROM ocupacion',
      );
      expect(n).toBe(2);
    });
    expect(await sql('SELECT 1 FROM ocupacion')).toHaveLength(2);
  });

  it('lo escrito en savepoints exitosos se descarta si la transacción externa revierte', async () => {
    class Revertir extends Error {}
    await expect(
      ds.transaction(async (manager) => {
        await manager.transaction((m) =>
          insertarOcupacion(m, personaA, '2024-01-01', null),
        );
        throw new Revertir();
      }),
    ).rejects.toBeInstanceOf(Revertir);
    expect(await sql('SELECT 1 FROM ocupacion')).toHaveLength(0);
  });
});
```

- [ ] **Step 7: Ejecutar el test de integración**

Run: `docker compose up -d db && cd backend && npm run test:integracion -- src/modules/personas/importacion/savepoints.int.spec.ts`
Expected: PASS (2 tests). **Si el primero falla** (por ejemplo `current transaction is aborted`), la arquitectura de la spec no se sostiene: detener el trabajo y avisar, porque cambia el diseño (habría que ejecutar los savepoints a mano con `SAVEPOINT`/`ROLLBACK TO SAVEPOINT` por `manager.query`).

- [ ] **Step 8: Lint, formato y commit**

```bash
cd backend && npm run lint && npm run format
git add backend/src/modules/personas
git commit -m "Separar el cuerpo del alta de personas y ocupaciones para reusarlo en transacciones externas"
```

---

### Task 2: Dependencias y lectura del CSV

**Files:**
- Modify: `backend/package.json`, `backend/package-lock.json` (por `npm install`)
- Create: `backend/src/modules/personas/importacion/tipos.ts`
- Create: `backend/src/modules/personas/importacion/normalizar.ts`
- Create: `backend/src/modules/personas/importacion/normalizar.spec.ts`
- Create: `backend/src/modules/personas/importacion/csv.ts`
- Create: `backend/src/modules/personas/importacion/csv.spec.ts`

**Interfaces:**
- Produces (`tipos.ts`): `COLUMNAS`, `Columna`, `ValoresFila`, `FilaCsv`, `ErrorImportacion`, `MAX_BYTES`, `MAX_FILAS`, `COLUMNAS_PERSONA`, `COLUMNAS_OBLIGATORIAS_OCUPACION`, `COLUMNAS_OCUPACION`.
- Produces (`normalizar.ts`): `clave(texto: string): string`, `aFechaIso(texto: string): string`.
- Produces (`csv.ts`): `leerCsv(archivo: Buffer): FilaCsv[]` (lanza `BadRequestException`).

- [ ] **Step 1: Instalar las dependencias**

```bash
cd backend && npm install csv-parse && npm install -D @types/multer
```

Expected: `package.json` suma `csv-parse` en `dependencies` y `@types/multer` en `devDependencies`.

- [ ] **Step 2: Crear `tipos.ts`**

```ts
/** Tamaño máximo del archivo; lo corta la carga multipart (413). */
export const MAX_BYTES = 2 * 1024 * 1024;
/** Filas de datos máximas (sin contar la cabecera); más da 400. */
export const MAX_FILAS = 2000;

export const COLUMNAS = [
  'legajo',
  'apellido',
  'nombre',
  'documento',
  'fecha_nacimiento',
  'fecha_ingreso',
  'situacion_revista',
  'fecha_prevista_retiro',
  'unidad',
  'puesto',
  'fecha_desde',
  'fecha_hasta',
  'caracter',
  'dedicacion',
] as const;

export type Columna = (typeof COLUMNAS)[number];
export type ValoresFila = Record<Columna, string>;

/** Una fila de datos con su número en el archivo (la cabecera es la fila 1). */
export interface FilaCsv {
  fila: number;
  valores: ValoresFila;
}

export interface ErrorImportacion {
  fila: number;
  columna?: string;
  mensaje: string;
}

export const COLUMNAS_PERSONA = [
  'legajo',
  'apellido',
  'nombre',
  'documento',
  'fecha_nacimiento',
  'fecha_ingreso',
  'situacion_revista',
  'fecha_prevista_retiro',
] as const satisfies readonly Columna[];

/** Una fila con ocupación las necesita todas; `fecha_hasta` es opcional. */
export const COLUMNAS_OBLIGATORIAS_OCUPACION = [
  'unidad',
  'puesto',
  'fecha_desde',
  'caracter',
  'dedicacion',
] as const satisfies readonly Columna[];

export const COLUMNAS_OCUPACION = [
  ...COLUMNAS_OBLIGATORIAS_OCUPACION,
  'fecha_hasta',
] as const satisfies readonly Columna[];
```

- [ ] **Step 3: Escribir el test de `normalizar.ts`**

Crear `normalizar.spec.ts`:

```ts
import { aFechaIso, clave } from './normalizar.js';

describe('clave', () => {
  it('ignora mayúsculas, tildes y espacios de más', () => {
    expect(clave('  Cátedra   de FÍSICA ')).toBe('catedra de fisica');
  });

  it('conserva la ñ, también en mayúscula', () => {
    expect(clave('Año')).toBe('año');
    expect(clave('AÑO')).toBe('año');
  });
});

describe('aFechaIso', () => {
  it('deja intacta una fecha ISO', () => {
    expect(aFechaIso('2024-03-01')).toBe('2024-03-01');
  });

  it('convierte DD/MM/AAAA, con o sin ceros', () => {
    expect(aFechaIso('01/03/2024')).toBe('2024-03-01');
    expect(aFechaIso('1/3/2024')).toBe('2024-03-01');
  });

  it('no inventa nada con formatos desconocidos: los devuelve para que la validación los rechace', () => {
    expect(aFechaIso('marzo 2024')).toBe('marzo 2024');
    expect(aFechaIso('')).toBe('');
  });
});
```

- [ ] **Step 4: Ejecutar y verificar que falla**

Run: `cd backend && npx vitest run src/modules/personas/importacion/normalizar.spec.ts`
Expected: FAIL (no existe `normalizar.js`).

- [ ] **Step 5: Implementar `normalizar.ts`**

```ts
/** Para comparar denominaciones: sin mayúsculas, tildes ni espacios repetidos (la ñ se conserva). */
export function clave(texto: string): string {
  return texto
    .toLowerCase() // antes de normalizar, para que la Ñ mayúscula también se proteja
    .normalize('NFD')
    .replace(/ñ/g, '\u0001') // protege la ñ
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'ñ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * `DD/MM/AAAA` a `AAAA-MM-DD`. Cualquier otro texto vuelve igual: la
 * validación de fechas del DTO lo rechaza con su mensaje.
 */
export function aFechaIso(texto: string): string {
  const partes = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim());
  if (!partes) return texto.trim();
  const [, dia, mes, anio] = partes;
  return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}
```

Nota: `'Año'.normalize('NFD')` descompone la ñ en `n` + U+0303; el reemplazo la protege antes de quitar las marcas combinantes. Si el test de la ñ falla, revisar el orden de los `replace`.

- [ ] **Step 6: Ejecutar y verificar que pasa**

Run: `cd backend && npx vitest run src/modules/personas/importacion/normalizar.spec.ts`
Expected: PASS.

- [ ] **Step 7: Escribir el test de `csv.ts`**

Crear `csv.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { COLUMNAS, MAX_FILAS } from './tipos.js';
import { leerCsv } from './csv.js';

const CABECERA = COLUMNAS.join(';');
const fila = (valores: Partial<Record<(typeof COLUMNAS)[number], string>>) =>
  COLUMNAS.map((c) => valores[c] ?? '').join(';');
const buffer = (...lineas: string[]) => Buffer.from(lineas.join('\n'), 'utf8');

describe('leerCsv', () => {
  it('lee una fila con separador ; y le asigna el número de línea del archivo', () => {
    const filas = leerCsv(
      buffer(CABECERA, fila({ legajo: 'L-1', apellido: 'Pérez' })),
    );
    expect(filas).toHaveLength(1);
    expect(filas[0].fila).toBe(2);
    expect(filas[0].valores.legajo).toBe('L-1');
    expect(filas[0].valores.apellido).toBe('Pérez');
    expect(filas[0].valores.unidad).toBe('');
  });

  it('detecta el separador coma', () => {
    const coma = (s: string) => s.replaceAll(';', ',');
    const filas = leerCsv(
      buffer(coma(CABECERA), coma(fila({ legajo: 'L-1' }))),
    );
    expect(filas[0].valores.legajo).toBe('L-1');
  });

  it('tolera BOM, CRLF y columnas en otro orden', () => {
    const invertida = [...COLUMNAS].reverse();
    const texto =
      '﻿' +
      invertida.join(';') +
      '\r\n' +
      invertida.map((c) => (c === 'legajo' ? 'L-9' : '')).join(';') +
      '\r\n';
    const filas = leerCsv(Buffer.from(texto, 'utf8'));
    expect(filas[0].valores.legajo).toBe('L-9');
  });

  it('lee comillas con separador adentro como una sola celda', () => {
    const filas = leerCsv(
      buffer(CABECERA, fila({ legajo: 'L-1', apellido: '"Pérez; Gómez"' })),
    );
    expect(filas[0].valores.apellido).toBe('Pérez; Gómez');
  });

  it('ignora las filas vacías que deja Excel', () => {
    const vacia = COLUMNAS.map(() => '').join(';');
    const filas = leerCsv(
      buffer(CABECERA, fila({ legajo: 'L-1' }), vacia, vacia),
    );
    expect(filas).toHaveLength(1);
  });

  it('rechaza un archivo vacío', () => {
    expect(() => leerCsv(Buffer.from('   \n', 'utf8'))).toThrow(
      BadRequestException,
    );
  });

  it('rechaza una cabecera con una columna faltante, nombrándola', () => {
    const sinNombre = COLUMNAS.filter((c) => c !== 'nombre').join(';');
    expect(() => leerCsv(buffer(sinNombre))).toThrow(/nombre/);
  });

  it('rechaza una columna desconocida (nombre mal escrito) en vez de descartarla', () => {
    const mal = COLUMNAS.map((c) =>
      c === 'fecha_prevista_retiro' ? 'fecha_retiro' : c,
    ).join(';');
    expect(() => leerCsv(buffer(mal))).toThrow(/fecha_retiro/);
  });

  it('rechaza una columna repetida', () => {
    expect(() => leerCsv(buffer(CABECERA + ';legajo'))).toThrow(/legajo/);
  });

  it('rechaza una fila con otra cantidad de columnas, indicando la línea', () => {
    expect(() => leerCsv(buffer(CABECERA, 'L-1;Pérez'))).toThrow(/2/);
  });

  it('rechaza más filas que el máximo', () => {
    const filas = Array.from({ length: MAX_FILAS + 1 }, (_, i) =>
      fila({ legajo: `L-${i}` }),
    );
    expect(() => leerCsv(buffer(CABECERA, ...filas))).toThrow(
      /2000|filas/,
    );
  });

  it('acepta exactamente el máximo de filas', () => {
    const filas = Array.from({ length: MAX_FILAS }, (_, i) =>
      fila({ legajo: `L-${i}` }),
    );
    expect(leerCsv(buffer(CABECERA, ...filas))).toHaveLength(MAX_FILAS);
  });
});
```

- [ ] **Step 8: Ejecutar y verificar que falla**

Run: `cd backend && npx vitest run src/modules/personas/importacion/csv.spec.ts`
Expected: FAIL (no existe `csv.js`).

- [ ] **Step 9: Implementar `csv.ts`**

```ts
import { BadRequestException } from '@nestjs/common';
import { CsvError, parse } from 'csv-parse/sync';
import {
  COLUMNAS,
  MAX_FILAS,
  type Columna,
  type FilaCsv,
  type ValoresFila,
} from './tipos.js';

interface Registro {
  record: string[];
  info: { lines: number };
}

const ocurrencias = (texto: string, caracter: string) =>
  texto.split(caracter).length - 1;

/** Excel en español exporta con `;`; el resto, con `,`. Se decide por la cabecera. */
function detectarSeparador(texto: string): ';' | ',' {
  const cabecera = texto.split(/\r?\n/, 1)[0];
  return ocurrencias(cabecera, ';') > ocurrencias(cabecera, ',') ? ';' : ',';
}

function indicesDeCabecera(cabecera: string[]): Map<Columna, number> {
  const nombres = cabecera.map((c) => c.trim().toLowerCase());
  const conocidas = new Set<string>(COLUMNAS);

  const desconocidas = nombres.filter((n) => !conocidas.has(n));
  if (desconocidas.length > 0) {
    throw new BadRequestException(
      `Columnas desconocidas en la cabecera: ${desconocidas.join(', ')}`,
    );
  }
  const repetidas = nombres.filter((n, i) => nombres.indexOf(n) !== i);
  if (repetidas.length > 0) {
    throw new BadRequestException(
      `Columnas repetidas en la cabecera: ${[...new Set(repetidas)].join(', ')}`,
    );
  }
  const faltantes = COLUMNAS.filter((c) => !nombres.includes(c));
  if (faltantes.length > 0) {
    throw new BadRequestException(
      `Faltan columnas en la cabecera: ${faltantes.join(', ')}`,
    );
  }
  return new Map(nombres.map((n, i) => [n as Columna, i]));
}

/**
 * Lee el CSV y devuelve las filas de datos con su número de línea (la
 * cabecera es la 1). Ignora las filas totalmente vacías. Todo problema de
 * forma del archivo lanza 400 y corta la importación.
 */
export function leerCsv(archivo: Buffer): FilaCsv[] {
  const texto = archivo.toString('utf8').replace(/^﻿/, '');
  if (texto.trim() === '') {
    throw new BadRequestException('El archivo está vacío');
  }

  let registros: Registro[];
  try {
    registros = parse(texto, {
      delimiter: detectarSeparador(texto),
      skip_empty_lines: true,
      trim: true,
      info: true,
    }) as Registro[];
  } catch (error) {
    if (error instanceof CsvError) {
      throw new BadRequestException(
        `No se pudo leer el CSV: ${error.message}`,
      );
    }
    throw error;
  }

  const [primero, ...datos] = registros;
  const indices = indicesDeCabecera(primero.record);

  const filas: FilaCsv[] = datos
    .map(({ record, info }) => ({
      fila: info.lines,
      valores: Object.fromEntries(
        COLUMNAS.map((c) => [c, record[indices.get(c) as number] ?? '']),
      ) as ValoresFila,
    }))
    .filter(({ valores }) => Object.values(valores).some((v) => v !== ''));

  if (filas.length > MAX_FILAS) {
    throw new BadRequestException(
      `El archivo tiene ${filas.length} filas y el máximo es ${MAX_FILAS}`,
    );
  }
  return filas;
}
```

Notas: (a) `info.lines` es la línea del archivo donde termina el registro; sin saltos de línea dentro de las celdas coincide con el número de fila de Excel. Si el test "asigna el número de línea" falla con otro valor, verificar la semántica de `info.lines` en la versión instalada de `csv-parse` y ajustar. (b) Un registro con distinta cantidad de columnas hace que `csv-parse` lance `CsvError` (`CSV_RECORD_INCONSISTENT_COLUMNS`) con la línea en el mensaje.

- [ ] **Step 10: Ejecutar y verificar que pasa**

Run: `cd backend && npx vitest run src/modules/personas/importacion/`
Expected: PASS (`normalizar.spec.ts` y `csv.spec.ts`).

- [ ] **Step 11: Lint, formato y commit**

```bash
cd backend && npm run lint && npm run format
git add backend/package.json backend/package-lock.json backend/src/modules/personas/importacion
git commit -m "Leer el CSV de importación: separador, cabecera, límites y filas con su número"
```

---

### Task 3: Agrupar las filas por persona

**Files:**
- Create: `backend/src/modules/personas/importacion/agrupador.ts`
- Create: `backend/src/modules/personas/importacion/agrupador.spec.ts`

**Interfaces:**
- Consumes: `FilaCsv`, `ErrorImportacion`, `COLUMNAS_PERSONA`, `COLUMNAS_OCUPACION`, `COLUMNAS_OBLIGATORIAS_OCUPACION` de `tipos.ts`; `aFechaIso` de `normalizar.ts`.
- Produces: `OcupacionCsv`, `PersonaCsv`, `agrupar(filas: FilaCsv[]): { personas: PersonaCsv[]; errores: ErrorImportacion[] }`.

```ts
export interface OcupacionCsv {
  fila: number;
  unidad: string;
  puesto: string;
  fechaDesde: string; // ISO si venía en un formato conocido
  fechaHasta: string; // '' si no hay
  caracter: string;
  dedicacion: string;
}
export interface PersonaCsv {
  fila: number; // primera fila del legajo
  legajo: string;
  apellido: string;
  nombre: string;
  documento: string;
  fechaNacimiento: string;
  fechaIngreso: string;
  situacionRevista: string;
  fechaPrevistaRetiro: string; // '' si no hay
  ocupaciones: OcupacionCsv[];
}
```

- [ ] **Step 1: Escribir el test**

Crear `agrupador.spec.ts`:

```ts
import { COLUMNAS, type FilaCsv, type ValoresFila } from './tipos.js';
import { agrupar } from './agrupador.js';

const base = {
  legajo: 'L-1',
  apellido: 'Pérez',
  nombre: 'Ana',
  documento: '30111111',
  fecha_nacimiento: '20/05/1980',
  fecha_ingreso: '2005-03-01',
  situacion_revista: 'Planta permanente',
  unidad: 'Cátedra de Física',
  puesto: 'Titular',
  fecha_desde: '2020-03-01',
  caracter: 'Titular',
  dedicacion: 'Simple',
};
const f = (
  fila: number,
  parcial: Partial<ValoresFila> = {},
): FilaCsv => ({
  fila,
  valores: {
    ...Object.fromEntries(COLUMNAS.map((c) => [c, ''])),
    ...base,
    ...parcial,
  } as ValoresFila,
});

describe('agrupar', () => {
  it('arma una persona con sus ocupaciones y normaliza las fechas', () => {
    const { personas, errores } = agrupar([
      f(2),
      f(3, { puesto: 'Jefe', fecha_desde: '01/03/2021' }),
    ]);
    expect(errores).toEqual([]);
    expect(personas).toHaveLength(1);
    expect(personas[0]).toMatchObject({
      fila: 2,
      legajo: 'L-1',
      fechaNacimiento: '1980-05-20',
      situacionRevista: 'Planta permanente',
      fechaPrevistaRetiro: '',
    });
    expect(personas[0].ocupaciones.map((o) => [o.fila, o.puesto, o.fechaDesde])).toEqual([
      [2, 'Titular', '2020-03-01'],
      [3, 'Jefe', '2021-03-01'],
    ]);
  });

  it('agrupa por legajo aunque las filas no sean contiguas', () => {
    const { personas } = agrupar([
      f(2),
      f(3, { legajo: 'L-2', documento: '30222222' }),
      f(4, { puesto: 'Jefe' }),
    ]);
    expect(personas.map((p) => [p.legajo, p.ocupaciones.length])).toEqual([
      ['L-1', 2],
      ['L-2', 1],
    ]);
  });

  it('una fila sin ocupación registra la persona sin ocupaciones', () => {
    const { personas, errores } = agrupar([
      f(2, {
        unidad: '',
        puesto: '',
        fecha_desde: '',
        caracter: '',
        dedicacion: '',
      }),
    ]);
    expect(errores).toEqual([]);
    expect(personas[0].ocupaciones).toEqual([]);
  });

  it('una fila con la ocupación incompleta da un error por columna faltante', () => {
    const { errores } = agrupar([f(5, { dedicacion: '', caracter: '' })]);
    expect(errores.map((e) => [e.fila, e.columna])).toEqual([
      [5, 'caracter'],
      [5, 'dedicacion'],
    ]);
  });

  it('fecha_hasta sola, sin el resto de la ocupación, es error', () => {
    const { errores } = agrupar([
      f(2, {
        unidad: '',
        puesto: '',
        fecha_desde: '',
        caracter: '',
        dedicacion: '',
        fecha_hasta: '2024-01-01',
      }),
    ]);
    expect(errores.length).toBeGreaterThan(0);
    expect(errores.every((e) => e.fila === 2)).toBe(true);
  });

  it('la fila que discrepa en los datos de la persona da error y no aporta su ocupación', () => {
    const { personas, errores } = agrupar([
      f(2),
      f(3, { apellido: 'Gómez', puesto: 'Jefe' }),
    ]);
    expect(errores).toEqual([
      expect.objectContaining({ fila: 3, columna: 'apellido' }),
    ]);
    expect(errores[0].mensaje).toMatch(/fila 2/);
    expect(personas[0].ocupaciones).toHaveLength(1);
  });

  it('un legajo vacío es error y la fila se descarta', () => {
    const { personas, errores } = agrupar([f(2, { legajo: '' })]);
    expect(personas).toEqual([]);
    expect(errores).toEqual([
      expect.objectContaining({ fila: 2, columna: 'legajo' }),
    ]);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `cd backend && npx vitest run src/modules/personas/importacion/agrupador.spec.ts`
Expected: FAIL (no existe `agrupador.js`).

- [ ] **Step 3: Implementar `agrupador.ts`**

```ts
import { aFechaIso } from './normalizar.js';
import {
  COLUMNAS_OBLIGATORIAS_OCUPACION,
  COLUMNAS_OCUPACION,
  COLUMNAS_PERSONA,
  type Columna,
  type ErrorImportacion,
  type FilaCsv,
} from './tipos.js';

export interface OcupacionCsv {
  fila: number;
  unidad: string;
  puesto: string;
  fechaDesde: string;
  fechaHasta: string;
  caracter: string;
  dedicacion: string;
}

export interface PersonaCsv {
  /** Primera fila del legajo en el archivo. */
  fila: number;
  legajo: string;
  apellido: string;
  nombre: string;
  documento: string;
  fechaNacimiento: string;
  fechaIngreso: string;
  situacionRevista: string;
  fechaPrevistaRetiro: string;
  ocupaciones: OcupacionCsv[];
}

const COLUMNAS_FECHA: ReadonlySet<Columna> = new Set([
  'fecha_nacimiento',
  'fecha_ingreso',
  'fecha_prevista_retiro',
  'fecha_desde',
  'fecha_hasta',
]);

/** Valor de la celda ya limpio; las fechas en `DD/MM/AAAA` pasan a ISO. */
function celda(fila: FilaCsv, columna: Columna): string {
  const valor = fila.valores[columna].trim();
  return COLUMNAS_FECHA.has(columna) ? aFechaIso(valor) : valor;
}

function personaDe(fila: FilaCsv): PersonaCsv {
  return {
    fila: fila.fila,
    legajo: celda(fila, 'legajo'),
    apellido: celda(fila, 'apellido'),
    nombre: celda(fila, 'nombre'),
    documento: celda(fila, 'documento'),
    fechaNacimiento: celda(fila, 'fecha_nacimiento'),
    fechaIngreso: celda(fila, 'fecha_ingreso'),
    situacionRevista: celda(fila, 'situacion_revista'),
    fechaPrevistaRetiro: celda(fila, 'fecha_prevista_retiro'),
    ocupaciones: [],
  };
}

/**
 * Agrupa las filas por legajo. Los datos de la persona deben coincidir en
 * todas sus filas. Una fila sin ninguna columna de ocupación solo registra a
 * la persona; con alguna, necesita unidad, puesto, fecha_desde, caracter y
 * dedicacion.
 */
export function agrupar(filas: FilaCsv[]): {
  personas: PersonaCsv[];
  errores: ErrorImportacion[];
} {
  const personas = new Map<string, PersonaCsv>();
  const errores: ErrorImportacion[] = [];

  for (const fila of filas) {
    const legajo = celda(fila, 'legajo');
    if (legajo === '') {
      errores.push({
        fila: fila.fila,
        columna: 'legajo',
        mensaje: 'El legajo es obligatorio',
      });
      continue;
    }

    const existente = personas.get(legajo);
    if (existente) {
      const discrepante = COLUMNAS_PERSONA.find(
        (c) => celda(fila, c) !== celdaDePersona(existente, c),
      );
      if (discrepante) {
        errores.push({
          fila: fila.fila,
          columna: discrepante,
          mensaje: `Difiere de la fila ${existente.fila}, que ya trae al legajo ${legajo}: los datos de la persona deben ser iguales en todas sus filas`,
        });
        continue;
      }
    }
    const persona = existente ?? personaDe(fila);
    personas.set(legajo, persona);

    const hayOcupacion = COLUMNAS_OCUPACION.some((c) => celda(fila, c) !== '');
    if (!hayOcupacion) continue;

    const faltantes = COLUMNAS_OBLIGATORIAS_OCUPACION.filter(
      (c) => celda(fila, c) === '',
    );
    if (faltantes.length > 0) {
      for (const columna of faltantes) {
        errores.push({
          fila: fila.fila,
          columna,
          mensaje: `Falta ${columna}: una fila con ocupación necesita unidad, puesto, fecha_desde, caracter y dedicacion`,
        });
      }
      continue;
    }
    persona.ocupaciones.push({
      fila: fila.fila,
      unidad: celda(fila, 'unidad'),
      puesto: celda(fila, 'puesto'),
      fechaDesde: celda(fila, 'fecha_desde'),
      fechaHasta: celda(fila, 'fecha_hasta'),
      caracter: celda(fila, 'caracter'),
      dedicacion: celda(fila, 'dedicacion'),
    });
  }
  return { personas: [...personas.values()], errores };
}

function celdaDePersona(persona: PersonaCsv, columna: Columna): string {
  switch (columna) {
    case 'legajo':
      return persona.legajo;
    case 'apellido':
      return persona.apellido;
    case 'nombre':
      return persona.nombre;
    case 'documento':
      return persona.documento;
    case 'fecha_nacimiento':
      return persona.fechaNacimiento;
    case 'fecha_ingreso':
      return persona.fechaIngreso;
    case 'situacion_revista':
      return persona.situacionRevista;
    case 'fecha_prevista_retiro':
      return persona.fechaPrevistaRetiro;
    default:
      return '';
  }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `cd backend && npx vitest run src/modules/personas/importacion/agrupador.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Lint, formato y commit**

```bash
cd backend && npm run lint && npm run format
git add backend/src/modules/personas/importacion
git commit -m "Agrupar las filas del CSV por legajo y validar la forma de cada ocupación"
```

---

### Task 4: Resolver referencias y armar los DTO validados

**Files:**
- Create: `backend/src/modules/personas/importacion/catalogos.ts`
- Create: `backend/src/modules/personas/importacion/catalogos.spec.ts`
- Create: `backend/src/modules/personas/importacion/validar.ts`
- Create: `backend/src/modules/personas/importacion/validar.spec.ts`

**Interfaces:**
- Consumes: `clave` de `normalizar.ts`; `PersonaCsv`, `OcupacionCsv` de `agrupador.ts`; `CrearPersonaDto`, `CrearOcupacionDto` (módulo `personas/dto`); `ErrorImportacion`.
- Produces (`catalogos.ts`):

```ts
export interface DatosCatalogos {
  situaciones: { id: number; denominacion: string }[];
  caracteres: { id: number; denominacion: string }[];
  dedicaciones: { id: number; denominacion: string }[];
  /** Todas las unidades, activas o no: sirven para armar la ruta de las candidatas. */
  unidades: { id: number; denominacion: string; idSuperior: number | null; activo: boolean }[];
  /** Solo puestos activos. */
  puestos: { id: number; denominacion: string; idUnidad: number }[];
}
export interface Catalogos { /* opaco; lo arma construirCatalogos */ }
export function construirCatalogos(datos: DatosCatalogos): Catalogos;
export type Resolucion<T> = { valor: T } | { error: string };
export function resolverDominio(catalogo: Map<string, {id:number;denominacion:string}>... 
```
Definición concreta de la API pública que usan las tareas siguientes:
```ts
export function resolverSituacion(c: Catalogos, texto: string): Resolucion<number>;
export function resolverCaracter(c: Catalogos, texto: string): Resolucion<number>;
export function resolverDedicacion(c: Catalogos, texto: string): Resolucion<number>;
export function resolverPuesto(c: Catalogos, unidad: string, puesto: string): Resolucion<number>;
```
- Produces (`validar.ts`):

```ts
export function armarPersona(p: PersonaCsv, idSituacionRevista: number): Promise<{ dto?: CrearPersonaDto; errores: ErrorImportacion[] }>;
export function armarOcupacion(o: OcupacionCsv, ids: { idPuesto: number; idCaracterOcupacion: number; idDedicacion: number }): Promise<{ dto?: CrearOcupacionDto; errores: ErrorImportacion[] }>;
```

- [ ] **Step 1: Escribir el test de `catalogos.ts`**

Crear `catalogos.spec.ts`:

```ts
import {
  construirCatalogos,
  resolverCaracter,
  resolverPuesto,
  resolverSituacion,
  type DatosCatalogos,
} from './catalogos.js';

const datos: DatosCatalogos = {
  situaciones: [
    { id: 1, denominacion: 'Planta permanente' },
    { id: 2, denominacion: 'Contratado' },
  ],
  caracteres: [{ id: 1, denominacion: 'Titular' }],
  dedicaciones: [{ id: 1, denominacion: 'Simple' }],
  unidades: [
    { id: 1, denominacion: 'Facultad', idSuperior: null, activo: true },
    { id: 2, denominacion: 'Departamento A', idSuperior: 1, activo: true },
    { id: 3, denominacion: 'Departamento B', idSuperior: 1, activo: true },
    { id: 4, denominacion: 'Cátedra de Física', idSuperior: 2, activo: true },
    { id: 5, denominacion: 'Cátedra de Física', idSuperior: 3, activo: true },
    { id: 6, denominacion: 'Cátedra de Química', idSuperior: 2, activo: true },
    { id: 7, denominacion: 'Cátedra vieja', idSuperior: 2, activo: false },
  ],
  puestos: [
    { id: 100, denominacion: 'Titular', idUnidad: 4 },
    { id: 101, denominacion: 'Titular', idUnidad: 5 },
    { id: 102, denominacion: 'Jefe', idUnidad: 6 },
  ],
};
const catalogos = construirCatalogos(datos);

describe('resolver dominios', () => {
  it('encuentra por denominación sin mayúsculas ni tildes', () => {
    expect(resolverSituacion(catalogos, 'PLANTA PERMANENTE')).toEqual({
      valor: 1,
    });
    expect(resolverCaracter(catalogos, 'titular')).toEqual({ valor: 1 });
  });

  it('si no existe, lista las opciones', () => {
    const r = resolverSituacion(catalogos, 'Jubilado');
    expect(r).toEqual({ error: expect.stringContaining('Planta permanente') });
    expect(r).toEqual({ error: expect.stringContaining('Contratado') });
    expect(r).toEqual({ error: expect.stringContaining('Jubilado') });
  });
});

describe('resolverPuesto', () => {
  it('resuelve unidad única y puesto dentro de ella', () => {
    expect(resolverPuesto(catalogos, 'cátedra de química', 'Jefe')).toEqual({
      valor: 102,
    });
  });

  it('una unidad con el mismo nombre en dos ramas es ambigua y nombra las candidatas con su ruta', () => {
    const r = resolverPuesto(catalogos, 'Cátedra de Física', 'Titular');
    expect(r).toEqual({
      error: expect.stringContaining(
        'Facultad > Departamento A > Cátedra de Física',
      ),
    });
    expect(r).toEqual({
      error: expect.stringContaining(
        'Facultad > Departamento B > Cátedra de Física',
      ),
    });
  });

  it('una unidad inexistente o inactiva no se encuentra', () => {
    expect(resolverPuesto(catalogos, 'Cátedra de Arte', 'Jefe')).toEqual({
      error: expect.stringContaining('Cátedra de Arte'),
    });
    expect(resolverPuesto(catalogos, 'Cátedra vieja', 'Jefe')).toEqual({
      error: expect.stringContaining('Cátedra vieja'),
    });
  });

  it('un puesto que no es de esa unidad no se encuentra', () => {
    expect(resolverPuesto(catalogos, 'Cátedra de Química', 'Titular')).toEqual({
      error: expect.stringMatching(/Cátedra de Química.*Titular/),
    });
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `cd backend && npx vitest run src/modules/personas/importacion/catalogos.spec.ts`
Expected: FAIL (no existe `catalogos.js`).

- [ ] **Step 3: Implementar `catalogos.ts`**

```ts
import { clave } from './normalizar.js';

interface Valor {
  id: number;
  denominacion: string;
}

export interface DatosCatalogos {
  situaciones: Valor[];
  caracteres: Valor[];
  dedicaciones: Valor[];
  /** Todas las unidades: las inactivas sirven para armar la ruta de las candidatas. */
  unidades: {
    id: number;
    denominacion: string;
    idSuperior: number | null;
    activo: boolean;
  }[];
  /** Solo puestos activos. */
  puestos: { id: number; denominacion: string; idUnidad: number }[];
}

export type Resolucion<T> = { valor: T } | { error: string };

export interface Catalogos {
  situaciones: Map<string, Valor>;
  caracteres: Map<string, Valor>;
  dedicaciones: Map<string, Valor>;
  /** Unidades activas por clave de denominación. */
  unidadesPorNombre: Map<string, { id: number; ruta: string }[]>;
  /** idUnidad → clave del puesto → id. */
  puestosPorUnidad: Map<number, Map<string, number>>;
}

const porClave = (valores: Valor[]) =>
  new Map(valores.map((v) => [clave(v.denominacion), v]));

export function construirCatalogos(datos: DatosCatalogos): Catalogos {
  const unidades = new Map(datos.unidades.map((u) => [u.id, u]));
  const ruta = (id: number): string => {
    const nombres: string[] = [];
    for (
      let actual = unidades.get(id);
      actual;
      actual =
        actual.idSuperior === null ? undefined : unidades.get(actual.idSuperior)
    ) {
      nombres.unshift(actual.denominacion);
    }
    return nombres.join(' > ');
  };

  const unidadesPorNombre = new Map<string, { id: number; ruta: string }[]>();
  for (const unidad of datos.unidades.filter((u) => u.activo)) {
    const k = clave(unidad.denominacion);
    unidadesPorNombre.set(k, [
      ...(unidadesPorNombre.get(k) ?? []),
      { id: unidad.id, ruta: ruta(unidad.id) },
    ]);
  }

  const puestosPorUnidad = new Map<number, Map<string, number>>();
  for (const puesto of datos.puestos) {
    const delaUnidad = puestosPorUnidad.get(puesto.idUnidad) ?? new Map();
    delaUnidad.set(clave(puesto.denominacion), puesto.id);
    puestosPorUnidad.set(puesto.idUnidad, delaUnidad);
  }

  return {
    situaciones: porClave(datos.situaciones),
    caracteres: porClave(datos.caracteres),
    dedicaciones: porClave(datos.dedicaciones),
    unidadesPorNombre,
    puestosPorUnidad,
  };
}

function resolverDominio(
  catalogo: Map<string, Valor>,
  nombreDominio: string,
  texto: string,
): Resolucion<number> {
  const encontrado = catalogo.get(clave(texto));
  if (encontrado) return { valor: encontrado.id };
  const opciones = [...catalogo.values()].map((v) => v.denominacion).join(', ');
  return {
    error: `"${texto}" no es ${nombreDominio} válido (opciones: ${opciones})`,
  };
}

export const resolverSituacion = (c: Catalogos, texto: string) =>
  resolverDominio(c.situaciones, 'una situación de revista', texto);

export const resolverCaracter = (c: Catalogos, texto: string) =>
  resolverDominio(c.caracteres, 'un carácter de ocupación', texto);

export const resolverDedicacion = (c: Catalogos, texto: string) =>
  resolverDominio(c.dedicaciones, 'una dedicación', texto);

export function resolverPuesto(
  c: Catalogos,
  unidad: string,
  puesto: string,
): Resolucion<number> {
  const candidatas = c.unidadesPorNombre.get(clave(unidad)) ?? [];
  if (candidatas.length === 0) {
    return { error: `No existe la unidad activa "${unidad}"` };
  }
  if (candidatas.length > 1) {
    return {
      error: `La unidad "${unidad}" es ambigua; puede ser: ${candidatas
        .map((u) => u.ruta)
        .join(' | ')}`,
    };
  }
  const id = c.puestosPorUnidad.get(candidatas[0].id)?.get(clave(puesto));
  if (id === undefined) {
    return {
      error: `La unidad "${unidad}" no tiene un puesto activo "${puesto}"`,
    };
  }
  return { valor: id };
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `cd backend && npx vitest run src/modules/personas/importacion/catalogos.spec.ts`
Expected: PASS.

- [ ] **Step 5: Escribir el test de `validar.ts`**

Crear `validar.spec.ts`:

```ts
import type { OcupacionCsv, PersonaCsv } from './agrupador.js';
import { armarOcupacion, armarPersona } from './validar.js';

const persona = (parcial: Partial<PersonaCsv> = {}): PersonaCsv => ({
  fila: 2,
  legajo: 'L-1',
  apellido: 'Pérez',
  nombre: 'Ana',
  documento: '30111111',
  fechaNacimiento: '1980-05-20',
  fechaIngreso: '2005-03-01',
  situacionRevista: 'Planta permanente',
  fechaPrevistaRetiro: '',
  ocupaciones: [],
  ...parcial,
});

const ocupacion = (parcial: Partial<OcupacionCsv> = {}): OcupacionCsv => ({
  fila: 3,
  unidad: 'U',
  puesto: 'P',
  fechaDesde: '2020-03-01',
  fechaHasta: '',
  caracter: 'Titular',
  dedicacion: 'Simple',
  ...parcial,
});

describe('armarPersona', () => {
  it('arma el DTO; la fecha de retiro vacía queda sin definir', async () => {
    const { dto, errores } = await armarPersona(persona(), 4);
    expect(errores).toEqual([]);
    expect(dto).toMatchObject({
      legajo: 'L-1',
      idSituacionRevista: 4,
      fechaPrevistaRetiro: undefined,
    });
  });

  it('nombra la columna del CSV (no la propiedad del DTO) en cada error', async () => {
    const { dto, errores } = await armarPersona(
      persona({ documento: '12.345', fechaNacimiento: '2024-02-30' }),
      4,
    );
    expect(dto).toBeUndefined();
    expect(errores.map((e) => [e.fila, e.columna]).sort()).toEqual([
      [2, 'documento'],
      [2, 'fecha_nacimiento'],
    ]);
  });

  it('rechaza un apellido más largo que la columna de la base', async () => {
    const { errores } = await armarPersona(
      persona({ apellido: 'x'.repeat(101) }),
      4,
    );
    expect(errores).toEqual([
      expect.objectContaining({ fila: 2, columna: 'apellido' }),
    ]);
  });
});

describe('armarOcupacion', () => {
  const ids = { idPuesto: 10, idCaracterOcupacion: 1, idDedicacion: 2 };

  it('arma el DTO; fecha_hasta vacía queda sin definir', async () => {
    const { dto, errores } = await armarOcupacion(ocupacion(), ids);
    expect(errores).toEqual([]);
    expect(dto).toMatchObject({
      idPuesto: 10,
      fechaDesde: '2020-03-01',
      fechaHasta: undefined,
    });
  });

  it('una fecha inválida nombra su columna y la fila de la ocupación', async () => {
    const { errores } = await armarOcupacion(
      ocupacion({ fechaDesde: 'ayer' }),
      ids,
    );
    expect(errores).toEqual([
      expect.objectContaining({ fila: 3, columna: 'fecha_desde' }),
    ]);
  });
});
```

- [ ] **Step 6: Ejecutar y verificar que falla**

Run: `cd backend && npx vitest run src/modules/personas/importacion/validar.spec.ts`
Expected: FAIL (no existe `validar.js`).

- [ ] **Step 7: Implementar `validar.ts`**

`armarPersona` y `armarOcupacion` son asíncronas porque `validate` de class-validator lo es.

```ts
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { CrearOcupacionDto } from '../dto/crear-ocupacion.dto.js';
import { CrearPersonaDto } from '../dto/crear-persona.dto.js';
import type { OcupacionCsv, PersonaCsv } from './agrupador.js';
import type { ErrorImportacion } from './tipos.js';

/** Propiedad del DTO → columna del CSV, para que el error apunte donde RR. HH. edita. */
const COLUMNA_DE: Record<string, string> = {
  legajo: 'legajo',
  apellido: 'apellido',
  nombre: 'nombre',
  documento: 'documento',
  fechaNacimiento: 'fecha_nacimiento',
  fechaIngreso: 'fecha_ingreso',
  idSituacionRevista: 'situacion_revista',
  fechaPrevistaRetiro: 'fecha_prevista_retiro',
  idPuesto: 'puesto',
  fechaDesde: 'fecha_desde',
  fechaHasta: 'fecha_hasta',
  idCaracterOcupacion: 'caracter',
  idDedicacion: 'dedicacion',
};

const vacioASinDefinir = (texto: string) => (texto === '' ? undefined : texto);

function aErrores(
  fila: number,
  errores: ValidationError[],
): ErrorImportacion[] {
  return errores.flatMap((e) =>
    Object.values(e.constraints ?? {}).map((mensaje) => ({
      fila,
      columna: COLUMNA_DE[e.property] ?? e.property,
      mensaje,
    })),
  );
}

/** Aplica las mismas validaciones del alta manual (`CrearPersonaDto`). */
export async function armarPersona(
  p: PersonaCsv,
  idSituacionRevista: number,
): Promise<{ dto?: CrearPersonaDto; errores: ErrorImportacion[] }> {
  const dto = plainToInstance(CrearPersonaDto, {
    legajo: p.legajo,
    apellido: p.apellido,
    nombre: p.nombre,
    documento: p.documento,
    fechaNacimiento: p.fechaNacimiento,
    fechaIngreso: p.fechaIngreso,
    idSituacionRevista,
    fechaPrevistaRetiro: vacioASinDefinir(p.fechaPrevistaRetiro),
  });
  const errores = aErrores(p.fila, await validate(dto));
  return errores.length > 0 ? { errores } : { dto, errores };
}

/** Aplica las mismas validaciones del alta manual (`CrearOcupacionDto`). */
export async function armarOcupacion(
  o: OcupacionCsv,
  ids: {
    idPuesto: number;
    idCaracterOcupacion: number;
    idDedicacion: number;
  },
): Promise<{ dto?: CrearOcupacionDto; errores: ErrorImportacion[] }> {
  const dto = plainToInstance(CrearOcupacionDto, {
    ...ids,
    fechaDesde: o.fechaDesde,
    fechaHasta: vacioASinDefinir(o.fechaHasta),
  });
  const errores = aErrores(o.fila, await validate(dto));
  return errores.length > 0 ? { errores } : { dto, errores };
}
```

Nota: el test del apellido largo depende de que `CrearPersonaDto` tenga `@MaxLength(100)` (lo tiene). `validate` sin opciones no rechaza propiedades extra, y el DTO no las tiene.

- [ ] **Step 8: Ejecutar y verificar que pasa**

Run: `cd backend && npx vitest run src/modules/personas/importacion/`
Expected: PASS (`normalizar`, `csv`, `agrupador`, `catalogos`, `validar`).

- [ ] **Step 9: Lint, formato y commit**

```bash
cd backend && npm run lint && npm run format
git add backend/src/modules/personas/importacion
git commit -m "Resolver unidad, puesto y dominios por denominación y validar con los DTO del alta"
```

---

### Task 5: Servicio de importación

**Files:**
- Create: `backend/src/modules/personas/importacion/dto/resultado-importacion.dto.ts`
- Create: `backend/src/modules/personas/importacion/importacion.service.ts`
- Create: `backend/src/modules/personas/importacion/importacion.service.spec.ts`

**Interfaces:**
- Consumes: todo lo de las Tareas 1 a 4; `enTransaccionDePersonas` y `traducirError` (`../transaccion.js`); `ReferenciaService.listarValores(slug)`; constantes `DOMINIO_*` (`../personas.constantes.js`).
- Produces:

```ts
export class ErrorImportacionDto { fila: number; columna?: string; mensaje: string }
export class ResultadoImportacionDto {
  importado: boolean; filas: number; personas: number; ocupaciones: number;
  errores: ErrorImportacionDto[];
}
// ImportacionService
constructor(
  @InjectRepository(Persona) personasRepo: Repository<Persona>,
  @InjectRepository(UnidadOrganizativa) unidades: Repository<UnidadOrganizativa>,
  @InjectRepository(Puesto) puestos: Repository<Puesto>,
  referencia: ReferenciaService,
  personas: PersonasService,
  ocupaciones: OcupacionesService,
)
importar(archivo: Buffer, confirmar: boolean): Promise<ResultadoImportacionDto>
```

- [ ] **Step 1: Crear el DTO de resultado**

`dto/resultado-importacion.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorImportacionDto {
  @ApiProperty({ description: 'Fila del archivo; la cabecera es la 1' })
  fila: number;

  @ApiPropertyOptional({ description: 'Columna del CSV a la que apunta el error' })
  columna?: string;

  @ApiProperty()
  mensaje: string;
}

export class ResultadoImportacionDto {
  @ApiProperty({
    description:
      'true solo si se pidió confirmar y no hubo errores: se escribió todo',
  })
  importado: boolean;

  @ApiProperty({ description: 'Filas de datos leídas' })
  filas: number;

  @ApiProperty({
    description: 'Personas creadas, o que se crearían en la vista previa',
  })
  personas: number;

  @ApiProperty({
    description: 'Ocupaciones creadas, o que se crearían en la vista previa',
  })
  ocupaciones: number;

  @ApiProperty({ type: ErrorImportacionDto, isArray: true })
  errores: ErrorImportacionDto[];
}
```

- [ ] **Step 2: Escribir el test del servicio**

Crear `importacion.service.spec.ts`. Usa servicios simulados: el manager falso ejecuta los callbacks de `transaction` en el acto y propaga sus errores.

```ts
import { ConflictException } from '@nestjs/common';
import { COLUMNAS } from './tipos.js';
import { ImportacionService } from './importacion.service.js';

const CABECERA = COLUMNAS.join(';');
const fila = (v: Partial<Record<(typeof COLUMNAS)[number], string>>) =>
  COLUMNAS.map((c) => v[c] ?? '').join(';');
const csv = (...lineas: string[]) =>
  Buffer.from([CABECERA, ...lineas].join('\n'), 'utf8');

const persona = (legajo: string, extra = {}) => ({
  legajo,
  apellido: 'Pérez',
  nombre: 'Ana',
  documento: `3011${legajo.replace(/\D/g, '').padStart(4, '0')}`,
  fecha_nacimiento: '1980-05-20',
  fecha_ingreso: '2005-03-01',
  situacion_revista: 'Planta permanente',
  unidad: 'Cátedra de Física',
  puesto: 'Titular',
  fecha_desde: '2020-03-01',
  caracter: 'Titular',
  dedicacion: 'Simple',
  ...extra,
});

function crearServicio() {
  const manager: {
    query: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  } = {
    query: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(async (trabajo: (m: unknown) => unknown) =>
      trabajo(manager),
    ),
  };
  const personasRepo = { manager };
  const unidades = {
    find: vi.fn().mockResolvedValue([
      { id: 1, denominacion: 'Cátedra de Física', idUnidadSuperior: null, activo: true },
    ]),
  };
  const puestos = {
    find: vi.fn().mockResolvedValue([
      { id: 10, denominacion: 'Titular', idUnidad: 1 },
      { id: 11, denominacion: 'Jefe', idUnidad: 1 },
    ]),
  };
  const valores: Record<string, { id: number; denominacion: string }[]> = {
    'situacion-revista': [{ id: 1, denominacion: 'Planta permanente' }],
    'caracter-ocupacion': [{ id: 1, denominacion: 'Titular' }],
    dedicacion: [{ id: 1, denominacion: 'Simple' }],
  };
  const referencia = {
    listarValores: vi.fn(async (slug: string) => valores[slug]),
  };
  let siguienteId = 100;
  const personas = {
    validarAlta: vi.fn().mockResolvedValue(undefined),
    crearCon: vi.fn(async () => siguienteId++),
  };
  const ocupaciones = {
    validarAlta: vi.fn().mockResolvedValue(undefined),
    crearCon: vi.fn().mockResolvedValue({}),
  };
  const servicio = new ImportacionService(
    personasRepo as never,
    unidades as never,
    puestos as never,
    referencia as never,
    personas as never,
    ocupaciones as never,
  );
  return { servicio, manager, personas, ocupaciones, referencia };
}

describe('ImportacionService.importar', () => {
  it('vista previa: cuenta lo que se crearía, no confirma', async () => {
    const { servicio, personas, ocupaciones } = crearServicio();
    const r = await servicio.importar(
      csv(
        fila(persona('L-1')),
        fila(persona('L-1', { puesto: 'Jefe', fecha_desde: '2021-03-01' })),
        fila(persona('L-2')),
      ),
      false,
    );
    expect(r).toEqual({
      importado: false,
      filas: 3,
      personas: 2,
      ocupaciones: 3,
      errores: [],
    });
    expect(personas.crearCon).toHaveBeenCalledTimes(2);
    expect(ocupaciones.crearCon).toHaveBeenCalledTimes(3);
  });

  it('confirmar sin errores: importado = true', async () => {
    const { servicio } = crearServicio();
    const r = await servicio.importar(csv(fila(persona('L-1'))), true);
    expect(r.importado).toBe(true);
    expect(r.errores).toEqual([]);
  });

  it('toma el bloqueo de estructura una sola vez', async () => {
    const { servicio, manager } = crearServicio();
    await servicio.importar(
      csv(fila(persona('L-1')), fila(persona('L-2'))),
      true,
    );
    const bloqueos = manager.query.mock.calls.filter(([sql]) =>
      String(sql).includes('pg_advisory_xact_lock'),
    );
    expect(bloqueos).toHaveLength(1);
  });

  it('junta los errores de varias filas y no confirma aunque se pida', async () => {
    const { servicio, personas } = crearServicio();
    personas.crearCon
      .mockRejectedValueOnce(new ConflictException('El legajo L-1 ya lo tiene Gómez, Ana'))
      .mockResolvedValue(101);
    const r = await servicio.importar(
      csv(
        fila(persona('L-1')),
        fila(persona('L-2', { unidad: 'Cátedra de Arte' })),
        fila(persona('L-3')),
      ),
      true,
    );
    expect(r.importado).toBe(false);
    expect(r.errores.map((e) => e.fila)).toEqual([2, 3]);
    expect(r.errores[0].mensaje).toMatch(/L-1 ya lo tiene/);
    expect(r.errores[1]).toMatchObject({ columna: 'puesto' });
    expect(r.errores[1].mensaje).toMatch(/Cátedra de Arte/);
  });

  it('si la persona falla, se omiten sus ocupaciones', async () => {
    const { servicio, personas, ocupaciones } = crearServicio();
    personas.crearCon.mockRejectedValueOnce(
      new ConflictException('El documento 30110001 ya lo tiene Gómez, Ana (legajo L-9)'),
    );
    const r = await servicio.importar(csv(fila(persona('L-1'))), false);
    expect(ocupaciones.crearCon).not.toHaveBeenCalled();
    expect(r.ocupaciones).toBe(0);
    expect(r.errores).toHaveLength(1);
  });

  it('un solape que rechaza el ABM se reporta con su fila y el resto sigue', async () => {
    const { servicio, ocupaciones } = crearServicio();
    ocupaciones.crearCon
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(
        new ConflictException('La persona ya ocupa ese puesto desde 2020-03-01, sin fecha de fin: las fechas no pueden superponerse'),
      )
      .mockResolvedValue({});
    const r = await servicio.importar(
      csv(
        fila(persona('L-1')),
        fila(persona('L-1', { fecha_desde: '2021-01-01' })),
        fila(persona('L-1', { puesto: 'Jefe' })),
      ),
      true,
    );
    expect(r.importado).toBe(false);
    expect(r.errores.map((e) => e.fila)).toEqual([3]);
    expect(r.ocupaciones).toBe(2);
  });

  it('un error inesperado (no HTTP) se propaga y revierte todo', async () => {
    const { servicio, personas } = crearServicio();
    personas.crearCon.mockRejectedValueOnce(new Error('conexión caída'));
    await expect(
      servicio.importar(csv(fila(persona('L-1'))), true),
    ).rejects.toThrow('conexión caída');
  });

  it('errores de forma y de referencia no abren la transacción si no queda nada válido', async () => {
    const { servicio, manager } = crearServicio();
    const r = await servicio.importar(
      csv(fila(persona('L-1', { situacion_revista: 'Jubilado' }))),
      true,
    );
    expect(r.importado).toBe(false);
    expect(r.errores[0]).toMatchObject({ fila: 2, columna: 'situacion_revista' });
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('ordena los errores por fila', async () => {
    const { servicio } = crearServicio();
    const r = await servicio.importar(
      csv(
        fila(persona('L-1', { dedicacion: 'Mágica' })),
        fila(persona('L-2', { legajo: '' })),
      ),
      false,
    );
    const filas = r.errores.map((e) => e.fila);
    expect(filas).toEqual([...filas].sort((a, b) => a - b));
  });
});
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `cd backend && npx vitest run src/modules/personas/importacion/importacion.service.spec.ts`
Expected: FAIL (no existe `importacion.service.js`).

- [ ] **Step 4: Implementar `importacion.service.ts`**

```ts
import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Puesto } from '../../estructura/entities/puesto.entity.js';
import { UnidadOrganizativa } from '../../estructura/entities/unidad-organizativa.entity.js';
import { ReferenciaService } from '../../referencia/referencia.service.js';
import type { CrearOcupacionDto } from '../dto/crear-ocupacion.dto.js';
import type { CrearPersonaDto } from '../dto/crear-persona.dto.js';
import { Persona } from '../entities/persona.entity.js';
import { OcupacionesService } from '../ocupaciones.service.js';
import {
  DOMINIO_CARACTER_OCUPACION,
  DOMINIO_DEDICACION,
  DOMINIO_SITUACION_REVISTA,
} from '../personas.constantes.js';
import { PersonasService } from '../personas.service.js';
import { enTransaccionDePersonas, traducirError } from '../transaccion.js';
import { agrupar } from './agrupador.js';
import {
  construirCatalogos,
  resolverCaracter,
  resolverDedicacion,
  resolverPuesto,
  resolverSituacion,
  type Catalogos,
  type Resolucion,
} from './catalogos.js';
import { leerCsv } from './csv.js';
import type { ResultadoImportacionDto } from './dto/resultado-importacion.dto.js';
import type { ErrorImportacion } from './tipos.js';
import { armarOcupacion, armarPersona } from './validar.js';

interface PersonaLista {
  fila: number;
  dto: CrearPersonaDto;
  ocupaciones: { fila: number; dto: CrearOcupacionDto }[];
}

/** Fuerza el rollback de la transacción externa sin que cuente como fallo. */
class Revertir extends Error {}

/** Ocupación o persona rechazada por una regla de negocio: se reporta y se sigue. */
function comoError(fila: number, error: unknown): ErrorImportacion {
  const traducido = traducirError(error);
  if (traducido instanceof HttpException) {
    return { fila, mensaje: traducido.message };
  }
  throw traducido;
}

/**
 * Importación masiva de personas y ocupaciones (OE4; RF06, RF07). Aplica las
 * reglas del ABM llamando a `crearCon` de sus servicios dentro de una única
 * transacción, con un savepoint por fila para reunir todos los errores. Solo
 * con `confirmar` y sin errores hace commit; si no, rollback.
 */
@Injectable()
export class ImportacionService {
  constructor(
    @InjectRepository(Persona) private readonly personasRepo: Repository<Persona>,
    @InjectRepository(UnidadOrganizativa)
    private readonly unidades: Repository<UnidadOrganizativa>,
    @InjectRepository(Puesto) private readonly puestos: Repository<Puesto>,
    private readonly referencia: ReferenciaService,
    private readonly personas: PersonasService,
    private readonly ocupaciones: OcupacionesService,
  ) {}

  async importar(
    archivo: Buffer,
    confirmar: boolean,
  ): Promise<ResultadoImportacionDto> {
    const filas = leerCsv(archivo);
    const { personas, errores } = agrupar(filas);
    const catalogos = await this.cargarCatalogos();
    const listas = await this.resolver(personas, catalogos, errores);

    let creadas = { personas: 0, ocupaciones: 0 };
    if (listas.length > 0) {
      creadas = await this.ejecutar(listas, errores, confirmar);
    }

    return {
      importado: confirmar && errores.length === 0,
      filas: filas.length,
      personas: creadas.personas,
      ocupaciones: creadas.ocupaciones,
      errores: errores.sort((a, b) => a.fila - b.fila),
    };
  }

  /** Texto → ids → DTO validado. Lo que falla se reporta y se excluye de la ejecución. */
  private async resolver(
    personas: ReturnType<typeof agrupar>['personas'],
    catalogos: Catalogos,
    errores: ErrorImportacion[],
  ): Promise<PersonaLista[]> {
    const listas: PersonaLista[] = [];
    const tomar = <T>(
      r: Resolucion<T>,
      fila: number,
      columna: string,
    ): T | undefined => {
      if ('error' in r) {
        errores.push({ fila, columna, mensaje: r.error });
        return undefined;
      }
      return r.valor;
    };

    for (const p of personas) {
      const idSituacion = tomar(
        resolverSituacion(catalogos, p.situacionRevista),
        p.fila,
        'situacion_revista',
      );
      if (idSituacion === undefined) continue;
      const armada = await armarPersona(p, idSituacion);
      errores.push(...armada.errores);
      if (!armada.dto) continue;

      const lista: PersonaLista = { fila: p.fila, dto: armada.dto, ocupaciones: [] };
      for (const o of p.ocupaciones) {
        const idPuesto = tomar(resolverPuesto(catalogos, o.unidad, o.puesto), o.fila, 'puesto');
        const idCaracterOcupacion = tomar(resolverCaracter(catalogos, o.caracter), o.fila, 'caracter');
        const idDedicacion = tomar(resolverDedicacion(catalogos, o.dedicacion), o.fila, 'dedicacion');
        if (
          idPuesto === undefined ||
          idCaracterOcupacion === undefined ||
          idDedicacion === undefined
        ) {
          continue;
        }
        const armadaO = await armarOcupacion(o, {
          idPuesto,
          idCaracterOcupacion,
          idDedicacion,
        });
        errores.push(...armadaO.errores);
        if (armadaO.dto) lista.ocupaciones.push({ fila: o.fila, dto: armadaO.dto });
      }
      listas.push(lista);
    }
    return listas;
  }

  private async ejecutar(
    listas: PersonaLista[],
    errores: ErrorImportacion[],
    confirmar: boolean,
  ): Promise<{ personas: number; ocupaciones: number }> {
    const creadas = { personas: 0, ocupaciones: 0 };
    try {
      await enTransaccionDePersonas(this.personasRepo, async (manager) => {
        for (const lista of listas) {
          let idPersona: number;
          try {
            await this.personas.validarAlta(lista.dto);
            idPersona = await manager.transaction((m) =>
              this.personas.crearCon(m, lista.dto),
            );
          } catch (error) {
            errores.push(comoError(lista.fila, error));
            continue;
          }
          creadas.personas++;

          for (const ocupacion of lista.ocupaciones) {
            try {
              await this.ocupaciones.validarAlta(ocupacion.dto);
              await manager.transaction((m) =>
                this.ocupaciones.crearCon(m, idPersona, ocupacion.dto),
              );
              creadas.ocupaciones++;
            } catch (error) {
              errores.push(comoError(ocupacion.fila, error));
            }
          }
        }
        if (!confirmar || errores.length > 0) throw new Revertir();
      });
    } catch (error) {
      if (!(error instanceof Revertir)) throw error;
    }
    return creadas;
  }

  private async cargarCatalogos(): Promise<Catalogos> {
    const [situaciones, caracteres, dedicaciones, unidades, puestos] =
      await Promise.all([
        this.referencia.listarValores(DOMINIO_SITUACION_REVISTA),
        this.referencia.listarValores(DOMINIO_CARACTER_OCUPACION),
        this.referencia.listarValores(DOMINIO_DEDICACION),
        this.unidades.find(),
        this.puestos.find({ where: { activo: true } }),
      ]);
    return construirCatalogos({
      situaciones,
      caracteres,
      dedicaciones,
      unidades: unidades.map((u) => ({
        id: u.id,
        denominacion: u.denominacion,
        idSuperior: u.idUnidadSuperior,
        activo: u.activo,
      })),
      puestos: puestos.map((p) => ({
        id: p.id,
        denominacion: p.denominacion,
        idUnidad: p.idUnidad,
      })),
    });
  }
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `cd backend && npx vitest run src/modules/personas/importacion/importacion.service.spec.ts`
Expected: PASS (9 tests). Si el test "un solape…" falla por el orden de los mocks, recordar que `crearCon` de ocupaciones se llama una vez por ocupación válida, en el orden del archivo.

- [ ] **Step 6: Lint, formato y commit**

```bash
cd backend && npm run lint && npm run format
git add backend/src/modules/personas/importacion
git commit -m "Orquestar la importación en una transacción con un savepoint por fila"
```

---

### Task 6: Endpoints, módulo y pruebas de integración

**Files:**
- Create: `backend/src/modules/personas/importacion/dto/importar-personas.dto.ts`
- Create: `backend/src/modules/personas/importacion/plantilla.ts`
- Create: `backend/src/modules/personas/importacion/importacion.controller.ts`
- Create: `backend/src/modules/personas/importacion/importacion.service.int.spec.ts`
- Modify: `backend/src/modules/personas/personas.module.ts`

**Interfaces:**
- Consumes: `ImportacionService.importar(archivo: Buffer, confirmar: boolean)`; `MAX_BYTES`, `COLUMNAS`.
- Produces: `POST /api/personas/importacion` (multipart `archivo` + `confirmar`), `GET /api/personas/importacion/plantilla`.

- [ ] **Step 1: Crear el DTO de entrada y la plantilla**

`dto/importar-personas.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/** Campos de texto del formulario multipart (el archivo viaja aparte). */
export class ImportarPersonasDto {
  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'false: vista previa sin escribir. true: importa si no hay errores',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : value,
  )
  @IsBoolean()
  confirmar?: boolean;
}
```

`plantilla.ts`:

```ts
import { COLUMNAS } from './tipos.js';

const EJEMPLO: Record<(typeof COLUMNAS)[number], string> = {
  legajo: 'L-1234',
  apellido: 'Pérez',
  nombre: 'Ana',
  documento: '30111111',
  fecha_nacimiento: '1980-05-20',
  fecha_ingreso: '2005-03-01',
  situacion_revista: 'Planta permanente',
  fecha_prevista_retiro: '',
  unidad: 'Cátedra de Física',
  puesto: 'Profesor titular',
  fecha_desde: '2020-03-01',
  fecha_hasta: '',
  caracter: 'Titular',
  dedicacion: 'Exclusiva',
};

/** BOM para que Excel abra el archivo como UTF-8; separador `;` como el Excel en español. */
export const PLANTILLA_CSV = `﻿${COLUMNAS.join(';')}\n${COLUMNAS.map((c) => EJEMPLO[c]).join(';')}\n`;
```

- [ ] **Step 2: Crear el controller**

`importacion.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ROLES } from '../../../common/roles.js';
import { ImportarPersonasDto } from './dto/importar-personas.dto.js';
import { ResultadoImportacionDto } from './dto/resultado-importacion.dto.js';
import { ImportacionService } from './importacion.service.js';
import { PLANTILLA_CSV } from './plantilla.js';
import { MAX_BYTES } from './tipos.js';

/** Importación masiva de personas y ocupaciones desde un CSV (OE4). */
@ApiTags('personas')
@Controller('personas/importacion')
export class ImportacionController {
  constructor(private readonly servicio: ImportacionService) {}

  @Post()
  @HttpCode(200)
  @Roles(ROLES.recursosHumanos)
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAX_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo'],
      properties: {
        archivo: { type: 'string', format: 'binary' },
        confirmar: { type: 'boolean', default: false },
      },
    },
  })
  @ApiOkResponse({
    type: ResultadoImportacionDto,
    description:
      'Reporte de la vista previa o de la importación; los errores de datos van en `errores`',
  })
  @ApiBadRequestResponse({
    description: 'Falta el archivo, está vacío, la cabecera es inválida o hay más de 2000 filas',
  })
  @ApiPayloadTooLargeResponse({ description: 'El archivo supera los 2 MB' })
  importar(
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body() dto: ImportarPersonasDto,
  ): Promise<ResultadoImportacionDto> {
    if (!archivo) throw new BadRequestException('Falta el archivo CSV');
    return this.servicio.importar(archivo.buffer, dto.confirmar ?? false);
  }

  @Get('plantilla')
  @Roles(ROLES.recursosHumanos)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="plantilla-personas.csv"')
  @ApiOkResponse({ description: 'CSV con la cabecera y una fila de ejemplo' })
  plantilla(): string {
    return PLANTILLA_CSV;
  }
}
```

- [ ] **Step 3: Registrar en el módulo**

En `personas.module.ts` agregar los imports

```ts
import { UnidadOrganizativa } from '../estructura/entities/unidad-organizativa.entity.js';
import { ImportacionController } from './importacion/importacion.controller.js';
import { ImportacionService } from './importacion/importacion.service.js';
```

y cambiar la declaración por:

```ts
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Persona,
      Ocupacion,
      Usuario,
      Puesto,
      UnidadOrganizativa,
    ]),
    ReferenciaModule,
  ],
  controllers: [
    ImportacionController,
    PersonasController,
    OcupacionesController,
  ],
  providers: [PersonasService, OcupacionesService, ImportacionService],
  exports: [PersonasService],
})
export class PersonasModule {}
```

`ImportacionController` va primero para que `/personas/importacion` no se confunda con `/personas/:id`.

- [ ] **Step 4: Verificar compilación y cobertura de roles**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json && npx vitest run src/common/cobertura-roles.spec.ts`
Expected: sin errores de tipos; el test de cobertura incluye `importacion.controller.ts` y pasa.

- [ ] **Step 5: Escribir la prueba de integración**

Crear `importacion.service.int.spec.ts`:

```ts
import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../../testing/base-temporal.js';
import { Puesto } from '../../estructura/entities/puesto.entity.js';
import { UnidadOrganizativa } from '../../estructura/entities/unidad-organizativa.entity.js';
import { ReferenciaService } from '../../referencia/referencia.service.js';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';
import { Ocupacion } from '../entities/ocupacion.entity.js';
import { Persona } from '../entities/persona.entity.js';
import { OcupacionesService } from '../ocupaciones.service.js';
import { PersonasService } from '../personas.service.js';
import { ImportacionService } from './importacion.service.js';
import { COLUMNAS } from './tipos.js';

const fila = (v: Partial<Record<(typeof COLUMNAS)[number], string>>) =>
  COLUMNAS.map((c) => v[c] ?? '').join(';');
const csv = (...lineas: string[]) =>
  Buffer.from([COLUMNAS.join(';'), ...lineas].join('\n'), 'utf8');

describe('Importación de personas (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let servicio: ImportacionService;
  let catedra: string;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const contar = async (tabla: 'persona' | 'ocupacion') =>
    (await sql<{ n: number }[]>(`SELECT count(*)::int AS n FROM ${tabla}`))[0].n;

  const persona = (legajo: string, extra: Record<string, string> = {}) => ({
    legajo,
    apellido: 'Pérez',
    nombre: 'Ana',
    documento: `30${legajo.replace(/\D/g, '').padStart(6, '0')}`,
    fecha_nacimiento: '1980-05-20',
    fecha_ingreso: '2005-03-01',
    situacion_revista: 'Planta permanente',
    unidad: catedra,
    puesto: 'Titular',
    fecha_desde: '2020-03-01',
    caracter: 'Titular',
    dedicacion: 'Simple',
    ...extra,
  });

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    const [{ denominacion, id }] = await sql<
      { denominacion: string; id: number }[]
    >(
      `SELECT denominacion, id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
    );
    catedra = denominacion;
    for (const puesto of ['Titular', 'Jefe']) {
      await sql(
        `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
         SELECT $1, $2, $3, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'`,
        [`P-${puesto}`.slice(0, 10), puesto, id],
      );
    }
    const referencia = new ReferenciaService(ds);
    const ocupaciones = new OcupacionesService(
      ds.getRepository(Ocupacion),
      ds.getRepository(Persona),
      ds.getRepository(Puesto),
      referencia,
    );
    const personas = new PersonasService(
      ds.getRepository(Persona),
      ds.getRepository(Ocupacion),
      ds.getRepository(Usuario),
      referencia,
    );
    servicio = new ImportacionService(
      ds.getRepository(Persona),
      ds.getRepository(UnidadOrganizativa),
      ds.getRepository(Puesto),
      referencia,
      personas,
      ocupaciones,
    );
  });
  afterAll(async () => {
    await base.destruir();
  });
  afterEach(async () => {
    await sql('DELETE FROM ocupacion');
    await sql('DELETE FROM persona');
  });

  it('la vista previa no deja nada y la confirmación crea exactamente lo mismo', async () => {
    const archivo = csv(
      fila(persona('L-1')),
      fila(persona('L-1', { puesto: 'Jefe' })), // simultánea en otro puesto
      fila(persona('L-2')),
    );
    const previa = await servicio.importar(archivo, false);
    expect(previa).toMatchObject({
      importado: false,
      personas: 2,
      ocupaciones: 3,
      errores: [],
    });
    expect(await contar('persona')).toBe(0);
    expect(await contar('ocupacion')).toBe(0);

    const real = await servicio.importar(archivo, true);
    expect(real).toMatchObject({ importado: true, personas: 2, ocupaciones: 3 });
    expect(await contar('persona')).toBe(2);
    expect(await contar('ocupacion')).toBe(3);
  });

  it('un solape dentro del archivo se reporta, el resto se evalúa y no se escribe nada', async () => {
    const r = await servicio.importar(
      csv(
        fila(persona('L-1')),
        fila(persona('L-1', { fecha_desde: '2021-01-01' })), // solapa con la anterior (sin fin)
        fila(persona('L-2')),
        fila(persona('L-3', { unidad: 'No existe' })),
      ),
      true,
    );
    expect(r.importado).toBe(false);
    expect(r.errores.map((e) => e.fila)).toEqual([3, 5]);
    expect(r.errores[0].mensaje).toMatch(/ya ocupa ese puesto/);
    expect(await contar('persona')).toBe(0);
    expect(await contar('ocupacion')).toBe(0);
  });

  it('un legajo que ya existe es error y no se toca', async () => {
    await servicio.importar(csv(fila(persona('L-1'))), true);
    const r = await servicio.importar(
      csv(fila(persona('L-1', { apellido: 'Otro' }))),
      true,
    );
    expect(r.importado).toBe(false);
    expect(r.errores[0].mensaje).toMatch(/legajo L-1 ya lo tiene Pérez, Ana/);
    const [{ apellido }] = await sql<{ apellido: string }[]>(
      `SELECT apellido FROM persona WHERE legajo = 'L-1'`,
    );
    expect(apellido).toBe('Pérez');
  });

  it('dos legajos con el mismo documento: el segundo falla con "ya lo tiene", no con un 500', async () => {
    const r = await servicio.importar(
      csv(
        fila(persona('L-1')),
        fila(persona('L-2', { documento: persona('L-1').documento })),
      ),
      true,
    );
    expect(r.importado).toBe(false);
    expect(r.errores).toEqual([
      expect.objectContaining({
        fila: 3,
        mensaje: expect.stringMatching(/documento .* ya lo tiene/),
      }),
    ]);
    expect(await contar('persona')).toBe(0);
  });

  it('una persona sin ocupación se importa sola', async () => {
    const r = await servicio.importar(
      csv(
        fila(
          persona('L-1', {
            unidad: '',
            puesto: '',
            fecha_desde: '',
            caracter: '',
            dedicacion: '',
          }),
        ),
      ),
      true,
    );
    expect(r).toMatchObject({ importado: true, personas: 1, ocupaciones: 0 });
  });

  it('dos importaciones simultáneas del mismo archivo: una gana y la otra recibe errores', async () => {
    const archivo = csv(fila(persona('L-1')));
    const [a, b] = await Promise.all([
      servicio.importar(archivo, true),
      servicio.importar(archivo, true),
    ]);
    expect([a.importado, b.importado].filter(Boolean)).toHaveLength(1);
    expect(await contar('persona')).toBe(1);
  });
});
```

Nota: el seed de la base crea al menos una unidad raíz (las otras pruebas de integración la usan con `WHERE id_unidad_superior IS NULL`). Si el nivel `operativo_docente` o los códigos de puesto chocan, ajustar solo los datos del `beforeAll`.

- [ ] **Step 6: Ejecutar la integración**

Run: `docker compose up -d db && cd backend && npm run test:integracion -- src/modules/personas`
Expected: PASS, incluidas las pruebas de Personas y Ocupaciones que ya existían.

- [ ] **Step 7: Suite completa, lint, formato y commit**

```bash
cd backend && npm test && npm run lint && npm run format
git add backend/src/modules/personas
git commit -m "Exponer la importación de personas por CSV con vista previa y confirmación"
```

---

### Task 7: Frontend

**Files:**
- Modify: `frontend/src/api/esquema.d.ts` (solo con `npm run api:tipos`)
- Create: `frontend/src/features/personas/hooks/useImportarPersonas.ts`
- Create: `frontend/src/features/personas/pages/ImportarPersonasPage.tsx`
- Modify: `frontend/src/features/personas/pages/PersonasPage.tsx`
- Modify: `frontend/src/router.tsx`

**Interfaces:**
- Consumes: `POST /api/personas/importacion`, `GET /api/personas/importacion/plantilla`; tipo `Esquemas['ResultadoImportacionDto']`; `mensajeError` de `features/admin/hooks/useGuardarValor`.
- Produces: `useImportarPersonas()`, página `/personas/importar`.

- [ ] **Step 1: Regenerar los tipos**

Con el backend corriendo (`docker compose up --build -d`, porque hay dependencias nuevas):

Run: `cd frontend && npm run api:tipos`
Expected: `esquema.d.ts` incluye `ResultadoImportacionDto` y `ErrorImportacionDto` y las rutas `/api/personas/importacion`.

- [ ] **Step 2: Crear el hook**

`hooks/useImportarPersonas.ts`. Usa `fetch` directo con `FormData` (el cliente `openapi-fetch` serializa JSON); el resto de la capa de mutación sigue TanStack Query.

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';

export type ResultadoImportacion = Esquemas['ResultadoImportacionDto'];

interface Args {
  archivo: File;
  /** false: vista previa. true: importa si no hay errores. */
  confirmar: boolean;
}

/** Sube el CSV. Los errores de datos vuelven en `errores`; un rechazo del archivo lanza. */
export function useImportarPersonas() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({
      archivo,
      confirmar,
    }: Args): Promise<ResultadoImportacion> => {
      const cuerpo = new FormData();
      cuerpo.append('archivo', archivo);
      cuerpo.append('confirmar', String(confirmar));
      const respuesta = await fetch('/api/personas/importacion', {
        method: 'POST',
        body: cuerpo,
        credentials: 'include',
      });
      const datos: unknown = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        throw new Error(
          respuesta.status === 413
            ? 'El archivo supera los 2 MB'
            : mensajeError(datos),
        );
      }
      return datos as ResultadoImportacion;
    },
    onSuccess: (resultado) => {
      if (resultado.importado) {
        cliente.invalidateQueries({ queryKey: ['personas'] });
        cliente.invalidateQueries({ queryKey: ['ocupaciones'] });
      }
    },
  });
}
```

- [ ] **Step 3: Crear la página**

`pages/ImportarPersonasPage.tsx`:

```tsx
import {
  Alert,
  Button,
  CircularProgress,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import {
  useImportarPersonas,
  type ResultadoImportacion,
} from '../hooks/useImportarPersonas';

export function ImportarPersonasPage() {
  const [archivo, setArchivo] = useState<File>();
  const [resultado, setResultado] = useState<ResultadoImportacion>();
  const importar = useImportarPersonas();

  const elegir = (nuevo: File | undefined) => {
    setArchivo(nuevo);
    setResultado(undefined);
    importar.reset();
    if (nuevo) {
      importar.mutate(
        { archivo: nuevo, confirmar: false },
        { onSuccess: setResultado },
      );
    }
  };

  const confirmar = () => {
    if (!archivo) return;
    importar.mutate(
      { archivo, confirmar: true },
      { onSuccess: setResultado },
    );
  };

  const sinErrores = resultado !== undefined && resultado.errores.length === 0;

  return (
    <PaginaEnConstruccion
      titulo="Importar personas y ocupaciones"
      descripcion="Carga inicial desde un CSV: primero una vista previa sin escribir y después la confirmación (OE4)."
    >
      <Stack spacing={2}>
        <Alert severity="info">
          Solo da de alta: un legajo o documento que ya existe es un error. El
          archivo contiene datos personales; no se guarda en el sistema.{' '}
          <Link href="/api/personas/importacion/plantilla" download>
            Descargar la plantilla
          </Link>
        </Alert>

        <Button variant="outlined" component="label" sx={{ alignSelf: 'start' }}>
          {archivo ? `Archivo: ${archivo.name}` : 'Elegir archivo CSV'}
          <input
            hidden
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              elegir(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </Button>

        {importar.isPending && <CircularProgress aria-label="Procesando" />}
        {importar.isError && (
          <Alert severity="error">{importar.error.message}</Alert>
        )}

        {resultado?.importado && (
          <Alert severity="success">
            Importadas {resultado.personas} personas y {resultado.ocupaciones}{' '}
            ocupaciones.{' '}
            <Link component={RouterLink} to="/personas">
              Ir a Personas
            </Link>
          </Alert>
        )}

        {resultado && !resultado.importado && (
          <>
            {sinErrores ? (
              <Alert severity="success">
                {resultado.filas} filas leídas, sin errores. Se crearían{' '}
                {resultado.personas} personas y {resultado.ocupaciones}{' '}
                ocupaciones.
              </Alert>
            ) : (
              <Alert severity="error">
                {resultado.errores.length} errores en {resultado.filas} filas.
                No se escribió nada: corregí el archivo y elegilo de nuevo.
              </Alert>
            )}
            {!sinErrores && (
              <Table size="small" aria-label="Errores de la importación">
                <TableHead>
                  <TableRow>
                    <TableCell>Fila</TableCell>
                    <TableCell>Columna</TableCell>
                    <TableCell>Error</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {resultado.errores.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.fila}</TableCell>
                      <TableCell>{e.columna ?? '—'}</TableCell>
                      <TableCell>{e.mensaje}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                disabled={!sinErrores || importar.isPending}
                onClick={confirmar}
              >
                Importar
              </Button>
            </Stack>
            {sinErrores && (
              <Typography variant="caption">
                Al importar se vuelve a validar todo el archivo; si algo cambió
                desde la vista previa, no se escribe nada y se muestran los
                nuevos errores.
              </Typography>
            )}
          </>
        )}
      </Stack>
    </PaginaEnConstruccion>
  );
}
```

Nota: si tras confirmar el servidor devuelve errores, `setResultado` los muestra en el mismo paso 2 (el botón queda deshabilitado) y no se escribió nada.

- [ ] **Step 4: Ruta y botón de entrada**

En `router.tsx`, agregar el import

```tsx
import { ImportarPersonasPage } from './features/personas/pages/ImportarPersonasPage';
```

y, antes de `{ path: 'personas/yo', … }`, la ruta:

```tsx
      {
        path: 'personas/importar',
        element: (
          <RutaProtegida roles={['recursos_humanos']}>
            <ImportarPersonasPage />
          </RutaProtegida>
        ),
      },
```

En `PersonasPage.tsx` importar `Button` de MUI y `Link as RouterLink` de `react-router`, y debajo del `<ListaPersonas … />` (dentro del primer `<Box>`), agregar:

```tsx
          {puedeEditar && (
            <Button component={RouterLink} to="/personas/importar" sx={{ mt: 1 }}>
              Importar CSV
            </Button>
          )}
```

(`puedeEditar` ya es `sesion?.rol === 'recursos_humanos'`.)

- [ ] **Step 5: Compilar, lint y formato**

Run: `cd frontend && npm run build && npm run lint && npm run format`
Expected: sin errores de tipos ni de lint.

- [ ] **Step 6: Validar el flujo en la aplicación**

Con `docker compose up --build`, iniciar sesión como `recursos_humanos` y recorrer, con un CSV armado desde la plantilla:

1. Descargar la plantilla desde el enlace y verificar que abre en Excel con tildes correctas.
2. Elegir un CSV válido: aparece "sin errores" y el botón Importar se habilita. Verificar que en Personas todavía no hay nada nuevo.
3. Importar: aparece el mensaje de éxito y las personas figuran en `/personas` con sus ocupaciones.
4. Elegir un CSV con una fila con la unidad mal escrita y otra con un solape: la tabla lista ambas filas con su columna y el botón queda deshabilitado.
5. Reimportar el mismo CSV ya importado: todos los legajos dan error "ya lo tiene".
6. Un archivo con una columna mal nombrada: mensaje de error de archivo, sin tabla.
7. Con un usuario que no es `recursos_humanos`, `/personas/importar` muestra el aviso de permiso y el botón no aparece en Personas.

- [ ] **Step 7: Commit**

```bash
git add frontend
git commit -m "Agregar la pantalla de importación de personas con vista previa y confirmación"
```

---

### Task 8: Documentación y cierre

**Files:**
- Modify: `README.md` (sección "Personas y ocupaciones", ~línea 84-91)
- Modify: `docs/requerimientos.md` (§5, párrafo "**Personas:**", ~línea 116)
- Modify: `docs/superpowers/specs/2026-10-13-personas-ocupaciones-design.md` (sección "Fuera de alcance")
- Modify: `docs/superpowers/specs/2026-10-14-importacion-csv-personas-design.md` (línea de estado)
- Modify: `docs/superpowers/plans/2026-10-14-importacion-csv-personas.md` (línea de estado)

- [ ] **Step 1: README**

En `README.md`, al final de la sección "## Personas y ocupaciones" (después de la viñeta de `btree_gist`), agregar:

```markdown
### Importación desde CSV

- Recursos Humanos puede cargar personas y ocupaciones de una vez desde **Personas → Importar CSV** (`/personas/importar`). Es una carga inicial: solo da de alta; un legajo o documento ya existente es un error.
- Descargá la plantilla desde esa pantalla. El archivo tiene una fila por ocupación; las filas con el mismo `legajo` son la misma persona y deben traer los mismos datos personales. Una fila sin `unidad`, `puesto`, `fecha_desde`, `caracter` ni `dedicacion` registra a la persona sin ocupación.
- Columnas (todas deben estar en la cabecera): `legajo`, `apellido`, `nombre`, `documento`, `fecha_nacimiento`, `fecha_ingreso`, `situacion_revista`, `fecha_prevista_retiro`, `unidad`, `puesto`, `fecha_desde`, `fecha_hasta`, `caracter`, `dedicacion`. Fechas `AAAA-MM-DD` o `DD/MM/AAAA`; separador `;` o `,`; UTF-8.
- `situacion_revista`, `caracter` y `dedicacion` se escriben como la denominación de la tabla de referencia; `unidad` y `puesto`, como las denominaciones de la estructura (si una unidad se repite en ramas distintas, el error lista las candidatas).
- Primero se muestra una vista previa sin escribir nada; al confirmar se valida todo de nuevo y se importa todo o nada. Máximo 2 MB y 2000 filas.
- El CSV contiene datos personales (Ley 25.326, RNF02): el sistema no lo guarda, pero su custodia y su borrado después de la carga son responsabilidad de Recursos Humanos.
```

- [ ] **Step 2: Requerimientos**

En `docs/requerimientos.md` §5, al final del párrafo que empieza con `**Personas:**`, agregar la oración: ` La carga inicial masiva desde CSV (apoyo a OE4) está en \`docs/superpowers/specs/2026-10-14-importacion-csv-personas-design.md\`.`

- [ ] **Step 3: Spec de Personas**

En la sección "Fuera de alcance" de `2026-10-13-personas-ocupaciones-design.md`, reemplazar `la importación masiva de personas y la auditoría de cambios.` por `la auditoría de cambios. La importación masiva de personas se especifica en \`2026-10-14-importacion-csv-personas-design.md\`.`

- [ ] **Step 4: Verificación final**

```bash
cd backend && npm test && npm run test:integracion && npm run lint && npm run format
cd ../frontend && npm run build && npm run lint && npm run format
```

Expected: todo en verde. Revisar `git status`: sin cambios sin commitear fuera de los de esta tarea (en particular, `esquema.d.ts` regenerado ya está commiteado desde la Tarea 7).

- [ ] **Step 5: Estados y commit**

Cambiar la primera línea de la spec a `Estado: Implementada | Fecha: 2026-10-14 | Autor: IvanOchoa229` y la del plan a `Estado: Implementado | Fecha: 2026-10-14 | PR: #<número>` (completar con el PR cuando exista).

```bash
git add README.md docs
git commit -m "Documentar la importación por CSV y marcar la spec y el plan como implementados"
```
