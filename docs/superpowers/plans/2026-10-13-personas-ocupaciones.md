Estado: En curso | Fecha: 2026-10-13 | PR: —

# Personas y ocupaciones: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** que Recursos Humanos gestione las personas del departamento (RF06) y sus ocupaciones de puestos con vigencia, carácter y dedicación, incluidas las simultáneas y el historial (RF07); que el administrador vincule cada usuario con su persona; y que la baja de un puesto o de una persona quede bloqueada mientras tengan ocupaciones abiertas.

**Arquitectura:** el módulo `personas` suma las entidades `Persona` y `Ocupacion`, dos dominios de referencia (`situacion_revista`, `dedicacion`), `PersonasService` y `OcupacionesService`. El solapamiento de ocupaciones lo impide una restricción de exclusión de PostgreSQL (`btree_gist`); los servicios validan antes para dar mensajes legibles y traducen el error de la base como respaldo. Las escrituras toman el mismo bloqueo consultivo que Estructura (7002), así que un alta de ocupación y una baja de puesto o de persona no pueden cruzarse. `PuestosService` y `UsuariosService` consumen al módulo nuevo.

**Tech Stack:** NestJS 12, TypeORM 0.3, PostgreSQL 16 (`btree_gist`), class-validator, vitest, React 19, MUI, TanStack Query, react-hook-form, zod.

**Spec:** `docs/superpowers/specs/2026-10-13-personas-ocupaciones-design.md`. Antes de empezar, leer también `docs/requerimientos.md` §5 y §6 y las specs de Usuarios y Estructura.

## Global Constraints

- Nombres de dominio y de código en español; snake_case en la base y camelCase en el código (`SnakeNamingStrategy`).
- Imports ESM con extensión `.js` (`'./persona.entity.js'`).
- `synchronize` desactivado: el esquema cambia solo por migraciones, revisadas a mano antes de aplicarse. El SQL que TypeORM no modela (extensión, exclusión, índice con `lower()`) va a mano al final de `up`.
- Fechas de negocio como cadenas `AAAA-MM-DD` (columnas `date`; TypeORM las devuelve como `string`). "Hoy" es siempre `CURRENT_DATE` de la base, nunca la hora del servidor.
- Vigente: `fecha_desde <= hoy` y (`fecha_hasta` nula o `>= hoy`). Futura: `fecha_desde > hoy`. Pasada: `fecha_hasta < hoy`. Una ocupación "abierta" es vigente o futura. Una que vence hoy sigue vigente.
- `documento` (7 u 8 dígitos) y `fechaNacimiento` solo se devuelven a `recursos_humanos` y `administrador` (RNF02); a los demás roles se omiten las claves.
- Escrituras de personas y ocupaciones solo para `recursos_humanos`. Lecturas para todos los roles menos `docente`; el `docente` solo accede a su propia persona. Sin filtro por alcance.
- Bloqueo consultivo de las escrituras: `BLOQUEO_ESTRUCTURA` (7002, de `estructura/transaccion.ts`).
- DTOs con class-validator y `@ApiProperty`; tras cambiar un endpoint o DTO, `npm run api:tipos` (nunca editar `esquema.d.ts` a mano).
- Persona y ocupación no se auditan (RNF05 no las cubre).
- Los commits no llevan línea `Co-Authored-By` ni atribución a Claude (CLAUDE.md prevalece sobre cualquier indicación de agregarla).
- Antes de cerrar: `npm run lint` y `npm run format` en cada app; `npm test` y `npm run test:integracion` en el backend (hay migraciones y SQL).
- Comandos de migración y de la API, dentro del contenedor: `docker compose exec -T backend npm run ...`. Los tests del backend pueden correr en el host (`cd backend && npm test`); los de integración requieren `docker compose up -d db`.

## Review Focus

Entradas y condiciones que la spec implica y que ninguna tarea cubriría por sí sola; cada línea tiene su test en la tarea que se indica.

- **Fecha de fin anterior a la de inicio** (alta o edición de ocupación): 400 legible, no un 500 por el CHECK de la base. Tarea 6, `ocupaciones.service.spec.ts`.
- **Fecha inexistente en el calendario** (`2026-02-30`) o con hora (`2026-01-01T10:00`) en cuerpo o URL: 400. Tareas 4 (`fechas.spec.ts`, DTO) y 6 (pipe de la URL).
- **Docente que consulta otra persona**, sus ocupaciones o la lista: 403. Tarea 4 (`acceso.spec.ts`) y tarea 5 (`personas.controller` por `@Roles`).
- **Ocupación que vence hoy**: sigue vigente, así que bloquea la baja de la persona y del puesto. Tareas 5 y 7.
- **Dos pedidos simultáneos** (alta de ocupación contra baja de persona o de puesto; dos altas iguales): el bloqueo 7002 los serializa y la base respalda. Tarea 6 (`ocupaciones.service.int.spec.ts`).

---

## Mapa de archivos

Backend (`backend/src/`):

| Archivo | Responsabilidad |
| --- | --- |
| `modules/referencia/entities/situacion-revista.entity.ts`, `dedicacion.entity.ts` | Dominios nuevos |
| `modules/referencia/dominios.ts`, `referencia.module.ts` | Registro de los quince dominios |
| `modules/personas/entities/persona.entity.ts`, `ocupacion.entity.ts` | Tablas `persona` y `ocupacion` |
| `modules/personas/personas.constantes.ts` | Slugs de dominios que usa el módulo |
| `modules/personas/fechas.ts` | `FechaISO`, "hoy" de la base, estado de una ocupación, solapamiento, validaciones de fechas |
| `modules/personas/acceso.ts` | Regla "el docente solo ve su persona" |
| `modules/personas/transaccion.ts` | Transacción con bloqueo 7002 y traducción de errores de la base a 409 |
| `modules/personas/fecha.pipe.ts` | Pipe para el segmento `:fechaDesde` de la URL |
| `modules/personas/dto/*.ts` | DTOs de entrada y salida |
| `modules/personas/persona.mapper.ts`, `ocupacion.mapper.ts` | Entidad → DTO (omite datos personales según el rol) |
| `modules/personas/personas.service.ts`, `ocupaciones.service.ts` | Reglas de negocio |
| `modules/personas/personas.controller.ts`, `ocupaciones.controller.ts`, `personas.module.ts` | HTTP y módulo |
| `common/roles.ts`, `common/like.ts` | Grupos de roles nuevos; `escaparLike` compartido |
| `modules/estructura/puestos.service.ts` | Baja bloqueada por ocupaciones |
| `modules/usuarios/entities/usuario.entity.ts`, `usuarios.service.ts`, `usuarios.module.ts` | FK y validación de `idPersona` |
| `infra/database/migrations/*` | Tres migraciones |
| `infra/database/personas.int.spec.ts`, `fk-usuario-persona.int.spec.ts` | Pruebas del esquema |

Frontend (`frontend/src/`): `features/personas/{hooks,components,pages}`, `auth/permisos.ts`, `router.tsx`, `features/admin/components/FormularioUsuario.tsx`, `features/estructura/components/{TablaPuestos,OcupantesPuestoDialog}.tsx`.

---

## Tarea 1: Dominios de referencia `situacion_revista` y `dedicacion`

**Files:**
- Create: `backend/src/modules/referencia/entities/situacion-revista.entity.ts`
- Create: `backend/src/modules/referencia/entities/dedicacion.entity.ts`
- Modify: `backend/src/modules/referencia/dominios.ts`
- Modify: `backend/src/modules/referencia/dominios.spec.ts`
- Modify: `backend/src/modules/referencia/referencia.module.ts`
- Create: `backend/src/infra/database/migrations/<timestamp>-CrearReferenciaPersonas.ts` (lo genera TypeORM)

**Interfaces:**
- Produces: dominios `situacion-revista` (simple) y `dedicacion` (ordinal) en `DOMINIOS`; tablas `situacion_revista(id_situacion_revista, codigo, denominacion, activo)` y `dedicacion(id_dedicacion, codigo, denominacion, activo, orden)` con sus valores iniciales.

- [x] **Paso 1: Actualizar el test de dominios**

En `dominios.spec.ts`, cambiar el título `define los trece dominios cerrados` por `define los quince dominios cerrados` y las tres apariciones de `13` por `15` (líneas 9, 13 y 14). Agregar dentro del mismo `describe`:

```ts
  it('incluye los dominios de personas', () => {
    const porSlug = new Map(DOMINIOS.map((d) => [d.slug, d]));
    expect(porSlug.get('situacion-revista')).toMatchObject({
      tabla: 'situacion_revista',
      ordinal: false,
    });
    expect(porSlug.get('dedicacion')).toMatchObject({
      tabla: 'dedicacion',
      ordinal: true,
    });
  });
```

- [x] **Paso 2: Verificar que falla**

Run: `cd backend && npx vitest run src/modules/referencia/dominios.spec.ts`
Expected: FAIL (`expected 13 to have a length of 15`).

- [x] **Paso 3: Crear las dos entidades**

`situacion-revista.entity.ts`:

```ts
import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('situacion_revista')
export class SituacionRevista extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_situacion_revista' })
  id: number;
}
```

`dedicacion.entity.ts`:

```ts
import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferenciaOrdinal } from './valor-referencia.base.js';

@Entity('dedicacion')
export class Dedicacion extends ValorReferenciaOrdinal {
  @PrimaryGeneratedColumn({ name: 'id_dedicacion' })
  id: number;
}
```

- [x] **Paso 4: Registrar los dominios y las entidades**

En `dominios.ts`: agregar los imports

```ts
import { SituacionRevista } from './entities/situacion-revista.entity.js';
import { Dedicacion } from './entities/dedicacion.entity.js';
```

cambiar el comentario `/** Los trece dominios cerrados del modelo (RF23). */` por `/** Los quince dominios cerrados del modelo (RF23). */` y agregar al final del arreglo `DOMINIOS` (después de `tipo-relacion-contractual`):

```ts
  {
    slug: 'situacion-revista',
    denominacion: 'Situación de revista',
    tabla: 'situacion_revista',
    ordinal: false,
    entidad: SituacionRevista,
  },
  {
    slug: 'dedicacion',
    denominacion: 'Dedicación',
    tabla: 'dedicacion',
    ordinal: true,
    entidad: Dedicacion,
  },
```

En `referencia.module.ts`: importar `SituacionRevista` y `Dedicacion` y sumarlos a la lista de `TypeOrmModule.forFeature([...])` (después de `TipoRelacionContractual`).

- [x] **Paso 5: Verificar que pasa**

Run: `cd backend && npx vitest run src/modules/referencia`
Expected: PASS.

- [x] **Paso 6: Generar la migración**

```bash
docker compose exec -T backend npm run migration:run
docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/CrearReferenciaPersonas
```

Revisar el archivo generado: debe crear solo `situacion_revista` y `dedicacion` (con `UNIQUE` de `codigo`, `denominacion` y, en `dedicacion`, de `orden`); `down` debe borrarlas. Si propone otras tablas, detenerse.

- [x] **Paso 7: Cargar los valores iniciales**

En la migración generada, arriba de la clase (después del import) agregar:

```ts
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
```

y al final de `up` (después de los `CREATE TABLE` generados):

```ts
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
```

- [x] **Paso 8: Aplicar, revertir y reaplicar**

```bash
docker compose exec -T backend npm run migration:run
docker compose exec -T backend npm run migration:revert
docker compose exec -T backend npm run migration:run
```

Expected: sin errores en los tres. El paso 6 solo generó el archivo, así que el primer `run` aplica la nueva migración; `revert` deshace solo la última aplicada (verificar con `docker compose exec -T backend npm run migration:show` que es `CrearReferenciaPersonas`).

- [x] **Paso 9: Lint, formato, tests y commit**

```bash
cd backend && npm run lint && npm run format && npm test
git add backend/src
git commit -m "Agregar los dominios situación de revista y dedicación"
```

---

## Tarea 2: Esquema de `persona` y `ocupacion`

**Files:**
- Create: `backend/src/modules/personas/entities/persona.entity.ts`
- Create: `backend/src/modules/personas/entities/ocupacion.entity.ts`
- Modify: `backend/src/modules/personas/personas.module.ts` (registro de entidades; los servicios llegan después)
- Create: `backend/src/infra/database/migrations/<timestamp>-CrearPersonasYOcupaciones.ts` (generada y completada)
- Test: `backend/src/infra/database/personas.int.spec.ts`

**Interfaces:**
- Consumes: `SituacionRevista`, `Dedicacion`, `CaracterOcupacion` (referencia), `Puesto` (estructura).
- Produces: `Persona` (`id, legajo, apellido, nombre, documento, fechaNacimiento, idSituacionRevista, situacionRevista, fechaIngreso, fechaPrevistaRetiro, activo`) y `Ocupacion` (`idPersona, idPuesto, fechaDesde` como clave; `fechaHasta, idCaracterOcupacion, idDedicacion` y las relaciones `persona, puesto, caracterOcupacion, dedicacion`). Restricciones con nombre: `CK_persona_documento`, `CK_persona_ingreso_posterior_a_nacimiento`, `CK_persona_retiro_desde_ingreso`, `CK_ocupacion_fechas`, `EX_ocupacion_sin_solape`.

- [x] **Paso 1: Escribir el test de integración del esquema**

`backend/src/infra/database/personas.int.spec.ts`:

```ts
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';

interface ErrorDeBase {
  code: string;
  constraint?: string;
  detail?: string;
}

describe('esquema de personas y ocupaciones', () => {
  let base: BaseTemporal;
  let revista: number;
  let caracter: number;
  let dedicacion: number;
  let puestoA: number;
  let puestoB: number;

  const sql = <T = unknown>(consulta: string, parametros?: unknown[]) =>
    base.dataSource.query(consulta, parametros) as Promise<T>;

  /** Código, restricción y detalle del error de PostgreSQL (no dependen del idioma). */
  const fallo = async (promesa: Promise<unknown>): Promise<ErrorDeBase> => {
    try {
      await promesa;
    } catch (e) {
      return (e as { driverError: ErrorDeBase }).driverError;
    }
    throw new Error('Se esperaba que la base rechazara la operación');
  };

  const persona = async (
    legajo: string,
    documento: string,
    extra: { nacimiento?: string; ingreso?: string; retiro?: string | null } = {},
  ) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista, fecha_prevista_retiro)
         VALUES ($1, 'Pérez', 'Ana', $2, $3, $4, $5, $6) RETURNING id_persona AS id`,
        [
          legajo,
          documento,
          extra.nacimiento ?? '1980-01-01',
          extra.ingreso ?? '2005-03-01',
          revista,
          extra.retiro ?? null,
        ],
      )
    )[0].id;

  const ocupar = (
    idPersona: number,
    idPuesto: number,
    desde: string,
    hasta: string | null = null,
  ) =>
    sql(
      `INSERT INTO ocupacion (id_persona, id_puesto, fecha_desde, fecha_hasta, id_caracter_ocupacion, id_dedicacion)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [idPersona, idPuesto, desde, hasta, caracter, dedicacion],
    );

  const puesto = async (codigo: string, idUnidad: number) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
         SELECT $1, $1, $2, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
         RETURNING id_puesto AS id`,
        [codigo, idUnidad],
      )
    )[0].id;

  beforeAll(async () => {
    base = await crearBaseTemporal();
    revista = (
      await sql<{ id: number }[]>(
        `SELECT id_situacion_revista AS id FROM situacion_revista WHERE codigo = 'planta_permanente'`,
      )
    )[0].id;
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
    const [{ id: departamento }] = await sql<{ id: number }[]>(
      `SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
    );
    puestoA = await puesto('T-A', departamento);
    puestoB = await puesto('T-B', departamento);
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('carga los valores iniciales de los dominios nuevos', async () => {
    const revistas = await sql<{ codigo: string }[]>(
      'SELECT codigo FROM situacion_revista ORDER BY codigo',
    );
    expect(revistas.map((r) => r.codigo)).toEqual([
      'ad_honorem',
      'contratado',
      'licencia',
      'planta_permanente',
    ]);
    const dedicaciones = await sql<{ codigo: string; orden: number }[]>(
      'SELECT codigo, orden FROM dedicacion ORDER BY orden',
    );
    expect(dedicaciones.map((d) => [d.codigo, d.orden])).toEqual([
      ['simple', 1],
      ['semiexclusiva', 2],
      ['exclusiva', 3],
    ]);
  });

  describe('persona', () => {
    it('acepta una persona completa y una sin fecha de retiro', async () => {
      await persona('L-1', '30111111');
      await persona('L-2', '3011112', { retiro: '2040-12-31' });
    });

    it('rechaza un documento que no tiene 7 u 8 dígitos', async () => {
      // Los de más de 8 caracteres ni llegan al CHECK: la columna es varchar(8).
      for (const documento of ['123456', '3011A111', '30.1111']) {
        const error = await fallo(persona(`L-${documento}`, documento));
        expect(error).toMatchObject({
          code: '23514',
          constraint: 'CK_persona_documento',
        });
      }
    });

    it('rechaza legajo y documento repetidos', async () => {
      await persona('L-3', '30333333');
      const legajo = await fallo(persona('L-3', '30333334'));
      expect(legajo.code).toBe('23505');
      expect(legajo.detail).toContain('(legajo)');
      const documento = await fallo(persona('L-4', '30333333'));
      expect(documento.code).toBe('23505');
      expect(documento.detail).toContain('(documento)');
    });

    it('rechaza un ingreso que no es posterior al nacimiento', async () => {
      const error = await fallo(
        persona('L-5', '30555555', {
          nacimiento: '2000-01-01',
          ingreso: '2000-01-01',
        }),
      );
      expect(error.constraint).toBe('CK_persona_ingreso_posterior_a_nacimiento');
    });

    it('rechaza un retiro anterior al ingreso pero acepta el mismo día', async () => {
      const error = await fallo(
        persona('L-6', '30666666', { ingreso: '2010-05-01', retiro: '2010-04-30' }),
      );
      expect(error.constraint).toBe('CK_persona_retiro_desde_ingreso');
      await persona('L-7', '30777777', {
        ingreso: '2010-05-01',
        retiro: '2010-05-01',
      });
    });
  });

  describe('ocupacion', () => {
    it('rechaza una fecha de fin anterior a la de inicio', async () => {
      const id = await persona('O-1', '40111111');
      const error = await fallo(ocupar(id, puestoA, '2024-05-10', '2024-05-09'));
      expect(error.constraint).toBe('CK_ocupacion_fechas');
    });

    it('rechaza el solape de la misma persona en el mismo puesto', async () => {
      const id = await persona('O-2', '40222222');
      await ocupar(id, puestoA, '2024-01-01', '2024-06-30');
      const error = await fallo(ocupar(id, puestoA, '2024-06-30', '2024-12-31'));
      expect(error).toMatchObject({
        code: '23P01',
        constraint: 'EX_ocupacion_sin_solape',
      });
    });

    it('permite fechas adyacentes: se cierra un día y se abre al siguiente', async () => {
      const id = await persona('O-3', '40333333');
      await ocupar(id, puestoA, '2024-01-01', '2024-06-30');
      await ocupar(id, puestoA, '2024-07-01');
    });

    it('trata el fin nulo como abierto: solapa con cualquier ocupación posterior', async () => {
      const id = await persona('O-4', '40444444');
      await ocupar(id, puestoA, '2024-01-01');
      const error = await fallo(ocupar(id, puestoA, '2030-01-01', '2030-02-01'));
      expect(error.code).toBe('23P01');
    });

    it('permite ocupaciones simultáneas en puestos distintos', async () => {
      const id = await persona('O-5', '40555555');
      await ocupar(id, puestoA, '2024-01-01');
      await ocupar(id, puestoB, '2024-01-01');
    });

    it('permite que otra persona ocupe el mismo puesto en las mismas fechas', async () => {
      const uno = await persona('O-6', '40666666');
      const otro = await persona('O-7', '40777777');
      await ocupar(uno, puestoA, '2024-01-01');
      await ocupar(otro, puestoA, '2024-01-01');
    });

    it('rechaza dos ocupaciones que empiezan el mismo día', async () => {
      const id = await persona('O-8', '40888888');
      await ocupar(id, puestoA, '2024-01-01', '2024-01-31');
      const error = await fallo(ocupar(id, puestoA, '2024-01-01', '2024-01-15'));
      expect(['23505', '23P01']).toContain(error.code);
    });

    it('no permite borrar una persona ni un puesto con ocupaciones', async () => {
      const id = await persona('O-9', '40999999');
      await ocupar(id, puestoB, '2020-01-01', '2020-12-31');
      expect((await fallo(sql('DELETE FROM persona WHERE id_persona = $1', [id]))).code).toBe('23503');
      expect((await fallo(sql('DELETE FROM puesto WHERE id_puesto = $1', [puestoB]))).code).toBe('23503');
    });
  });
});
```

- [x] **Paso 2: Verificar que falla**

Run: `cd backend && npm run test:integracion -- src/infra/database/personas.int.spec.ts`
Expected: FAIL (`relation "persona" does not exist`).

- [x] **Paso 3: Crear las entidades**

`persona.entity.ts`:

```ts
import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { SituacionRevista } from '../../referencia/entities/situacion-revista.entity.js';

/**
 * Persona del departamento (RF06). Las fechas son `AAAA-MM-DD`. El índice por
 * `lower(apellido), lower(nombre)` se crea en la migración y no está declarado acá.
 */
@Entity('persona')
@Check('CK_persona_documento', `"documento" ~ '^[0-9]{7,8}$'`)
@Check(
  'CK_persona_ingreso_posterior_a_nacimiento',
  '"fecha_ingreso" > "fecha_nacimiento"',
)
@Check(
  'CK_persona_retiro_desde_ingreso',
  '"fecha_prevista_retiro" IS NULL OR "fecha_prevista_retiro" >= "fecha_ingreso"',
)
export class Persona {
  @PrimaryGeneratedColumn({ name: 'id_persona' })
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  legajo: string;

  @Column({ type: 'varchar', length: 100 })
  apellido: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  /** DNI de 7 u 8 dígitos. Dato personal: solo lo ven RR. HH. y el administrador. */
  @Column({ type: 'varchar', length: 8, unique: true })
  documento: string;

  @Column({ type: 'date' })
  fechaNacimiento: string;

  @Column({ type: 'date' })
  fechaIngreso: string;

  @Column({ name: 'id_situacion_revista', type: 'int' })
  idSituacionRevista: number;

  @ManyToOne(() => SituacionRevista, { nullable: false })
  @JoinColumn({ name: 'id_situacion_revista' })
  situacionRevista: Relation<SituacionRevista>;

  @Column({ type: 'date', nullable: true })
  fechaPrevistaRetiro: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
```

`ocupacion.entity.ts`:

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
import { Puesto } from '../../estructura/entities/puesto.entity.js';
import { CaracterOcupacion } from '../../referencia/entities/caracter-ocupacion.entity.js';
import { Dedicacion } from '../../referencia/entities/dedicacion.entity.js';
import { Persona } from './persona.entity.js';

/**
 * Vínculo persona-puesto con vigencia (RF07). La restricción de exclusión
 * `EX_ocupacion_sin_solape` (misma persona, mismo puesto, rangos que se
 * solapan) se crea en la migración y no está declarada acá. Las fechas son
 * `AAAA-MM-DD`; `fechaHasta` nula significa sin fin.
 */
@Entity('ocupacion')
@Check('CK_ocupacion_fechas', '"fecha_hasta" IS NULL OR "fecha_hasta" >= "fecha_desde"')
@Index('IDX_ocupacion_puesto', ['idPuesto'])
export class Ocupacion {
  @PrimaryColumn({ name: 'id_persona', type: 'int' })
  idPersona: number;

  @PrimaryColumn({ name: 'id_puesto', type: 'int' })
  idPuesto: number;

  @PrimaryColumn({ type: 'date' })
  fechaDesde: string;

  @Column({ type: 'date', nullable: true })
  fechaHasta: string | null;

  @Column({ name: 'id_caracter_ocupacion', type: 'int' })
  idCaracterOcupacion: number;

  @Column({ name: 'id_dedicacion', type: 'int' })
  idDedicacion: number;

  @ManyToOne(() => Persona, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_persona' })
  persona: Relation<Persona>;

  @ManyToOne(() => Puesto, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_puesto' })
  puesto: Relation<Puesto>;

  @ManyToOne(() => CaracterOcupacion, { nullable: false })
  @JoinColumn({ name: 'id_caracter_ocupacion' })
  caracterOcupacion: Relation<CaracterOcupacion>;

  @ManyToOne(() => Dedicacion, { nullable: false })
  @JoinColumn({ name: 'id_dedicacion' })
  dedicacion: Relation<Dedicacion>;
}
```

En `personas.module.ts`, registrar las entidades para que `autoLoadEntities` las cargue:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ocupacion } from './entities/ocupacion.entity.js';
import { Persona } from './entities/persona.entity.js';

/** Personas y ocupaciones (RF06–RF07). */
@Module({
  imports: [TypeOrmModule.forFeature([Persona, Ocupacion])],
})
export class PersonasModule {}
```

- [x] **Paso 4: Generar la migración**

```bash
docker compose exec -T backend npm run migration:run
docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/CrearPersonasYOcupaciones
```

Revisar el archivo: debe crear solo `persona` y `ocupacion` con sus claves foráneas, los `UNIQUE` de `legajo` y `documento`, los cuatro `CHECK`, la clave primaria compuesta y el índice `IDX_ocupacion_puesto`; `down` debe eliminarlos. Si propone otras tablas, detenerse.

- [x] **Paso 5: Completar la migración con el SQL manual**

Al final de `up` (después de las sentencias generadas) agregar:

```ts
    // Lo que sigue no se puede declarar en las entidades. Si `migration:generate`
    // propone borrar IDX_persona_apellido_nombre o EX_ocupacion_sin_solape,
    // ver el paso 9 de esta tarea.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    await queryRunner.query(
      `CREATE INDEX "IDX_persona_apellido_nombre" ON "persona" (lower("apellido"), lower("nombre"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "ocupacion" ADD CONSTRAINT "EX_ocupacion_sin_solape" EXCLUDE USING gist ("id_persona" WITH =, "id_puesto" WITH =, daterange("fecha_desde", "fecha_hasta", '[]') WITH &&)`,
    );
```

Al principio de `down` (antes de las sentencias generadas) agregar:

```ts
    await queryRunner.query(
      `ALTER TABLE "ocupacion" DROP CONSTRAINT "EX_ocupacion_sin_solape"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_persona_apellido_nombre"`);
    // La extensión btree_gist se deja instalada: la base puede usarla otra migración.
```

- [x] **Paso 6: Aplicar, revertir y reaplicar**

```bash
docker compose exec -T backend npm run migration:run
docker compose exec -T backend npm run migration:revert
docker compose exec -T backend npm run migration:run
```

Expected: sin errores en los tres. Si `CREATE EXTENSION` falla por permisos, el usuario de la base no puede crearla: ver el riesgo de la spec y detenerse.

- [x] **Paso 7: Verificar que el test pasa**

Run: `cd backend && npm run test:integracion -- src/infra/database/personas.int.spec.ts`
Expected: PASS. Si el caso "dos ocupaciones que empiezan el mismo día" falla por otro código, ajustar el arreglo esperado en el test, no la migración.

- [x] **Paso 8: Sondear que `migration:generate` no propone cambios inesperados**

```bash
docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/SondaBorrar
```

Expected: "No changes in database schema were found", o un archivo cuyo único contenido sea `DROP INDEX "IDX_persona_apellido_nombre"` y/o `DROP CONSTRAINT "EX_ocupacion_sin_solape"`. Borrar el archivo `*-SondaBorrar.ts` si se generó. Cualquier otra diferencia indica que las entidades y la migración no coinciden: corregir antes de seguir.

- [x] **Paso 9: Si la sonda propuso borrar la exclusión o el índice**

Es una limitación de TypeORM con lo que no modela. Declarar la exclusión en la entidad evita el ruido: en `ocupacion.entity.ts` importar `Exclusion` de `typeorm` y agregar sobre la clase

```ts
@Exclusion(
  'EX_ocupacion_sin_solape',
  `USING gist ("id_persona" WITH =, "id_puesto" WITH =, daterange("fecha_desde", "fecha_hasta", '[]') WITH &&)`,
)
```

y repetir el paso 8. Si aun así propone cambios sobre la exclusión, dejar la declaración, documentar en el comentario de la entidad que la sonda puede mostrar ese `DROP` y no aplicarlo. El índice con `lower()` se trata igual que los de Estructura: ignorar su `DROP` en la sonda.

- [x] **Paso 10: Lint, formato y commit**

```bash
cd backend && npm run lint && npm run format && npm test
git add backend/src
git commit -m "Crear las tablas persona y ocupacion con exclusión de solapes"
```

---

## Tarea 3: FK `usuario.id_persona → persona`

**Files:**
- Modify: `backend/src/modules/usuarios/entities/usuario.entity.ts`
- Create: `backend/src/infra/database/migrations/<timestamp>-AgregarFkUsuarioPersona.ts` (generada y completada)
- Test: `backend/src/infra/database/fk-usuario-persona.int.spec.ts`

**Interfaces:**
- Consumes: `Persona` (tarea 2).
- Produces: FK con `ON DELETE RESTRICT`; la migración aborta y lista los `id_persona` huérfanos.

- [x] **Paso 1: Escribir el test**

`backend/src/infra/database/fk-usuario-persona.int.spec.ts`:

```ts
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';

describe('FK usuario.id_persona → persona', () => {
  let base: BaseTemporal | undefined;
  afterEach(async () => {
    await base?.destruir();
    base = undefined;
  });

  const crearUsuario = (
    b: BaseTemporal,
    nombre: string,
    idPersona: number | null,
  ) =>
    b.dataSource.query(
      `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol, id_persona)
       SELECT $1, 'x', id_rol, $2 FROM rol WHERE codigo = 'docente'`,
      [nombre, idPersona],
    );

  const crearPersona = async (b: BaseTemporal) =>
    (
      await b.dataSource.query(
        `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
         SELECT 'L-1', 'Pérez', 'Ana', '30111111', '1980-01-01', '2005-03-01', id_situacion_revista
         FROM situacion_revista WHERE codigo = 'planta_permanente'
         RETURNING id_persona AS id`,
      )
    )[0].id as number;

  it('la migración aborta y lista las personas inexistentes', async () => {
    base = await crearBaseTemporal({ sin: ['AgregarFkUsuarioPersona'] });
    await crearUsuario(base, 'uno', 999);
    await crearUsuario(base, 'dos', 998);
    await expect(base.aplicarTodas()).rejects.toThrow(/998, 999/);
  });

  it('con la FK aplicada, no se puede vincular una persona inexistente', async () => {
    base = await crearBaseTemporal();
    await expect(crearUsuario(base, 'uno', 999)).rejects.toThrow(
      /foreign key|viola la llave/i,
    );
  });

  it('admite usuarios sin persona y con una persona existente', async () => {
    base = await crearBaseTemporal();
    await crearUsuario(base, 'sin', null);
    await crearUsuario(base, 'con', await crearPersona(base));
  });

  it('no se puede borrar una persona vinculada a un usuario', async () => {
    base = await crearBaseTemporal();
    const id = await crearPersona(base);
    await crearUsuario(base, 'con', id);
    await expect(
      base.dataSource.query('DELETE FROM persona WHERE id_persona = $1', [id]),
    ).rejects.toThrow(/foreign key|viola la llave/i);
  });
});
```

- [x] **Paso 2: Verificar que falla**

Run: `cd backend && npm run test:integracion -- src/infra/database/fk-usuario-persona.int.spec.ts`
Expected: FAIL (no existe la migración `AgregarFkUsuarioPersona` ni la FK; el primer test falla por no encontrar errores y el segundo inserta sin error).

- [x] **Paso 3: Declarar la relación en la entidad**

En `usuario.entity.ts`: importar `Persona` y `type Relation`:

```ts
import { Persona } from '../../personas/entities/persona.entity.js';
```

(agregar `type Relation` a la lista de imports de `typeorm`) y reemplazar el bloque de `idPersona` por:

```ts
  /** Persona vinculada; obligatoria para el rol docente (ver `UsuariosService`). */
  @Column({ name: 'id_persona', type: 'int', nullable: true, unique: true })
  idPersona: number | null;

  @ManyToOne(() => Persona, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_persona' })
  persona: Relation<Persona> | null;
```

- [x] **Paso 4: Generar la migración**

```bash
docker compose exec -T backend npm run migration:run
docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/AgregarFkUsuarioPersona
```

Revisar: debe contener solo el `ALTER TABLE "usuario" ADD CONSTRAINT "FK_..." FOREIGN KEY ("id_persona") REFERENCES "persona"("id_persona") ON DELETE RESTRICT ...` y su `down`. Si propone otra cosa, detenerse.

- [x] **Paso 5: Abortar ante huérfanos**

Al principio de `up`, antes del `ALTER TABLE` generado:

```ts
    const huerfanas: { id_persona: number }[] = await queryRunner.query(
      `SELECT DISTINCT u.id_persona
       FROM usuario u
       LEFT JOIN persona p ON p.id_persona = u.id_persona
       WHERE u.id_persona IS NOT NULL AND p.id_persona IS NULL
       ORDER BY u.id_persona`,
    );
    if (huerfanas.length > 0) {
      throw new Error(
        `usuario referencia personas que no existen: ${huerfanas
          .map((h) => h.id_persona)
          .join(', ')}. Poné esos id_persona en NULL o cargá las personas antes de migrar`,
      );
    }
```

- [x] **Paso 6: Aplicar, revertir y reaplicar**

```bash
docker compose exec -T backend npm run migration:run
docker compose exec -T backend npm run migration:revert
docker compose exec -T backend npm run migration:run
```

Expected: sin errores.

- [x] **Paso 7: Verificar que el test pasa y que la sonda no propone cambios**

```bash
cd backend && npm run test:integracion -- src/infra/database/fk-usuario-persona.int.spec.ts
docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/SondaBorrar
```

Expected: PASS; la sonda no encuentra cambios (o solo los `DROP` ya conocidos de la tarea 2; borrar el archivo si se generó).

- [x] **Paso 8: Lint, formato, tests y commit**

```bash
cd backend && npm run lint && npm run format && npm test && npm run test:integracion
git add backend/src
git commit -m "Agregar la clave foránea de usuario hacia persona"
```

---

## Tarea 4: Base compartida del módulo (fechas, acceso, errores, DTOs, mapper)

**Files:**
- Modify: `backend/src/common/roles.ts`, `backend/src/common/roles.spec.ts`
- Create: `backend/src/common/like.ts`; Modify: `backend/src/modules/estructura/puestos.service.ts` (importa `escaparLike`)
- Create: `backend/src/modules/personas/personas.constantes.ts`, `fechas.ts`, `fechas.spec.ts`, `acceso.ts`, `acceso.spec.ts`, `transaccion.ts`, `transaccion.spec.ts`, `fecha.pipe.ts`, `fecha.pipe.spec.ts`
- Create: `backend/src/modules/personas/dto/fecha-iso.decorator.ts`, `crear-persona.dto.ts`, `actualizar-persona.dto.ts`, `filtro-personas.dto.ts`, `persona.dto.ts`, `crear-ocupacion.dto.ts`, `actualizar-ocupacion.dto.ts`, `cerrar-ocupacion.dto.ts`, `ocupacion.dto.ts`, `personas-dto.spec.ts`
- Create: `backend/src/modules/personas/persona.mapper.ts`, `persona.mapper.spec.ts`, `ocupacion.mapper.ts`

**Interfaces:**
- Produces (usados por las tareas 5 a 7):
  - `common/roles.ts`: `ROLES_SIN_DOCENTE: CodigoRol[]`, `ROLES_CON_DATOS_PERSONALES: CodigoRol[]`.
  - `common/like.ts`: `escaparLike(texto: string): string`.
  - `fechas.ts`: `type FechaISO = string`, `type EstadoOcupacion = 'vigente' | 'futura' | 'pasada'`, `interface Vigencia { fechaDesde: FechaISO; fechaHasta: FechaISO | null }`, `esFechaValida(texto: string): boolean`, `hoyDeLaBase(manager: Pick<EntityManager, 'query'>): Promise<FechaISO>`, `estadoDe(o: Vigencia, hoy: FechaISO): EstadoOcupacion`, `estaAbierta(o: Vigencia, hoy: FechaISO): boolean`, `seSolapan(a: Vigencia, b: Vigencia): boolean`, `validarRango(desde: FechaISO, hasta: FechaISO | null): void`, `validarFechasDePersona(nacimiento: FechaISO, ingreso: FechaISO, retiro: FechaISO | null): void`.
  - `acceso.ts`: `exigirAccesoAPersona(sesion: Pick<SesionUsuario, 'rol' | 'idPersona'>, idPersona: number): void`.
  - `transaccion.ts`: `enTransaccionDePersonas<T>(repositorio: { manager: EntityManager }, trabajo: (manager: EntityManager) => Promise<T>): Promise<T>`, `traducirError(error: unknown): unknown`.
  - `fecha.pipe.ts`: `ParseFechaPipe`.
  - DTOs: `CrearPersonaDto`, `ActualizarPersonaDto`, `FiltroPersonasDto`, `PersonaDto` (con `tieneUsuario`, `documento?`, `fechaNacimiento?`), `PersonaDetalleDto` (`ocupacionesVigentes: OcupacionDto[]`), `ResultadoBajaPersonaDto` (`persona`, `advertencias`), `CrearOcupacionDto`, `ActualizarOcupacionDto`, `CerrarOcupacionDto`, `OcupacionDto` (`estado`), `OcupanteDto extends OcupacionDto` (`legajo`, `apellido`, `nombre`).
  - Mappers: `aPersonaDto(p: Persona, opciones: { verSensibles: boolean; tieneUsuario: boolean }): PersonaDto`, `puedeVerDatosPersonales(rol: CodigoRol): boolean`, `aOcupacionDto(o: Ocupacion, hoy: FechaISO): OcupacionDto`, `aOcupanteDto(o: Ocupacion, hoy: FechaISO): OcupanteDto` (requiere `o.persona` cargada).

- [x] **Paso 1: Roles nuevos**

En `common/roles.ts`, al final:

```ts
/** Todos menos el docente: ven personas y ocupaciones de la facultad. */
export const ROLES_SIN_DOCENTE: CodigoRol[] = TODOS_LOS_ROLES.filter(
  (rol) => rol !== ROLES.docente,
);

/** Ven el documento y la fecha de nacimiento (RNF02, Ley 25.326). */
export const ROLES_CON_DATOS_PERSONALES: CodigoRol[] = [
  ROLES.recursosHumanos,
  ROLES.administrador,
];
```

En `roles.spec.ts`, importar ambas constantes y agregar:

```ts
  it('el docente es el único rol fuera de ROLES_SIN_DOCENTE', () => {
    expect(ROLES_SIN_DOCENTE).not.toContain('docente');
    expect(ROLES_SIN_DOCENTE).toHaveLength(TODOS_LOS_ROLES.length - 1);
  });

  it('solo RR. HH. y el administrador ven datos personales', () => {
    expect([...ROLES_CON_DATOS_PERSONALES].sort()).toEqual([
      'administrador',
      'recursos_humanos',
    ]);
  });
```

Run: `cd backend && npx vitest run src/common/roles.spec.ts` → PASS.

- [x] **Paso 2: Mover `escaparLike` a `common/like.ts`**

Crear `backend/src/common/like.ts`:

```ts
/** Para `ILIKE`: `%`, `_` y `\` del texto buscado no son comodines. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, '\\$&');
}
```

En `puestos.service.ts` reemplazar la definición de `escaparLike` (y su comentario) por:

```ts
import { escaparLike } from '../../common/like.js';

// El spec existente la importa desde acá.
export { escaparLike };
```

(el `import` va junto a los demás imports, el `export` debajo de ellos). Run: `cd backend && npx vitest run src/modules/estructura/puestos.service.spec.ts` → PASS.

- [x] **Paso 3: Constantes**

`personas.constantes.ts`:

```ts
/** Slugs de los dominios de referencia (`ReferenciaService.validarActivo`). */
export const DOMINIO_SITUACION_REVISTA = 'situacion-revista';
export const DOMINIO_DEDICACION = 'dedicacion';
export const DOMINIO_CARACTER_OCUPACION = 'caracter-ocupacion';
```

- [x] **Paso 4: Test de fechas**

`fechas.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import {
  esFechaValida,
  estaAbierta,
  estadoDe,
  hoyDeLaBase,
  seSolapan,
  validarFechasDePersona,
  validarRango,
} from './fechas.js';

const HOY = '2026-06-15';
const o = (fechaDesde: string, fechaHasta: string | null) => ({
  fechaDesde,
  fechaHasta,
});

describe('esFechaValida', () => {
  it.each(['2026-06-15', '2024-02-29', '1999-12-31'])('acepta %s', (f) =>
    expect(esFechaValida(f)).toBe(true),
  );
  it.each([
    '2026-02-30',
    '2025-02-29',
    '2026-13-01',
    '2026-00-10',
    '26-06-15',
    '2026-06-15T10:00:00',
    '2026-6-5',
    '',
    'hoy',
  ])('rechaza %s', (f) => expect(esFechaValida(f)).toBe(false));
});

describe('estadoDe', () => {
  it('es vigente entre el inicio y el fin, ambos inclusive', () => {
    expect(estadoDe(o('2026-06-15', '2026-06-15'), HOY)).toBe('vigente');
    expect(estadoDe(o('2020-01-01', null), HOY)).toBe('vigente');
  });
  it('una ocupación que vence hoy sigue vigente', () => {
    expect(estadoDe(o('2020-01-01', HOY), HOY)).toBe('vigente');
  });
  it('es pasada si terminó antes de hoy', () => {
    expect(estadoDe(o('2020-01-01', '2026-06-14'), HOY)).toBe('pasada');
  });
  it('es futura si empieza después de hoy', () => {
    expect(estadoDe(o('2026-06-16', null), HOY)).toBe('futura');
  });
  it('está abierta si es vigente o futura', () => {
    expect(estaAbierta(o('2020-01-01', HOY), HOY)).toBe(true);
    expect(estaAbierta(o('2027-01-01', null), HOY)).toBe(true);
    expect(estaAbierta(o('2020-01-01', '2026-06-14'), HOY)).toBe(false);
  });
});

describe('seSolapan', () => {
  it('detecta rangos que comparten algún día', () => {
    expect(seSolapan(o('2024-01-01', '2024-06-30'), o('2024-06-30', null))).toBe(true);
    expect(seSolapan(o('2024-01-01', null), o('2030-01-01', '2030-02-01'))).toBe(true);
  });
  it('las fechas adyacentes no se solapan', () => {
    expect(seSolapan(o('2024-01-01', '2024-06-30'), o('2024-07-01', null))).toBe(false);
  });
  it('es simétrica', () => {
    const a = o('2024-01-01', '2024-03-01');
    const b = o('2024-02-01', '2024-04-01');
    expect(seSolapan(a, b)).toBe(seSolapan(b, a));
  });
});

describe('validarRango', () => {
  it('acepta fin igual o posterior al inicio y fin nulo', () => {
    expect(() => validarRango('2024-01-01', '2024-01-01')).not.toThrow();
    expect(() => validarRango('2024-01-01', null)).not.toThrow();
  });
  it('rechaza con 400 un fin anterior al inicio', () => {
    expect(() => validarRango('2024-01-02', '2024-01-01')).toThrow(
      BadRequestException,
    );
  });
});

describe('validarFechasDePersona', () => {
  it('acepta un caso válido, con y sin retiro', () => {
    expect(() => validarFechasDePersona('1980-01-01', '2005-03-01', null)).not.toThrow();
    expect(() => validarFechasDePersona('1980-01-01', '2005-03-01', '2005-03-01')).not.toThrow();
  });
  it('rechaza un ingreso que no es posterior al nacimiento', () => {
    expect(() => validarFechasDePersona('2000-01-01', '2000-01-01', null)).toThrow(
      /ingreso debe ser posterior al nacimiento/,
    );
  });
  it('rechaza un retiro anterior al ingreso', () => {
    expect(() => validarFechasDePersona('1980-01-01', '2005-03-01', '2005-02-28')).toThrow(
      /retiro no puede ser anterior al ingreso/,
    );
  });
});

describe('hoyDeLaBase', () => {
  it('devuelve CURRENT_DATE como texto', async () => {
    const manager = { query: vi.fn(async () => [{ hoy: HOY }]) };
    expect(await hoyDeLaBase(manager)).toBe(HOY);
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('CURRENT_DATE'),
    );
  });
});
```

Run: `cd backend && npx vitest run src/modules/personas/fechas.spec.ts` → FAIL (no existe `fechas.ts`).

- [x] **Paso 5: Implementar `fechas.ts`**

```ts
import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

/** Fecha sin hora, `AAAA-MM-DD`; así devuelve TypeORM las columnas `date`. */
export type FechaISO = string;

export type EstadoOcupacion = 'vigente' | 'futura' | 'pasada';

export interface Vigencia {
  fechaDesde: FechaISO;
  fechaHasta: FechaISO | null;
}

/** Fin de una ocupación sin `fechaHasta`, para comparar como cadenas. */
const SIN_FIN = '9999-12-31';

/** Una fecha `AAAA-MM-DD` que existe en el calendario. */
export function esFechaValida(texto: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) return false;
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

/** "Hoy" es el de la base, el mismo que usarán las vistas de detección. */
export async function hoyDeLaBase(
  manager: Pick<EntityManager, 'query'>,
): Promise<FechaISO> {
  const [fila] = await manager.query<{ hoy: string }[]>(
    'SELECT CURRENT_DATE::text AS hoy',
  );
  return fila.hoy;
}

export function estadoDe(ocupacion: Vigencia, hoy: FechaISO): EstadoOcupacion {
  if (ocupacion.fechaHasta !== null && ocupacion.fechaHasta < hoy) return 'pasada';
  if (ocupacion.fechaDesde > hoy) return 'futura';
  return 'vigente';
}

/** Vigente o futura: la que todavía puede cambiar y bloquea las bajas. */
export function estaAbierta(ocupacion: Vigencia, hoy: FechaISO): boolean {
  return estadoDe(ocupacion, hoy) !== 'pasada';
}

/** Comparten al menos un día (rangos cerrados; sin fin = abierto). */
export function seSolapan(a: Vigencia, b: Vigencia): boolean {
  return (
    a.fechaDesde <= (b.fechaHasta ?? SIN_FIN) &&
    b.fechaDesde <= (a.fechaHasta ?? SIN_FIN)
  );
}

export function validarRango(desde: FechaISO, hasta: FechaISO | null): void {
  if (hasta !== null && hasta < desde) {
    throw new BadRequestException(
      'La fecha de fin no puede ser anterior a la fecha de inicio',
    );
  }
}

export function validarFechasDePersona(
  nacimiento: FechaISO,
  ingreso: FechaISO,
  retiro: FechaISO | null,
): void {
  if (ingreso <= nacimiento) {
    throw new BadRequestException(
      'La fecha de ingreso debe ser posterior al nacimiento',
    );
  }
  if (retiro !== null && retiro < ingreso) {
    throw new BadRequestException(
      'La fecha prevista de retiro no puede ser anterior al ingreso',
    );
  }
}
```

Run: `cd backend && npx vitest run src/modules/personas/fechas.spec.ts` → PASS.

- [x] **Paso 6: Acceso del docente (test y código)**

`acceso.spec.ts`:

```ts
import { ForbiddenException } from '@nestjs/common';
import { exigirAccesoAPersona } from './acceso.js';

describe('exigirAccesoAPersona', () => {
  it('el docente accede a su propia persona', () => {
    expect(() =>
      exigirAccesoAPersona({ rol: 'docente', idPersona: 5 }, 5),
    ).not.toThrow();
  });
  it('el docente no accede a la de otro', () => {
    expect(() =>
      exigirAccesoAPersona({ rol: 'docente', idPersona: 5 }, 6),
    ).toThrow(ForbiddenException);
  });
  it('el docente sin persona vinculada no accede a ninguna', () => {
    expect(() =>
      exigirAccesoAPersona({ rol: 'docente', idPersona: null }, 5),
    ).toThrow(ForbiddenException);
  });
  it.each(['recursos_humanos', 'autoridad', 'jefe_catedra', 'administrador'] as const)(
    'el rol %s no tiene esta restricción',
    (rol) => {
      expect(() => exigirAccesoAPersona({ rol, idPersona: null }, 5)).not.toThrow();
    },
  );
});
```

`acceso.ts`:

```ts
import { ForbiddenException } from '@nestjs/common';
import { ROLES } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';

/** El docente solo accede a su propia persona (RF24); los demás roles no se restringen acá. */
export function exigirAccesoAPersona(
  sesion: Pick<SesionUsuario, 'rol' | 'idPersona'>,
  idPersona: number,
): void {
  if (sesion.rol === ROLES.docente && sesion.idPersona !== idPersona) {
    throw new ForbiddenException('Solo podés consultar tu propia ficha');
  }
}
```

Run: `cd backend && npx vitest run src/modules/personas/acceso.spec.ts` → PASS.

- [x] **Paso 7: Transacción y traducción de errores (test y código)**

`transaccion.spec.ts`:

```ts
import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { BLOQUEO_ESTRUCTURA } from '../estructura/transaccion.js';
import { enTransaccionDePersonas, traducirError } from './transaccion.js';

const errorDeBase = (code: string, detail = '') =>
  new QueryFailedError('SELECT 1', [], Object.assign(new Error('x'), { code, detail }));

describe('traducirError', () => {
  it('traduce la exclusión (23P01) a 409', () => {
    expect(traducirError(errorDeBase('23P01'))).toBeInstanceOf(ConflictException);
  });
  it('nombra el legajo y el documento repetidos', () => {
    expect(
      (traducirError(errorDeBase('23505', 'Key (legajo)=(1) already exists.')) as Error).message,
    ).toContain('legajo');
    expect(
      (traducirError(errorDeBase('23505', 'Key (documento)=(30111111) already exists.')) as Error).message,
    ).toContain('documento');
  });
  it('explica la clave repetida de una ocupación', () => {
    const detalle = 'Key (id_persona, id_puesto, fecha_desde)=(1, 2, 2024-01-01) already exists.';
    expect((traducirError(errorDeBase('23505', detalle)) as Error).message).toContain(
      'empieza ese día',
    );
  });
  it('deja pasar otros errores sin tocarlos', () => {
    const otro = new Error('boom');
    expect(traducirError(otro)).toBe(otro);
    const base = errorDeBase('22003');
    expect(traducirError(base)).toBe(base);
  });
});

describe('enTransaccionDePersonas', () => {
  function entorno() {
    const consultas: { sql: string; parametros?: unknown[] }[] = [];
    const manager = {
      query: vi.fn(async (sql: string, parametros?: unknown[]) => {
        consultas.push({ sql, parametros });
        return [];
      }),
      transaction: async (trabajo: (m: unknown) => Promise<unknown>) => trabajo(manager),
    };
    return { repositorio: { manager } as never, consultas };
  }

  it('toma el bloqueo consultivo de estructura antes del trabajo', async () => {
    const { repositorio, consultas } = entorno();
    const resultado = await enTransaccionDePersonas(repositorio, async () => 42);
    expect(resultado).toBe(42);
    expect(consultas[0].sql).toContain('pg_advisory_xact_lock');
    expect(consultas[0].parametros).toEqual([BLOQUEO_ESTRUCTURA]);
  });

  it('traduce el error de la base que sale del trabajo', async () => {
    const { repositorio } = entorno();
    await expect(
      enTransaccionDePersonas(repositorio, async () => {
        throw errorDeBase('23P01');
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
```

`transaccion.ts`:

```ts
import { ConflictException } from '@nestjs/common';
import { QueryFailedError, type EntityManager } from 'typeorm';
import { BLOQUEO_ESTRUCTURA } from '../estructura/transaccion.js';

/**
 * Convierte los errores de restricción de la base (exclusión de solapes y
 * unicidades) en 409 con un mensaje útil. Es el respaldo de las validaciones
 * previas de los servicios; el resto de los errores pasa sin cambios.
 */
export function traducirError(error: unknown): unknown {
  if (!(error instanceof QueryFailedError)) return error;
  const { code, detail } = (error.driverError ?? {}) as {
    code?: string;
    detail?: string;
  };
  if (code === '23P01') {
    return new ConflictException(
      'La persona ya ocupa ese puesto en un período que se superpone con el indicado',
    );
  }
  if (code === '23505') {
    const campos = /\(([^)]+)\)=/.exec(detail ?? '')?.[1] ?? '';
    if (campos.includes('fecha_desde')) {
      return new ConflictException(
        'La persona ya tiene una ocupación de ese puesto que empieza ese día',
      );
    }
    if (campos.includes('documento')) {
      return new ConflictException('Ya existe una persona con ese documento');
    }
    if (campos.includes('legajo')) {
      return new ConflictException('Ya existe una persona con ese legajo');
    }
    return new ConflictException('Ya existe un registro con esos datos');
  }
  return error;
}

/**
 * Ejecuta el trabajo en una transacción que antes toma el bloqueo consultivo
 * de estructura (el mismo que las bajas de puestos): un alta de ocupación y la
 * baja del puesto o de la persona no pueden cruzarse.
 */
export async function enTransaccionDePersonas<T>(
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
    throw traducirError(error);
  }
}
```

Run: `cd backend && npx vitest run src/modules/personas/transaccion.spec.ts` → PASS.

- [x] **Paso 8: Pipe de la fecha de la URL (test y código)**

`fecha.pipe.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { ParseFechaPipe } from './fecha.pipe.js';

describe('ParseFechaPipe', () => {
  const pipe = new ParseFechaPipe();
  it('devuelve una fecha válida', () => {
    expect(pipe.transform('2026-06-15')).toBe('2026-06-15');
  });
  it.each(['2026-02-30', '2026-06-15T10:00', 'ayer', '15/06/2026'])(
    'rechaza %s con 400',
    (valor) => {
      expect(() => pipe.transform(valor)).toThrow(BadRequestException);
    },
  );
});
```

`fecha.pipe.ts`:

```ts
import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { esFechaValida } from './fechas.js';

/** Valida un segmento de la URL con formato `AAAA-MM-DD` que exista en el calendario. */
@Injectable()
export class ParseFechaPipe implements PipeTransform<string, string> {
  transform(valor: string): string {
    if (!esFechaValida(valor)) {
      throw new BadRequestException('La fecha debe tener formato AAAA-MM-DD y existir');
    }
    return valor;
  }
}
```

Run: `cd backend && npx vitest run src/modules/personas/fecha.pipe.spec.ts` → PASS.

- [x] **Paso 9: Test de los DTOs**

`dto/personas-dto.spec.ts`:

```ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActualizarOcupacionDto } from './actualizar-ocupacion.dto.js';
import { ActualizarPersonaDto } from './actualizar-persona.dto.js';
import { CerrarOcupacionDto } from './cerrar-ocupacion.dto.js';
import { CrearOcupacionDto } from './crear-ocupacion.dto.js';
import { CrearPersonaDto } from './crear-persona.dto.js';
import { FiltroPersonasDto } from './filtro-personas.dto.js';

const errores = async <T extends object>(clase: new () => T, plano: object) =>
  (await validate(plainToInstance(clase, plano))).flatMap((e) => Object.keys(e.constraints ?? {}).map(() => e.property));

const persona = {
  legajo: ' L-100 ',
  apellido: 'Pérez',
  nombre: 'Ana',
  documento: '30111111',
  fechaNacimiento: '1980-01-01',
  fechaIngreso: '2005-03-01',
  idSituacionRevista: 1,
};

describe('CrearPersonaDto', () => {
  it('acepta una persona válida y recorta el legajo', async () => {
    const dto = plainToInstance(CrearPersonaDto, persona);
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.legajo).toBe('L-100');
  });
  it.each(['123456', '123456789', '3011111A', '30.111.111'])(
    'rechaza el documento %s',
    async (documento) => {
      expect(await errores(CrearPersonaDto, { ...persona, documento })).toContain('documento');
    },
  );
  it.each(['2026-02-30', '1980-01-01T00:00:00Z', '01/01/1980', ''])(
    'rechaza la fecha de nacimiento %s',
    async (fechaNacimiento) => {
      expect(await errores(CrearPersonaDto, { ...persona, fechaNacimiento })).toContain('fechaNacimiento');
    },
  );
  it('acepta la fecha prevista de retiro nula u omitida', async () => {
    expect(await errores(CrearPersonaDto, { ...persona, fechaPrevistaRetiro: null })).toEqual([]);
    expect(await errores(CrearPersonaDto, persona)).toEqual([]);
  });
  it('exige los campos obligatorios', async () => {
    expect(await errores(CrearPersonaDto, {})).toEqual(
      expect.arrayContaining(['legajo', 'apellido', 'nombre', 'documento', 'fechaNacimiento', 'fechaIngreso', 'idSituacionRevista']),
    );
  });
});

describe('ActualizarPersonaDto', () => {
  it('todo es opcional', async () => {
    expect(await errores(ActualizarPersonaDto, {})).toEqual([]);
  });
});

describe('FiltroPersonasDto', () => {
  it('convierte "true" y "false" en booleanos', async () => {
    const dto = plainToInstance(FiltroPersonasDto, { activo: 'false', sinUsuario: 'true' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.activo).toBe(false);
    expect(dto.sinUsuario).toBe(true);
  });
});

describe('DTOs de ocupación', () => {
  const ocupacion = {
    idPuesto: 3,
    fechaDesde: '2024-01-01',
    idCaracterOcupacion: 1,
    idDedicacion: 1,
  };
  it('acepta una ocupación con y sin fin', async () => {
    expect(await errores(CrearOcupacionDto, ocupacion)).toEqual([]);
    expect(await errores(CrearOcupacionDto, { ...ocupacion, fechaHasta: '2024-12-31' })).toEqual([]);
  });
  it.each(['2024-02-30', '2024-01-01T10:00', 'x'])(
    'rechaza fechaDesde %s',
    async (fechaDesde) => {
      expect(await errores(CrearOcupacionDto, { ...ocupacion, fechaDesde })).toContain('fechaDesde');
    },
  );
  it('al actualizar, todo es opcional y fechaHasta admite null', async () => {
    expect(await errores(ActualizarOcupacionDto, {})).toEqual([]);
    expect(await errores(ActualizarOcupacionDto, { fechaHasta: null })).toEqual([]);
  });
  it('cerrar exige una fecha de fin válida', async () => {
    expect(await errores(CerrarOcupacionDto, {})).toContain('fechaHasta');
    expect(await errores(CerrarOcupacionDto, { fechaHasta: '2024-13-01' })).toContain('fechaHasta');
    expect(await errores(CerrarOcupacionDto, { fechaHasta: '2024-12-31' })).toEqual([]);
  });
});
```

Run: `cd backend && npx vitest run src/modules/personas/dto` → FAIL (no existen los DTOs).

- [x] **Paso 10: Implementar los DTOs**

`dto/fecha-iso.decorator.ts`:

```ts
import { applyDecorators } from '@nestjs/common';
import { IsISO8601, Matches } from 'class-validator';

/** Fecha sin hora, `AAAA-MM-DD`, que exista en el calendario. */
export function FechaIso() {
  return applyDecorators(
    Matches(/^\d{4}-\d{2}-\d{2}$/, {
      message: '$property debe ser una fecha AAAA-MM-DD',
    }),
    IsISO8601({ strict: true }, { message: '$property debe ser una fecha válida' }),
  );
}
```

`dto/crear-persona.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
} from 'class-validator';
import { FechaIso } from './fecha-iso.decorator.js';

/** Mayor valor de una columna int4 de Postgres. */
const MAX_INT4 = 2147483647;

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearPersonaDto {
  @ApiProperty({ example: 'L-1234', maxLength: 20, description: 'Único' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  legajo: string;

  @ApiProperty({ example: 'Pérez', maxLength: 100 })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellido: string;

  @ApiProperty({ example: 'Ana', maxLength: 100 })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({ example: '30111111', description: 'DNI de 7 u 8 dígitos, sin puntos. Único' })
  @Transform(recortar)
  @Matches(/^\d{7,8}$/, { message: 'documento debe tener 7 u 8 dígitos, sin puntos' })
  documento: string;

  @ApiProperty({ example: '1980-05-20', format: 'date' })
  @FechaIso()
  fechaNacimiento: string;

  @ApiProperty({ example: '2005-03-01', format: 'date', description: 'Posterior al nacimiento' })
  @FechaIso()
  fechaIngreso: string;

  @ApiProperty()
  @IsInt()
  @Max(MAX_INT4)
  idSituacionRevista: number;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'date',
    description: 'No anterior al ingreso; null la borra',
  })
  @IsOptional()
  @FechaIso()
  fechaPrevistaRetiro?: string | null;
}
```

`dto/actualizar-persona.dto.ts`:

```ts
import { PartialType } from '@nestjs/swagger';
import { CrearPersonaDto } from './crear-persona.dto.js';

/** Todo es opcional; solo `fechaPrevistaRetiro` admite `null`. */
export class ActualizarPersonaDto extends PartialType(CrearPersonaDto) {}
```

`dto/filtro-personas.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

const aBooleano = ({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
  const valor = obj[key];
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  return valor;
};

export class FiltroPersonasDto {
  @ApiPropertyOptional({ description: 'Texto contenido en el legajo, el apellido o el nombre' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'true: solo personas que todavía no tienen usuario vinculado',
  })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  sinUsuario?: boolean;
}
```

`dto/ocupacion.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import type { EstadoOcupacion } from '../fechas.js';

export class OcupacionDto {
  @ApiProperty()
  idPersona: number;

  @ApiProperty()
  idPuesto: number;

  @ApiProperty({ format: 'date', example: '2024-03-01' })
  fechaDesde: string;

  @ApiProperty({ format: 'date', nullable: true, type: String, description: 'null: sin fin' })
  fechaHasta: string | null;

  @ApiProperty()
  idCaracterOcupacion: number;

  @ApiProperty()
  idDedicacion: number;

  @ApiProperty({
    enum: ['vigente', 'futura', 'pasada'],
    description: 'Respecto de la fecha de hoy de la base',
  })
  estado: EstadoOcupacion;
}

/** Ocupación de un puesto con los datos mínimos de quien la ocupa. */
export class OcupanteDto extends OcupacionDto {
  @ApiProperty({ example: 'L-1234' })
  legajo: string;

  @ApiProperty()
  apellido: string;

  @ApiProperty()
  nombre: string;
}
```

`dto/persona.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OcupacionDto } from './ocupacion.dto.js';

export class PersonaDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ example: 'L-1234' })
  legajo: string;

  @ApiProperty()
  apellido: string;

  @ApiProperty()
  nombre: string;

  @ApiPropertyOptional({
    description: 'Solo para recursos humanos y administrador (Ley 25.326)',
  })
  documento?: string;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Solo para recursos humanos y administrador (Ley 25.326)',
  })
  fechaNacimiento?: string;

  @ApiProperty({ format: 'date' })
  fechaIngreso: string;

  @ApiProperty()
  idSituacionRevista: number;

  @ApiProperty({ format: 'date', nullable: true, type: String })
  fechaPrevistaRetiro: string | null;

  @ApiProperty()
  activo: boolean;

  @ApiProperty({ description: 'Tiene un usuario vinculado' })
  tieneUsuario: boolean;
}

export class PersonaDetalleDto extends PersonaDto {
  @ApiProperty({ type: OcupacionDto, isArray: true })
  ocupacionesVigentes: OcupacionDto[];
}

export class ResultadoBajaPersonaDto {
  @ApiProperty({ type: PersonaDetalleDto })
  persona: PersonaDetalleDto;

  @ApiProperty({ type: String, isArray: true, description: 'Avisos que no impidieron la baja' })
  advertencias: string[];
}
```

`dto/crear-ocupacion.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max } from 'class-validator';
import { FechaIso } from './fecha-iso.decorator.js';

const MAX_INT4 = 2147483647;

export class CrearOcupacionDto {
  @ApiProperty({ description: 'Puesto activo' })
  @IsInt()
  @Max(MAX_INT4)
  idPuesto: number;

  @ApiProperty({ format: 'date', example: '2024-03-01' })
  @FechaIso()
  fechaDesde: string;

  @ApiPropertyOptional({
    format: 'date',
    nullable: true,
    type: String,
    description: 'No anterior al inicio; sin valor, la ocupación no tiene fin',
  })
  @IsOptional()
  @FechaIso()
  fechaHasta?: string | null;

  @ApiProperty()
  @IsInt()
  @Max(MAX_INT4)
  idCaracterOcupacion: number;

  @ApiProperty()
  @IsInt()
  @Max(MAX_INT4)
  idDedicacion: number;
}
```

`dto/actualizar-ocupacion.dto.ts`:

```ts
import { OmitType, PartialType } from '@nestjs/swagger';
import { CrearOcupacionDto } from './crear-ocupacion.dto.js';

/** No admite `idPuesto` ni `fechaDesde`: forman la clave; para corregirlos se anula y se recarga. */
export class ActualizarOcupacionDto extends PartialType(
  OmitType(CrearOcupacionDto, ['idPuesto', 'fechaDesde'] as const),
) {}
```

`dto/cerrar-ocupacion.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { FechaIso } from './fecha-iso.decorator.js';

export class CerrarOcupacionDto {
  @ApiProperty({ format: 'date', example: '2026-06-30' })
  @FechaIso()
  fechaHasta: string;
}
```

Run: `cd backend && npx vitest run src/modules/personas/dto` → PASS.

- [x] **Paso 11: Mappers (test y código)**

`persona.mapper.spec.ts`:

```ts
import type { Persona } from './entities/persona.entity.js';
import { aPersonaDto, puedeVerDatosPersonales } from './persona.mapper.js';

const persona = {
  id: 1,
  legajo: 'L-1',
  apellido: 'Pérez',
  nombre: 'Ana',
  documento: '30111111',
  fechaNacimiento: '1980-01-01',
  fechaIngreso: '2005-03-01',
  idSituacionRevista: 2,
  fechaPrevistaRetiro: null,
  activo: true,
} as Persona;

describe('aPersonaDto', () => {
  it('incluye documento y fecha de nacimiento cuando se pueden ver', () => {
    expect(aPersonaDto(persona, { verSensibles: true, tieneUsuario: false })).toMatchObject({
      documento: '30111111',
      fechaNacimiento: '1980-01-01',
      tieneUsuario: false,
    });
  });
  it('omite las claves (no las deja en undefined) cuando no se pueden ver', () => {
    const dto = aPersonaDto(persona, { verSensibles: false, tieneUsuario: true });
    expect(dto).not.toHaveProperty('documento');
    expect(dto).not.toHaveProperty('fechaNacimiento');
    expect(JSON.stringify(dto)).not.toContain('30111111');
    expect(dto).toMatchObject({ id: 1, legajo: 'L-1', tieneUsuario: true });
  });
});

describe('puedeVerDatosPersonales', () => {
  it.each([
    ['recursos_humanos', true],
    ['administrador', true],
    ['autoridad', false],
    ['jefatura_departamento', false],
    ['jefe_catedra', false],
    ['analista_puestos', false],
    ['docente', false],
  ] as const)('%s → %s', (rol, esperado) => {
    expect(puedeVerDatosPersonales(rol)).toBe(esperado);
  });
});
```

`persona.mapper.ts`:

```ts
import {
  ROLES_CON_DATOS_PERSONALES,
  type CodigoRol,
} from '../../common/roles.js';
import type { PersonaDto } from './dto/persona.dto.js';
import type { Persona } from './entities/persona.entity.js';

export interface OpcionesPersona {
  /** Incluir `documento` y `fechaNacimiento` (RNF02). */
  verSensibles: boolean;
  tieneUsuario: boolean;
}

export const puedeVerDatosPersonales = (rol: CodigoRol): boolean =>
  ROLES_CON_DATOS_PERSONALES.includes(rol);

export function aPersonaDto(
  persona: Persona,
  { verSensibles, tieneUsuario }: OpcionesPersona,
): PersonaDto {
  const dto: PersonaDto = {
    id: persona.id,
    legajo: persona.legajo,
    apellido: persona.apellido,
    nombre: persona.nombre,
    fechaIngreso: persona.fechaIngreso,
    idSituacionRevista: persona.idSituacionRevista,
    fechaPrevistaRetiro: persona.fechaPrevistaRetiro,
    activo: persona.activo,
    tieneUsuario,
  };
  if (verSensibles) {
    dto.documento = persona.documento;
    dto.fechaNacimiento = persona.fechaNacimiento;
  }
  return dto;
}
```

`ocupacion.mapper.ts`:

```ts
import type { OcupacionDto, OcupanteDto } from './dto/ocupacion.dto.js';
import type { Ocupacion } from './entities/ocupacion.entity.js';
import { estadoDe, type FechaISO } from './fechas.js';

export function aOcupacionDto(ocupacion: Ocupacion, hoy: FechaISO): OcupacionDto {
  return {
    idPersona: ocupacion.idPersona,
    idPuesto: ocupacion.idPuesto,
    fechaDesde: ocupacion.fechaDesde,
    fechaHasta: ocupacion.fechaHasta,
    idCaracterOcupacion: ocupacion.idCaracterOcupacion,
    idDedicacion: ocupacion.idDedicacion,
    estado: estadoDe(ocupacion, hoy),
  };
}

/** Requiere `ocupacion.persona` cargada. */
export function aOcupanteDto(ocupacion: Ocupacion, hoy: FechaISO): OcupanteDto {
  return {
    ...aOcupacionDto(ocupacion, hoy),
    legajo: ocupacion.persona.legajo,
    apellido: ocupacion.persona.apellido,
    nombre: ocupacion.persona.nombre,
  };
}
```

Run: `cd backend && npx vitest run src/modules/personas` → PASS.

- [x] **Paso 12: Lint, formato y commit**

```bash
cd backend && npm run lint && npm run format && npm test
git add backend/src
git commit -m "Agregar la base compartida del módulo personas"
```

---

## Tarea 5: `PersonasService` y `PersonasController`

**Files:**
- Create: `backend/src/modules/personas/personas.service.ts`, `personas.service.spec.ts`, `personas.controller.ts`
- Modify: `backend/src/modules/personas/personas.module.ts`

**Interfaces:**
- Consumes: todo lo de la tarea 4; `ReferenciaService.validarActivo(slug, id)`; entidades `Persona`, `Ocupacion`, `Usuario`.
- Produces: `PersonasService` con
  - `listar(filtro: FiltroPersonasDto, sesion: SesionUsuario): Promise<PersonaDto[]>`
  - `obtener(id: number, sesion: SesionUsuario): Promise<PersonaDetalleDto>`
  - `crear(dto: CrearPersonaDto): Promise<PersonaDetalleDto>`
  - `actualizar(id: number, dto: ActualizarPersonaDto): Promise<PersonaDetalleDto>`
  - `darDeBaja(id: number): Promise<ResultadoBajaPersonaDto>`
  - `reactivar(id: number): Promise<PersonaDetalleDto>`
  - `exigirActiva(idPersona: number): Promise<void>` (400 si no existe o está de baja; lo usa `UsuariosService`)
  El módulo exporta `PersonasService`.

- [x] **Paso 1: Escribir el test del servicio**

`personas.service.spec.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FindOperator, type Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { Usuario } from '../usuarios/entities/usuario.entity.js';
import type { Ocupacion } from './entities/ocupacion.entity.js';
import type { Persona } from './entities/persona.entity.js';
import { PersonasService } from './personas.service.js';

const HOY = '2026-06-15';

function persona(parcial: Partial<Persona> = {}): Persona {
  return {
    id: 1,
    legajo: 'L-1',
    apellido: 'Pérez',
    nombre: 'Ana',
    documento: '30111111',
    fechaNacimiento: '1980-01-01',
    fechaIngreso: '2005-03-01',
    idSituacionRevista: 1,
    fechaPrevistaRetiro: null,
    activo: true,
    ...parcial,
  } as Persona;
}

function ocupacion(parcial: Partial<Ocupacion> = {}): Ocupacion {
  return {
    idPersona: 1,
    idPuesto: 10,
    fechaDesde: '2020-01-01',
    fechaHasta: null,
    idCaracterOcupacion: 1,
    idDedicacion: 1,
    puesto: { codigo: 'P-0010', denominacion: 'Jefe de cátedra' },
    ...parcial,
  } as Ocupacion;
}

const sesion = (rol: SesionUsuario['rol'], idPersona: number | null = null): SesionUsuario => ({
  id: 1,
  nombreUsuario: 'u',
  rol,
  idPersona,
  unidades: [],
});

function crearEntorno(
  existentes: Persona[],
  config: { ocupaciones?: Ocupacion[]; conUsuario?: number[] } = {},
) {
  const filas = existentes.map((p) => ({ ...p }));
  let proximoId = 100;

  const coincide = (p: Persona, donde: unknown): boolean =>
    Array.isArray(donde)
      ? donde.some((d) => coincide(p, d))
      : Object.entries(donde as Record<string, unknown>).every(
          ([clave, valor]) => valor instanceof FindOperator || p[clave as keyof Persona] === valor,
        );

  const repo = {
    find: vi.fn(async ({ where }: { where: unknown }) =>
      filas.filter((p) => coincide(p, where)).map((p) => ({ ...p })),
    ),
    findOne: vi.fn(async ({ where }: { where: unknown }) => {
      const fila = filas.find((p) => coincide(p, where));
      return fila ? { ...fila } : null;
    }),
    create: vi.fn((datos: Partial<Persona>) => ({ ...datos })),
    save: vi.fn(async (p: Partial<Persona>) => {
      if (p.id === undefined) {
        const nueva = { ...p, id: proximoId++ } as Persona;
        filas.push(nueva);
        return { ...nueva };
      }
      const i = filas.findIndex((f) => f.id === p.id);
      filas[i] = { ...(p as Persona) };
      return { ...(p as Persona) };
    }),
  };
  const repoOcupaciones = {
    find: vi.fn(async ({ where }: { where: { idPersona?: number } }) =>
      (config.ocupaciones ?? [])
        .filter((o) => where.idPersona === undefined || o.idPersona === where.idPersona)
        .map((o) => ({ ...o })),
    ),
  };
  const repoUsuarios = {
    find: vi.fn(async () => (config.conUsuario ?? []).map((idPersona) => ({ idPersona }))),
    count: vi.fn(
      async ({ where }: { where: { idPersona: number } }) =>
        (config.conUsuario ?? []).filter((id) => id === where.idPersona).length,
    ),
  };
  const consultas: string[] = [];
  const manager = {
    query: vi.fn(async (sql: string) => {
      consultas.push(sql);
      return sql.includes('CURRENT_DATE') ? [{ hoy: HOY }] : [];
    }),
    getRepository: (entidad: { name: string }) =>
      entidad.name === 'Ocupacion' ? repoOcupaciones : repo,
    transaction: async (trabajo: (m: unknown) => Promise<unknown>) => trabajo(manager),
  };
  (repo as unknown as { manager: unknown }).manager = manager;
  (repoOcupaciones as unknown as { manager: unknown }).manager = manager;

  const referencia = { validarActivo: vi.fn(async () => undefined) };
  const servicio = new PersonasService(
    repo as unknown as Repository<Persona>,
    repoOcupaciones as unknown as Repository<Ocupacion>,
    repoUsuarios as unknown as Repository<Usuario>,
    referencia as unknown as ReferenciaService,
  );
  return { servicio, repo, referencia, filas, consultas };
}

const alta = {
  legajo: 'L-9',
  apellido: 'Gómez',
  nombre: 'Luis',
  documento: '28999999',
  fechaNacimiento: '1975-02-02',
  fechaIngreso: '2000-08-01',
  idSituacionRevista: 1,
};

describe('PersonasService.crear', () => {
  it('crea la persona activa, valida la situación y toma el bloqueo', async () => {
    const { servicio, referencia, consultas } = crearEntorno([]);
    const creada = await servicio.crear(alta);
    expect(creada).toMatchObject({
      legajo: 'L-9',
      documento: '28999999',
      activo: true,
      tieneUsuario: false,
      ocupacionesVigentes: [],
    });
    expect(referencia.validarActivo).toHaveBeenCalledWith('situacion-revista', 1);
    expect(consultas[0]).toContain('pg_advisory_xact_lock');
  });

  it('rechaza con 409 un legajo repetido, nombrando a quien lo tiene', async () => {
    const { servicio } = crearEntorno([persona()]);
    const error = await servicio.crear({ ...alta, legajo: 'L-1' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toContain('Pérez');
  });

  it('rechaza con 409 un documento repetido', async () => {
    const { servicio } = crearEntorno([persona()]);
    await expect(servicio.crear({ ...alta, documento: '30111111' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('rechaza con 400 un ingreso que no es posterior al nacimiento', async () => {
    const { servicio, repo } = crearEntorno([]);
    await expect(
      servicio.crear({ ...alta, fechaIngreso: alta.fechaNacimiento }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rechaza con 400 un retiro anterior al ingreso', async () => {
    const { servicio } = crearEntorno([]);
    await expect(
      servicio.crear({ ...alta, fechaPrevistaRetiro: '1999-12-31' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('propaga el 400 de una situación de revista inactiva', async () => {
    const { servicio, referencia } = crearEntorno([]);
    referencia.validarActivo.mockRejectedValueOnce(new BadRequestException('inactivo'));
    await expect(servicio.crear(alta)).rejects.toThrow(BadRequestException);
  });
});

describe('PersonasService.actualizar', () => {
  it('modifica solo lo enviado y valida las fechas con los valores finales', async () => {
    const { servicio, filas } = crearEntorno([persona()]);
    const actualizada = await servicio.actualizar(1, { apellido: 'Gómez' });
    expect(actualizada.apellido).toBe('Gómez');
    expect(filas[0].legajo).toBe('L-1');
    await expect(
      servicio.actualizar(1, { fechaPrevistaRetiro: '2001-01-01' }),
    ).rejects.toThrow(/retiro no puede ser anterior/);
  });

  it('permite borrar la fecha de retiro con null pero no otros campos', async () => {
    const { servicio } = crearEntorno([persona({ fechaPrevistaRetiro: '2040-01-01' })]);
    expect((await servicio.actualizar(1, { fechaPrevistaRetiro: null })).fechaPrevistaRetiro).toBeNull();
    await expect(
      servicio.actualizar(1, { apellido: null as unknown as string }),
    ).rejects.toThrow(/apellido no admite null/);
  });

  it('permite conservar su propio legajo y rechaza el de otra persona', async () => {
    const { servicio } = crearEntorno([persona(), persona({ id: 2, legajo: 'L-2', documento: '30222222' })]);
    await expect(servicio.actualizar(1, { legajo: 'L-1' })).resolves.toBeDefined();
    await expect(servicio.actualizar(1, { legajo: 'L-2' })).rejects.toThrow(ConflictException);
    await expect(servicio.actualizar(1, { documento: '30222222' })).rejects.toThrow(ConflictException);
  });

  it('valida la situación de revista solo si cambia', async () => {
    const { servicio, referencia } = crearEntorno([persona({ idSituacionRevista: 1 })]);
    await servicio.actualizar(1, { idSituacionRevista: 1 });
    expect(referencia.validarActivo).not.toHaveBeenCalled();
    await servicio.actualizar(1, { idSituacionRevista: 3 });
    expect(referencia.validarActivo).toHaveBeenCalledWith('situacion-revista', 3);
  });

  it('responde 404 si no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(servicio.actualizar(9, { apellido: 'X' })).rejects.toThrow(NotFoundException);
  });
});

describe('PersonasService.listar y obtener', () => {
  const personas = [
    persona({ id: 1, apellido: 'Pérez', nombre: 'Ana' }),
    persona({ id: 2, legajo: 'L-2', documento: '30222222', apellido: 'Gómez', nombre: 'Luis' }),
  ];

  it('RR. HH. ve documento y nacimiento; otro rol no', async () => {
    const { servicio } = crearEntorno(personas);
    const [rrhh] = await servicio.listar({}, sesion('recursos_humanos'));
    expect(rrhh).toHaveProperty('documento', '30111111');
    const [jefe] = await servicio.listar({}, sesion('jefe_catedra'));
    expect(jefe).not.toHaveProperty('documento');
    expect(jefe).not.toHaveProperty('fechaNacimiento');
  });

  it('marca quién tiene usuario y filtra con sinUsuario', async () => {
    const { servicio } = crearEntorno(personas, { conUsuario: [2] });
    const todas = await servicio.listar({}, sesion('recursos_humanos'));
    expect(todas.map((p) => [p.id, p.tieneUsuario])).toEqual([
      [1, false],
      [2, true],
    ]);
    const libres = await servicio.listar({ sinUsuario: true }, sesion('recursos_humanos'));
    expect(libres.map((p) => p.id)).toEqual([1]);
  });

  it('obtener incluye solo las ocupaciones vigentes, con su estado', async () => {
    const { servicio } = crearEntorno(personas, {
      ocupaciones: [
        ocupacion({ idPuesto: 10 }),
        ocupacion({ idPuesto: 11, fechaHasta: HOY }),
        ocupacion({ idPuesto: 12, fechaHasta: '2026-06-14' }),
        ocupacion({ idPuesto: 13, fechaDesde: '2026-07-01' }),
      ],
    });
    const detalle = await servicio.obtener(1, sesion('autoridad'));
    expect(detalle.ocupacionesVigentes.map((o) => o.idPuesto)).toEqual([10, 11]);
    expect(detalle.ocupacionesVigentes.every((o) => o.estado === 'vigente')).toBe(true);
  });

  it('el docente solo obtiene la suya', async () => {
    const { servicio } = crearEntorno(personas);
    await expect(servicio.obtener(1, sesion('docente', 1))).resolves.toMatchObject({ id: 1 });
    await expect(servicio.obtener(2, sesion('docente', 1))).rejects.toThrow(ForbiddenException);
  });

  it('el docente ve su ficha sin documento ni nacimiento', async () => {
    const { servicio } = crearEntorno(personas);
    const propia = await servicio.obtener(1, sesion('docente', 1));
    expect(propia).not.toHaveProperty('documento');
  });

  it('responde 404 si no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(servicio.obtener(9, sesion('recursos_humanos'))).rejects.toThrow(NotFoundException);
  });
});

describe('PersonasService.darDeBaja', () => {
  it('da de baja a una persona sin ocupaciones abiertas', async () => {
    const { servicio, filas } = crearEntorno([persona()], {
      ocupaciones: [ocupacion({ fechaHasta: '2026-06-14' })],
    });
    const resultado = await servicio.darDeBaja(1);
    expect(resultado.persona.activo).toBe(false);
    expect(resultado.advertencias).toEqual([]);
    expect(filas[0].activo).toBe(false);
  });

  it.each([
    ['vigente sin fin', { fechaHasta: null }],
    ['que vence hoy', { fechaHasta: HOY }],
    ['futura', { fechaDesde: '2026-09-01' }],
  ])('rechaza con 409 si tiene una ocupación %s, y la nombra', async (_titulo, parcial) => {
    const { servicio, filas } = crearEntorno([persona()], {
      ocupaciones: [ocupacion(parcial)],
    });
    const error = await servicio.darDeBaja(1).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toContain('P-0010');
    expect(filas[0].activo).toBe(true);
  });

  it('advierte que el usuario vinculado sigue activo', async () => {
    const { servicio } = crearEntorno([persona()], { conUsuario: [1] });
    const resultado = await servicio.darDeBaja(1);
    expect(resultado.persona.activo).toBe(false);
    expect(resultado.advertencias).toHaveLength(1);
    expect(resultado.advertencias[0]).toMatch(/usuario/);
  });

  it('es idempotente con una persona ya dada de baja', async () => {
    const { servicio, repo } = crearEntorno([persona({ activo: false })]);
    await expect(servicio.darDeBaja(1)).resolves.toMatchObject({
      persona: { activo: false },
    });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('responde 404 y toma el bloqueo consultivo', async () => {
    const { servicio, consultas } = crearEntorno([]);
    await expect(servicio.darDeBaja(9)).rejects.toThrow(NotFoundException);
    expect(consultas[0]).toContain('pg_advisory_xact_lock');
  });
});

describe('PersonasService.reactivar', () => {
  it('reactiva una persona dada de baja', async () => {
    const { servicio, filas } = crearEntorno([persona({ activo: false })]);
    const detalle = await servicio.reactivar(1);
    expect(detalle.activo).toBe(true);
    expect(filas[0].activo).toBe(true);
  });
});

describe('PersonasService.exigirActiva', () => {
  it('acepta una persona activa', async () => {
    const { servicio } = crearEntorno([persona()]);
    await expect(servicio.exigirActiva(1)).resolves.toBeUndefined();
  });
  it('rechaza con 400 una persona inexistente o dada de baja', async () => {
    const { servicio } = crearEntorno([persona({ id: 2, activo: false })]);
    await expect(servicio.exigirActiva(1)).rejects.toThrow(BadRequestException);
    await expect(servicio.exigirActiva(2)).rejects.toThrow(/dada de baja/);
  });
});
```

- [x] **Paso 2: Verificar que falla**

Run: `cd backend && npx vitest run src/modules/personas/personas.service.spec.ts`
Expected: FAIL (no existe `personas.service.ts`).

- [x] **Paso 3: Implementar el servicio**

`personas.service.ts`:

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
  IsNull,
  Not,
  Repository,
  type FindOptionsWhere,
} from 'typeorm';
import { escaparLike } from '../../common/like.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { ReferenciaService } from '../referencia/referencia.service.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { exigirAccesoAPersona } from './acceso.js';
import type { ActualizarPersonaDto } from './dto/actualizar-persona.dto.js';
import type { CrearPersonaDto } from './dto/crear-persona.dto.js';
import type { FiltroPersonasDto } from './dto/filtro-personas.dto.js';
import type {
  PersonaDetalleDto,
  PersonaDto,
  ResultadoBajaPersonaDto,
} from './dto/persona.dto.js';
import { Ocupacion } from './entities/ocupacion.entity.js';
import { Persona } from './entities/persona.entity.js';
import {
  estaAbierta,
  estadoDe,
  hoyDeLaBase,
  validarFechasDePersona,
} from './fechas.js';
import { aOcupacionDto } from './ocupacion.mapper.js';
import { aPersonaDto, puedeVerDatosPersonales } from './persona.mapper.js';
import { DOMINIO_SITUACION_REVISTA } from './personas.constantes.js';
import { enTransaccionDePersonas } from './transaccion.js';

/** Único campo de la persona que admite `null` en una modificación. */
const CAMPOS_NULABLES = new Set(['fechaPrevistaRetiro']);

function cambios(dto: ActualizarPersonaDto): Partial<Persona> {
  const resultado: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(dto)) {
    if (valor === undefined) continue;
    if (valor === null && !CAMPOS_NULABLES.has(campo)) {
      throw new BadRequestException(`${campo} no admite null`);
    }
    resultado[campo] = valor;
  }
  return resultado as Partial<Persona>;
}

/** Personas del departamento (RF06). Las escrituras corren con el bloqueo de estructura. */
@Injectable()
export class PersonasService {
  constructor(
    @InjectRepository(Persona) private readonly personas: Repository<Persona>,
    @InjectRepository(Ocupacion)
    private readonly ocupaciones: Repository<Ocupacion>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly referencia: ReferenciaService,
  ) {}

  async listar(
    filtro: FiltroPersonasDto,
    sesion: SesionUsuario,
  ): Promise<PersonaDto[]> {
    const base: FindOptionsWhere<Persona> = {};
    if (filtro.activo !== undefined) base.activo = filtro.activo;
    const texto = filtro.q?.trim();
    const patron = texto ? `%${escaparLike(texto)}%` : undefined;
    const filas = await this.personas.find({
      where: patron
        ? [
            { ...base, legajo: ILike(patron) },
            { ...base, apellido: ILike(patron) },
            { ...base, nombre: ILike(patron) },
          ]
        : base,
      order: { apellido: 'ASC', nombre: 'ASC' },
    });
    const conUsuario = await this.idsConUsuario();
    const verSensibles = puedeVerDatosPersonales(sesion.rol);
    return filas
      .filter((p) => filtro.sinUsuario !== true || !conUsuario.has(p.id))
      .map((p) =>
        aPersonaDto(p, { verSensibles, tieneUsuario: conUsuario.has(p.id) }),
      );
  }

  async obtener(id: number, sesion: SesionUsuario): Promise<PersonaDetalleDto> {
    exigirAccesoAPersona(sesion, id);
    return this.detalle(id, puedeVerDatosPersonales(sesion.rol));
  }

  async crear(dto: CrearPersonaDto): Promise<PersonaDetalleDto> {
    validarFechasDePersona(
      dto.fechaNacimiento,
      dto.fechaIngreso,
      dto.fechaPrevistaRetiro ?? null,
    );
    await this.referencia.validarActivo(
      DOMINIO_SITUACION_REVISTA,
      dto.idSituacionRevista,
    );
    const id = await enTransaccionDePersonas(this.personas, async (manager) => {
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
    });
    // Solo RR. HH. escribe, y RR. HH. ve los datos personales.
    return this.detalle(id, true);
  }

  async actualizar(
    id: number,
    dto: ActualizarPersonaDto,
  ): Promise<PersonaDetalleDto> {
    const nuevos = cambios(dto);
    await enTransaccionDePersonas(this.personas, async (manager) => {
      const repo = manager.getRepository(Persona);
      const persona = await this.buscar(repo, id);
      const final = { ...persona, ...nuevos };
      validarFechasDePersona(
        final.fechaNacimiento,
        final.fechaIngreso,
        final.fechaPrevistaRetiro,
      );
      if (
        dto.idSituacionRevista !== undefined &&
        dto.idSituacionRevista !== persona.idSituacionRevista
      ) {
        await this.referencia.validarActivo(
          DOMINIO_SITUACION_REVISTA,
          dto.idSituacionRevista,
        );
      }
      if (final.legajo !== persona.legajo || final.documento !== persona.documento) {
        await this.exigirIdentidadLibre(repo, final.legajo, final.documento, id);
      }
      await repo.save(Object.assign(persona, nuevos));
    });
    return this.detalle(id, true);
  }

  /** Baja lógica. Se bloquea mientras tenga ocupaciones vigentes o futuras. */
  async darDeBaja(id: number): Promise<ResultadoBajaPersonaDto> {
    await enTransaccionDePersonas(this.personas, async (manager) => {
      const repo = manager.getRepository(Persona);
      const persona = await this.buscar(repo, id);
      if (!persona.activo) return;

      const hoy = await hoyDeLaBase(manager);
      const abiertas = (
        await manager.getRepository(Ocupacion).find({
          where: { idPersona: id },
          relations: { puesto: true },
        })
      ).filter((o) => estaAbierta(o, hoy));
      if (abiertas.length > 0) {
        throw new ConflictException(
          `No se puede dar de baja: tiene ocupaciones vigentes o futuras (${abiertas
            .map((o) => `${o.puesto.codigo} desde ${o.fechaDesde}`)
            .join(', ')}). Cerralas o anulalas primero`,
        );
      }
      persona.activo = false;
      await repo.save(persona);
    });
    const persona = await this.detalle(id, true);
    const advertencias = persona.tieneUsuario
      ? [
          'La persona tiene un usuario vinculado que sigue activo: pedile al administrador que lo desactive',
        ]
      : [];
    return { persona, advertencias };
  }

  async reactivar(id: number): Promise<PersonaDetalleDto> {
    await enTransaccionDePersonas(this.personas, async (manager) => {
      const repo = manager.getRepository(Persona);
      const persona = await this.buscar(repo, id);
      if (persona.activo) return;
      persona.activo = true;
      await repo.save(persona);
    });
    return this.detalle(id, true);
  }

  /** Para vincular un usuario: la persona debe existir y no estar dada de baja. */
  async exigirActiva(idPersona: number): Promise<void> {
    const persona = await this.personas.findOne({ where: { id: idPersona } });
    if (!persona) {
      throw new BadRequestException(`La persona ${idPersona} no existe`);
    }
    if (!persona.activo) {
      throw new BadRequestException(
        `La persona ${persona.apellido}, ${persona.nombre} está dada de baja y no puede vincularse a un usuario`,
      );
    }
  }

  private async detalle(
    id: number,
    verSensibles: boolean,
  ): Promise<PersonaDetalleDto> {
    const persona = await this.buscar(this.personas, id);
    const hoy = await hoyDeLaBase(this.personas.manager);
    const ocupaciones = await this.ocupaciones.find({
      where: { idPersona: id },
      order: { fechaDesde: 'DESC' },
    });
    const tieneUsuario = (await this.usuarios.count({ where: { idPersona: id } })) > 0;
    return {
      ...aPersonaDto(persona, { verSensibles, tieneUsuario }),
      ocupacionesVigentes: ocupaciones
        .filter((o) => estadoDe(o, hoy) === 'vigente')
        .map((o) => aOcupacionDto(o, hoy)),
    };
  }

  private async idsConUsuario(): Promise<Set<number>> {
    const vinculados = await this.usuarios.find({
      select: { idPersona: true },
      where: { idPersona: Not(IsNull()) },
    });
    return new Set(vinculados.map((u) => u.idPersona as number));
  }

  /** `repo` puede ser el de una transacción en curso. */
  private async buscar(repo: Repository<Persona>, id: number): Promise<Persona> {
    const persona = await repo.findOne({ where: { id } });
    if (!persona) throw new NotFoundException(`No existe la persona ${id}`);
    return persona;
  }

  /** Legajo y documento únicos; el mensaje nombra a quien ya los tiene. */
  private async exigirIdentidadLibre(
    repo: Repository<Persona>,
    legajo: string,
    documento: string,
    idExcluido?: number,
  ): Promise<void> {
    const repetidas = (await repo.find({ where: [{ legajo }, { documento }] })).filter(
      (p) => p.id !== idExcluido,
    );
    const porLegajo = repetidas.find((p) => p.legajo === legajo);
    if (porLegajo) {
      throw new ConflictException(
        `El legajo ${legajo} ya lo tiene ${porLegajo.apellido}, ${porLegajo.nombre}`,
      );
    }
    const porDocumento = repetidas.find((p) => p.documento === documento);
    if (porDocumento) {
      throw new ConflictException(
        `El documento ${documento} ya lo tiene ${porDocumento.apellido}, ${porDocumento.nombre} (legajo ${porDocumento.legajo})`,
      );
    }
  }
}
```

- [x] **Paso 4: Verificar que el test pasa**

Run: `cd backend && npx vitest run src/modules/personas/personas.service.spec.ts`
Expected: PASS.

- [x] **Paso 5: Implementar el controller**

`personas.controller.ts`:

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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { ROLES, ROLES_SIN_DOCENTE, TODOS_LOS_ROLES } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { ActualizarPersonaDto } from './dto/actualizar-persona.dto.js';
import { CrearPersonaDto } from './dto/crear-persona.dto.js';
import { FiltroPersonasDto } from './dto/filtro-personas.dto.js';
import {
  PersonaDetalleDto,
  PersonaDto,
  ResultadoBajaPersonaDto,
} from './dto/persona.dto.js';
import { PersonasService } from './personas.service.js';

/** Registro de personas (RF06). */
@ApiTags('personas')
@Controller('personas')
export class PersonasController {
  constructor(private readonly servicio: PersonasService) {}

  @Get()
  @Roles(...ROLES_SIN_DOCENTE)
  @ApiOkResponse({ type: PersonaDto, isArray: true })
  listar(
    @Query() filtro: FiltroPersonasDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PersonaDto[]> {
    return this.servicio.listar(filtro, sesion);
  }

  @Get(':id')
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: PersonaDetalleDto })
  @ApiNotFoundResponse({ description: 'La persona no existe' })
  @ApiForbiddenResponse({ description: 'El docente solo accede a su propia ficha' })
  obtener(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PersonaDetalleDto> {
    return this.servicio.obtener(id, sesion);
  }

  @Post()
  @Roles(ROLES.recursosHumanos)
  @ApiCreatedResponse({ type: PersonaDetalleDto })
  @ApiBadRequestResponse({ description: 'Fechas incoherentes o situación inválida' })
  @ApiConflictResponse({ description: 'Legajo o documento repetidos' })
  crear(@Body() dto: CrearPersonaDto): Promise<PersonaDetalleDto> {
    return this.servicio.crear(dto);
  }

  @Patch(':id')
  @Roles(ROLES.recursosHumanos)
  @ApiOkResponse({ type: PersonaDetalleDto })
  @ApiNotFoundResponse({ description: 'La persona no existe' })
  @ApiBadRequestResponse({ description: 'Fechas incoherentes o situación inválida' })
  @ApiConflictResponse({ description: 'Legajo o documento repetidos' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPersonaDto,
  ): Promise<PersonaDetalleDto> {
    return this.servicio.actualizar(id, dto);
  }

  @Post(':id/baja')
  @HttpCode(200)
  @Roles(ROLES.recursosHumanos)
  @ApiOkResponse({ type: ResultadoBajaPersonaDto })
  @ApiNotFoundResponse({ description: 'La persona no existe' })
  @ApiConflictResponse({ description: 'Tiene ocupaciones vigentes o futuras' })
  darDeBaja(@Param('id', ParseIntPipe) id: number): Promise<ResultadoBajaPersonaDto> {
    return this.servicio.darDeBaja(id);
  }

  @Post(':id/reactivar')
  @HttpCode(200)
  @Roles(ROLES.recursosHumanos)
  @ApiOkResponse({ type: PersonaDetalleDto })
  @ApiNotFoundResponse({ description: 'La persona no existe' })
  reactivar(@Param('id', ParseIntPipe) id: number): Promise<PersonaDetalleDto> {
    return this.servicio.reactivar(id);
  }
}
```

- [x] **Paso 6: Registrar en el módulo**

Reemplazar `personas.module.ts` por:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferenciaModule } from '../referencia/referencia.module.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { Ocupacion } from './entities/ocupacion.entity.js';
import { Persona } from './entities/persona.entity.js';
import { PersonasController } from './personas.controller.js';
import { PersonasService } from './personas.service.js';

/**
 * Personas y ocupaciones (RF06–RF07). Registra `Usuario` solo para consultar
 * qué personas ya tienen usuario: no importa `UsuariosModule`, que importa a este.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Persona, Ocupacion, Usuario]),
    ReferenciaModule,
  ],
  controllers: [PersonasController],
  providers: [PersonasService],
  exports: [PersonasService],
})
export class PersonasModule {}
```

- [x] **Paso 7: Verificar la suite y el arranque**

```bash
cd backend && npm test
docker compose restart backend && docker compose logs --tail=30 backend
```

Expected: tests PASS (incluido `cobertura-roles.spec.ts`, que exige `@Roles` en las rutas nuevas); el backend arranca sin errores de inyección. Probar con la sesión del administrador: `curl -s -c /tmp/c.txt -H 'Content-Type: application/json' -d '{"nombreUsuario":"<ADMIN_USUARIO>","clave":"<ADMIN_CLAVE>"}' localhost:3000/api/auth/login` y `curl -s -b /tmp/c.txt localhost:3000/api/personas` → `[]`.

- [x] **Paso 8: Lint, formato y commit**

```bash
cd backend && npm run lint && npm run format && npm test
git add backend/src
git commit -m "Agregar el alta, edición y baja de personas"
```

---

## Tarea 6: `OcupacionesService` y `OcupacionesController`

**Files:**
- Create: `backend/src/modules/personas/ocupaciones.service.ts`, `ocupaciones.service.spec.ts`, `ocupaciones.service.int.spec.ts`, `ocupaciones.controller.ts`
- Modify: `backend/src/modules/personas/personas.module.ts`

**Interfaces:**
- Consumes: tareas 4 y 5; entidades `Ocupacion`, `Persona`, `Puesto`.
- Produces: `OcupacionesService` con
  - `listarDePersona(idPersona: number, sesion: SesionUsuario): Promise<OcupacionDto[]>` (por `fechaDesde` descendente; 404 si la persona no existe; 403 al docente ajeno)
  - `listarDePuesto(idPuesto: number): Promise<OcupanteDto[]>` (solo vigentes; 404 si el puesto no existe)
  - `crear(idPersona: number, dto: CrearOcupacionDto): Promise<OcupacionDto>`
  - `actualizar(idPersona: number, idPuesto: number, fechaDesde: FechaISO, dto: ActualizarOcupacionDto): Promise<OcupacionDto>`
  - `cerrar(idPersona: number, idPuesto: number, fechaDesde: FechaISO, dto: CerrarOcupacionDto): Promise<OcupacionDto>`
  - `anular(idPersona: number, idPuesto: number, fechaDesde: FechaISO): Promise<void>`

- [x] **Paso 1: Escribir el test unitario**

`ocupaciones.service.spec.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { Puesto } from '../estructura/entities/puesto.entity.js';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { Ocupacion } from './entities/ocupacion.entity.js';
import type { Persona } from './entities/persona.entity.js';
import { OcupacionesService } from './ocupaciones.service.js';

const HOY = '2026-06-15';

const ocupacion = (parcial: Partial<Ocupacion> = {}): Ocupacion =>
  ({
    idPersona: 1,
    idPuesto: 10,
    fechaDesde: '2024-01-01',
    fechaHasta: null,
    idCaracterOcupacion: 1,
    idDedicacion: 1,
    ...parcial,
  }) as Ocupacion;

const sesion = (rol: SesionUsuario['rol'], idPersona: number | null = null): SesionUsuario => ({
  id: 1,
  nombreUsuario: 'u',
  rol,
  idPersona,
  unidades: [],
});

interface Config {
  personas?: Partial<Persona>[];
  puestos?: Partial<Puesto>[];
}

function crearEntorno(existentes: Ocupacion[], config: Config = {}) {
  const filas = existentes.map((o) => ({ ...o }));
  const personas = config.personas ?? [
    { id: 1, activo: true, apellido: 'Pérez', nombre: 'Ana', legajo: 'L-1' },
  ];
  const puestos = config.puestos ?? [
    { id: 10, codigo: 'P-0010', activo: true },
    { id: 11, codigo: 'P-0011', activo: true },
  ];

  const mismaClave = (o: Ocupacion, k: Partial<Ocupacion>) =>
    o.idPersona === k.idPersona && o.idPuesto === k.idPuesto && o.fechaDesde === k.fechaDesde;

  const repoOcupaciones = {
    find: vi.fn(async ({ where }: { where: Partial<Ocupacion> }) =>
      filas
        .filter((o) =>
          Object.entries(where).every(([k, v]) => o[k as keyof Ocupacion] === v),
        )
        .map((o) => ({
          ...o,
          persona: personas.find((p) => p.id === o.idPersona),
        })),
    ),
    findOne: vi.fn(async ({ where }: { where: Partial<Ocupacion> }) => {
      const fila = filas.find((o) => mismaClave(o, where));
      return fila ? { ...fila } : null;
    }),
    create: vi.fn((datos: Partial<Ocupacion>) => ({ ...datos })),
    save: vi.fn(async (o: Ocupacion) => {
      const i = filas.findIndex((f) => mismaClave(f, o));
      if (i >= 0) filas[i] = { ...o };
      else filas.push({ ...o });
      return { ...o };
    }),
    delete: vi.fn(async (k: Partial<Ocupacion>) => {
      const i = filas.findIndex((f) => mismaClave(f, k));
      if (i >= 0) filas.splice(i, 1);
    }),
  };
  const repoPersonas = {
    findOne: vi.fn(async ({ where }: { where: { id: number } }) => {
      const p = personas.find((x) => x.id === where.id);
      return p ? { ...p } : null;
    }),
  };
  const repoPuestos = {
    findOne: vi.fn(async ({ where }: { where: { id: number } }) => {
      const p = puestos.find((x) => x.id === where.id);
      return p ? { ...p } : null;
    }),
  };
  const consultas: string[] = [];
  const manager = {
    query: vi.fn(async (sql: string) => {
      consultas.push(sql);
      return sql.includes('CURRENT_DATE') ? [{ hoy: HOY }] : [];
    }),
    getRepository: (entidad: { name: string }) =>
      entidad.name === 'Ocupacion'
        ? repoOcupaciones
        : entidad.name === 'Persona'
          ? repoPersonas
          : repoPuestos,
    transaction: async (trabajo: (m: unknown) => Promise<unknown>) => trabajo(manager),
  };
  (repoOcupaciones as unknown as { manager: unknown }).manager = manager;

  const referencia = { validarActivo: vi.fn(async () => undefined) };
  const servicio = new OcupacionesService(
    repoOcupaciones as unknown as Repository<Ocupacion>,
    repoPersonas as unknown as Repository<Persona>,
    repoPuestos as unknown as Repository<Puesto>,
    referencia as unknown as ReferenciaService,
  );
  return { servicio, repoOcupaciones, referencia, filas, consultas };
}

const alta = {
  idPuesto: 10,
  fechaDesde: '2024-01-01',
  idCaracterOcupacion: 1,
  idDedicacion: 2,
};

describe('OcupacionesService.crear', () => {
  it('crea la ocupación, valida carácter y dedicación y toma el bloqueo', async () => {
    const { servicio, referencia, consultas, filas } = crearEntorno([]);
    const creada = await servicio.crear(1, alta);
    expect(creada).toEqual({
      idPersona: 1,
      idPuesto: 10,
      fechaDesde: '2024-01-01',
      fechaHasta: null,
      idCaracterOcupacion: 1,
      idDedicacion: 2,
      estado: 'vigente',
    });
    expect(filas).toHaveLength(1);
    expect(referencia.validarActivo).toHaveBeenCalledWith('caracter-ocupacion', 1);
    expect(referencia.validarActivo).toHaveBeenCalledWith('dedicacion', 2);
    expect(consultas[0]).toContain('pg_advisory_xact_lock');
  });

  it('rechaza con 400 una fecha de fin anterior a la de inicio, sin tocar la base', async () => {
    const { servicio, filas } = crearEntorno([]);
    await expect(
      servicio.crear(1, { ...alta, fechaHasta: '2023-12-31' }),
    ).rejects.toThrow(BadRequestException);
    expect(filas).toHaveLength(0);
  });

  it('acepta una ocupación ya terminada (carga de historial) con estado pasada', async () => {
    const { servicio } = crearEntorno([]);
    const creada = await servicio.crear(1, {
      ...alta,
      fechaDesde: '2020-01-01',
      fechaHasta: '2020-12-31',
    });
    expect(creada.estado).toBe('pasada');
  });

  it('rechaza con 409 un solape en el mismo puesto y nombra el período', async () => {
    const { servicio, filas } = crearEntorno([
      ocupacion({ fechaDesde: '2024-01-01', fechaHasta: '2024-06-30' }),
    ]);
    const error = await servicio
      .crear(1, { ...alta, fechaDesde: '2024-06-30', fechaHasta: '2024-12-31' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toContain('2024-01-01');
    expect(filas).toHaveLength(1);
  });

  it('permite fechas adyacentes y ocupaciones simultáneas en otro puesto', async () => {
    const { servicio, filas } = crearEntorno([
      ocupacion({ fechaDesde: '2024-01-01', fechaHasta: '2024-06-30' }),
    ]);
    await servicio.crear(1, { ...alta, fechaDesde: '2024-07-01' });
    await servicio.crear(1, { ...alta, idPuesto: 11, fechaDesde: '2024-01-01' });
    expect(filas).toHaveLength(3);
  });

  it('rechaza con 400 una persona dada de baja o un puesto dado de baja', async () => {
    const baja = crearEntorno([], { personas: [{ id: 1, activo: false, apellido: 'P', nombre: 'A' }] });
    await expect(baja.servicio.crear(1, alta)).rejects.toThrow(/dada de baja/);
    const puestoBaja = crearEntorno([], { puestos: [{ id: 10, codigo: 'P-0010', activo: false }] });
    await expect(puestoBaja.servicio.crear(1, alta)).rejects.toThrow(/P-0010/);
  });

  it('responde 404 si la persona no existe y 400 si el puesto no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(servicio.crear(9, alta)).rejects.toThrow(NotFoundException);
    await expect(servicio.crear(1, { ...alta, idPuesto: 99 })).rejects.toThrow(BadRequestException);
  });
});

describe('OcupacionesService.actualizar', () => {
  it('modifica carácter y dedicación de una ocupación vigente', async () => {
    const { servicio, referencia } = crearEntorno([ocupacion()]);
    const actualizada = await servicio.actualizar(1, 10, '2024-01-01', {
      idCaracterOcupacion: 2,
      idDedicacion: 3,
    });
    expect(actualizada).toMatchObject({ idCaracterOcupacion: 2, idDedicacion: 3 });
    expect(referencia.validarActivo).toHaveBeenCalledTimes(2);
  });

  it('no valida de nuevo los valores que no cambian', async () => {
    const { servicio, referencia } = crearEntorno([ocupacion()]);
    await servicio.actualizar(1, 10, '2024-01-01', { idCaracterOcupacion: 1 });
    expect(referencia.validarActivo).not.toHaveBeenCalled();
  });

  it('rechaza con 409 modificar una ocupación pasada', async () => {
    const { servicio } = crearEntorno([ocupacion({ fechaHasta: '2026-06-14' })]);
    await expect(
      servicio.actualizar(1, 10, '2024-01-01', { idDedicacion: 2 }),
    ).rejects.toThrow(/historial/);
  });

  it('modifica una ocupación que vence hoy', async () => {
    const { servicio } = crearEntorno([ocupacion({ fechaHasta: HOY })]);
    await expect(
      servicio.actualizar(1, 10, '2024-01-01', { idDedicacion: 2 }),
    ).resolves.toMatchObject({ idDedicacion: 2 });
  });

  it('rechaza con 400 un fin anterior al inicio y con 409 un fin que provoca solape', async () => {
    const { servicio } = crearEntorno([
      ocupacion({ fechaDesde: '2024-01-01', fechaHasta: '2026-06-30' }),
      ocupacion({ fechaDesde: '2026-07-01', fechaHasta: null }),
    ]);
    await expect(
      servicio.actualizar(1, 10, '2024-01-01', { fechaHasta: '2023-12-31' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      servicio.actualizar(1, 10, '2024-01-01', { fechaHasta: '2026-07-15' }),
    ).rejects.toThrow(ConflictException);
  });

  it('no se solapa consigo misma al ampliar su propio fin', async () => {
    const { servicio } = crearEntorno([ocupacion({ fechaHasta: '2026-12-31' })]);
    await expect(
      servicio.actualizar(1, 10, '2024-01-01', { fechaHasta: '2027-12-31' }),
    ).resolves.toMatchObject({ fechaHasta: '2027-12-31' });
  });

  it('permite reabrir una ocupación vigente con fechaHasta null', async () => {
    const { servicio } = crearEntorno([ocupacion({ fechaHasta: '2026-12-31' })]);
    await expect(
      servicio.actualizar(1, 10, '2024-01-01', { fechaHasta: null }),
    ).resolves.toMatchObject({ fechaHasta: null });
  });

  it('rechaza con 400 poner null en carácter o dedicación', async () => {
    const { servicio } = crearEntorno([ocupacion()]);
    await expect(
      servicio.actualizar(1, 10, '2024-01-01', {
        idDedicacion: null as unknown as number,
      }),
    ).rejects.toThrow(/idDedicacion no admite null/);
  });

  it('responde 404 si la ocupación no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(
      servicio.actualizar(1, 10, '2024-01-01', { idDedicacion: 2 }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('OcupacionesService.cerrar', () => {
  it('fija la fecha de fin', async () => {
    const { servicio, filas } = crearEntorno([ocupacion()]);
    const cerrada = await servicio.cerrar(1, 10, '2024-01-01', { fechaHasta: HOY });
    expect(cerrada).toMatchObject({ fechaHasta: HOY, estado: 'vigente' });
    expect(filas[0].fechaHasta).toBe(HOY);
  });

  it('con un fin pasado, la ocupación queda como historial', async () => {
    const { servicio } = crearEntorno([ocupacion()]);
    expect((await servicio.cerrar(1, 10, '2024-01-01', { fechaHasta: '2025-12-31' })).estado).toBe('pasada');
  });

  it('rechaza con 400 un fin anterior al inicio', async () => {
    const { servicio, filas } = crearEntorno([ocupacion()]);
    await expect(
      servicio.cerrar(1, 10, '2024-01-01', { fechaHasta: '2023-01-01' }),
    ).rejects.toThrow(BadRequestException);
    expect(filas[0].fechaHasta).toBeNull();
  });

  it('rechaza con 409 cerrar una ocupación que ya es historial', async () => {
    const { servicio } = crearEntorno([ocupacion({ fechaHasta: '2025-01-31' })]);
    await expect(
      servicio.cerrar(1, 10, '2024-01-01', { fechaHasta: '2025-02-28' }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('OcupacionesService.anular', () => {
  it('elimina una ocupación que todavía no empezó', async () => {
    const { servicio, filas } = crearEntorno([ocupacion({ fechaDesde: '2026-07-01' })]);
    await servicio.anular(1, 10, '2026-07-01');
    expect(filas).toHaveLength(0);
  });

  it.each([
    ['vigente', { fechaDesde: '2024-01-01' }],
    ['que empieza hoy', { fechaDesde: HOY }],
    ['pasada', { fechaDesde: '2020-01-01', fechaHasta: '2020-12-31' }],
  ])('rechaza con 409 anular una ocupación %s', async (_titulo, parcial) => {
    const { servicio, filas } = crearEntorno([ocupacion(parcial)]);
    await expect(
      servicio.anular(1, 10, parcial.fechaDesde as string),
    ).rejects.toThrow(/cerrala/);
    expect(filas).toHaveLength(1);
  });

  it('responde 404 si no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(servicio.anular(1, 10, '2026-07-01')).rejects.toThrow(NotFoundException);
  });
});

describe('OcupacionesService.listarDePersona', () => {
  it('devuelve el historial por fecha de inicio descendente, con su estado', async () => {
    const { servicio, repoOcupaciones } = crearEntorno([
      ocupacion({ fechaDesde: '2020-01-01', fechaHasta: '2021-12-31' }),
      ocupacion({ fechaDesde: '2024-01-01' }),
    ]);
    const lista = await servicio.listarDePersona(1, sesion('recursos_humanos'));
    expect(repoOcupaciones.find).toHaveBeenCalledWith(
      expect.objectContaining({ order: { fechaDesde: 'DESC' } }),
    );
    expect(lista.map((o) => o.estado).sort()).toEqual(['pasada', 'vigente']);
  });

  it('el docente solo lee las suyas', async () => {
    const { servicio } = crearEntorno([ocupacion()]);
    await expect(servicio.listarDePersona(1, sesion('docente', 1))).resolves.toHaveLength(1);
    await expect(servicio.listarDePersona(1, sesion('docente', 2))).rejects.toThrow(ForbiddenException);
  });

  it('responde 404 si la persona no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(servicio.listarDePersona(9, sesion('recursos_humanos'))).rejects.toThrow(NotFoundException);
  });
});

describe('OcupacionesService.listarDePuesto', () => {
  it('devuelve solo los ocupantes vigentes, con los datos mínimos de la persona', async () => {
    const { servicio } = crearEntorno([
      ocupacion(),
      ocupacion({ fechaDesde: '2010-01-01', fechaHasta: '2012-01-01' }),
      ocupacion({ fechaDesde: '2027-01-01' }),
    ]);
    const ocupantes = await servicio.listarDePuesto(10);
    expect(ocupantes).toHaveLength(1);
    expect(ocupantes[0]).toMatchObject({ legajo: 'L-1', apellido: 'Pérez', estado: 'vigente' });
    expect(ocupantes[0]).not.toHaveProperty('documento');
  });

  it('responde 404 si el puesto no existe', async () => {
    const { servicio } = crearEntorno([]);
    await expect(servicio.listarDePuesto(99)).rejects.toThrow(NotFoundException);
  });
});
```

- [x] **Paso 2: Verificar que falla**

Run: `cd backend && npx vitest run src/modules/personas/ocupaciones.service.spec.ts`
Expected: FAIL (no existe `ocupaciones.service.ts`).

- [x] **Paso 3: Implementar el servicio**

`ocupaciones.service.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { Puesto } from '../estructura/entities/puesto.entity.js';
import { ReferenciaService } from '../referencia/referencia.service.js';
import { exigirAccesoAPersona } from './acceso.js';
import type { ActualizarOcupacionDto } from './dto/actualizar-ocupacion.dto.js';
import type { CerrarOcupacionDto } from './dto/cerrar-ocupacion.dto.js';
import type { CrearOcupacionDto } from './dto/crear-ocupacion.dto.js';
import type { OcupacionDto, OcupanteDto } from './dto/ocupacion.dto.js';
import { Ocupacion } from './entities/ocupacion.entity.js';
import { Persona } from './entities/persona.entity.js';
import {
  esFechaValida,
  estadoDe,
  hoyDeLaBase,
  seSolapan,
  validarRango,
  type FechaISO,
} from './fechas.js';
import { aOcupacionDto, aOcupanteDto } from './ocupacion.mapper.js';
import {
  DOMINIO_CARACTER_OCUPACION,
  DOMINIO_DEDICACION,
} from './personas.constantes.js';
import { enTransaccionDePersonas } from './transaccion.js';

/** Campos que no admiten `null` en una modificación (`fechaHasta` sí: reabre la ocupación). */
const CAMPOS_OBLIGATORIOS = ['idCaracterOcupacion', 'idDedicacion'] as const;

const describir = (o: { fechaDesde: FechaISO; fechaHasta: FechaISO | null }) =>
  o.fechaHasta === null
    ? `desde ${o.fechaDesde}, sin fecha de fin`
    : `del ${o.fechaDesde} al ${o.fechaHasta}`;

/** Ocupaciones de puestos con vigencia (RF07). Las escrituras corren con el bloqueo de estructura. */
@Injectable()
export class OcupacionesService {
  constructor(
    @InjectRepository(Ocupacion)
    private readonly ocupaciones: Repository<Ocupacion>,
    @InjectRepository(Persona) private readonly personas: Repository<Persona>,
    @InjectRepository(Puesto) private readonly puestos: Repository<Puesto>,
    private readonly referencia: ReferenciaService,
  ) {}

  async listarDePersona(
    idPersona: number,
    sesion: SesionUsuario,
  ): Promise<OcupacionDto[]> {
    exigirAccesoAPersona(sesion, idPersona);
    await this.exigirPersona(this.personas, idPersona);
    const hoy = await hoyDeLaBase(this.ocupaciones.manager);
    const filas = await this.ocupaciones.find({
      where: { idPersona },
      order: { fechaDesde: 'DESC' },
    });
    return filas.map((o) => aOcupacionDto(o, hoy));
  }

  /** Quiénes ocupan hoy el puesto. */
  async listarDePuesto(idPuesto: number): Promise<OcupanteDto[]> {
    const puesto = await this.puestos.findOne({ where: { id: idPuesto } });
    if (!puesto) throw new NotFoundException(`No existe el puesto ${idPuesto}`);
    const hoy = await hoyDeLaBase(this.ocupaciones.manager);
    const filas = await this.ocupaciones.find({
      where: { idPuesto },
      relations: { persona: true },
    });
    return filas
      .filter((o) => estadoDe(o, hoy) === 'vigente')
      .map((o) => aOcupanteDto(o, hoy))
      .sort(
        (a, b) =>
          a.apellido.localeCompare(b.apellido, 'es') ||
          a.nombre.localeCompare(b.nombre, 'es'),
      );
  }

  async crear(idPersona: number, dto: CrearOcupacionDto): Promise<OcupacionDto> {
    const fechaHasta = dto.fechaHasta ?? null;
    validarRango(dto.fechaDesde, fechaHasta);
    await this.referencia.validarActivo(DOMINIO_CARACTER_OCUPACION, dto.idCaracterOcupacion);
    await this.referencia.validarActivo(DOMINIO_DEDICACION, dto.idDedicacion);

    return enTransaccionDePersonas(this.ocupaciones, async (manager) => {
      const persona = await this.exigirPersona(manager.getRepository(Persona), idPersona);
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
        throw new BadRequestException(`El puesto ${puesto.codigo} está dado de baja`);
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
    });
  }

  /** Solo ocupaciones vigentes o futuras; una pasada es historial inmutable. */
  async actualizar(
    idPersona: number,
    idPuesto: number,
    fechaDesde: FechaISO,
    dto: ActualizarOcupacionDto,
  ): Promise<OcupacionDto> {
    for (const campo of CAMPOS_OBLIGATORIOS) {
      if (dto[campo] === null) {
        throw new BadRequestException(`${campo} no admite null`);
      }
    }
    return enTransaccionDePersonas(this.ocupaciones, async (manager) => {
      const repo = manager.getRepository(Ocupacion);
      const ocupacion = await this.buscar(repo, idPersona, idPuesto, fechaDesde);
      const hoy = await hoyDeLaBase(manager);
      if (estadoDe(ocupacion, hoy) === 'pasada') {
        throw new ConflictException(
          `La ocupación terminó el ${ocupacion.fechaHasta} y forma parte del historial: no se modifica`,
        );
      }

      if (
        dto.idCaracterOcupacion !== undefined &&
        dto.idCaracterOcupacion !== ocupacion.idCaracterOcupacion
      ) {
        await this.referencia.validarActivo(DOMINIO_CARACTER_OCUPACION, dto.idCaracterOcupacion);
      }
      if (dto.idDedicacion !== undefined && dto.idDedicacion !== ocupacion.idDedicacion) {
        await this.referencia.validarActivo(DOMINIO_DEDICACION, dto.idDedicacion);
      }
      const fechaHasta =
        dto.fechaHasta === undefined ? ocupacion.fechaHasta : dto.fechaHasta;
      validarRango(ocupacion.fechaDesde, fechaHasta);
      await this.exigirSinSolape(repo, { ...ocupacion, fechaHasta }, ocupacion.fechaDesde);

      ocupacion.fechaHasta = fechaHasta;
      if (dto.idCaracterOcupacion !== undefined) {
        ocupacion.idCaracterOcupacion = dto.idCaracterOcupacion;
      }
      if (dto.idDedicacion !== undefined) ocupacion.idDedicacion = dto.idDedicacion;
      const guardada = await repo.save(ocupacion);
      return aOcupacionDto(guardada, hoy);
    });
  }

  cerrar(
    idPersona: number,
    idPuesto: number,
    fechaDesde: FechaISO,
    dto: CerrarOcupacionDto,
  ): Promise<OcupacionDto> {
    return this.actualizar(idPersona, idPuesto, fechaDesde, {
      fechaHasta: dto.fechaHasta,
    });
  }

  /** Solo las que todavía no empezaron (error de carga); el resto se cierra. */
  async anular(
    idPersona: number,
    idPuesto: number,
    fechaDesde: FechaISO,
  ): Promise<void> {
    await enTransaccionDePersonas(this.ocupaciones, async (manager) => {
      const repo = manager.getRepository(Ocupacion);
      const ocupacion = await this.buscar(repo, idPersona, idPuesto, fechaDesde);
      const hoy = await hoyDeLaBase(manager);
      if (estadoDe(ocupacion, hoy) !== 'futura') {
        throw new ConflictException(
          'Solo se pueden anular ocupaciones que todavía no empezaron; para terminar una vigente, cerrala con una fecha de fin',
        );
      }
      await repo.delete({ idPersona, idPuesto, fechaDesde });
    });
  }

  private async buscar(
    repo: Repository<Ocupacion>,
    idPersona: number,
    idPuesto: number,
    fechaDesde: FechaISO,
  ): Promise<Ocupacion> {
    if (!esFechaValida(fechaDesde)) {
      throw new BadRequestException('fechaDesde debe ser una fecha AAAA-MM-DD válida');
    }
    const ocupacion = await repo.findOne({
      where: { idPersona, idPuesto, fechaDesde },
    });
    if (!ocupacion) {
      throw new NotFoundException(
        `La persona ${idPersona} no tiene una ocupación del puesto ${idPuesto} que empiece el ${fechaDesde}`,
      );
    }
    return ocupacion;
  }

  private async exigirPersona(
    repo: Pick<Repository<Persona>, 'findOne'>,
    idPersona: number,
  ): Promise<Persona> {
    const persona = await repo.findOne({ where: { id: idPersona } });
    if (!persona) throw new NotFoundException(`No existe la persona ${idPersona}`);
    return persona;
  }

  /**
   * Mensaje legible antes de que la restricción de exclusión de la base
   * (el respaldo) rechace el solape. `fechaDesdeExcluida` deja afuera a la
   * propia ocupación que se está modificando.
   */
  private async exigirSinSolape(
    repo: Repository<Ocupacion>,
    nueva: Pick<Ocupacion, 'idPersona' | 'idPuesto' | 'fechaDesde' | 'fechaHasta'>,
    fechaDesdeExcluida?: FechaISO,
  ): Promise<void> {
    const delPuesto = await repo.find({
      where: { idPersona: nueva.idPersona, idPuesto: nueva.idPuesto },
    });
    const choque = delPuesto.find(
      (o) => o.fechaDesde !== fechaDesdeExcluida && seSolapan(o, nueva),
    );
    if (choque) {
      throw new ConflictException(
        `La persona ya ocupa ese puesto ${describir(choque)}: las fechas no pueden superponerse`,
      );
    }
  }
}
```

- [x] **Paso 4: Verificar que el test pasa**

Run: `cd backend && npx vitest run src/modules/personas/ocupaciones.service.spec.ts`
Expected: PASS.

- [x] **Paso 5: Implementar el controller**

`ocupaciones.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { ROLES, ROLES_SIN_DOCENTE, TODOS_LOS_ROLES } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { ActualizarOcupacionDto } from './dto/actualizar-ocupacion.dto.js';
import { CerrarOcupacionDto } from './dto/cerrar-ocupacion.dto.js';
import { CrearOcupacionDto } from './dto/crear-ocupacion.dto.js';
import { OcupacionDto, OcupanteDto } from './dto/ocupacion.dto.js';
import { ParseFechaPipe } from './fecha.pipe.js';
import { OcupacionesService } from './ocupaciones.service.js';

/** Ocupaciones de puestos (RF07), colgadas de la persona y consultables por puesto. */
@ApiTags('personas')
@Controller()
export class OcupacionesController {
  constructor(private readonly servicio: OcupacionesService) {}

  @Get('personas/:idPersona/ocupaciones')
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: OcupacionDto, isArray: true })
  @ApiNotFoundResponse({ description: 'La persona no existe' })
  @ApiForbiddenResponse({ description: 'El docente solo accede a su propia ficha' })
  listarDePersona(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<OcupacionDto[]> {
    return this.servicio.listarDePersona(idPersona, sesion);
  }

  @Post('personas/:idPersona/ocupaciones')
  @Roles(ROLES.recursosHumanos)
  @ApiCreatedResponse({ type: OcupacionDto })
  @ApiNotFoundResponse({ description: 'La persona no existe' })
  @ApiBadRequestResponse({ description: 'Fechas incoherentes, persona o puesto de baja' })
  @ApiConflictResponse({ description: 'Se solapa con otra ocupación del mismo puesto' })
  crear(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Body() dto: CrearOcupacionDto,
  ): Promise<OcupacionDto> {
    return this.servicio.crear(idPersona, dto);
  }

  @Patch('personas/:idPersona/ocupaciones/:idPuesto/:fechaDesde')
  @Roles(ROLES.recursosHumanos)
  @ApiOkResponse({ type: OcupacionDto })
  @ApiNotFoundResponse({ description: 'La ocupación no existe' })
  @ApiBadRequestResponse({ description: 'Fechas incoherentes' })
  @ApiConflictResponse({ description: 'Ocupación pasada o solape' })
  actualizar(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
    @Param('fechaDesde', ParseFechaPipe) fechaDesde: string,
    @Body() dto: ActualizarOcupacionDto,
  ): Promise<OcupacionDto> {
    return this.servicio.actualizar(idPersona, idPuesto, fechaDesde, dto);
  }

  @Post('personas/:idPersona/ocupaciones/:idPuesto/:fechaDesde/cerrar')
  @HttpCode(200)
  @Roles(ROLES.recursosHumanos)
  @ApiOkResponse({ type: OcupacionDto })
  @ApiNotFoundResponse({ description: 'La ocupación no existe' })
  @ApiBadRequestResponse({ description: 'El fin es anterior al inicio' })
  @ApiConflictResponse({ description: 'Ocupación pasada o solape' })
  cerrar(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
    @Param('fechaDesde', ParseFechaPipe) fechaDesde: string,
    @Body() dto: CerrarOcupacionDto,
  ): Promise<OcupacionDto> {
    return this.servicio.cerrar(idPersona, idPuesto, fechaDesde, dto);
  }

  @Delete('personas/:idPersona/ocupaciones/:idPuesto/:fechaDesde')
  @HttpCode(204)
  @Roles(ROLES.recursosHumanos)
  @ApiNoContentResponse({ description: 'Ocupación anulada' })
  @ApiNotFoundResponse({ description: 'La ocupación no existe' })
  @ApiConflictResponse({ description: 'La ocupación ya empezó' })
  anular(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
    @Param('fechaDesde', ParseFechaPipe) fechaDesde: string,
  ): Promise<void> {
    return this.servicio.anular(idPersona, idPuesto, fechaDesde);
  }

  @Get('puestos/:idPuesto/ocupaciones')
  @Roles(...ROLES_SIN_DOCENTE)
  @ApiOkResponse({ type: OcupanteDto, isArray: true })
  @ApiNotFoundResponse({ description: 'El puesto no existe' })
  listarDePuesto(
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
  ): Promise<OcupanteDto[]> {
    return this.servicio.listarDePuesto(idPuesto);
  }
}
```

- [x] **Paso 6: Registrar en el módulo**

En `personas.module.ts`: importar `Puesto` (`'../estructura/entities/puesto.entity.js'`), `OcupacionesController` y `OcupacionesService`; agregar `Puesto` a `TypeOrmModule.forFeature([Persona, Ocupacion, Usuario, Puesto])`, `OcupacionesController` a `controllers` y `OcupacionesService` a `providers`.

- [x] **Paso 7: Escribir el test de integración del servicio**

`ocupaciones.service.int.spec.ts` (contra PostgreSQL real; fija el comportamiento del bloqueo, de la exclusión y de "hoy"):

```ts
import { ConflictException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { crearBaseTemporal, type BaseTemporal } from '../../testing/base-temporal.js';
import { Puesto } from '../estructura/entities/puesto.entity.js';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { Ocupacion } from './entities/ocupacion.entity.js';
import { Persona } from './entities/persona.entity.js';
import { OcupacionesService } from './ocupaciones.service.js';
import { PersonasService } from './personas.service.js';

describe('Ocupaciones y personas (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ocupaciones: OcupacionesService;
  let personas: PersonasService;
  let ds: DataSource;
  let idPersona: number;
  let idPuesto: number;
  let caracter: number;
  let dedicacion: number;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  /** Fecha relativa a CURRENT_DATE de la base: dia(0) es hoy. */
  const dia = async (delta: number) =>
    (await sql<{ f: string }[]>(`SELECT (CURRENT_DATE + $1::int)::text AS f`, [delta]))[0].f;

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    const referencia = { validarActivo: async () => undefined } as unknown as ReferenciaService;
    ocupaciones = new OcupacionesService(
      ds.getRepository(Ocupacion),
      ds.getRepository(Persona),
      ds.getRepository(Puesto),
      referencia,
    );
    personas = new PersonasService(
      ds.getRepository(Persona),
      ds.getRepository(Ocupacion),
      ds.getRepository(Usuario),
      referencia,
    );
    caracter = (await sql<{ id: number }[]>(`SELECT id_caracter_ocupacion AS id FROM caracter_ocupacion WHERE codigo = 'titular'`))[0].id;
    dedicacion = (await sql<{ id: number }[]>(`SELECT id_dedicacion AS id FROM dedicacion WHERE codigo = 'simple'`))[0].id;
    const revista = (await sql<{ id: number }[]>(`SELECT id_situacion_revista AS id FROM situacion_revista WHERE codigo = 'planta_permanente'`))[0].id;
    idPersona = (await sql<{ id: number }[]>(
      `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
       VALUES ('L-1', 'Pérez', 'Ana', '30111111', '1980-01-01', '2005-03-01', $1) RETURNING id_persona AS id`,
      [revista],
    ))[0].id;
    const [{ id: departamento }] = await sql<{ id: number }[]>(`SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`);
    idPuesto = (await sql<{ id: number }[]>(
      `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
       SELECT 'P-0001', 'Jefe', $1, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
       RETURNING id_puesto AS id`,
      [departamento],
    ))[0].id;
  });
  afterAll(async () => {
    await base.destruir();
  });
  afterEach(async () => {
    await sql('DELETE FROM ocupacion');
    await sql(`UPDATE persona SET activo = true`);
    await sql(`UPDATE puesto SET activo = true`);
  });

  const alta = async (desde: number, hasta: number | null) => ({
    idPuesto,
    fechaDesde: await dia(desde),
    fechaHasta: hasta === null ? null : await dia(hasta),
    idCaracterOcupacion: caracter,
    idDedicacion: dedicacion,
  });

  it('crea una ocupación vigente y la devuelve con estado vigente', async () => {
    const creada = await ocupaciones.crear(idPersona, await alta(-10, null));
    expect(creada.estado).toBe('vigente');
  });

  it('rechaza un solape con ConflictException legible', async () => {
    await ocupaciones.crear(idPersona, await alta(-10, 10));
    await expect(ocupaciones.crear(idPersona, await alta(5, 20))).rejects.toThrow(
      /ya ocupa ese puesto/,
    );
  });

  it('de dos altas idénticas simultáneas, una gana y la otra recibe 409', async () => {
    const datos = await alta(-1, null);
    const resultados = await Promise.allSettled([
      ocupaciones.crear(idPersona, datos),
      ocupaciones.crear(idPersona, datos),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rechazada = resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rechazada.reason).toBeInstanceOf(ConflictException);
    expect(await sql('SELECT 1 FROM ocupacion')).toHaveLength(1);
  });

  it('una ocupación que vence hoy bloquea la baja de la persona', async () => {
    await ocupaciones.crear(idPersona, await alta(-30, 0));
    await expect(personas.darDeBaja(idPersona)).rejects.toThrow(/P-0001/);
  });

  it('una ocupación que venció ayer ya no bloquea la baja', async () => {
    await ocupaciones.crear(idPersona, await alta(-30, -1));
    await expect(personas.darDeBaja(idPersona)).resolves.toMatchObject({
      persona: { activo: false },
    });
  });

  it('no admite ocupaciones nuevas de una persona dada de baja', async () => {
    await personas.darDeBaja(idPersona);
    await expect(ocupaciones.crear(idPersona, await alta(1, null))).rejects.toThrow(/dada de baja/);
  });

  it('cerrar una ocupación libera el período para una nueva', async () => {
    const abierta = await alta(-30, null);
    await ocupaciones.crear(idPersona, abierta);
    await ocupaciones.cerrar(idPersona, idPuesto, abierta.fechaDesde, { fechaHasta: await dia(-1) });
    await expect(ocupaciones.crear(idPersona, await alta(0, null))).resolves.toBeDefined();
  });

  it('anula una ocupación futura pero no una vigente', async () => {
    const futura = await alta(10, null);
    await ocupaciones.crear(idPersona, futura);
    await ocupaciones.anular(idPersona, idPuesto, futura.fechaDesde);
    const vigente = await alta(-1, null);
    await ocupaciones.crear(idPersona, vigente);
    await expect(ocupaciones.anular(idPersona, idPuesto, vigente.fechaDesde)).rejects.toThrow(/cerrala/);
  });

  it('lista los ocupantes vigentes de un puesto', async () => {
    await ocupaciones.crear(idPersona, await alta(-30, null));
    const ocupantes = await ocupaciones.listarDePuesto(idPuesto);
    expect(ocupantes).toHaveLength(1);
    expect(ocupantes[0]).toMatchObject({ legajo: 'L-1', apellido: 'Pérez' });
  });
});
```

- [x] **Paso 8: Verificar la suite completa y el arranque**

```bash
cd backend && npm test && npm run test:integracion -- src/modules/personas/ocupaciones.service.int.spec.ts
docker compose restart backend && docker compose logs --tail=30 backend
```

Expected: PASS en ambos; el backend arranca sin errores de inyección; `cobertura-roles.spec.ts` incluye `ocupaciones.controller.ts`.

- [x] **Paso 9: Lint, formato y commit**

```bash
cd backend && npm run lint && npm run format && npm test
git add backend/src
git commit -m "Agregar las ocupaciones con vigencia, cierre y anulación"
```

---

## Tarea 7: Integración con Estructura y Usuarios

**Files:**
- Modify: `backend/src/modules/estructura/puestos.service.ts`, `puestos.service.spec.ts`
- Modify: `backend/src/modules/usuarios/usuarios.service.ts`, `usuarios.service.spec.ts`, `usuarios.module.ts`

**Interfaces:**
- Consumes: `Ocupacion` (entidad), `estaAbierta`, `hoyDeLaBase` (`personas/fechas.ts`); `PersonasService.exigirActiva`.
- Produces: `PuestosService.darDeBaja` rechaza con 409 si el puesto tiene ocupaciones vigentes o futuras; `UsuariosService` valida `idPersona` (400 si no existe o está de baja, 409 si ya está vinculada).

- [ ] **Paso 1: Actualizar el test de puestos**

En `puestos.service.spec.ts`:

1. Importar `Ocupacion`:

```ts
import { Ocupacion } from '../personas/entities/ocupacion.entity.js';
```

2. Ampliar `interface Config`:

```ts
  /** Ocupaciones de los puestos, para la baja. */
  ocupaciones?: Partial<Ocupacion>[];
  /** "Hoy" de la base (por defecto 2026-06-15). */
  hoy?: string;
```

3. En `crearEntorno`, antes de `const manager = {`, agregar:

```ts
  const repoOcupaciones = {
    find: vi.fn(async ({ where }: { where: { idPuesto?: number } }) =>
      (config.ocupaciones ?? [])
        .filter((o) => o.idPuesto === where.idPuesto)
        .map((o) => ({ ...o })),
    ),
  };
```

y reemplazar `query` y `getRepository` del `manager` por:

```ts
    query: vi.fn(async (sql: string) => {
      consultas.push(sql);
      if (sql.includes('CURRENT_DATE')) return [{ hoy: config.hoy ?? '2026-06-15' }];
      return sql.includes('nextval') ? [{ n: String(++secuencia) }] : [];
    }),
    getRepository: (entidad: unknown) =>
      entidad === Ocupacion ? repoOcupaciones : repo,
```

4. Agregar dentro de `describe('PuestosService.darDeBaja', ...)`:

```ts
  const ocupante = (parcial: Partial<Ocupacion> = {}): Partial<Ocupacion> => ({
    idPuesto: 1,
    idPersona: 7,
    fechaDesde: '2025-01-01',
    fechaHasta: null,
    persona: { apellido: 'Pérez', nombre: 'Ana' } as never,
    ...parcial,
  });

  it.each([
    ['vigente sin fin', {}],
    ['que vence hoy', { fechaHasta: '2026-06-15' }],
    ['futura', { fechaDesde: '2026-09-01' }],
  ])('rechaza con 409 si tiene una ocupación %s y nombra a la persona', async (_t, parcial) => {
    const { servicio, filas } = crearEntorno([puesto({ id: 1 })], {
      ocupaciones: [ocupante(parcial)],
    });
    const error = await servicio.darDeBaja(1).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toContain('Pérez, Ana');
    expect(filas[0].activo).toBe(true);
  });

  it('no se bloquea por una ocupación que terminó ayer', async () => {
    const { servicio, filas } = crearEntorno([puesto({ id: 1 })], {
      ocupaciones: [ocupante({ fechaHasta: '2026-06-14' })],
    });
    await servicio.darDeBaja(1);
    expect(filas[0].activo).toBe(false);
  });
```

- [ ] **Paso 2: Verificar que falla**

Run: `cd backend && npx vitest run src/modules/estructura/puestos.service.spec.ts`
Expected: FAIL en los tres casos nuevos con ocupación abierta (la baja procede).

- [ ] **Paso 3: Implementar la baja bloqueada**

En `puestos.service.ts`: agregar los imports

```ts
import { Ocupacion } from '../personas/entities/ocupacion.entity.js';
import { estaAbierta, hoyDeLaBase } from '../personas/fechas.js';
```

y, en `darDeBaja`, después del bloque que rechaza por subordinados y antes de `puesto.activo = false;`:

```ts
      const hoy = await hoyDeLaBase(manager);
      const abiertas = (
        await manager.getRepository(Ocupacion).find({
          where: { idPuesto: id },
          relations: { persona: true },
        })
      ).filter((o) => estaAbierta(o, hoy));
      if (abiertas.length > 0) {
        throw new ConflictException(
          `No se puede dar de baja: tiene ocupaciones vigentes o futuras (${abiertas
            .map((o) => `${o.persona.apellido}, ${o.persona.nombre}`)
            .join('; ')}). Cerralas o anulalas primero`,
        );
      }
```

Actualizar el comentario de la docstring de `darDeBaja`: `/** Baja lógica. Se bloquea mientras haya subordinados activos u ocupaciones vigentes o futuras. */`. No hace falta tocar el constructor ni `EstructuraModule`: la entidad `Ocupacion` ya la registra `PersonasModule`.

Run: `cd backend && npx vitest run src/modules/estructura` → PASS.

- [ ] **Paso 4: Actualizar el test de usuarios**

En `usuarios.service.spec.ts`:

1. Importar `import type { PersonasService } from '../personas/personas.service.js';`.
2. En `crearServicio`, antes del `return`, agregar `const personas = { exigirActiva: vi.fn(async () => undefined) };`, pasar `personas as unknown as PersonasService` como sexto argumento de `new UsuariosService(...)` (después de `unidadesEstructura`) y devolver `personas` en el objeto retornado.
3. Agregar, dentro de `describe('UsuariosService.crear', ...)`:

```ts
  it('valida que la persona exista y esté activa', async () => {
    const { servicio, personas } = crearServicio([]);
    await servicio.crear({ ...base, rol: 'docente', idPersona: 8 });
    expect(personas.exigirActiva).toHaveBeenCalledWith(8);
  });

  it('propaga el 400 si la persona no existe o está dada de baja', async () => {
    const { servicio, personas } = crearServicio([]);
    personas.exigirActiva.mockRejectedValueOnce(new BadRequestException('no existe'));
    await expect(
      servicio.crear({ ...base, rol: 'docente', idPersona: 8 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('no consulta personas si no se vincula ninguna', async () => {
    const { servicio, personas } = crearServicio([]);
    await servicio.crear({ ...base, rol: 'recursos_humanos' });
    expect(personas.exigirActiva).not.toHaveBeenCalled();
  });
```

y en el `describe` de `actualizar` (buscar el que ya prueba `idPersona`; si no hay, agregar uno nuevo `describe('UsuariosService.actualizar (persona)', ...)` usando `crearServicio([usuario({ id: 1 })])`):

```ts
  it('valida la persona solo cuando cambia', async () => {
    const { servicio, personas } = crearServicio([
      usuario({ id: 1, rolCodigo: 'docente', idPersona: 5 }),
    ]);
    await servicio.actualizar(1, { idPersona: 5 });
    expect(personas.exigirActiva).not.toHaveBeenCalled();
    await servicio.actualizar(1, { idPersona: 6 });
    expect(personas.exigirActiva).toHaveBeenCalledWith(6);
  });
```

- [ ] **Paso 5: Verificar que falla**

Run: `cd backend && npx vitest run src/modules/usuarios/usuarios.service.spec.ts`
Expected: FAIL (`personas.exigirActiva` nunca se llama).

- [ ] **Paso 6: Implementar la validación de la persona**

En `usuarios.service.ts`:

1. Importar `import { PersonasService } from '../personas/personas.service.js';` y sumar al constructor, después de `unidadesEstructura`:

```ts
    private readonly personas: PersonasService,
```

2. Reemplazar `validarPersonaLibre` por un método que valide ambas cosas, con el 400 antes que el 409:

```ts
  /** La persona debe existir y estar activa (400) y no estar vinculada a otro usuario (409). */
  private async validarPersona(idPersona: number | null): Promise<void> {
    if (idPersona === null) return;
    await this.personas.exigirActiva(idPersona);
    if (await this.usuarios.findOne({ where: { idPersona } })) {
      throw new ConflictException(
        'Esa persona ya está vinculada a otro usuario',
      );
    }
  }
```

y cambiar las dos llamadas (`crear`: `await this.validarPersonaLibre(idPersona);` y `actualizar`: `await this.validarPersonaLibre(idPersonaFinal);`) por `this.validarPersona(...)`.

En `usuarios.module.ts`: importar `PersonasModule` (`'../personas/personas.module.js'`) y agregarlo a `imports` después de `EstructuraModule`.

- [ ] **Paso 7: Verificar la suite y el arranque**

```bash
cd backend && npm test && npm run test:integracion
docker compose restart backend && docker compose logs --tail=30 backend
```

Expected: todo PASS; el backend arranca sin dependencias circulares (`PersonasModule` no importa a `UsuariosModule`).

- [ ] **Paso 8: Lint, formato y commit**

```bash
cd backend && npm run lint && npm run format && npm test
git add backend/src
git commit -m "Bloquear la baja de puestos con ocupaciones y validar la persona de un usuario"
```

---

## Tarea 8: Frontend: personas y ocupaciones

**Files:**
- Modify: `frontend/src/api/esquema.d.ts` (regenerado, no a mano)
- Create: `frontend/src/features/personas/hooks/usePersonas.ts`, `useOcupaciones.ts`
- Create: `frontend/src/features/personas/components/ListaPersonas.tsx`, `FichaPersona.tsx`, `TablaOcupaciones.tsx`, `FormularioPersona.tsx`, `FormularioOcupacion.tsx`, `CerrarOcupacionDialog.tsx`
- Modify: `frontend/src/features/personas/pages/PersonasPage.tsx`; Create: `frontend/src/features/personas/pages/MiFichaPage.tsx`
- Modify: `frontend/src/auth/permisos.ts`, `frontend/src/router.tsx`

**Interfaces:**
- Consumes: la API de las tareas 5 y 6; `useSesion()` (`rol`, `idPersona`); `useValoresReferencia(slug, incluirInactivos)`; `usePuestos()`; `mensajeError`.
- Produces: rutas `/personas` (todos menos docente) y `/personas/yo` (docente); hooks `usePersonas(filtro)`, `usePersona(id)`, `useCrearPersona()`, `useActualizarPersona()`, `useCambiarEstadoPersona()`, `useOcupacionesDePersona(id)`, `useOcupantesDePuesto(id)`, `useCrearOcupacion()`, `useActualizarOcupacion()`, `useCerrarOcupacion()`, `useAnularOcupacion()`.

El frontend no tiene tests: se valida con lint, build y el recorrido manual del paso final.

- [ ] **Paso 1: Regenerar los tipos de la API**

Con el backend corriendo y reiniciado:

```bash
cd frontend && npm run api:tipos
```

Verificar que `src/api/esquema.d.ts` ahora tiene `PersonaDto`, `PersonaDetalleDto`, `ResultadoBajaPersonaDto`, `CrearPersonaDto`, `ActualizarPersonaDto`, `OcupacionDto`, `OcupanteDto`, `CrearOcupacionDto`, `ActualizarOcupacionDto`, `CerrarOcupacionDto` y las rutas `/api/personas`, `/api/personas/{id}`, `/api/personas/{id}/baja`, `/api/personas/{id}/reactivar`, `/api/personas/{idPersona}/ocupaciones`, `/api/personas/{idPersona}/ocupaciones/{idPuesto}/{fechaDesde}`, `.../cerrar` y `/api/puestos/{idPuesto}/ocupaciones`: `grep -n "PersonaDetalleDto\|/api/personas" frontend/src/api/esquema.d.ts | head`. Si algún nombre difiere, usar el que quedó generado en los pasos siguientes.

- [ ] **Paso 2: Hooks de personas**

`hooks/usePersonas.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';

export type Persona = Esquemas['PersonaDto'];
export type PersonaDetalle = Esquemas['PersonaDetalleDto'];
type CrearPersona = Esquemas['CrearPersonaDto'];
type ActualizarPersona = Esquemas['ActualizarPersonaDto'];

interface FiltroPersonas {
  q?: string;
  activo?: boolean;
  sinUsuario?: boolean;
}

/** Las personas de la facultad; el volumen es chico y la pantalla filtra por texto. */
export function usePersonas(filtro: FiltroPersonas = {}) {
  return useQuery({
    queryKey: ['personas', 'lista', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/personas', {
        params: { query: filtro },
      });
      if (error || !data) throw new Error('No se pudieron cargar las personas');
      return data;
    },
  });
}

export function usePersona(id: number | undefined) {
  return useQuery({
    queryKey: ['personas', 'detalle', id],
    enabled: id !== undefined,
    queryFn: async () => {
      const { data, error } = await api.GET('/api/personas/{id}', {
        params: { path: { id: id as number } },
      });
      if (error || !data) throw new Error('No se pudo cargar la persona');
      return data;
    },
  });
}

function useInvalidar() {
  const cliente = useQueryClient();
  return () => {
    cliente.invalidateQueries({ queryKey: ['personas'] });
    cliente.invalidateQueries({ queryKey: ['ocupaciones'] });
  };
}

export function useCrearPersona() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (cuerpo: CrearPersona) => {
      const { data, error } = await api.POST('/api/personas', { body: cuerpo });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useActualizarPersona() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: { id: number; cuerpo: ActualizarPersona }) => {
      const { data, error } = await api.PATCH('/api/personas/{id}', {
        params: { path: { id: args.id } },
        body: args.cuerpo,
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

/** Devuelve los avisos de la baja (por ejemplo, un usuario vinculado que sigue activo). */
export function useCambiarEstadoPersona() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: {
      id: number;
      accion: 'baja' | 'reactivar';
    }): Promise<string[]> => {
      if (args.accion === 'baja') {
        const { data, error } = await api.POST('/api/personas/{id}/baja', {
          params: { path: { id: args.id } },
        });
        if (error || !data) throw new Error(mensajeError(error));
        return data.advertencias;
      }
      const { data, error } = await api.POST('/api/personas/{id}/reactivar', {
        params: { path: { id: args.id } },
      });
      if (error || !data) throw new Error(mensajeError(error));
      return [];
    },
    onSuccess: invalidar,
  });
}
```

- [ ] **Paso 3: Hooks de ocupaciones**

`hooks/useOcupaciones.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';

export type Ocupacion = Esquemas['OcupacionDto'];
export type Ocupante = Esquemas['OcupanteDto'];
type CrearOcupacion = Esquemas['CrearOcupacionDto'];
type ActualizarOcupacion = Esquemas['ActualizarOcupacionDto'];

interface ClaveOcupacion {
  idPersona: number;
  idPuesto: number;
  fechaDesde: string;
}

const ruta = (c: ClaveOcupacion) => ({
  path: {
    idPersona: c.idPersona,
    idPuesto: c.idPuesto,
    fechaDesde: c.fechaDesde,
  },
});

/** Historial completo de la persona, de la más reciente a la más antigua. */
export function useOcupacionesDePersona(idPersona: number | undefined) {
  return useQuery({
    queryKey: ['ocupaciones', 'persona', idPersona],
    enabled: idPersona !== undefined,
    queryFn: async () => {
      const { data, error } = await api.GET(
        '/api/personas/{idPersona}/ocupaciones',
        { params: { path: { idPersona: idPersona as number } } },
      );
      if (error || !data) throw new Error('No se pudieron cargar las ocupaciones');
      return data;
    },
  });
}

/** Quiénes ocupan hoy el puesto. */
export function useOcupantesDePuesto(idPuesto: number | undefined) {
  return useQuery({
    queryKey: ['ocupaciones', 'puesto', idPuesto],
    enabled: idPuesto !== undefined,
    queryFn: async () => {
      const { data, error } = await api.GET(
        '/api/puestos/{idPuesto}/ocupaciones',
        { params: { path: { idPuesto: idPuesto as number } } },
      );
      if (error || !data) throw new Error('No se pudieron cargar los ocupantes');
      return data;
    },
  });
}

function useInvalidar() {
  const cliente = useQueryClient();
  return () => {
    cliente.invalidateQueries({ queryKey: ['ocupaciones'] });
    cliente.invalidateQueries({ queryKey: ['personas'] });
  };
}

export function useCrearOcupacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: { idPersona: number; cuerpo: CrearOcupacion }) => {
      const { data, error } = await api.POST(
        '/api/personas/{idPersona}/ocupaciones',
        {
          params: { path: { idPersona: args.idPersona } },
          body: args.cuerpo,
        },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useActualizarOcupacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: ClaveOcupacion & { cuerpo: ActualizarOcupacion }) => {
      const { data, error } = await api.PATCH(
        '/api/personas/{idPersona}/ocupaciones/{idPuesto}/{fechaDesde}',
        { params: ruta(args), body: args.cuerpo },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useCerrarOcupacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: ClaveOcupacion & { fechaHasta: string }) => {
      const { data, error } = await api.POST(
        '/api/personas/{idPersona}/ocupaciones/{idPuesto}/{fechaDesde}/cerrar',
        { params: ruta(args), body: { fechaHasta: args.fechaHasta } },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useAnularOcupacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (args: ClaveOcupacion) => {
      const { response, error } = await api.DELETE(
        '/api/personas/{idPersona}/ocupaciones/{idPuesto}/{fechaDesde}',
        { params: ruta(args) },
      );
      if (!response.ok) throw new Error(mensajeError(error));
    },
    onSuccess: invalidar,
  });
}
```

- [ ] **Paso 4: Formulario de persona**

`components/FormularioPersona.tsx`:

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
  useActualizarPersona,
  useCrearPersona,
  type PersonaDetalle,
} from '../hooks/usePersonas';

interface Props {
  /** Sin persona, el formulario crea una nueva. */
  persona?: PersonaDetalle;
  onCerrar: () => void;
  onGuardada?: (id: number) => void;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const esquema = z
  .object({
    legajo: z.string().trim().min(1, 'Obligatorio').max(20, 'Hasta 20 caracteres'),
    apellido: z.string().trim().min(1, 'Obligatorio').max(100, 'Hasta 100 caracteres'),
    nombre: z.string().trim().min(1, 'Obligatorio').max(100, 'Hasta 100 caracteres'),
    documento: z.string().trim().regex(/^\d{7,8}$/, '7 u 8 dígitos, sin puntos'),
    fechaNacimiento: z.string().regex(FECHA, 'Elegí una fecha'),
    fechaIngreso: z.string().regex(FECHA, 'Elegí una fecha'),
    idSituacionRevista: z.string().min(1, 'Elegí una situación'),
    fechaPrevistaRetiro: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Fecha inválida'),
  })
  .refine((d) => d.fechaIngreso > d.fechaNacimiento, {
    path: ['fechaIngreso'],
    message: 'Debe ser posterior al nacimiento',
  })
  .refine(
    (d) => d.fechaPrevistaRetiro === '' || d.fechaPrevistaRetiro >= d.fechaIngreso,
    { path: ['fechaPrevistaRetiro'], message: 'No puede ser anterior al ingreso' },
  );
type Datos = z.infer<typeof esquema>;

/** Se monta solo mientras está abierto, por lo que parte siempre de cero. */
export function FormularioPersona({ persona, onCerrar, onGuardada }: Props) {
  const { data: situaciones } = useValoresReferencia('situacion-revista', false);
  const crear = useCrearPersona();
  const actualizar = useActualizarPersona();
  const [error, setError] = useState<string>();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      legajo: persona?.legajo ?? '',
      apellido: persona?.apellido ?? '',
      nombre: persona?.nombre ?? '',
      documento: persona?.documento ?? '',
      fechaNacimiento: persona?.fechaNacimiento ?? '',
      fechaIngreso: persona?.fechaIngreso ?? '',
      idSituacionRevista: persona ? String(persona.idSituacionRevista) : '',
      fechaPrevistaRetiro: persona?.fechaPrevistaRetiro ?? '',
    },
  });

  const guardar = handleSubmit(async (datos) => {
    setError(undefined);
    const cuerpo = {
      legajo: datos.legajo,
      apellido: datos.apellido,
      nombre: datos.nombre,
      documento: datos.documento,
      fechaNacimiento: datos.fechaNacimiento,
      fechaIngreso: datos.fechaIngreso,
      idSituacionRevista: Number(datos.idSituacionRevista),
      fechaPrevistaRetiro: datos.fechaPrevistaRetiro || null,
    };
    try {
      const guardada = persona
        ? await actualizar.mutateAsync({ id: persona.id, cuerpo })
        : await crear.mutateAsync(cuerpo);
      onGuardada?.(guardada.id);
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  const fecha = (campo: keyof Datos, etiqueta: string, ayuda?: string) => (
    <TextField
      label={etiqueta}
      type="date"
      slotProps={{ inputLabel: { shrink: true } }}
      {...register(campo)}
      error={!!errors[campo]}
      helperText={errors[campo]?.message ?? ayuda}
    />
  );

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>
          {persona ? `Editar a ${persona.apellido}, ${persona.nombre}` : 'Nueva persona'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Legajo"
              {...register('legajo')}
              error={!!errors.legajo}
              helperText={errors.legajo?.message}
              autoFocus
            />
            <TextField
              label="Apellido"
              {...register('apellido')}
              error={!!errors.apellido}
              helperText={errors.apellido?.message}
            />
            <TextField
              label="Nombre"
              {...register('nombre')}
              error={!!errors.nombre}
              helperText={errors.nombre?.message}
            />
            <TextField
              label="Documento"
              {...register('documento')}
              error={!!errors.documento}
              helperText={errors.documento?.message ?? 'DNI, 7 u 8 dígitos'}
            />
            {fecha('fechaNacimiento', 'Fecha de nacimiento')}
            {fecha('fechaIngreso', 'Fecha de ingreso')}
            <TextField
              select
              label="Situación de revista"
              defaultValue={persona ? String(persona.idSituacionRevista) : ''}
              {...register('idSituacionRevista')}
              error={!!errors.idSituacionRevista}
              helperText={errors.idSituacionRevista?.message}
            >
              {(situaciones ?? []).map((s) => (
                <MenuItem key={s.id} value={String(s.id)}>
                  {s.denominacion}
                </MenuItem>
              ))}
            </TextField>
            {fecha(
              'fechaPrevistaRetiro',
              'Fecha prevista de retiro (opcional)',
              'Alimenta el horizonte de riesgo',
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

- [ ] **Paso 5: Formulario y diálogo de cierre de ocupaciones**

`components/FormularioOcupacion.tsx`:

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
import { usePuestos } from '../../estructura/hooks/usePuestos';
import {
  useActualizarOcupacion,
  useCrearOcupacion,
  type Ocupacion,
} from '../hooks/useOcupaciones';

interface Props {
  idPersona: number;
  /** Sin ocupación, el formulario crea una nueva; con una, solo edita carácter, dedicación y fin. */
  ocupacion?: Ocupacion;
  onCerrar: () => void;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const esquema = z
  .object({
    idPuesto: z.string().min(1, 'Elegí un puesto'),
    fechaDesde: z.string().regex(FECHA, 'Elegí una fecha'),
    fechaHasta: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Fecha inválida'),
    idCaracterOcupacion: z.string().min(1, 'Elegí un carácter'),
    idDedicacion: z.string().min(1, 'Elegí una dedicación'),
  })
  .refine((d) => d.fechaHasta === '' || d.fechaHasta >= d.fechaDesde, {
    path: ['fechaHasta'],
    message: 'No puede ser anterior al inicio',
  });
type Datos = z.infer<typeof esquema>;

/** Se monta solo mientras está abierto, por lo que parte siempre de cero. */
export function FormularioOcupacion({ idPersona, ocupacion, onCerrar }: Props) {
  const { data: puestos } = usePuestos();
  const { data: caracteres } = useValoresReferencia('caracter-ocupacion', false);
  const { data: dedicaciones } = useValoresReferencia('dedicacion', false);
  const crear = useCrearOcupacion();
  const actualizar = useActualizarOcupacion();
  const [error, setError] = useState<string>();
  const esEdicion = !!ocupacion;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      idPuesto: ocupacion ? String(ocupacion.idPuesto) : '',
      fechaDesde: ocupacion?.fechaDesde ?? '',
      fechaHasta: ocupacion?.fechaHasta ?? '',
      idCaracterOcupacion: ocupacion ? String(ocupacion.idCaracterOcupacion) : '',
      idDedicacion: ocupacion ? String(ocupacion.idDedicacion) : '',
    },
  });

  const guardar = handleSubmit(async (datos) => {
    setError(undefined);
    const comunes = {
      fechaHasta: datos.fechaHasta || null,
      idCaracterOcupacion: Number(datos.idCaracterOcupacion),
      idDedicacion: Number(datos.idDedicacion),
    };
    try {
      if (ocupacion) {
        await actualizar.mutateAsync({
          idPersona,
          idPuesto: ocupacion.idPuesto,
          fechaDesde: ocupacion.fechaDesde,
          cuerpo: comunes,
        });
      } else {
        await crear.mutateAsync({
          idPersona,
          cuerpo: {
            ...comunes,
            idPuesto: Number(datos.idPuesto),
            fechaDesde: datos.fechaDesde,
          },
        });
      }
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  // En una edición se muestra el puesto aunque esté de baja; en un alta, solo los activos.
  const elegibles = (puestos ?? []).filter(
    (p) => p.activo || p.id === ocupacion?.idPuesto,
  );

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="xs">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>{esEdicion ? 'Editar ocupación' : 'Nueva ocupación'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              select
              label="Puesto"
              disabled={esEdicion}
              defaultValue={ocupacion ? String(ocupacion.idPuesto) : ''}
              {...register('idPuesto')}
              error={!!errors.idPuesto}
              helperText={errors.idPuesto?.message}
            >
              {elegibles.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.codigo} · {p.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Desde"
              type="date"
              disabled={esEdicion}
              slotProps={{ inputLabel: { shrink: true } }}
              {...register('fechaDesde')}
              error={!!errors.fechaDesde}
              helperText={
                errors.fechaDesde?.message ??
                (esEdicion ? 'Para corregir el inicio, anulá la ocupación y cargala de nuevo' : undefined)
              }
            />
            <TextField
              label="Hasta (opcional)"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...register('fechaHasta')}
              error={!!errors.fechaHasta}
              helperText={errors.fechaHasta?.message ?? 'Vacío: sin fecha de fin'}
            />
            <TextField
              select
              label="Carácter"
              defaultValue={ocupacion ? String(ocupacion.idCaracterOcupacion) : ''}
              {...register('idCaracterOcupacion')}
              error={!!errors.idCaracterOcupacion}
              helperText={errors.idCaracterOcupacion?.message}
            >
              {(caracteres ?? []).map((c) => (
                <MenuItem key={c.id} value={String(c.id)}>
                  {c.denominacion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Dedicación"
              defaultValue={ocupacion ? String(ocupacion.idDedicacion) : ''}
              {...register('idDedicacion')}
              error={!!errors.idDedicacion}
              helperText={errors.idDedicacion?.message}
            >
              {(dedicaciones ?? []).map((d) => (
                <MenuItem key={d.id} value={String(d.id)}>
                  {d.denominacion}
                </MenuItem>
              ))}
            </TextField>
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

`components/CerrarOcupacionDialog.tsx`:

```tsx
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { useCerrarOcupacion, type Ocupacion } from '../hooks/useOcupaciones';

interface Props {
  ocupacion: Ocupacion;
  onCerrar: () => void;
}

/** Fija la fecha de fin de una ocupación; la persona deja de ocupar el puesto desde el día siguiente. */
export function CerrarOcupacionDialog({ ocupacion, onCerrar }: Props) {
  const cerrar = useCerrarOcupacion();
  const [fecha, setFecha] = useState('');
  const [error, setError] = useState<string>();

  const confirmar = async () => {
    setError(undefined);
    try {
      await cerrar.mutateAsync({
        idPersona: ocupacion.idPersona,
        idPuesto: ocupacion.idPuesto,
        fechaDesde: ocupacion.fechaDesde,
        fechaHasta: fecha,
      });
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="xs">
      <DialogTitle>Cerrar ocupación</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Último día en el puesto"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText={`Desde ${ocupacion.fechaDesde}. Ese día la ocupación sigue vigente.`}
            autoFocus
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={confirmar}
          disabled={fecha === '' || cerrar.isPending}
        >
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Paso 6: Tabla de ocupaciones**

`components/TablaOcupaciones.tsx`:

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
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { usePuestos } from '../../estructura/hooks/usePuestos';
import {
  useAnularOcupacion,
  useOcupacionesDePersona,
  type Ocupacion,
} from '../hooks/useOcupaciones';
import { CerrarOcupacionDialog } from './CerrarOcupacionDialog';
import { FormularioOcupacion } from './FormularioOcupacion';

interface Props {
  idPersona: number;
  /** Solo RR. HH. escribe. */
  puedeEditar: boolean;
  /** Una persona dada de baja no admite ocupaciones nuevas. */
  admiteNuevas: boolean;
}

const COLOR = { vigente: 'success', futura: 'info', pasada: 'default' } as const;
const ETIQUETA = { vigente: 'Vigente', futura: 'Futura', pasada: 'Historial' } as const;

export function TablaOcupaciones({ idPersona, puedeEditar, admiteNuevas }: Props) {
  const { data: ocupaciones, isLoading, isError } = useOcupacionesDePersona(idPersona);
  const { data: puestos } = usePuestos();
  const { data: caracteres } = useValoresReferencia('caracter-ocupacion', true);
  const { data: dedicaciones } = useValoresReferencia('dedicacion', true);
  const anular = useAnularOcupacion();
  const [formulario, setFormulario] = useState<{ ocupacion?: Ocupacion } | null>(null);
  const [cerrando, setCerrando] = useState<Ocupacion>();
  const [error, setError] = useState<string>();

  if (isLoading) return <CircularProgress aria-label="Cargando" />;
  if (isError || !ocupaciones) {
    return <Alert severity="error">No se pudieron cargar las ocupaciones.</Alert>;
  }

  const puesto = (id: number) => puestos?.find((p) => p.id === id);
  const nombre = (lista: { id: number; denominacion: string }[] | undefined, id: number) =>
    lista?.find((v) => v.id === id)?.denominacion ?? String(id);

  const anularOcupacion = async (o: Ocupacion) => {
    setError(undefined);
    try {
      await anular.mutateAsync(o);
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center' }}>
        <Typography variant="h6" component="h3" sx={{ flexGrow: 1 }}>
          Ocupaciones
        </Typography>
        {puedeEditar && admiteNuevas && (
          <Button variant="contained" onClick={() => setFormulario({})}>
            Nueva ocupación
          </Button>
        )}
      </Stack>
      {error && (
        <Alert severity="error" onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      {ocupaciones.length === 0 ? (
        <Alert severity="info">Esta persona no tiene ocupaciones registradas.</Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Puesto</TableCell>
              <TableCell>Desde</TableCell>
              <TableCell>Hasta</TableCell>
              <TableCell>Carácter</TableCell>
              <TableCell>Dedicación</TableCell>
              <TableCell>Estado</TableCell>
              {puedeEditar && <TableCell align="right">Acciones</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {ocupaciones.map((o) => {
              const p = puesto(o.idPuesto);
              return (
                <TableRow key={`${o.idPuesto}-${o.fechaDesde}`}>
                  <TableCell>{p ? `${p.codigo} · ${p.denominacion}` : o.idPuesto}</TableCell>
                  <TableCell>{o.fechaDesde}</TableCell>
                  <TableCell>{o.fechaHasta ?? '—'}</TableCell>
                  <TableCell>{nombre(caracteres, o.idCaracterOcupacion)}</TableCell>
                  <TableCell>{nombre(dedicaciones, o.idDedicacion)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={ETIQUETA[o.estado]} color={COLOR[o.estado]} />
                  </TableCell>
                  {puedeEditar && (
                    <TableCell align="right">
                      {o.estado !== 'pasada' && (
                        <Button size="small" onClick={() => setFormulario({ ocupacion: o })}>
                          Editar
                        </Button>
                      )}
                      {o.estado === 'vigente' && o.fechaHasta === null && (
                        <Button size="small" onClick={() => setCerrando(o)}>
                          Cerrar
                        </Button>
                      )}
                      {o.estado === 'futura' && (
                        <Button size="small" onClick={() => anularOcupacion(o)}>
                          Anular
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {formulario && (
        <FormularioOcupacion
          idPersona={idPersona}
          ocupacion={formulario.ocupacion}
          onCerrar={() => setFormulario(null)}
        />
      )}
      {cerrando && (
        <CerrarOcupacionDialog ocupacion={cerrando} onCerrar={() => setCerrando(undefined)} />
      )}
    </Stack>
  );
}
```

- [ ] **Paso 7: Ficha y lista**

`components/FichaPersona.tsx`:

```tsx
import { Alert, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { mensajeError } from '../../admin/hooks/useGuardarValor';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { useCambiarEstadoPersona, usePersona } from '../hooks/usePersonas';
import { FormularioPersona } from './FormularioPersona';
import { TablaOcupaciones } from './TablaOcupaciones';

interface Props {
  idPersona: number;
  /** Solo RR. HH. escribe. */
  puedeEditar: boolean;
}

export function FichaPersona({ idPersona, puedeEditar }: Props) {
  const { data: persona, isLoading, isError } = usePersona(idPersona);
  const { data: situaciones } = useValoresReferencia('situacion-revista', true);
  const cambiarEstado = useCambiarEstadoPersona();
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string>();
  const [avisos, setAvisos] = useState<string[]>([]);

  if (isLoading) return <CircularProgress aria-label="Cargando" />;
  if (isError || !persona) {
    return <Alert severity="error">No se pudo cargar la persona.</Alert>;
  }

  const alternar = async () => {
    setError(undefined);
    setAvisos([]);
    try {
      setAvisos(
        await cambiarEstado.mutateAsync({
          id: persona.id,
          accion: persona.activo ? 'baja' : 'reactivar',
        }),
      );
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const dato = (etiqueta: string, valor: string | null | undefined) => (
    <Stack>
      <Typography variant="caption" color="text.secondary">
        {etiqueta}
      </Typography>
      <Typography>{valor || '—'}</Typography>
    </Stack>
  );

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Typography variant="h5" component="h2" sx={{ flexGrow: 1 }}>
          {persona.apellido}, {persona.nombre}
        </Typography>
        <Chip
          size="small"
          label={persona.activo ? 'Activa' : 'De baja'}
          color={persona.activo ? 'success' : 'default'}
        />
        {persona.tieneUsuario && <Chip size="small" label="Con usuario" />}
        {puedeEditar && (
          <>
            <Button onClick={() => setEditando(true)}>Editar</Button>
            <Button onClick={alternar} disabled={cambiarEstado.isPending}>
              {persona.activo ? 'Dar de baja' : 'Reactivar'}
            </Button>
          </>
        )}
      </Stack>
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
      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 4 }}>
        {dato('Legajo', persona.legajo)}
        {persona.documento !== undefined && dato('Documento', persona.documento)}
        {persona.fechaNacimiento !== undefined &&
          dato('Fecha de nacimiento', persona.fechaNacimiento)}
        {dato('Fecha de ingreso', persona.fechaIngreso)}
        {dato(
          'Situación de revista',
          situaciones?.find((s) => s.id === persona.idSituacionRevista)?.denominacion,
        )}
        {dato('Retiro previsto', persona.fechaPrevistaRetiro)}
      </Stack>
      <TablaOcupaciones
        idPersona={persona.id}
        puedeEditar={puedeEditar}
        admiteNuevas={persona.activo}
      />
      {editando && (
        <FormularioPersona persona={persona} onCerrar={() => setEditando(false)} />
      )}
    </Stack>
  );
}
```

`components/ListaPersonas.tsx`:

```tsx
import {
  Alert,
  Button,
  CircularProgress,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { usePersonas } from '../hooks/usePersonas';

interface Props {
  seleccionada?: number;
  onElegir: (id: number) => void;
  /** Solo RR. HH. da de alta. */
  onNueva?: () => void;
}

export function ListaPersonas({ seleccionada, onElegir, onNueva }: Props) {
  const [verBajas, setVerBajas] = useState(false);
  const [texto, setTexto] = useState('');
  const { data, isLoading, isError } = usePersonas({ activo: verBajas ? undefined : true });

  if (isLoading) return <CircularProgress aria-label="Cargando" />;
  if (isError || !data) {
    return <Alert severity="error">No se pudieron cargar las personas.</Alert>;
  }

  const buscado = texto.trim().toLowerCase();
  const filas = data.filter(
    (p) =>
      buscado === '' ||
      `${p.legajo} ${p.apellido} ${p.nombre}`.toLowerCase().includes(buscado),
  );

  return (
    <Stack spacing={1}>
      {onNueva && (
        <Button variant="contained" onClick={onNueva}>
          Nueva persona
        </Button>
      )}
      <TextField
        size="small"
        label="Buscar por legajo, apellido o nombre"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <FormControlLabel
        control={<Switch checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} />}
        label="Ver dadas de baja"
      />
      {filas.length === 0 ? (
        <Alert severity="info">No hay personas para mostrar.</Alert>
      ) : (
        <List dense>
          {filas.map((p) => (
            <ListItemButton
              key={p.id}
              selected={p.id === seleccionada}
              onClick={() => onElegir(p.id)}
            >
              <ListItemText
                primary={`${p.apellido}, ${p.nombre}`}
                secondary={`${p.legajo}${p.activo ? '' : ' · de baja'}${p.tieneUsuario ? ' · con usuario' : ''}`}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Stack>
  );
}
```

- [ ] **Paso 8: Páginas, ruta y menú**

Reemplazar `pages/PersonasPage.tsx`:

```tsx
import { Alert, Box, Divider } from '@mui/material';
import { useState } from 'react';
import { useSesion } from '../../../auth/useSesion';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { FichaPersona } from '../components/FichaPersona';
import { FormularioPersona } from '../components/FormularioPersona';
import { ListaPersonas } from '../components/ListaPersonas';

export function PersonasPage() {
  const { data: sesion } = useSesion();
  const puedeEditar = sesion?.rol === 'recursos_humanos';
  const [idSeleccionada, setIdSeleccionada] = useState<number>();
  const [creando, setCreando] = useState(false);

  return (
    <PaginaEnConstruccion
      titulo="Personas"
      descripcion="Personas y ocupaciones, incluidas las simultáneas y el historial (RF06, RF07)."
    >
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: '320px 1fr' },
        }}
      >
        <Box>
          <ListaPersonas
            seleccionada={idSeleccionada}
            onElegir={setIdSeleccionada}
            onNueva={puedeEditar ? () => setCreando(true) : undefined}
          />
        </Box>
        <Box>
          <Divider sx={{ display: { md: 'none' }, mb: 2 }} />
          {idSeleccionada !== undefined ? (
            <FichaPersona key={idSeleccionada} idPersona={idSeleccionada} puedeEditar={puedeEditar} />
          ) : (
            <Alert severity="info">Elegí una persona para ver su ficha y sus ocupaciones.</Alert>
          )}
        </Box>
      </Box>
      {creando && (
        <FormularioPersona onCerrar={() => setCreando(false)} onGuardada={setIdSeleccionada} />
      )}
    </PaginaEnConstruccion>
  );
}
```

Crear `pages/MiFichaPage.tsx`:

```tsx
import { Alert } from '@mui/material';
import { useSesion } from '../../../auth/useSesion';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { FichaPersona } from '../components/FichaPersona';

/** El docente ve su propia persona y sus ocupaciones, en solo lectura. */
export function MiFichaPage() {
  const { data: sesion } = useSesion();
  return (
    <PaginaEnConstruccion
      titulo="Mi ficha"
      descripcion="Tus datos y tus ocupaciones, con el historial."
    >
      {sesion?.idPersona == null ? (
        <Alert severity="warning">
          Tu usuario todavía no tiene una persona vinculada. Pedile al administrador que la asigne.
        </Alert>
      ) : (
        <FichaPersona idPersona={sesion.idPersona} puedeEditar={false} />
      )}
    </PaginaEnConstruccion>
  );
}
```

En `auth/permisos.ts` reemplazar la entrada de `/personas` por:

```ts
  {
    ruta: '/personas',
    nombre: 'Personas',
    roles: [
      'recursos_humanos',
      'autoridad',
      'jefatura_departamento',
      'jefe_catedra',
      'analista_puestos',
      'administrador',
    ],
  },
  { ruta: '/personas/yo', nombre: 'Mi ficha', roles: ['docente'] },
```

En `router.tsx` importar `MiFichaPage` (`'./features/personas/pages/MiFichaPage'`) y agregar, después de la ruta `personas`:

```tsx
      { path: 'personas/yo', element: <MiFichaPage /> },
```

- [ ] **Paso 9: Lint, build y commit**

```bash
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm run build
cd frontend && npx prettier --write "src/**/*.{ts,tsx}"
git add frontend/src
git commit -m "Agregar la pantalla de personas y ocupaciones"
```

Expected: 0 errores de lint; el build compila. Si `tsc` marca un nombre de tipo o de ruta distinto, ajustar al generado en `esquema.d.ts` (paso 1).

---

## Tarea 9: Frontend: vínculo con el usuario y ocupantes en Estructura

**Files:**
- Modify: `frontend/src/features/admin/components/FormularioUsuario.tsx`
- Create: `frontend/src/features/estructura/components/OcupantesPuestoDialog.tsx`
- Modify: `frontend/src/features/estructura/components/TablaPuestos.tsx`, `frontend/src/features/estructura/pages/EstructuraPage.tsx`

**Interfaces:**
- Consumes: `usePersonas`, `useOcupantesDePuesto`, `useValoresReferencia`.

- [ ] **Paso 1: Selector de persona en el formulario de usuario**

En `FormularioUsuario.tsx`:

1. Importar `usePersonas`: `import { usePersonas } from '../../personas/hooks/usePersonas';`.
2. Ampliar el esquema con `idPersona: z.string()` (queda `''` si no se vincula) y hacer que el docente la exija. Reemplazar el cuerpo de `crearEsquema` por:

```ts
function crearEsquema(esAlta: boolean) {
  return z
    .object({
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
      idPersona: z.string(),
      idUnidades: z.array(z.number()),
    })
    .refine((d) => d.rol !== 'docente' || d.idPersona !== '', {
      path: ['idPersona'],
      message: 'El rol docente exige una persona',
    });
}
```

3. Dentro del componente, después de `const { data: unidades } = useUnidades(true);`, agregar:

```tsx
  const { data: personas } = usePersonas({ activo: true });
  // Solo las que no tienen usuario, más la que ya está vinculada a este.
  const personasElegibles = (personas ?? []).filter(
    (p) => !p.tieneUsuario || p.id === usuario?.idPersona,
  );
```

4. En `defaultValues` agregar `idPersona: usuario?.idPersona != null ? String(usuario.idPersona) : '',`.
5. En `guardar`, calcular `const idPersona = datos.idPersona === '' ? null : Number(datos.idPersona);` y agregar `idPersona,` al cuerpo de `actualizar.mutateAsync` (dentro de `cuerpo`) y de `crear.mutateAsync`.
6. Después del `TextField` de `rol`, agregar:

```tsx
            <TextField
              select
              label="Persona vinculada"
              defaultValue={usuario?.idPersona != null ? String(usuario.idPersona) : ''}
              {...register('idPersona')}
              error={!!errors.idPersona}
              helperText={
                errors.idPersona?.message ??
                'Obligatoria para el rol docente; solo se ofrecen personas activas sin usuario'
              }
            >
              <MenuItem value="">Sin persona</MenuItem>
              {personasElegibles.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.apellido}, {p.nombre} · {p.legajo}
                </MenuItem>
              ))}
            </TextField>
```

7. En el `helperText` del `TextField` de rol, reemplazar el texto `'El rol docente exige vincular una persona, que se habilita cuando exista el módulo de personas'` por `'El rol docente exige vincular una persona'`.

- [ ] **Paso 2: Diálogo de ocupantes de un puesto**

`estructura/components/OcupantesPuestoDialog.tsx`:

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
import { useOcupantesDePuesto } from '../../personas/hooks/useOcupaciones';
import type { Puesto } from '../hooks/usePuestos';

interface Props {
  puesto: Puesto;
  onCerrar: () => void;
}

/** Quiénes ocupan hoy el puesto (RF07). */
export function OcupantesPuestoDialog({ puesto, onCerrar }: Props) {
  const { data: ocupantes, isLoading, isError } = useOcupantesDePuesto(puesto.id);
  const { data: caracteres } = useValoresReferencia('caracter-ocupacion', true);
  const { data: dedicaciones } = useValoresReferencia('dedicacion', true);
  const nombre = (lista: { id: number; denominacion: string }[] | undefined, id: number) =>
    lista?.find((v) => v.id === id)?.denominacion ?? String(id);

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <DialogTitle>
        Ocupantes de {puesto.codigo} · {puesto.denominacion}
      </DialogTitle>
      <DialogContent>
        {isLoading && <CircularProgress aria-label="Cargando" />}
        {isError && <Alert severity="error">No se pudieron cargar los ocupantes.</Alert>}
        {ocupantes && ocupantes.length === 0 && (
          <Alert severity="info">Hoy nadie ocupa este puesto.</Alert>
        )}
        {ocupantes && ocupantes.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Persona</TableCell>
                <TableCell>Desde</TableCell>
                <TableCell>Hasta</TableCell>
                <TableCell>Carácter</TableCell>
                <TableCell>Dedicación</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ocupantes.map((o) => (
                <TableRow key={`${o.idPersona}-${o.fechaDesde}`}>
                  <TableCell>
                    {o.apellido}, {o.nombre} ({o.legajo})
                  </TableCell>
                  <TableCell>{o.fechaDesde}</TableCell>
                  <TableCell>{o.fechaHasta ?? '—'}</TableCell>
                  <TableCell>{nombre(caracteres, o.idCaracterOcupacion)}</TableCell>
                  <TableCell>{nombre(dedicaciones, o.idDedicacion)}</TableCell>
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

- [ ] **Paso 3: Botón "Ocupantes" en la tabla de puestos**

En `TablaPuestos.tsx`:

1. Importar `import { OcupantesPuestoDialog } from './OcupantesPuestoDialog';`.
2. Agregar a `Props`: `/** El docente no ve a los ocupantes de otros puestos. */ puedeVerOcupantes: boolean;` y a la firma `({ unidad, unidadesValidas, puedeEditar, puedeVerOcupantes }: Props)`.
3. Agregar el estado `const [verOcupantes, setVerOcupantes] = useState<Puesto>();` junto a los demás `useState`.
4. Cambiar la condición de la columna de acciones `{puedeEditar && <TableCell align="right">Acciones</TableCell>}` por `{(puedeEditar || puedeVerOcupantes) && ( <TableCell align="right">Acciones</TableCell> )}` y la celda de cada fila: reemplazar `{puedeEditar && (<TableCell align="right"> ... </TableCell>)}` por

```tsx
                  {(puedeEditar || puedeVerOcupantes) && (
                    <TableCell align="right">
                      {puedeVerOcupantes && (
                        <Button size="small" onClick={() => setVerOcupantes(p)}>
                          Ocupantes
                        </Button>
                      )}
                      {puedeEditar && (
                        <>
                          <Button size="small" onClick={() => setFormulario({ puesto: p })}>
                            Editar
                          </Button>
                          <Button size="small" onClick={() => alternar(p)}>
                            {p.activo ? 'Dar de baja' : 'Reactivar'}
                          </Button>
                        </>
                      )}
                    </TableCell>
                  )}
```

5. Antes del cierre del `Stack`, junto al `FormularioPuesto`, agregar:

```tsx
      {verOcupantes && (
        <OcupantesPuestoDialog puesto={verOcupantes} onCerrar={() => setVerOcupantes(undefined)} />
      )}
```

En `EstructuraPage.tsx`, pasar a `TablaPuestos` la nueva propiedad: `puedeVerOcupantes={sesion?.rol !== undefined && sesion.rol !== 'docente'}`.

- [ ] **Paso 4: Lint, build y commit**

```bash
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm run build
cd frontend && npx prettier --write "src/**/*.{ts,tsx}"
git add frontend/src
git commit -m "Vincular personas a usuarios y mostrar los ocupantes de cada puesto"
```

---

## Tarea 10: Documentos, verificación final y cierre

**Files:**
- Modify: `docs/requerimientos.md`, `README.md`
- Modify: la línea de Estado de esta spec y de este plan

- [ ] **Paso 1: Actualizar `docs/requerimientos.md`**

En §5, debajo del párrafo **Estructura:** (línea 114), agregar:

```markdown
**Personas:** `persona` y `ocupacion` (clave compuesta, con restricción de exclusión de solapes sobre `btree_gist`); ver `docs/superpowers/specs/2026-10-13-personas-ocupaciones-design.md`. Suma dos dominios de referencia (`situacion_revista`, `dedicacion`) a los administrados por RF23.
```

No cambian los enunciados de RF06 y RF07.

- [ ] **Paso 2: Actualizar `README.md`**

Debajo de la sección "Unidades organizativas", agregar una sección `## Personas y ocupaciones` con:

- Personas y ocupaciones las carga Recursos Humanos desde la aplicación (`/personas`); no hay `DELETE`: se dan de baja (personas) o se cierran y anulan (ocupaciones).
- Una ocupación no se solapa con otra de la misma persona en el mismo puesto (lo garantiza la base con `btree_gist`); cerrar fija el último día y el siguiente queda libre. Una ocupación que termina antes de hoy es historial y no se modifica.
- Datos personales (Ley 25.326, RNF02): `documento` y `fechaNacimiento` solo los devuelve la API a `recursos_humanos` y `administrador`.
- La baja de una persona o de un puesto se bloquea mientras tengan ocupaciones vigentes o futuras; la baja de la persona no desactiva su usuario.
- La extensión `btree_gist` se crea en la migración y requiere permiso `CREATE EXTENSION` (el usuario de la base del compose lo tiene).

- [ ] **Paso 3: Verificación completa**

```bash
cd backend && npm run lint && npx prettier --check src && npm test && npm run test:integracion
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm run build
cd frontend && npx prettier --check "src/**/*.{ts,tsx}"
docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/SondaBorrar
```

Expected: todo en 0 errores y PASS; la sonda no encuentra cambios, o solo los `DROP` conocidos del índice con `lower()` y de la exclusión (tarea 2, paso 9). Borrar `*-SondaBorrar.ts` si se generó. Reportar el recuento de tests tal cual salga.

- [ ] **Paso 4: Recorrido manual en el navegador**

Con `docker compose up` y el administrador inicial (`ADMIN_USUARIO`/`ADMIN_CLAVE`), cargar cátedras con `backend/scripts/catedras-ejemplo.sql`, crear puestos tipo en una cátedra, y verificar:

1. Como administrador: crear un usuario `recursos_humanos` y otro `docente` (el alta del docente exige persona: sin persona muestra "El rol docente exige una persona").
2. Como RR. HH.: crear una persona (con documento de 6 dígitos el formulario lo rechaza); crear otra con el mismo legajo → mensaje de 409 con el nombre de quien lo tiene.
3. Cargar una ocupación; cargar otra del mismo puesto con fechas que se solapan → error legible. Cargar una en otro puesto con las mismas fechas → se acepta (simultánea).
4. Cerrar la ocupación con un día pasado → pasa a "Historial" y desaparece "Editar". Cargar una nueva desde el día siguiente → se acepta.
5. Intentar dar de baja a la persona con una ocupación vigente → error que nombra el puesto; en Estructura, "Dar de baja" sobre ese puesto → error que nombra a la persona.
6. Desde Administración → Usuarios, vincular la persona al usuario docente. Entrar como ese docente: el menú muestra "Mi ficha" y no "Personas"; abrir `/personas` en la barra de direcciones no debe mostrar datos de otras personas; en `/personas/yo` no aparecen documento ni fecha de nacimiento.
7. Como `jefe_catedra` o `autoridad`: en `/personas` la ficha no muestra documento ni fecha de nacimiento; en Estructura, el botón "Ocupantes" lista a quien ocupa el puesto.

Anotar cualquier desvío y corregirlo antes de cerrar.

- [ ] **Paso 5: Cerrar los documentos**

Cambiar la primera línea de la spec a `Estado: Implementada | Fecha: 2026-10-13 | Autor: IvanOchoa229`. En este plan, cambiar la primera línea a `Estado: Implementado | Fecha: 2026-10-13 | PR: #<número del PR>` y marcar las casillas realizadas.

- [ ] **Paso 6: Commit**

```bash
git add README.md docs
git commit -m "Documentar personas y ocupaciones y marcar la spec y el plan como implementados"
```

El PR se abre con `gh pr create` desde `feat/personas` cuando el usuario lo pida.
