Estado: Implementado | Fecha: 2026-10-16 | PR: #7

# Criticidad: evaluación por par conocimiento-puesto: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** que RR. HH., la jefatura y los jefes de cátedra evalúen el impacto de pérdida y la dificultad de reemplazo de cada conocimiento que exige un puesto, que el servidor calcule el nivel de criticidad con una matriz editable, y que quede el historial y el avance de OE5 (RF12, RF24, RNF04, RNF05).

**Arquitectura:** el módulo `criticidad` suma tres tablas de escalas y matriz (`nivel_impacto`, `nivel_dificultad`, `matriz_criticidad`), la tabla de historial de solo inserción `evaluacion_criticidad` y la vista `criticidad_vigente` (última evaluación por par). Tres servicios: `MatrizService` (escalas, cálculo y edición de la matriz), `EvaluacionesService` (evaluar e historial, bajo el bloqueo de conocimiento 7003) y `ParesService` (pares y avance, por SQL). El alcance reutiliza `AlcanceService`. La auditoría ya cubre `evaluacion_criticidad` y exige `save()`. La fusión de conocimientos pasa a mover también las evaluaciones.

**Tech Stack:** NestJS 12, TypeORM 0.3, PostgreSQL 16, class-validator, vitest, React 19, MUI, TanStack Query, react-hook-form, zod.

**Spec:** `docs/superpowers/specs/2026-10-16-criticidad-evaluacion-design.md`. Antes de empezar, leer también `docs/requerimientos.md` §5, §6 y §7 y las specs de Usuarios y Conocimiento (en especial «Acreditación» y «Fusión»).

## Global Constraints

- Nombres de dominio y de código en español; snake_case en la base y camelCase en el código (`SnakeNamingStrategy`).
- Imports ESM con extensión `.js` (`'./criticidad.constantes.js'`).
- `synchronize` desactivado: el esquema cambia solo por migraciones, revisadas a mano antes de aplicarse. Si `migration:generate` propone algo ajeno a este bloque (por ejemplo `DROP INDEX "IDX_persona_apellido_nombre"`, creado a mano), se borra de la migración. Las migraciones con datos o con vistas se escriben a mano con `migration:create`.
- Fechas de negocio como cadenas `AAAA-MM-DD`. «Hoy» es siempre `CURRENT_DATE` de la base (`hoyDeLaBase` de `personas/fechas.ts`), nunca la hora del servidor. En SQL crudo, las columnas `date` se devuelven con `::text`.
- Tres niveles por eje. Matriz inicial (impacto × dificultad): alto/fácil `media`, alto/moderada `alta`, alto/difícil `alta`, medio/fácil `baja`, medio/moderada `media`, medio/difícil `alta`, bajo/fácil `baja`, bajo/moderada `baja`, bajo/difícil `media`.
- El nivel lo calcula siempre el servidor con la matriz; el DTO de evaluación no acepta `nivelCriticidad` (`forbidNonWhitelisted` da 400). Sin ajuste manual.
- `evaluacion_criticidad` es de solo inserción: sin edición ni borrado. Vigente: mayor `fecha_evaluacion` y, en empate, mayor `id_evaluacion`. Una evaluación con fecha anterior a la vigente no la reemplaza.
- Sin FK compuesta de `evaluacion_criticidad` a `requisito_puesto`. Solo se evalúan pares que hoy están en `requisito_puesto`, con puesto y conocimiento activos.
- El evaluador se guarda como `id_usuario` de la sesión; no se exige persona vinculada.
- Se escribe con `save()` (nunca `update()` ni QueryBuilder) para que `AuditoriaSubscriber` registre el alta (RNF05). `evaluacion_criticidad` ya está en `ENTIDADES_AUDITADAS`.
- Las escrituras de evaluación corren con el bloqueo consultivo de conocimiento (`enTransaccionDeConocimiento`, clave 7003): así una fusión no se cruza con una evaluación del conocimiento que desaparece.
- `nivel_impacto` y `nivel_dificultad` no se registran en `DOMINIOS` ni en la API de referencia: son escalas fijas, solo lectura, cargadas por migración.
- Permisos: evalúan `recursos_humanos` (sin límite), `jefatura_departamento` y `jefe_catedra` (puesto dentro de su alcance). Leen además `autoridad`. Sin acceso a evaluaciones: `docente`, `analista_puestos` y `administrador`; este último solo lee y edita la matriz.
- DTOs con class-validator y `@ApiProperty`; tras cambiar un endpoint o DTO, `npm run api:tipos` (nunca editar `esquema.d.ts` a mano).
- Los commits no llevan línea `Co-Authored-By` ni atribución a Claude (CLAUDE.md prevalece sobre cualquier indicación de agregarla).
- Antes de cerrar: `npm run lint` y `npm run format` en cada app; `npm test` y `npm run test:integracion` en el backend (hay migraciones y SQL); `npm run build` en el frontend.
- Comandos de migración y de la API, dentro del contenedor: `docker compose exec -T backend npm run ...`. Los tests del backend corren en el host (`cd backend && npx vitest run <archivo>`); los de integración requieren `docker compose up -d db`.

## Review Focus

Entradas y condiciones que la spec implica y que ninguna tarea cubriría por sí sola; cada línea tiene su test en la tarea que se indica.

- **Dos evaluaciones del mismo par el mismo día**: gana la de mayor id. **Una con fecha anterior** a la vigente queda en el historial y no cambia la vigente. Tarea 2 (`evaluacion.esquema.int.spec.ts`).
- **Requisito quitado y vuelto a agregar**: la evaluación no cuenta para el avance mientras el requisito no está y vuelve a contar al reagregarlo. Tarea 6 (`pares.int.spec.ts`).
- **Matriz cambiada después de evaluar**: la evaluación guardada conserva su nivel; la nueva usa la matriz nueva. Tarea 4 (`evaluaciones.int.spec.ts`).
- **Evaluar durante una fusión**: el bloqueo 7003 serializa la evaluación del conocimiento de origen con la fusión; tras la fusión, evaluar el origen da 400 (inactivo) y las evaluaciones previas quedan en el destino. Tareas 4 y 6.
- **Quién puede qué**: docente, analista y administrador reciben 403 en toda ruta de evaluación; jefe de cátedra con el puesto fuera de su alcance, 403; autoridad no puede evaluar; RR. HH. evalúa cualquier puesto. Tareas 3, 4 y 5 (más el test global de `@Roles`).
- **Entradas raras**: `fechaEvaluacion` futura (400), escalas inexistentes o inactivas (400), campo `nivelCriticidad` en el cuerpo (400), par sin requisito (409), puesto inexistente (404), puesto sin evaluaciones (aparece como pendiente, nunca como no crítico). Tareas 4, 5 y 6.

---

## Mapa de archivos

Backend (`backend/src/`):

| Archivo | Responsabilidad |
| --- | --- |
| `common/roles.ts` | Tres listas de roles de criticidad (evaluadores, lectores, lectores de la matriz) |
| `modules/criticidad/criticidad.constantes.ts` | Slug del dominio `nivel-criticidad` |
| `modules/criticidad/entities/nivel-impacto.entity.ts`, `nivel-dificultad.entity.ts`, `matriz-criticidad.entity.ts`, `evaluacion-criticidad.entity.ts` | Entidades |
| `infra/database/migrations/*` | Cuatro migraciones: tablas de escalas y matriz, su carga, evaluación, vista |
| `modules/criticidad/dto/matriz.dto.ts`, `evaluacion.dto.ts`, `pares.dto.ts` | DTOs de entrada y salida |
| `modules/criticidad/criticidad.mapper.ts` | Entidad → DTO |
| `modules/criticidad/matriz.service.ts` | Lectura de escalas y matriz, `nivelDe`, edición de celdas |
| `modules/criticidad/evaluaciones.service.ts` | `evaluar` e `historial` |
| `modules/criticidad/pares.sql.ts`, `pares.service.ts` | Pares con su evaluación vigente y avance de OE5 |
| `modules/criticidad/criticidad.controller.ts` | `GET /criticidad/pares`, `/avance`, `/matriz`; `PUT /criticidad/matriz/...` |
| `modules/criticidad/evaluaciones.controller.ts` | `POST` e historial bajo `/puestos/:idPuesto/criticidad/:idConocimiento` |
| `modules/criticidad/criticidad.module.ts` | Registro |
| `modules/conocimiento/fusion.sql.ts`, `conocimientos.service.ts`, `dto/catalogo.dto.ts` | Paso de fusión y contador de evaluaciones |

Frontend (`frontend/src/`):

| Archivo | Responsabilidad |
| --- | --- |
| `features/criticidad/hooks/useCriticidad.ts` | Pares, avance, matriz, historial y mutaciones |
| `features/criticidad/pages/CriticidadPage.tsx` | Avance de OE5, filtros y tabla de pares |
| `features/criticidad/components/EvaluarDialog.tsx` | Formulario con criterios, resultado en vivo e historial |
| `features/criticidad/components/HistorialEvaluaciones.tsx` | Tabla del historial del par |
| `features/criticidad/niveles.ts` | Etiqueta y color del nivel de criticidad |
| `features/admin/components/MatrizCriticidad.tsx`, `pages/AdminPage.tsx` | Pestaña de la matriz |
| `features/conocimiento/components/FusionarDialog.tsx` | Muestra las evaluaciones movidas |

---

### Task 1: Escalas y matriz (tablas, carga y entidades)

**Files:**
- Create: `backend/src/modules/criticidad/entities/nivel-impacto.entity.ts`
- Create: `backend/src/modules/criticidad/entities/nivel-dificultad.entity.ts`
- Create: `backend/src/modules/criticidad/entities/matriz-criticidad.entity.ts`
- Create: `backend/src/infra/database/migrations/<marca>-CrearEscalasYMatrizCriticidad.ts` (generada)
- Create: `backend/src/infra/database/migrations/<marca>-CargarEscalasYMatrizCriticidad.ts` (a mano)
- Test: `backend/src/modules/criticidad/matriz.esquema.int.spec.ts`

**Interfaces:**
- Consumes: `ValorReferenciaOrdinal` (`modules/referencia/entities/valor-referencia.base.ts`), `NivelCriticidad` (`modules/referencia/entities/nivel-criticidad.entity.ts`).
- Produces: entidades `NivelImpacto`, `NivelDificultad` (columnas de `ValorReferenciaOrdinal` más `criterio: string`) y `MatrizCriticidad` (`idNivelImpacto`, `idNivelDificultad`, `idNivelCriticidad`: `number`); tablas `nivel_impacto`, `nivel_dificultad`, `matriz_criticidad` con 3 + 3 + 9 filas.

- [ ] **Step 1: Escribir las entidades**

`nivel-impacto.entity.ts`:

```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferenciaOrdinal } from '../../referencia/entities/valor-referencia.base.js';

/**
 * Escala fija de impacto de pérdida (bajo, medio, alto). No es un dominio de
 * RF23: agregar o quitar un nivel dejaría incompleta la matriz. Se carga por
 * migración, con el criterio observable de cada nivel.
 */
@Entity('nivel_impacto')
export class NivelImpacto extends ValorReferenciaOrdinal {
  @PrimaryGeneratedColumn({ name: 'id_nivel_impacto' })
  id: number;

  @Column({ type: 'text' })
  criterio: string;
}
```

`nivel-dificultad.entity.ts` (igual, con `nivel_dificultad`, `id_nivel_dificultad`, clase `NivelDificultad` y el comentario «Escala fija de dificultad de reemplazo (fácil, moderada, difícil)»):

```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferenciaOrdinal } from '../../referencia/entities/valor-referencia.base.js';

/**
 * Escala fija de dificultad de reemplazo (fácil, moderada, difícil). Mismas
 * razones que `NivelImpacto` para no ser un dominio administrable.
 */
@Entity('nivel_dificultad')
export class NivelDificultad extends ValorReferenciaOrdinal {
  @PrimaryGeneratedColumn({ name: 'id_nivel_dificultad' })
  id: number;

  @Column({ type: 'text' })
  criterio: string;
}
```

`matriz-criticidad.entity.ts`:

```ts
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { NivelCriticidad } from '../../referencia/entities/nivel-criticidad.entity.js';
import { NivelDificultad } from './nivel-dificultad.entity.js';
import { NivelImpacto } from './nivel-impacto.entity.js';

/**
 * Nivel de criticidad para cada combinación de impacto y dificultad. Siempre
 * tiene las nueve celdas: solo se edita `idNivelCriticidad`, nunca se agregan
 * ni se borran filas.
 */
@Entity('matriz_criticidad')
export class MatrizCriticidad {
  @PrimaryColumn({ name: 'id_nivel_impacto', type: 'int' })
  idNivelImpacto: number;

  @PrimaryColumn({ name: 'id_nivel_dificultad', type: 'int' })
  idNivelDificultad: number;

  @Column({ name: 'id_nivel_criticidad', type: 'int' })
  idNivelCriticidad: number;

  @ManyToOne(() => NivelImpacto, { nullable: false })
  @JoinColumn({ name: 'id_nivel_impacto' })
  nivelImpacto: Relation<NivelImpacto>;

  @ManyToOne(() => NivelDificultad, { nullable: false })
  @JoinColumn({ name: 'id_nivel_dificultad' })
  nivelDificultad: Relation<NivelDificultad>;

  @ManyToOne(() => NivelCriticidad, { nullable: false })
  @JoinColumn({ name: 'id_nivel_criticidad' })
  nivelCriticidad: Relation<NivelCriticidad>;
}
```

- [ ] **Step 2: Generar la migración de tablas**

Con la base arriba (`docker compose up -d db backend`):

Run: `docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/CrearEscalasYMatrizCriticidad`

Revisar el archivo generado. Debe tener solo: `CREATE TABLE "nivel_impacto"`, `"nivel_dificultad"` (con `criterio text NOT NULL`, `orden` único, `codigo` y `denominacion` únicos) y `"matriz_criticidad"` (clave primaria `("id_nivel_impacto", "id_nivel_dificultad")`), más sus tres FK, y el `down` simétrico. Borrar cualquier `DROP`/`CREATE` ajeno a este bloque.

- [ ] **Step 3: Escribir la migración de carga a mano**

Run: `docker compose exec -T backend npm run migration:create -- src/infra/database/migrations/CargarEscalasYMatrizCriticidad`

Reemplazar el cuerpo del archivo creado (conservar el nombre de clase y `name` que generó TypeORM con su marca de tiempo):

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

type Escala = [codigo: string, denominacion: string, orden: number, criterio: string];

const IMPACTOS: Escala[] = [
  ['bajo', 'Bajo', 1, 'La cátedra o el departamento sigue funcionando con ajustes menores'],
  ['medio', 'Medio', 2, 'Una función se degrada o se demora'],
  ['alto', 'Alto', 3, 'Una función crítica no puede cumplirse (por ejemplo, no se puede dictar o evaluar)'],
];

const DIFICULTADES: Escala[] = [
  ['facil', 'Fácil', 1, 'Otra persona del departamento lo cubre en menos de un mes'],
  ['moderada', 'Moderada', 2, 'Se forma o se contrata en uno a seis meses'],
  ['dificil', 'Difícil', 3, 'Más de seis meses, o nadie en el departamento lo tiene'],
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

export class CargarEscalasYMatrizCriticidad<MARCA> implements MigrationInterface {
  name = 'CargarEscalasYMatrizCriticidad<MARCA>';

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
```

(`<MARCA>` es la marca de tiempo que TypeORM puso en el nombre del archivo; el nombre de clase y `name` deben coincidir con el generado.)

- [ ] **Step 4: Escribir el test de integración del esquema**

`backend/src/modules/criticidad/matriz.esquema.int.spec.ts`:

```ts
import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';

describe('Escalas y matriz de criticidad (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('carga tres niveles por eje, ordenados y con criterio', async () => {
    for (const tabla of ['nivel_impacto', 'nivel_dificultad']) {
      const filas = await sql<{ codigo: string; orden: number; criterio: string }[]>(
        `SELECT codigo, orden, criterio FROM ${tabla} ORDER BY orden`,
      );
      expect(filas).toHaveLength(3);
      expect(filas.map((f) => f.orden)).toEqual([1, 2, 3]);
      expect(filas.every((f) => f.criterio.length > 10)).toBe(true);
    }
  });

  it('carga las nueve celdas con los resultados acordados', async () => {
    const filas = await sql<{ i: string; d: string; n: string }[]>(
      `SELECT i.codigo AS i, d.codigo AS d, n.codigo AS n
       FROM matriz_criticidad m
       JOIN nivel_impacto i ON i.id_nivel_impacto = m.id_nivel_impacto
       JOIN nivel_dificultad d ON d.id_nivel_dificultad = m.id_nivel_dificultad
       JOIN nivel_criticidad n ON n.id_nivel_criticidad = m.id_nivel_criticidad
       ORDER BY i.orden DESC, d.orden`,
    );
    expect(filas.map((f) => `${f.i}/${f.d}=${f.n}`)).toEqual([
      'alto/facil=media',
      'alto/moderada=alta',
      'alto/dificil=alta',
      'medio/facil=baja',
      'medio/moderada=media',
      'medio/dificil=alta',
      'bajo/facil=baja',
      'bajo/moderada=baja',
      'bajo/dificil=media',
    ]);
  });

  it('no admite una celda repetida', async () => {
    await expect(
      sql(
        `INSERT INTO matriz_criticidad (id_nivel_impacto, id_nivel_dificultad, id_nivel_criticidad)
         SELECT m.id_nivel_impacto, m.id_nivel_dificultad, m.id_nivel_criticidad
         FROM matriz_criticidad m LIMIT 1`,
      ),
    ).rejects.toThrow(/duplicate key|llave duplicada/i);
  });

  it('no deja borrar una escala que la matriz usa', async () => {
    await expect(sql(`DELETE FROM nivel_impacto`)).rejects.toThrow(
      /foreign key|llave foránea/i,
    );
  });
});
```

- [ ] **Step 5: Correr el test**

Run: `cd backend && npx vitest run --config vitest.integracion.config.ts src/modules/criticidad/matriz.esquema.int.spec.ts`
Expected: PASS (4 tests). Si falla por columnas, revisar la migración generada del paso 2.

- [ ] **Step 6: Confirmar que entidades y migraciones coinciden**

Run: `docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/Verificar`
Expected: «No changes in database schema were found» (o solo el `DROP INDEX "IDX_persona_apellido_nombre"` conocido). Si genera un archivo con otros cambios, ajustar entidad o migración y borrar el archivo `Verificar`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/criticidad backend/src/infra/database/migrations
git commit -m "Agregar las escalas de impacto y dificultad y la matriz de criticidad"
```

---

### Task 2: Historial de evaluaciones y vista de la vigente

**Files:**
- Create: `backend/src/modules/criticidad/entities/evaluacion-criticidad.entity.ts`
- Create: `backend/src/infra/database/migrations/<marca>-CrearEvaluacionCriticidad.ts` (generada)
- Create: `backend/src/infra/database/migrations/<marca>-CrearVistaCriticidadVigente.ts` (a mano)
- Test: `backend/src/modules/criticidad/evaluacion.esquema.int.spec.ts`

**Interfaces:**
- Consumes: tablas de la tarea 1; `Puesto`, `Conocimiento`, `Usuario`, `NivelCriticidad`.
- Produces: entidad `EvaluacionCriticidad` (`id`, `idPuesto`, `idConocimiento`, `idNivelImpacto`, `idNivelDificultad`, `idNivelCriticidad`, `fechaEvaluacion: string`, `idUsuario`, `observaciones: string | null`, `registradaEn: Date`; relaciones `usuario`, `puesto`, `conocimiento`); tabla `evaluacion_criticidad`; vista `criticidad_vigente` con las columnas `id_evaluacion, id_puesto, id_conocimiento, id_nivel_impacto, id_nivel_dificultad, id_nivel_criticidad, fecha_evaluacion, id_usuario, observaciones, registrada_en`.

- [ ] **Step 1: Escribir la entidad**

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
import { Conocimiento } from '../../conocimiento/entities/conocimiento.entity.js';
import { Puesto } from '../../estructura/entities/puesto.entity.js';
import { NivelCriticidad } from '../../referencia/entities/nivel-criticidad.entity.js';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';
import { NivelDificultad } from './nivel-dificultad.entity.js';
import { NivelImpacto } from './nivel-impacto.entity.js';

/**
 * Una evaluación de criticidad de un conocimiento en un puesto. Solo se
 * agregan filas: un error se corrige con una evaluación nueva. `idNivelCriticidad`
 * es la foto del resultado de la matriz al evaluar. Vigente: mayor
 * `fechaEvaluacion` y, en empate, mayor `id` (vista `criticidad_vigente`).
 * Se audita (RNF05): escribir siempre con `save()`.
 */
@Entity('evaluacion_criticidad')
@Check(
  'CK_evaluacion_criticidad_fecha_no_futura',
  '"fecha_evaluacion" <= CURRENT_DATE',
)
@Index('IDX_evaluacion_criticidad_par', [
  'idPuesto',
  'idConocimiento',
  'fechaEvaluacion',
])
export class EvaluacionCriticidad {
  @PrimaryGeneratedColumn({ name: 'id_evaluacion' })
  id: number;

  @Column({ name: 'id_puesto', type: 'int' })
  idPuesto: number;

  @Column({ name: 'id_conocimiento', type: 'int' })
  idConocimiento: number;

  @Column({ name: 'id_nivel_impacto', type: 'int' })
  idNivelImpacto: number;

  @Column({ name: 'id_nivel_dificultad', type: 'int' })
  idNivelDificultad: number;

  @Column({ name: 'id_nivel_criticidad', type: 'int' })
  idNivelCriticidad: number;

  @Column({ type: 'date' })
  fechaEvaluacion: string;

  @Column({ name: 'id_usuario', type: 'int' })
  idUsuario: number;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  registradaEn: Date;

  @ManyToOne(() => Puesto, { nullable: false })
  @JoinColumn({ name: 'id_puesto' })
  puesto: Relation<Puesto>;

  @ManyToOne(() => Conocimiento, { nullable: false })
  @JoinColumn({ name: 'id_conocimiento' })
  conocimiento: Relation<Conocimiento>;

  @ManyToOne(() => NivelImpacto, { nullable: false })
  @JoinColumn({ name: 'id_nivel_impacto' })
  nivelImpacto: Relation<NivelImpacto>;

  @ManyToOne(() => NivelDificultad, { nullable: false })
  @JoinColumn({ name: 'id_nivel_dificultad' })
  nivelDificultad: Relation<NivelDificultad>;

  @ManyToOne(() => NivelCriticidad, { nullable: false })
  @JoinColumn({ name: 'id_nivel_criticidad' })
  nivelCriticidad: Relation<NivelCriticidad>;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario>;
}
```

El índice es ascendente: PostgreSQL lo recorre al revés para el orden descendente de la vigente.

- [ ] **Step 2: Generar la migración de la tabla**

Run: `docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/CrearEvaluacionCriticidad`

Revisar: `CREATE TABLE "evaluacion_criticidad"` con `CK_evaluacion_criticidad_fecha_no_futura`, `registrada_en ... DEFAULT now()`, el índice `IDX_evaluacion_criticidad_par` y seis FK (`ON DELETE NO ACTION`). Borrar cambios ajenos.

- [ ] **Step 3: Escribir la migración de la vista a mano**

Run: `docker compose exec -T backend npm run migration:create -- src/infra/database/migrations/CrearVistaCriticidadVigente`

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearVistaCriticidadVigente<MARCA> implements MigrationInterface {
  name = 'CrearVistaCriticidadVigente<MARCA>';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE VIEW "criticidad_vigente" AS
       SELECT DISTINCT ON ("id_puesto", "id_conocimiento")
              "id_evaluacion", "id_puesto", "id_conocimiento",
              "id_nivel_impacto", "id_nivel_dificultad", "id_nivel_criticidad",
              "fecha_evaluacion", "id_usuario", "observaciones", "registrada_en"
       FROM "evaluacion_criticidad"
       ORDER BY "id_puesto", "id_conocimiento", "fecha_evaluacion" DESC, "id_evaluacion" DESC`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW "criticidad_vigente"`);
  }
}
```

- [ ] **Step 4: Escribir el test de integración**

`backend/src/modules/criticidad/evaluacion.esquema.int.spec.ts`:

```ts
import type { DataSource } from 'typeorm';
import { AuditoriaSubscriber } from '../../infra/auditoria/auditoria.subscriber.js';
import { contextoUsuario } from '../../infra/auditoria/contexto-usuario.js';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { EvaluacionCriticidad } from './entities/evaluacion-criticidad.entity.js';

describe('Evaluaciones de criticidad: esquema y vista (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let puesto: number;
  let conocimiento: number;
  let usuario: number;
  let escalas: { alto: number; bajo: number; facil: number; dificil: number; alta: number; baja: number };

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const dia = async (delta: number) =>
    (
      await sql<{ f: string }[]>(`SELECT (CURRENT_DATE + $1::int)::text AS f`, [
        delta,
      ])
    )[0].f;
  const id = async (consulta: string, parametros?: unknown[]) =>
    (await sql<{ id: number }[]>(consulta, parametros))[0].id;
  const evaluar = (
    fecha: string,
    nivel: number,
    p = puesto,
    c = conocimiento,
  ) =>
    sql<{ id: number }[]>(
      `INSERT INTO evaluacion_criticidad
         (id_puesto, id_conocimiento, id_nivel_impacto, id_nivel_dificultad, id_nivel_criticidad, fecha_evaluacion, id_usuario)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_evaluacion AS id`,
      [p, c, escalas.alto, escalas.dificil, nivel, fecha, usuario],
    );
  const vigente = async (p = puesto, c = conocimiento) =>
    (
      await sql<{ id: number; n: number; f: string }[]>(
        `SELECT id_evaluacion AS id, id_nivel_criticidad AS n, fecha_evaluacion::text AS f
         FROM criticidad_vigente WHERE id_puesto = $1 AND id_conocimiento = $2`,
        [p, c],
      )
    )[0];

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    puesto = await id(
      `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
       SELECT 'P-0001', 'Jefe de cátedra', (SELECT id_unidad FROM unidad_organizativa WHERE id_unidad_superior IS NULL),
              id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
       RETURNING id_puesto AS id`,
    );
    conocimiento = await id(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT 'SQL', 'sql', t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
    );
    usuario = await id(
      `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol)
       SELECT 'evaluador', 'x', id_rol FROM rol WHERE codigo = 'recursos_humanos' RETURNING id_usuario AS id`,
    );
    const porCodigo = async (tabla: string, columna: string, codigo: string) =>
      id(`SELECT ${columna} AS id FROM ${tabla} WHERE codigo = $1`, [codigo]);
    escalas = {
      alto: await porCodigo('nivel_impacto', 'id_nivel_impacto', 'alto'),
      bajo: await porCodigo('nivel_impacto', 'id_nivel_impacto', 'bajo'),
      facil: await porCodigo('nivel_dificultad', 'id_nivel_dificultad', 'facil'),
      dificil: await porCodigo('nivel_dificultad', 'id_nivel_dificultad', 'dificil'),
      alta: await porCodigo('nivel_criticidad', 'id_nivel_criticidad', 'alta'),
      baja: await porCodigo('nivel_criticidad', 'id_nivel_criticidad', 'baja'),
    };
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('rechaza una fecha de evaluación futura', async () => {
    await expect(evaluar(await dia(1), escalas.alta)).rejects.toThrow(
      /CK_evaluacion_criticidad_fecha_no_futura/,
    );
  });

  it('la vigente es la más reciente por fecha', async () => {
    await evaluar(await dia(-10), escalas.baja);
    const nueva = await evaluar(await dia(-2), escalas.alta);
    expect((await vigente()).id).toBe(nueva[0].id);
  });

  it('con la misma fecha gana el mayor id', async () => {
    const otro = await id(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT 'Redes', 'redes', t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
    );
    const hoy = await dia(0);
    await evaluar(hoy, escalas.baja, puesto, otro);
    const segunda = await evaluar(hoy, escalas.alta, puesto, otro);
    const v = await vigente(puesto, otro);
    expect(v.id).toBe(segunda[0].id);
    expect(v.n).toBe(escalas.alta);
  });

  it('una evaluación con fecha anterior a la vigente queda en el historial y no la reemplaza', async () => {
    const otro = await id(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT 'Java', 'java', t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
    );
    const reciente = await evaluar(await dia(-1), escalas.alta, puesto, otro);
    await evaluar(await dia(-30), escalas.baja, puesto, otro);
    expect((await vigente(puesto, otro)).id).toBe(reciente[0].id);
    const [{ n }] = await sql<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM evaluacion_criticidad WHERE id_puesto = $1 AND id_conocimiento = $2`,
      [puesto, otro],
    );
    expect(n).toBe(2);
  });

  it('un par sin evaluaciones no aparece en la vista', async () => {
    expect(await vigente(puesto, 999999)).toBeUndefined();
  });

  it('el alta con save() queda en la auditoría con el usuario', async () => {
    new AuditoriaSubscriber(ds);
    const repo = ds.getRepository(EvaluacionCriticidad);
    const creada = await contextoUsuario.run({ idUsuario: usuario }, () =>
      repo.save(
        repo.create({
          idPuesto: puesto,
          idConocimiento: conocimiento,
          idNivelImpacto: escalas.bajo,
          idNivelDificultad: escalas.facil,
          idNivelCriticidad: escalas.baja,
          fechaEvaluacion: '2026-01-01',
          idUsuario: usuario,
          observaciones: null,
        }),
      ),
    );
    const filas = await sql<{ operacion: string; id_usuario: number }[]>(
      `SELECT operacion, id_usuario FROM auditoria WHERE entidad = 'evaluacion_criticidad' AND id_registro = $1`,
      [String(creada.id)],
    );
    expect(filas).toEqual([{ operacion: 'alta', id_usuario: usuario }]);
  });
});
```

- [ ] **Step 5: Correr el test**

Run: `cd backend && npx vitest run --config vitest.integracion.config.ts src/modules/criticidad/evaluacion.esquema.int.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Confirmar que no hay diferencias de esquema**

Run: `docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/Verificar`
Expected: sin cambios (o solo el `DROP INDEX` conocido). Si crea un archivo, borrarlo.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/criticidad backend/src/infra/database/migrations
git commit -m "Agregar el historial de evaluaciones de criticidad y la vista de la vigente"
```

---

### Task 3: Matriz: roles, DTOs, servicio y endpoints

**Files:**
- Modify: `backend/src/common/roles.ts`
- Modify: `backend/src/common/roles.spec.ts`
- Create: `backend/src/modules/criticidad/criticidad.constantes.ts`
- Create: `backend/src/modules/criticidad/dto/matriz.dto.ts`
- Create: `backend/src/modules/criticidad/criticidad.mapper.ts`
- Create: `backend/src/modules/criticidad/matriz.service.ts`
- Create: `backend/src/modules/criticidad/criticidad.controller.ts`
- Modify: `backend/src/modules/criticidad/criticidad.module.ts`
- Test: `backend/src/modules/criticidad/matriz.service.spec.ts`

**Interfaces:**
- Consumes: entidades de la tarea 1; `ReferenciaService.validarActivo(slug, id)`.
- Produces:
  - `ROLES_EVALUADORES_DE_CRITICIDAD`, `ROLES_LECTORES_DE_CRITICIDAD`, `ROLES_LECTORES_DE_MATRIZ` (`CodigoRol[]`).
  - `DOMINIO_NIVEL_CRITICIDAD = 'nivel-criticidad'`.
  - `MatrizService.obtener(): Promise<MatrizDto>`, `nivelDe(idImpacto: number, idDificultad: number): Promise<number>` (id del nivel de criticidad), `editarCelda(idImpacto, idDificultad, dto: EditarCeldaDto): Promise<CeldaMatrizDto>`.
  - DTOs `EscalaDto`, `CeldaMatrizDto`, `MatrizDto`, `EditarCeldaDto`.
  - Endpoints `GET /criticidad/matriz` y `PUT /criticidad/matriz/:idImpacto/:idDificultad`.

- [ ] **Step 1: Escribir los tests de roles que fallan**

En `backend/src/common/roles.spec.ts`, agregar las tres listas al import y este bloque dentro del `describe('roles', ...)`:

```ts
  it('la criticidad la evalúan RR. HH. y los jefes; la leen además las autoridades; el docente, el analista y el administrador no', () => {
    expect([...ROLES_EVALUADORES_DE_CRITICIDAD].sort()).toEqual([
      'jefatura_departamento',
      'jefe_catedra',
      'recursos_humanos',
    ]);
    expect([...ROLES_LECTORES_DE_CRITICIDAD].sort()).toEqual([
      'autoridad',
      'jefatura_departamento',
      'jefe_catedra',
      'recursos_humanos',
    ]);
    for (const rol of ['docente', 'analista_puestos', 'administrador'] as const) {
      expect(ROLES_LECTORES_DE_CRITICIDAD).not.toContain(rol);
    }
    expect(ROLES_LECTORES_DE_MATRIZ).toEqual([
      ...ROLES_LECTORES_DE_CRITICIDAD,
      'administrador',
    ]);
  });
```

Run: `cd backend && npx vitest run src/common/roles.spec.ts`
Expected: FAIL (las constantes no existen).

- [ ] **Step 2: Agregar las listas a `roles.ts`**

Al final de `backend/src/common/roles.ts`:

```ts
/** Evalúan la criticidad de un par conocimiento-puesto (RF12): RR. HH. sin límite; los jefes, dentro de su alcance. */
export const ROLES_EVALUADORES_DE_CRITICIDAD: CodigoRol[] = [
  ROLES.recursosHumanos,
  ROLES.jefaturaDepartamento,
  ROLES.jefeCatedra,
];

/** Leen evaluaciones de criticidad (RF24): los evaluadores y las autoridades. El docente no. */
export const ROLES_LECTORES_DE_CRITICIDAD: CodigoRol[] = [
  ROLES.recursosHumanos,
  ROLES.autoridad,
  ROLES.jefaturaDepartamento,
  ROLES.jefeCatedra,
];

/** Leen escalas y matriz: los lectores de criticidad y el administrador, que edita la matriz. */
export const ROLES_LECTORES_DE_MATRIZ: CodigoRol[] = [
  ...ROLES_LECTORES_DE_CRITICIDAD,
  ROLES.administrador,
];
```

Run: `cd backend && npx vitest run src/common/roles.spec.ts`
Expected: PASS.

- [ ] **Step 3: Escribir las constantes y los DTOs**

`criticidad.constantes.ts`:

```ts
/** Slug del dominio de referencia `nivel_criticidad` (`ReferenciaService.validarActivo`). */
export const DOMINIO_NIVEL_CRITICIDAD = 'nivel-criticidad';
```

`dto/matriz.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

const MAX_INT4 = 2147483647;

export class EscalaDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  codigo: string;

  @ApiProperty()
  denominacion: string;

  @ApiProperty()
  orden: number;

  @ApiProperty({ description: 'Criterio observable del nivel' })
  criterio: string;

  @ApiProperty()
  activo: boolean;
}

export class CeldaMatrizDto {
  @ApiProperty()
  idNivelImpacto: number;

  @ApiProperty()
  idNivelDificultad: number;

  @ApiProperty({ description: 'Nivel de criticidad que da la combinación' })
  idNivelCriticidad: number;
}

export class MatrizDto {
  @ApiProperty({ type: EscalaDto, isArray: true })
  impactos: EscalaDto[];

  @ApiProperty({ type: EscalaDto, isArray: true })
  dificultades: EscalaDto[];

  @ApiProperty({ type: CeldaMatrizDto, isArray: true })
  celdas: CeldaMatrizDto[];
}

export class EditarCeldaDto {
  @ApiProperty({ description: 'Nivel de criticidad (activo) de la celda' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idNivelCriticidad: number;
}
```

`criticidad.mapper.ts` (se amplía en la tarea 4):

```ts
import type { CeldaMatrizDto, EscalaDto } from './dto/matriz.dto.js';
import type { MatrizCriticidad } from './entities/matriz-criticidad.entity.js';
import type { NivelDificultad } from './entities/nivel-dificultad.entity.js';
import type { NivelImpacto } from './entities/nivel-impacto.entity.js';

export function aEscalaDto(e: NivelImpacto | NivelDificultad): EscalaDto {
  return {
    id: e.id,
    codigo: e.codigo,
    denominacion: e.denominacion,
    orden: e.orden,
    criterio: e.criterio,
    activo: e.activo,
  };
}

export function aCeldaDto(c: MatrizCriticidad): CeldaMatrizDto {
  return {
    idNivelImpacto: c.idNivelImpacto,
    idNivelDificultad: c.idNivelDificultad,
    idNivelCriticidad: c.idNivelCriticidad,
  };
}
```

- [ ] **Step 4: Escribir los tests del servicio que fallan**

`matriz.service.spec.ts`:

```ts
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { MatrizCriticidad } from './entities/matriz-criticidad.entity.js';
import type { NivelDificultad } from './entities/nivel-dificultad.entity.js';
import type { NivelImpacto } from './entities/nivel-impacto.entity.js';
import { MatrizService } from './matriz.service.js';

const escala = (id: number, orden: number, activo = true) => ({
  id,
  codigo: `c${id}`,
  denominacion: `D${id}`,
  orden,
  criterio: `criterio ${id}`,
  activo,
});

function crearServicio(
  opciones: {
    impactos?: ReturnType<typeof escala>[];
    dificultades?: ReturnType<typeof escala>[];
    celdas?: MatrizCriticidad[];
    referenciaFalla?: boolean;
  } = {},
) {
  const impactos = opciones.impactos ?? [escala(1, 1), escala(2, 2), escala(3, 3)];
  const dificultades = opciones.dificultades ?? [escala(1, 1), escala(2, 2), escala(3, 3)];
  const celdas: MatrizCriticidad[] = opciones.celdas ?? [
    { idNivelImpacto: 3, idNivelDificultad: 3, idNivelCriticidad: 30 } as MatrizCriticidad,
    { idNivelImpacto: 1, idNivelDificultad: 1, idNivelCriticidad: 10 } as MatrizCriticidad,
  ];
  const repoImpactos = {
    find: vi.fn(async () => impactos),
    findOneBy: vi.fn(async ({ id }: { id: number }) => impactos.find((i) => i.id === id) ?? null),
  };
  const repoDificultades = {
    find: vi.fn(async () => dificultades),
    findOneBy: vi.fn(async ({ id }: { id: number }) => dificultades.find((d) => d.id === id) ?? null),
  };
  const repoCeldas = {
    find: vi.fn(async () => celdas),
    findOneBy: vi.fn(
      async (w: { idNivelImpacto: number; idNivelDificultad: number }) =>
        celdas.find(
          (c) =>
            c.idNivelImpacto === w.idNivelImpacto &&
            c.idNivelDificultad === w.idNivelDificultad,
        ) ?? null,
    ),
    save: vi.fn(async (c: MatrizCriticidad) => c),
  };
  const referencia = {
    validarActivo: vi.fn(async () => {
      if (opciones.referenciaFalla) throw new BadRequestException('inactivo');
    }),
  };
  const servicio = new MatrizService(
    repoImpactos as unknown as Repository<NivelImpacto>,
    repoDificultades as unknown as Repository<NivelDificultad>,
    repoCeldas as unknown as Repository<MatrizCriticidad>,
    referencia as unknown as ReferenciaService,
  );
  return { servicio, repoCeldas, referencia };
}

describe('MatrizService.nivelDe', () => {
  it('devuelve el nivel de la celda', async () => {
    const { servicio } = crearServicio();
    expect(await servicio.nivelDe(3, 3)).toBe(30);
    expect(await servicio.nivelDe(1, 1)).toBe(10);
  });

  it('rechaza una escala inexistente o desactivada', async () => {
    const { servicio } = crearServicio({
      impactos: [escala(1, 1), escala(2, 2, false)],
    });
    await expect(servicio.nivelDe(9, 1)).rejects.toBeInstanceOf(BadRequestException);
    await expect(servicio.nivelDe(2, 1)).rejects.toThrow(/desactivado/);
    await expect(servicio.nivelDe(1, 9)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('da 500 si la matriz no tiene la celda (matriz incompleta)', async () => {
    const { servicio } = crearServicio();
    await expect(servicio.nivelDe(2, 2)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});

describe('MatrizService.obtener', () => {
  it('devuelve las escalas ordenadas con su criterio y las celdas', async () => {
    const { servicio } = crearServicio();
    const matriz = await servicio.obtener();
    expect(matriz.impactos.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(matriz.impactos[0].criterio).toBe('criterio 1');
    expect(matriz.celdas).toEqual([
      { idNivelImpacto: 3, idNivelDificultad: 3, idNivelCriticidad: 30 },
      { idNivelImpacto: 1, idNivelDificultad: 1, idNivelCriticidad: 10 },
    ]);
  });
});

describe('MatrizService.editarCelda', () => {
  it('cambia el nivel de la celda', async () => {
    const { servicio, repoCeldas } = crearServicio();
    const celda = await servicio.editarCelda(1, 1, { idNivelCriticidad: 20 });
    expect(celda).toEqual({ idNivelImpacto: 1, idNivelDificultad: 1, idNivelCriticidad: 20 });
    expect(repoCeldas.save).toHaveBeenCalledOnce();
  });

  it('rechaza un nivel de criticidad inexistente o inactivo sin tocar la celda', async () => {
    const { servicio, repoCeldas } = crearServicio({ referenciaFalla: true });
    await expect(
      servicio.editarCelda(1, 1, { idNivelCriticidad: 99 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repoCeldas.save).not.toHaveBeenCalled();
  });

  it('da 404 si la celda no existe', async () => {
    const { servicio } = crearServicio();
    await expect(
      servicio.editarCelda(2, 2, { idNivelCriticidad: 20 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

Run: `cd backend && npx vitest run src/modules/criticidad/matriz.service.spec.ts`
Expected: FAIL (falta `matriz.service.js`).

- [ ] **Step 5: Implementar `MatrizService`**

```ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ReferenciaService } from '../referencia/referencia.service.js';
import { DOMINIO_NIVEL_CRITICIDAD } from './criticidad.constantes.js';
import { aCeldaDto, aEscalaDto } from './criticidad.mapper.js';
import type {
  CeldaMatrizDto,
  EditarCeldaDto,
  MatrizDto,
} from './dto/matriz.dto.js';
import { MatrizCriticidad } from './entities/matriz-criticidad.entity.js';
import { NivelDificultad } from './entities/nivel-dificultad.entity.js';
import { NivelImpacto } from './entities/nivel-impacto.entity.js';

/**
 * Escalas de impacto y dificultad y matriz que las combina (RF12). Cambiar una
 * celda no toca las evaluaciones ya guardadas: cada una conserva el nivel que
 * dio la matriz al evaluar.
 */
@Injectable()
export class MatrizService {
  constructor(
    @InjectRepository(NivelImpacto)
    private readonly impactos: Repository<NivelImpacto>,
    @InjectRepository(NivelDificultad)
    private readonly dificultades: Repository<NivelDificultad>,
    @InjectRepository(MatrizCriticidad)
    private readonly celdas: Repository<MatrizCriticidad>,
    private readonly referencia: ReferenciaService,
  ) {}

  async obtener(): Promise<MatrizDto> {
    const [impactos, dificultades, celdas] = await Promise.all([
      this.impactos.find({ order: { orden: 'ASC' } }),
      this.dificultades.find({ order: { orden: 'ASC' } }),
      this.celdas.find(),
    ]);
    return {
      impactos: impactos.map(aEscalaDto),
      dificultades: dificultades.map(aEscalaDto),
      celdas: celdas.map(aCeldaDto),
    };
  }

  /** Id del nivel de criticidad que la matriz da para el par; 400 si una escala no existe o está desactivada. */
  async nivelDe(idImpacto: number, idDificultad: number): Promise<number> {
    const impacto = await this.impactos.findOneBy({ id: idImpacto });
    if (!impacto || !impacto.activo) {
      throw new BadRequestException(
        `El nivel de impacto ${idImpacto} no existe o está desactivado`,
      );
    }
    const dificultad = await this.dificultades.findOneBy({ id: idDificultad });
    if (!dificultad || !dificultad.activo) {
      throw new BadRequestException(
        `El nivel de dificultad ${idDificultad} no existe o está desactivado`,
      );
    }
    const celda = await this.celdas.findOneBy({
      idNivelImpacto: idImpacto,
      idNivelDificultad: idDificultad,
    });
    if (!celda) {
      throw new InternalServerErrorException(
        'La matriz de criticidad está incompleta',
      );
    }
    return celda.idNivelCriticidad;
  }

  async editarCelda(
    idImpacto: number,
    idDificultad: number,
    dto: EditarCeldaDto,
  ): Promise<CeldaMatrizDto> {
    await this.referencia.validarActivo(
      DOMINIO_NIVEL_CRITICIDAD,
      dto.idNivelCriticidad,
    );
    const celda = await this.celdas.findOneBy({
      idNivelImpacto: idImpacto,
      idNivelDificultad: idDificultad,
    });
    if (!celda) {
      throw new NotFoundException(
        `No existe la celda de impacto ${idImpacto} y dificultad ${idDificultad}`,
      );
    }
    celda.idNivelCriticidad = dto.idNivelCriticidad;
    return aCeldaDto(await this.celdas.save(celda));
  }
}
```

Run: `cd backend && npx vitest run src/modules/criticidad/matriz.service.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Controller y módulo**

`criticidad.controller.ts` (se amplía en la tarea 5 con pares y avance):

```ts
import { Body, Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ROLES, ROLES_LECTORES_DE_MATRIZ } from '../../common/roles.js';
import { CeldaMatrizDto, EditarCeldaDto, MatrizDto } from './dto/matriz.dto.js';
import { MatrizService } from './matriz.service.js';

/** Criticidad del conocimiento por puesto (RF12): escalas, matriz, pares y avance. */
@ApiTags('criticidad')
@Controller('criticidad')
export class CriticidadController {
  constructor(private readonly matriz: MatrizService) {}

  @Get('matriz')
  @Roles(...ROLES_LECTORES_DE_MATRIZ)
  @ApiOkResponse({ type: MatrizDto })
  obtenerMatriz(): Promise<MatrizDto> {
    return this.matriz.obtener();
  }

  @Put('matriz/:idImpacto/:idDificultad')
  @Roles(ROLES.administrador)
  @ApiOkResponse({ type: CeldaMatrizDto })
  @ApiNotFoundResponse({ description: 'La celda no existe' })
  @ApiBadRequestResponse({ description: 'Nivel de criticidad inexistente o inactivo' })
  editarCelda(
    @Param('idImpacto', ParseIntPipe) idImpacto: number,
    @Param('idDificultad', ParseIntPipe) idDificultad: number,
    @Body() dto: EditarCeldaDto,
  ): Promise<CeldaMatrizDto> {
    return this.matriz.editarCelda(idImpacto, idDificultad, dto);
  }
}
```

`criticidad.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferenciaModule } from '../referencia/referencia.module.js';
import { CriticidadController } from './criticidad.controller.js';
import { EvaluacionCriticidad } from './entities/evaluacion-criticidad.entity.js';
import { MatrizCriticidad } from './entities/matriz-criticidad.entity.js';
import { NivelDificultad } from './entities/nivel-dificultad.entity.js';
import { NivelImpacto } from './entities/nivel-impacto.entity.js';
import { MatrizService } from './matriz.service.js';

/** Evaluación de criticidad por par conocimiento-puesto (RF12). */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NivelImpacto,
      NivelDificultad,
      MatrizCriticidad,
      EvaluacionCriticidad,
    ]),
    ReferenciaModule,
  ],
  controllers: [CriticidadController],
  providers: [MatrizService],
})
export class CriticidadModule {}
```

- [ ] **Step 7: Correr la batería del backend**

Run: `cd backend && npm run lint && npm test`
Expected: PASS, incluido `cobertura-roles.spec.ts` con el controller nuevo (cada ruta tiene `@Roles`).

- [ ] **Step 8: Commit**

```bash
git add backend/src
git commit -m "Agregar las escalas y la matriz de criticidad a la API"
```

---

### Task 4: Evaluar y consultar el historial

**Files:**
- Create: `backend/src/modules/criticidad/dto/evaluacion.dto.ts`
- Modify: `backend/src/modules/criticidad/criticidad.mapper.ts`
- Create: `backend/src/modules/criticidad/evaluaciones.service.ts`
- Create: `backend/src/modules/criticidad/evaluaciones.controller.ts`
- Modify: `backend/src/modules/criticidad/criticidad.module.ts`
- Test: `backend/src/modules/criticidad/evaluaciones.service.spec.ts`
- Test: `backend/src/modules/criticidad/evaluacion.dto.spec.ts`
- Test: `backend/src/modules/criticidad/evaluaciones.int.spec.ts`

**Interfaces:**
- Consumes: `MatrizService.nivelDe`; `AlcanceService.exigirUnidad(sesion, idUnidad)` (`modules/usuarios/alcance.service.ts`); `enTransaccionDeConocimiento(repositorio, trabajo)` (`modules/conocimiento/transaccion.ts`); `hoyDeLaBase(manager)`; `SesionUsuario`; `UsuariosModule` (exporta `AlcanceService`, como ya lo usa `ConocimientoModule`).
- Produces:
  - `EvaluarDto` (`idNivelImpacto`, `idNivelDificultad`, `fechaEvaluacion?: string`, `observaciones?: string | null`) y `EvaluacionDto` (`id`, `idPuesto`, `idConocimiento`, `idNivelImpacto`, `idNivelDificultad`, `idNivelCriticidad`, `fechaEvaluacion`, `idUsuario`, `nombreUsuario`, `observaciones`, `registradaEn: string`).
  - `EvaluacionesService.evaluar(idPuesto, idConocimiento, dto, sesion): Promise<EvaluacionDto>` e `historial(idPuesto, idConocimiento, sesion): Promise<EvaluacionDto[]>`.
  - `POST /puestos/:idPuesto/criticidad/:idConocimiento` y `GET /puestos/:idPuesto/criticidad/:idConocimiento/historial`.

- [ ] **Step 1: DTOs y mapper**

`dto/evaluacion.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../conocimiento/dto/trim.js';
import { FechaIso } from '../../personas/dto/fecha-iso.decorator.js';

const MAX_INT4 = 2147483647;

export class EvaluarDto {
  @ApiProperty({ description: 'Nivel de impacto de pérdida (escala fija)' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idNivelImpacto: number;

  @ApiProperty({ description: 'Nivel de dificultad de reemplazo (escala fija)' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idNivelDificultad: number;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-06-15',
    description: 'No futura; por defecto, hoy',
  })
  @IsOptional()
  @FechaIso()
  fechaEvaluacion?: string;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 2000 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  observaciones?: string | null;
}

export class EvaluacionDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  idPuesto: number;

  @ApiProperty()
  idConocimiento: number;

  @ApiProperty()
  idNivelImpacto: number;

  @ApiProperty()
  idNivelDificultad: number;

  @ApiProperty({ description: 'Resultado de la matriz al evaluar' })
  idNivelCriticidad: number;

  @ApiProperty({ format: 'date' })
  fechaEvaluacion: string;

  @ApiProperty()
  idUsuario: number;

  @ApiProperty()
  nombreUsuario: string;

  @ApiProperty({ nullable: true, type: String })
  observaciones: string | null;

  @ApiProperty({ format: 'date-time' })
  registradaEn: string;
}
```

Agregar a `criticidad.mapper.ts`:

```ts
import type { EvaluacionDto } from './dto/evaluacion.dto.js';
import type { EvaluacionCriticidad } from './entities/evaluacion-criticidad.entity.js';

export function aEvaluacionDto(
  e: EvaluacionCriticidad,
  nombreUsuario: string,
): EvaluacionDto {
  return {
    id: e.id,
    idPuesto: e.idPuesto,
    idConocimiento: e.idConocimiento,
    idNivelImpacto: e.idNivelImpacto,
    idNivelDificultad: e.idNivelDificultad,
    idNivelCriticidad: e.idNivelCriticidad,
    fechaEvaluacion: e.fechaEvaluacion,
    idUsuario: e.idUsuario,
    nombreUsuario,
    observaciones: e.observaciones,
    registradaEn: e.registradaEn.toISOString(),
  };
}
```

- [ ] **Step 2: Test del DTO que falla**

`evaluacion.dto.spec.ts`:

```ts
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EvaluarDto } from './dto/evaluacion.dto.js';

const validar = (datos: object) =>
  validateSync(plainToInstance(EvaluarDto, datos), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

describe('EvaluarDto', () => {
  it('acepta impacto y dificultad; fecha y observaciones son opcionales', () => {
    expect(validar({ idNivelImpacto: 3, idNivelDificultad: 2 })).toEqual([]);
  });

  it('rechaza que el cliente mande el nivel de criticidad', () => {
    expect(
      validar({ idNivelImpacto: 3, idNivelDificultad: 2, nivelCriticidad: 1 }),
    ).toContain('nivelCriticidad');
    expect(
      validar({ idNivelImpacto: 3, idNivelDificultad: 2, idNivelCriticidad: 1 }),
    ).toContain('idNivelCriticidad');
  });

  it('rechaza ids no enteros, fecha mal formada y observaciones demasiado largas', () => {
    expect(validar({ idNivelImpacto: 'x', idNivelDificultad: 2 })).toContain('idNivelImpacto');
    expect(
      validar({ idNivelImpacto: 1, idNivelDificultad: 2, fechaEvaluacion: '15/06/2026' }),
    ).toContain('fechaEvaluacion');
    expect(
      validar({ idNivelImpacto: 1, idNivelDificultad: 2, observaciones: 'x'.repeat(2001) }),
    ).toContain('observaciones');
  });
});
```

Run: `cd backend && npx vitest run src/modules/criticidad/evaluacion.dto.spec.ts`
Expected: PASS (el DTO ya existe; el test fija la regla de que el nivel no se acepta).

- [ ] **Step 3: Tests del servicio que fallan**

`evaluaciones.service.spec.ts`:

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
import type { AlcanceService } from '../usuarios/alcance.service.js';
import type { EvaluacionCriticidad } from './entities/evaluacion-criticidad.entity.js';
import { EvaluacionesService } from './evaluaciones.service.js';
import type { MatrizService } from './matriz.service.js';

const HOY = '2026-06-15';
const rrhh: SesionUsuario = {
  id: 4,
  nombreUsuario: 'rrhh',
  rol: 'recursos_humanos',
  idPersona: null,
  unidades: [],
};
const dto = { idNivelImpacto: 3, idNivelDificultad: 3 };

function crearEntorno(
  opciones: {
    puesto?: { idUnidad: number; activo: boolean } | null;
    conocimiento?: { activo: boolean } | null;
    requisito?: object | null;
    fueraDeAlcance?: boolean;
    matrizFalla?: boolean;
  } = {},
) {
  const puesto = opciones.puesto === undefined ? { idUnidad: 10, activo: true } : opciones.puesto;
  const conocimiento = opciones.conocimiento === undefined ? { activo: true } : opciones.conocimiento;
  const requisito = opciones.requisito === undefined ? {} : opciones.requisito;
  const repo = {
    create: vi.fn((d: Partial<EvaluacionCriticidad>) => ({ ...d })),
    save: vi.fn(async (d: Partial<EvaluacionCriticidad>) => ({
      ...d,
      id: 77,
      registradaEn: new Date('2026-06-15T12:00:00Z'),
    })),
    find: vi.fn(async () => []),
  };
  const manager = {
    query: vi.fn(async (sql: string) =>
      sql.includes('CURRENT_DATE') ? [{ hoy: HOY }] : [],
    ),
    getRepository: (entidad: { name: string }) =>
      entidad.name === 'Puesto'
        ? { findOne: vi.fn(async () => puesto) }
        : entidad.name === 'Conocimiento'
          ? { findOne: vi.fn(async () => conocimiento) }
          : entidad.name === 'RequisitoPuesto'
            ? { findOne: vi.fn(async () => requisito) }
            : repo,
    transaction: async (t: (m: unknown) => Promise<unknown>) => t(manager),
  };
  (repo as unknown as { manager: unknown }).manager = manager;
  const matriz = {
    nivelDe: vi.fn(async () => {
      if (opciones.matrizFalla) throw new BadRequestException('escala inactiva');
      return 30;
    }),
  };
  const alcance = {
    exigirUnidad: vi.fn(async () => {
      if (opciones.fueraDeAlcance) throw new ForbiddenException('fuera');
    }),
  };
  const puestos = { findOne: vi.fn(async () => puesto) };
  const servicio = new EvaluacionesService(
    repo as unknown as Repository<EvaluacionCriticidad>,
    puestos as unknown as Repository<Puesto>,
    matriz as unknown as MatrizService,
    alcance as unknown as AlcanceService,
  );
  return { servicio, repo, matriz, alcance };
}

describe('EvaluacionesService.evaluar', () => {
  it('guarda con el nivel de la matriz, el usuario de la sesión y la fecha de hoy por defecto', async () => {
    const { servicio, repo, matriz, alcance } = crearEntorno();

    const resultado = await servicio.evaluar(5, 8, dto, rrhh);

    expect(matriz.nivelDe).toHaveBeenCalledWith(3, 3);
    expect(alcance.exigirUnidad).toHaveBeenCalledWith(rrhh, 10);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        idPuesto: 5,
        idConocimiento: 8,
        idNivelImpacto: 3,
        idNivelDificultad: 3,
        idNivelCriticidad: 30,
        fechaEvaluacion: HOY,
        idUsuario: 4,
        observaciones: null,
      }),
    );
    expect(resultado).toMatchObject({
      id: 77,
      idNivelCriticidad: 30,
      nombreUsuario: 'rrhh',
      registradaEn: '2026-06-15T12:00:00.000Z',
    });
  });

  it('usa la fecha indicada y las observaciones', async () => {
    const { servicio, repo } = crearEntorno();
    await servicio.evaluar(5, 8, { ...dto, fechaEvaluacion: '2026-06-01', observaciones: 'Revisado' }, rrhh);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ fechaEvaluacion: '2026-06-01', observaciones: 'Revisado' }),
    );
  });

  it('rechaza una fecha futura sin guardar', async () => {
    const { servicio, repo } = crearEntorno();
    await expect(
      servicio.evaluar(5, 8, { ...dto, fechaEvaluacion: '2026-06-16' }, rrhh),
    ).rejects.toThrow(/futura/);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rechaza una escala inactiva antes de abrir la transacción', async () => {
    const { servicio, repo } = crearEntorno({ matrizFalla: true });
    await expect(servicio.evaluar(5, 8, dto, rrhh)).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('da 404 si el puesto o el conocimiento no existen', async () => {
    await expect(
      crearEntorno({ puesto: null }).servicio.evaluar(5, 8, dto, rrhh),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      crearEntorno({ conocimiento: null }).servicio.evaluar(5, 8, dto, rrhh),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('da 400 si el puesto o el conocimiento están dados de baja', async () => {
    await expect(
      crearEntorno({ puesto: { idUnidad: 10, activo: false } }).servicio.evaluar(5, 8, dto, rrhh),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      crearEntorno({ conocimiento: { activo: false } }).servicio.evaluar(5, 8, dto, rrhh),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('da 409 si el puesto no exige el conocimiento', async () => {
    const { servicio, repo } = crearEntorno({ requisito: null });
    await expect(servicio.evaluar(5, 8, dto, rrhh)).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('da 403 si el puesto está fuera del alcance', async () => {
    const { servicio, repo } = crearEntorno({ fueraDeAlcance: true });
    await expect(servicio.evaluar(5, 8, dto, rrhh)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('EvaluacionesService.historial', () => {
  it('da 404 si el puesto no existe y 403 si queda fuera del alcance', async () => {
    await expect(
      crearEntorno({ puesto: null }).servicio.historial(5, 8, rrhh),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      crearEntorno({ fueraDeAlcance: true }).servicio.historial(5, 8, rrhh),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lista la más reciente primero, con el nombre del evaluador', async () => {
    const { servicio, repo } = crearEntorno();
    repo.find.mockResolvedValueOnce([
      {
        id: 2, idPuesto: 5, idConocimiento: 8, idNivelImpacto: 3, idNivelDificultad: 3,
        idNivelCriticidad: 30, fechaEvaluacion: '2026-06-10', idUsuario: 4,
        observaciones: null, registradaEn: new Date('2026-06-10T10:00:00Z'),
        usuario: { nombreUsuario: 'rrhh' },
      },
    ] as never);
    const filas = await servicio.historial(5, 8, rrhh);
    expect(repo.find).toHaveBeenCalledWith({
      where: { idPuesto: 5, idConocimiento: 8 },
      relations: { usuario: true },
      order: { fechaEvaluacion: 'DESC', id: 'DESC' },
    });
    expect(filas).toEqual([expect.objectContaining({ id: 2, nombreUsuario: 'rrhh' })]);
  });
});
```

Run: `cd backend && npx vitest run src/modules/criticidad/evaluaciones.service.spec.ts`
Expected: FAIL (falta `evaluaciones.service.js`).

- [ ] **Step 4: Implementar `EvaluacionesService`**

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
import { Conocimiento } from '../conocimiento/entities/conocimiento.entity.js';
import { RequisitoPuesto } from '../conocimiento/entities/requisito-puesto.entity.js';
import { enTransaccionDeConocimiento } from '../conocimiento/transaccion.js';
import { Puesto } from '../estructura/entities/puesto.entity.js';
import { hoyDeLaBase } from '../personas/fechas.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { aEvaluacionDto } from './criticidad.mapper.js';
import type { EvaluacionDto, EvaluarDto } from './dto/evaluacion.dto.js';
import { EvaluacionCriticidad } from './entities/evaluacion-criticidad.entity.js';
import { MatrizService } from './matriz.service.js';

/**
 * Evaluación de criticidad por par conocimiento-puesto (RF12). Solo agrega al
 * historial; la vigente sale de la vista `criticidad_vigente`. Escribe con
 * `save()` para que la auditoría registre el alta (RNF05) y bajo el bloqueo de
 * conocimiento, para no cruzarse con una fusión.
 */
@Injectable()
export class EvaluacionesService {
  constructor(
    @InjectRepository(EvaluacionCriticidad)
    private readonly evaluaciones: Repository<EvaluacionCriticidad>,
    @InjectRepository(Puesto) private readonly puestos: Repository<Puesto>,
    private readonly matriz: MatrizService,
    private readonly alcance: AlcanceService,
  ) {}

  async evaluar(
    idPuesto: number,
    idConocimiento: number,
    dto: EvaluarDto,
    sesion: SesionUsuario,
  ): Promise<EvaluacionDto> {
    // Se lee antes de la transacción: valida las escalas y fija el nivel de esta evaluación.
    const idNivelCriticidad = await this.matriz.nivelDe(
      dto.idNivelImpacto,
      dto.idNivelDificultad,
    );

    return enTransaccionDeConocimiento(this.evaluaciones, async (manager) => {
      const puesto = await manager
        .getRepository(Puesto)
        .findOne({ where: { id: idPuesto } });
      if (!puesto) throw new NotFoundException(`No existe el puesto ${idPuesto}`);
      await this.alcance.exigirUnidad(sesion, puesto.idUnidad);
      if (!puesto.activo) {
        throw new BadRequestException('El puesto está dado de baja');
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
      const requisito = await manager
        .getRepository(RequisitoPuesto)
        .findOne({ where: { idPuesto, idConocimiento } });
      if (!requisito) {
        throw new ConflictException(
          'El puesto no exige ese conocimiento: solo se evalúan los conocimientos del perfil',
        );
      }
      const hoy = await hoyDeLaBase(manager);
      const fecha = dto.fechaEvaluacion ?? hoy;
      if (fecha > hoy) {
        throw new BadRequestException('La fecha de evaluación no puede ser futura');
      }

      const repo = manager.getRepository(EvaluacionCriticidad);
      const creada = await repo.save(
        repo.create({
          idPuesto,
          idConocimiento,
          idNivelImpacto: dto.idNivelImpacto,
          idNivelDificultad: dto.idNivelDificultad,
          idNivelCriticidad,
          fechaEvaluacion: fecha,
          idUsuario: sesion.id,
          observaciones: dto.observaciones ?? null,
        }),
      );
      return aEvaluacionDto(creada, sesion.nombreUsuario);
    });
  }

  /** Todas las evaluaciones del par, la más reciente primero. Sigue disponible aunque el requisito se haya quitado. */
  async historial(
    idPuesto: number,
    idConocimiento: number,
    sesion: SesionUsuario,
  ): Promise<EvaluacionDto[]> {
    const puesto = await this.puestos.findOne({ where: { id: idPuesto } });
    if (!puesto) throw new NotFoundException(`No existe el puesto ${idPuesto}`);
    await this.alcance.exigirUnidad(sesion, puesto.idUnidad);
    const filas = await this.evaluaciones.find({
      where: { idPuesto, idConocimiento },
      relations: { usuario: true },
      order: { fechaEvaluacion: 'DESC', id: 'DESC' },
    });
    return filas.map((e) => aEvaluacionDto(e, e.usuario.nombreUsuario));
  }
}
```

Run: `cd backend && npx vitest run src/modules/criticidad/evaluaciones.service.spec.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Controller y módulo**

`evaluaciones.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
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
import {
  ROLES_EVALUADORES_DE_CRITICIDAD,
  ROLES_LECTORES_DE_CRITICIDAD,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { EvaluacionDto, EvaluarDto } from './dto/evaluacion.dto.js';
import { EvaluacionesService } from './evaluaciones.service.js';

/** Evaluación de criticidad de un conocimiento en un puesto (RF12). */
@ApiTags('criticidad')
@Controller('puestos/:idPuesto/criticidad/:idConocimiento')
export class EvaluacionesController {
  constructor(private readonly servicio: EvaluacionesService) {}

  @Post()
  @HttpCode(201)
  @Roles(...ROLES_EVALUADORES_DE_CRITICIDAD)
  @ApiCreatedResponse({ type: EvaluacionDto })
  @ApiNotFoundResponse({ description: 'El puesto o el conocimiento no existen' })
  @ApiBadRequestResponse({
    description: 'Fecha futura, escala inactiva o puesto o conocimiento de baja',
  })
  @ApiConflictResponse({ description: 'El puesto no exige ese conocimiento' })
  @ApiForbiddenResponse({ description: 'El puesto está fuera de tu alcance' })
  evaluar(
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
    @Body() dto: EvaluarDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<EvaluacionDto> {
    return this.servicio.evaluar(idPuesto, idConocimiento, dto, sesion);
  }

  @Get('historial')
  @Roles(...ROLES_LECTORES_DE_CRITICIDAD)
  @ApiOkResponse({ type: EvaluacionDto, isArray: true })
  @ApiNotFoundResponse({ description: 'El puesto no existe' })
  @ApiForbiddenResponse({ description: 'El puesto está fuera de tu alcance' })
  historial(
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<EvaluacionDto[]> {
    return this.servicio.historial(idPuesto, idConocimiento, sesion);
  }
}
```

En `criticidad.module.ts`: importar `Puesto` (`../estructura/entities/puesto.entity.js`) en `TypeOrmModule.forFeature([...])`, importar `UsuariosModule` (`../usuarios/usuarios.module.js`) en `imports`, y registrar `EvaluacionesController` en `controllers` y `EvaluacionesService` en `providers`.

- [ ] **Step 6: Test de integración (matriz cambiada, empate, fusión pendiente)**

`evaluaciones.int.spec.ts` (usa el servicio real contra la base):

```ts
import type { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { Puesto } from '../estructura/entities/puesto.entity.js';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import { EvaluacionCriticidad } from './entities/evaluacion-criticidad.entity.js';
import { MatrizCriticidad } from './entities/matriz-criticidad.entity.js';
import { NivelDificultad } from './entities/nivel-dificultad.entity.js';
import { NivelImpacto } from './entities/nivel-impacto.entity.js';
import { EvaluacionesService } from './evaluaciones.service.js';
import { MatrizService } from './matriz.service.js';

describe('Evaluaciones de criticidad (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let servicio: EvaluacionesService;
  let matriz: MatrizService;
  let puesto: number;
  let conocimiento: number;
  let sesion: SesionUsuario;
  let ids: Record<string, number>;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const id = async (consulta: string, parametros?: unknown[]) =>
    (await sql<{ id: number }[]>(consulta, parametros))[0].id;

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    puesto = await id(
      `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
       SELECT 'P-0001', 'Jefe de cátedra', (SELECT id_unidad FROM unidad_organizativa WHERE id_unidad_superior IS NULL),
              id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
       RETURNING id_puesto AS id`,
    );
    conocimiento = await id(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT 'SQL', 'sql', t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
    );
    await sql(
      `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente)
       SELECT $1, $2, id_nivel_dominio, true FROM nivel_dominio WHERE codigo = 'avanzado'`,
      [puesto, conocimiento],
    );
    const usuario = await id(
      `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol)
       SELECT 'rrhh', 'x', id_rol FROM rol WHERE codigo = 'recursos_humanos' RETURNING id_usuario AS id`,
    );
    sesion = {
      id: usuario,
      nombreUsuario: 'rrhh',
      rol: 'recursos_humanos',
      idPersona: null,
      unidades: [],
    };
    const codigos = async (tabla: string, col: string) =>
      Object.fromEntries(
        (await sql<{ codigo: string; id: number }[]>(`SELECT codigo, ${col} AS id FROM ${tabla}`)).map(
          (f) => [f.codigo, f.id],
        ),
      );
    ids = {
      ...Object.fromEntries(Object.entries(await codigos('nivel_impacto', 'id_nivel_impacto')).map(([k, v]) => [`i_${k}`, v])),
      ...Object.fromEntries(Object.entries(await codigos('nivel_dificultad', 'id_nivel_dificultad')).map(([k, v]) => [`d_${k}`, v])),
      ...Object.fromEntries(Object.entries(await codigos('nivel_criticidad', 'id_nivel_criticidad')).map(([k, v]) => [`n_${k}`, v])),
    };
    matriz = new MatrizService(
      ds.getRepository(NivelImpacto),
      ds.getRepository(NivelDificultad),
      ds.getRepository(MatrizCriticidad),
      { validarActivo: async () => undefined } as never,
    );
    servicio = new EvaluacionesService(
      ds.getRepository(EvaluacionCriticidad),
      ds.getRepository(Puesto),
      matriz,
      { exigirUnidad: async () => undefined } as unknown as AlcanceService,
    );
    // El subscriber de auditoría exige usuario en el contexto de cada escritura.
    const { AuditoriaSubscriber } = await import('../../infra/auditoria/auditoria.subscriber.js');
    new AuditoriaSubscriber(ds);
  });
  afterAll(async () => {
    await base.destruir();
  });

  const evaluar = async (impacto: string, dificultad: string, extra = {}) => {
    const { contextoUsuario } = await import('../../infra/auditoria/contexto-usuario.js');
    return contextoUsuario.run({ idUsuario: sesion.id }, () =>
      servicio.evaluar(
        puesto,
        conocimiento,
        { idNivelImpacto: ids[`i_${impacto}`], idNivelDificultad: ids[`d_${dificultad}`], ...extra },
        sesion,
      ),
    );
  };

  it('guarda el nivel que da la matriz para cada combinación (alto/difícil = alta, bajo/fácil = baja)', async () => {
    expect((await evaluar('alto', 'dificil')).idNivelCriticidad).toBe(ids.n_alta);
    expect((await evaluar('bajo', 'facil')).idNivelCriticidad).toBe(ids.n_baja);
    expect((await evaluar('medio', 'moderada')).idNivelCriticidad).toBe(ids.n_media);
  });

  it('cambiar la matriz no altera lo guardado y la evaluación nueva usa la matriz nueva', async () => {
    const antes = await evaluar('bajo', 'dificil'); // matriz inicial: media
    expect(antes.idNivelCriticidad).toBe(ids.n_media);

    await matriz.editarCelda(ids.i_bajo, ids.d_dificil, { idNivelCriticidad: ids.n_alta });

    const [guardada] = await sql<{ n: number }[]>(
      `SELECT id_nivel_criticidad AS n FROM evaluacion_criticidad WHERE id_evaluacion = $1`,
      [antes.id],
    );
    expect(guardada.n).toBe(ids.n_media);
    expect((await evaluar('bajo', 'dificil')).idNivelCriticidad).toBe(ids.n_alta);
  });

  it('da 409 si el requisito se quitó, pero el historial sigue disponible', async () => {
    await sql(`DELETE FROM requisito_puesto WHERE id_puesto = $1 AND id_conocimiento = $2`, [puesto, conocimiento]);
    await expect(evaluar('alto', 'dificil')).rejects.toThrow(/no exige ese conocimiento/);
    const historial = await servicio.historial(puesto, conocimiento, sesion);
    expect(historial.length).toBeGreaterThanOrEqual(5);
    expect(historial[0].nombreUsuario).toBe('rrhh');
    // Orden: más reciente primero (misma fecha: mayor id primero).
    const claves = historial.map((h) => `${h.fechaEvaluacion}-${String(h.id).padStart(8, '0')}`);
    expect([...claves].sort().reverse()).toEqual(claves);
  });

  it('tras desactivar el conocimiento (como hace una fusión) no se puede evaluar', async () => {
    await sql(
      `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente)
       SELECT $1, $2, id_nivel_dominio, true FROM nivel_dominio WHERE codigo = 'avanzado'`,
      [puesto, conocimiento],
    );
    await sql(`UPDATE conocimiento SET activo = false WHERE id_conocimiento = $1`, [conocimiento]);
    await expect(evaluar('alto', 'dificil')).rejects.toThrow(/dado de baja/);
  });
});
```

Run: `cd backend && npx vitest run --config vitest.integracion.config.ts src/modules/criticidad/evaluaciones.int.spec.ts`
Expected: PASS (4 tests). Los tests comparten la base y se ejecutan en el orden escrito.

- [ ] **Step 7: Batería completa**

Run: `cd backend && npm run lint && npm test`
Expected: PASS (el test global de `@Roles` incluye `EvaluacionesController`).

- [ ] **Step 8: Commit**

```bash
git add backend/src
git commit -m "Agregar la evaluación de criticidad por par conocimiento-puesto y su historial"
```

---

### Task 5: Pares y avance de OE5

**Files:**
- Create: `backend/src/modules/criticidad/dto/pares.dto.ts`
- Create: `backend/src/modules/criticidad/pares.sql.ts`
- Create: `backend/src/modules/criticidad/pares.service.ts`
- Modify: `backend/src/modules/criticidad/criticidad.controller.ts`
- Modify: `backend/src/modules/criticidad/criticidad.module.ts`
- Test: `backend/src/modules/criticidad/pares.service.spec.ts`
- Test: `backend/src/modules/criticidad/pares.int.spec.ts`

**Interfaces:**
- Consumes: `AlcanceService.unidadesVisibles(sesion): Promise<number[] | null>`; vista `criticidad_vigente`.
- Produces:
  - `FiltroParesDto` (`idUnidad?`, `idPuesto?`, `estado?: 'pendiente' | 'evaluado'`), `ParCriticidadDto`, `AvanceDto` (`evaluados`, `total`).
  - `ParesService.pares(filtro, sesion): Promise<ParCriticidadDto[]>` y `avance(filtro, sesion): Promise<AvanceDto>`.
  - `GET /criticidad/pares` y `GET /criticidad/avance` (lectores de criticidad).

- [ ] **Step 1: DTOs**

`dto/pares.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';

export const ESTADOS_PAR = ['pendiente', 'evaluado'] as const;
export type EstadoPar = (typeof ESTADOS_PAR)[number];

const aNumero = ({ value }: { value: unknown }) => Number(value);

export class FiltroParesDto {
  @ApiPropertyOptional({ description: 'Unidad (incluye sus unidades descendientes)' })
  @IsOptional()
  @Transform(aNumero)
  @IsInt()
  idUnidad?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(aNumero)
  @IsInt()
  idPuesto?: number;

  @ApiPropertyOptional({ enum: ESTADOS_PAR })
  @IsOptional()
  @IsIn(ESTADOS_PAR)
  estado?: EstadoPar;
}

export class ParCriticidadDto {
  @ApiProperty()
  idPuesto: number;

  @ApiProperty()
  codigoPuesto: string;

  @ApiProperty()
  denominacionPuesto: string;

  @ApiProperty()
  idUnidad: number;

  @ApiProperty()
  idConocimiento: number;

  @ApiProperty()
  denominacionConocimiento: string;

  @ApiProperty()
  idNivelRequerido: number;

  @ApiProperty()
  esExcluyente: boolean;

  @ApiProperty({ enum: ESTADOS_PAR })
  estado: EstadoPar;

  @ApiProperty({ nullable: true, type: Number })
  idEvaluacion: number | null;

  @ApiProperty({ nullable: true, type: Number })
  idNivelImpacto: number | null;

  @ApiProperty({ nullable: true, type: Number })
  idNivelDificultad: number | null;

  @ApiProperty({ nullable: true, type: Number })
  idNivelCriticidad: number | null;

  @ApiProperty({ nullable: true, type: String, format: 'date' })
  fechaEvaluacion: string | null;
}

export class AvanceDto {
  @ApiProperty({ description: 'Pares con evaluación vigente' })
  evaluados: number;

  @ApiProperty({ description: 'Requisitos activos del alcance' })
  total: number;
}
```

- [ ] **Step 2: SQL**

`pares.sql.ts`:

```ts
/**
 * Parámetros comunes: `$1` unidades visibles (`null` = todas), `$2` unidad filtrada
 * (con sus descendientes) o `null`, `$3` puesto o `null`.
 */
const SUBUNIDADES = `
  WITH RECURSIVE subunidades AS (
    SELECT id_unidad FROM unidad_organizativa WHERE id_unidad = $2::int
    UNION
    SELECT u.id_unidad
    FROM unidad_organizativa u
    JOIN subunidades s ON u.id_unidad_superior = s.id_unidad
  )`;

/** Cada requisito activo con su evaluación vigente, si la hay. Un requisito quitado no aparece. */
const DESDE_PARES = `
  FROM requisito_puesto r
  JOIN puesto p ON p.id_puesto = r.id_puesto AND p.activo
  JOIN conocimiento c ON c.id_conocimiento = r.id_conocimiento AND c.activo
  LEFT JOIN criticidad_vigente v
    ON v.id_puesto = r.id_puesto AND v.id_conocimiento = r.id_conocimiento
  WHERE ($1::int[] IS NULL OR p.id_unidad = ANY($1::int[]))
    AND ($2::int IS NULL OR p.id_unidad IN (SELECT id_unidad FROM subunidades))
    AND ($3::int IS NULL OR p.id_puesto = $3::int)`;

/** Parámetros: los tres comunes y `$4` estado (`pendiente`, `evaluado` o `null`). */
export const SQL_PARES = `${SUBUNIDADES}
  SELECT p.id_puesto, p.codigo AS codigo_puesto, p.denominacion AS denominacion_puesto, p.id_unidad,
         r.id_conocimiento, c.denominacion AS denominacion_conocimiento,
         r.id_nivel_requerido, r.es_excluyente,
         v.id_evaluacion, v.id_nivel_impacto, v.id_nivel_dificultad, v.id_nivel_criticidad,
         v.fecha_evaluacion::text AS fecha_evaluacion
  ${DESDE_PARES}
    AND ($4::text IS NULL OR ($4::text = 'pendiente') = (v.id_evaluacion IS NULL))
  ORDER BY p.denominacion, p.id_puesto, r.es_excluyente DESC, c.denominacion`;

/** Parámetros: los tres comunes. */
export const SQL_AVANCE = `${SUBUNIDADES}
  SELECT count(*)::int AS total, count(v.id_evaluacion)::int AS evaluados
  ${DESDE_PARES}`;
```

- [ ] **Step 3: Tests del servicio que fallan**

`pares.service.spec.ts`:

```ts
import type { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import { ParesService } from './pares.service.js';
import { SQL_AVANCE, SQL_PARES } from './pares.sql.js';

const jefe: SesionUsuario = {
  id: 1, nombreUsuario: 'jefe', rol: 'jefe_catedra', idPersona: 7, unidades: [10],
};

function crearServicio(visibles: number[] | null, filas: object[] = []) {
  const query = vi.fn(async () => filas);
  const alcance = { unidadesVisibles: vi.fn(async () => visibles) };
  const servicio = new ParesService(
    { query } as unknown as DataSource,
    alcance as unknown as AlcanceService,
  );
  return { servicio, query };
}

const fila = (extra: object) => ({
  id_puesto: 5, codigo_puesto: 'P-0001', denominacion_puesto: 'Jefe', id_unidad: 10,
  id_conocimiento: 8, denominacion_conocimiento: 'SQL', id_nivel_requerido: 3,
  es_excluyente: true, id_evaluacion: null, id_nivel_impacto: null,
  id_nivel_dificultad: null, id_nivel_criticidad: null, fecha_evaluacion: null,
  ...extra,
});

describe('ParesService.pares', () => {
  it('pasa el alcance y los filtros a la consulta', async () => {
    const { servicio, query } = crearServicio([10, 11]);
    await servicio.pares({ idUnidad: 10, idPuesto: 5, estado: 'pendiente' }, jefe);
    expect(query).toHaveBeenCalledWith(SQL_PARES, [[10, 11], 10, 5, 'pendiente']);
  });

  it('sin restricción ni filtros pasa nulos', async () => {
    const { servicio, query } = crearServicio(null);
    await servicio.pares({}, jefe);
    expect(query).toHaveBeenCalledWith(SQL_PARES, [null, null, null, null]);
  });

  it('marca como pendiente el par sin evaluación y como evaluado el que la tiene', async () => {
    const { servicio } = crearServicio(null, [
      fila({}),
      fila({
        id_conocimiento: 9, id_evaluacion: 3, id_nivel_impacto: 2,
        id_nivel_dificultad: 1, id_nivel_criticidad: 4, fecha_evaluacion: '2026-06-01',
      }),
    ]);
    const pares = await servicio.pares({}, jefe);
    expect(pares[0]).toMatchObject({ estado: 'pendiente', idEvaluacion: null, idNivelCriticidad: null });
    expect(pares[1]).toMatchObject({
      estado: 'evaluado', idEvaluacion: 3, idNivelCriticidad: 4, fechaEvaluacion: '2026-06-01',
    });
  });

  it('con alcance vacío pasa un arreglo vacío (no ve nada)', async () => {
    const { servicio, query } = crearServicio([]);
    await servicio.pares({}, jefe);
    expect(query).toHaveBeenCalledWith(SQL_PARES, [[], null, null, null]);
  });
});

describe('ParesService.avance', () => {
  it('devuelve evaluados sobre total para el alcance', async () => {
    const { servicio, query } = crearServicio([10], [{ evaluados: 4, total: 9 }]);
    expect(await servicio.avance({ idUnidad: 10 }, jefe)).toEqual({ evaluados: 4, total: 9 });
    expect(query).toHaveBeenCalledWith(SQL_AVANCE, [[10], 10, null]);
  });
});
```

Run: `cd backend && npx vitest run src/modules/criticidad/pares.service.spec.ts`
Expected: FAIL (falta `pares.service.js`).

- [ ] **Step 4: Implementar `ParesService`**

```ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import type {
  AvanceDto,
  FiltroParesDto,
  ParCriticidadDto,
} from './dto/pares.dto.js';
import { SQL_AVANCE, SQL_PARES } from './pares.sql.js';

interface FilaPar {
  id_puesto: number;
  codigo_puesto: string;
  denominacion_puesto: string;
  id_unidad: number;
  id_conocimiento: number;
  denominacion_conocimiento: string;
  id_nivel_requerido: number;
  es_excluyente: boolean;
  id_evaluacion: number | null;
  id_nivel_impacto: number | null;
  id_nivel_dificultad: number | null;
  id_nivel_criticidad: number | null;
  fecha_evaluacion: string | null;
}

/**
 * Pares conocimiento-puesto con su evaluación vigente y avance de OE5 (RNF04:
 * todo por consulta, nada almacenado). El universo son los requisitos activos
 * del alcance de quien consulta.
 */
@Injectable()
export class ParesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alcance: AlcanceService,
  ) {}

  async pares(
    filtro: FiltroParesDto,
    sesion: SesionUsuario,
  ): Promise<ParCriticidadDto[]> {
    const visibles = await this.alcance.unidadesVisibles(sesion);
    const filas: FilaPar[] = await this.dataSource.query(SQL_PARES, [
      visibles,
      filtro.idUnidad ?? null,
      filtro.idPuesto ?? null,
      filtro.estado ?? null,
    ]);
    return filas.map((f) => ({
      idPuesto: f.id_puesto,
      codigoPuesto: f.codigo_puesto,
      denominacionPuesto: f.denominacion_puesto,
      idUnidad: f.id_unidad,
      idConocimiento: f.id_conocimiento,
      denominacionConocimiento: f.denominacion_conocimiento,
      idNivelRequerido: f.id_nivel_requerido,
      esExcluyente: f.es_excluyente,
      estado: f.id_evaluacion === null ? 'pendiente' : 'evaluado',
      idEvaluacion: f.id_evaluacion,
      idNivelImpacto: f.id_nivel_impacto,
      idNivelDificultad: f.id_nivel_dificultad,
      idNivelCriticidad: f.id_nivel_criticidad,
      fechaEvaluacion: f.fecha_evaluacion,
    }));
  }

  async avance(
    filtro: FiltroParesDto,
    sesion: SesionUsuario,
  ): Promise<AvanceDto> {
    const visibles = await this.alcance.unidadesVisibles(sesion);
    const [fila]: { evaluados: number; total: number }[] =
      await this.dataSource.query(SQL_AVANCE, [
        visibles,
        filtro.idUnidad ?? null,
        filtro.idPuesto ?? null,
      ]);
    return { evaluados: fila.evaluados, total: fila.total };
  }
}
```

Run: `cd backend && npx vitest run src/modules/criticidad/pares.service.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Agregar las rutas al controller y registrar el servicio**

En `criticidad.controller.ts`: agregar al import `Query` (de `@nestjs/common`), `ROLES_LECTORES_DE_CRITICIDAD` (de `roles.js`), `UsuarioActual`, `SesionUsuario`, `AvanceDto`, `FiltroParesDto`, `ParCriticidadDto` y `ParesService`; inyectar `private readonly pares: ParesService` junto a `matriz` y sumar:

```ts
  @Get('pares')
  @Roles(...ROLES_LECTORES_DE_CRITICIDAD)
  @ApiOkResponse({ type: ParCriticidadDto, isArray: true })
  listarPares(
    @Query() filtro: FiltroParesDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<ParCriticidadDto[]> {
    return this.pares.pares(filtro, sesion);
  }

  @Get('avance')
  @Roles(...ROLES_LECTORES_DE_CRITICIDAD)
  @ApiOkResponse({ type: AvanceDto })
  avance(
    @Query() filtro: FiltroParesDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<AvanceDto> {
    return this.pares.avance(filtro, sesion);
  }
```

En `criticidad.module.ts`: agregar `ParesService` a `providers`.

- [ ] **Step 6: Test de integración de consultas**

`pares.int.spec.ts`:

```ts
import type { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { ParesService } from './pares.service.js';

describe('Pares y avance de criticidad (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let servicio: ParesService;
  let cat1: number;
  let cat2: number;
  let p1: number;
  let p2: number;
  let c1: number;
  let c2: number;
  let usuario: number;
  let rrhh: SesionUsuario;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const id = async (consulta: string, parametros?: unknown[]) =>
    (await sql<{ id: number }[]>(consulta, parametros))[0].id;
  const sesion = (rol: SesionUsuario['rol'], unidades: number[] = []): SesionUsuario => ({
    id: usuario, nombreUsuario: 'u', rol, idPersona: null, unidades,
  });
  const nuevaCatedra = (nombre: string) =>
    id(
      `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
       SELECT $1, t.id_tipo_unidad, (SELECT id_unidad FROM unidad_organizativa WHERE id_unidad_superior IS NULL)
       FROM tipo_unidad t WHERE t.codigo = 'catedra' RETURNING id_unidad AS id`,
      [nombre],
    );
  const nuevoPuesto = (codigo: string, unidad: number) =>
    id(
      `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
       SELECT $1, $1, $2, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
       RETURNING id_puesto AS id`,
      [codigo, unidad],
    );
  const nuevoConocimiento = (nombre: string) =>
    id(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT $1, lower($1), t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
      [nombre],
    );
  const requisito = (p: number, c: number, excluyente = true) =>
    sql(
      `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente)
       SELECT $1, $2, id_nivel_dominio, $3 FROM nivel_dominio WHERE codigo = 'avanzado'`,
      [p, c, excluyente],
    );
  const evaluar = (p: number, c: number, nivel: string) =>
    sql(
      `INSERT INTO evaluacion_criticidad
         (id_puesto, id_conocimiento, id_nivel_impacto, id_nivel_dificultad, id_nivel_criticidad, fecha_evaluacion, id_usuario)
       SELECT $1, $2, i.id_nivel_impacto, d.id_nivel_dificultad, n.id_nivel_criticidad, CURRENT_DATE, $4
       FROM nivel_impacto i, nivel_dificultad d, nivel_criticidad n
       WHERE i.codigo = 'alto' AND d.codigo = 'dificil' AND n.codigo = $3`,
      [p, c, nivel, usuario],
    );

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    servicio = new ParesService(ds, new AlcanceService(ds));
    cat1 = await nuevaCatedra('Cátedra 1');
    cat2 = await nuevaCatedra('Cátedra 2');
    p1 = await nuevoPuesto('P-0001', cat1);
    p2 = await nuevoPuesto('P-0002', cat2);
    c1 = await nuevoConocimiento('SQL');
    c2 = await nuevoConocimiento('Redes');
    await requisito(p1, c1);
    await requisito(p1, c2, false);
    await requisito(p2, c1);
    usuario = await id(
      `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol)
       SELECT 'u', 'x', id_rol FROM rol WHERE codigo = 'recursos_humanos' RETURNING id_usuario AS id`,
    );
    rrhh = sesion('recursos_humanos');
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('RR. HH. ve todos los pares como pendientes y el avance en cero', async () => {
    const pares = await servicio.pares({}, rrhh);
    expect(pares).toHaveLength(3);
    expect(pares.every((p) => p.estado === 'pendiente')).toBe(true);
    expect(await servicio.avance({}, rrhh)).toEqual({ evaluados: 0, total: 3 });
  });

  it('un puesto sin evaluaciones aparece como pendiente, no como no crítico', async () => {
    const pares = await servicio.pares({ idPuesto: p2 }, rrhh);
    expect(pares).toEqual([
      expect.objectContaining({ idPuesto: p2, estado: 'pendiente', idNivelCriticidad: null }),
    ]);
  });

  it('cuenta la evaluación vigente y filtra por estado', async () => {
    await evaluar(p1, c1, 'baja');
    await evaluar(p1, c1, 'alta'); // la más reciente (mayor id, misma fecha) es la vigente
    expect(await servicio.avance({}, rrhh)).toEqual({ evaluados: 1, total: 3 });
    const evaluados = await servicio.pares({ estado: 'evaluado' }, rrhh);
    expect(evaluados).toHaveLength(1);
    expect(evaluados[0]).toMatchObject({ idPuesto: p1, idConocimiento: c1, estado: 'evaluado' });
    expect(await servicio.pares({ estado: 'pendiente' }, rrhh)).toHaveLength(2);
  });

  it('una evaluación de un requisito quitado no cuenta, y vuelve a contar al reagregarlo', async () => {
    await sql(`DELETE FROM requisito_puesto WHERE id_puesto = $1 AND id_conocimiento = $2`, [p1, c1]);
    expect(await servicio.avance({}, rrhh)).toEqual({ evaluados: 0, total: 2 });
    await requisito(p1, c1);
    expect(await servicio.avance({}, rrhh)).toEqual({ evaluados: 1, total: 3 });
  });

  it('el jefe de cátedra solo ve los pares de su cátedra, y uno sin unidades no ve nada', async () => {
    const jefe1 = sesion('jefe_catedra', [cat1]);
    const pares = await servicio.pares({}, jefe1);
    expect(pares.map((p) => p.idPuesto)).toEqual([p1, p1]);
    expect(await servicio.avance({}, jefe1)).toEqual({ evaluados: 1, total: 2 });
    expect(await servicio.pares({}, sesion('jefe_catedra'))).toEqual([]);
    expect(await servicio.avance({}, sesion('jefe_catedra'))).toEqual({ evaluados: 0, total: 0 });
  });

  it('filtrar por una unidad incluye sus descendientes; por otra cátedra, solo esa', async () => {
    const raiz = await id(`SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`);
    expect(await servicio.pares({ idUnidad: raiz }, rrhh)).toHaveLength(3);
    expect((await servicio.pares({ idUnidad: cat2 }, rrhh)).map((p) => p.idPuesto)).toEqual([p2]);
    // Un jefe no amplía su alcance filtrando por una unidad ajena.
    expect(await servicio.pares({ idUnidad: cat2 }, sesion('jefe_catedra', [cat1]))).toEqual([]);
  });

  it('excluye puestos dados de baja', async () => {
    await sql(`UPDATE puesto SET activo = false WHERE id_puesto = $1`, [p2]);
    expect(await servicio.avance({}, rrhh)).toEqual({ evaluados: 1, total: 3 - 1 });
  });
});
```

Run: `cd backend && npx vitest run --config vitest.integracion.config.ts src/modules/criticidad/pares.int.spec.ts`
Expected: PASS (7 tests). Si `tipo_unidad.codigo = 'catedra'` no existe, usar el código real: `SELECT codigo FROM tipo_unidad`.

- [ ] **Step 7: Batería completa**

Run: `cd backend && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src
git commit -m "Agregar los pares de criticidad y el avance de OE5"
```

---

### Task 6: La fusión de conocimientos mueve las evaluaciones

**Files:**
- Modify: `backend/src/modules/conocimiento/fusion.sql.ts`
- Modify: `backend/src/modules/conocimiento/conocimientos.service.ts:195-208`
- Modify: `backend/src/modules/conocimiento/dto/catalogo.dto.ts` (`ResultadoFusionDto`)
- Modify: `backend/src/modules/conocimiento/conocimientos.service.spec.ts:279-295`
- Modify: `backend/src/modules/conocimiento/fusion.int.spec.ts`

**Interfaces:**
- Consumes: tabla `evaluacion_criticidad` (tarea 2).
- Produces: `SQL_CONTAR_EVALUACIONES` (parámetro: id) y un paso más en `PASOS_FUSION`; `ResultadoFusionDto.evaluacionesMovidas: number`.

- [ ] **Step 1: Actualizar los tests (fallan)**

En `conocimientos.service.spec.ts`: importar `SQL_CONTAR_EVALUACIONES` junto a `SQL_CONTAR_PERSONAS` y cambiar el test «corre todos los pasos…»:

```ts
    manager.query.mockImplementation(async (sql: string) => {
      if (sql === SQL_CONTAR_REQUISITOS) return [{ n: 3 }];
      if (sql === SQL_CONTAR_PERSONAS) return [{ n: 5 }];
      if (sql === SQL_CONTAR_EVALUACIONES) return [{ n: 2 }];
      return [];
    });
```

y el resultado esperado:

```ts
    expect(resultado).toEqual({
      idOrigen: 1,
      idDestino: 2,
      requisitosMovidos: 3,
      personasMovidas: 5,
      evaluacionesMovidas: 2,
    });
```

En `fusion.int.spec.ts`: en el test «une requisitos, declaraciones y acreditaciones…» agregar `evaluacionesMovidas: 2` al `toEqual` del resultado (`requisitosMovidos: 2, personasMovidas: 3`) y, antes de llamar a `servicio.fusionar(a, ...)`, insertar dos evaluaciones del origen en puestos distintos:

```ts
    const usuario = (
      await sql<{ id: number }[]>(
        `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol)
         SELECT 'rrhh-fusion', 'x', id_rol FROM rol WHERE codigo = 'recursos_humanos' RETURNING id_usuario AS id`,
      )
    )[0].id;
    const evaluarOrigen = (puesto: number, fecha: string) =>
      sql(
        `INSERT INTO evaluacion_criticidad
           (id_puesto, id_conocimiento, id_nivel_impacto, id_nivel_dificultad, id_nivel_criticidad, fecha_evaluacion, id_usuario)
         SELECT $1, $2, i.id_nivel_impacto, d.id_nivel_dificultad, n.id_nivel_criticidad, $3, $4
         FROM nivel_impacto i, nivel_dificultad d, nivel_criticidad n
         WHERE i.codigo = 'alto' AND d.codigo = 'dificil' AND n.codigo = 'alta'`,
        [puesto, a, fecha, usuario],
      );
    await evaluarOrigen(puestoX, '2026-01-05');
    await evaluarOrigen(puestoY, '2026-01-06');
```

y, después de las verificaciones existentes de requisitos, esta:

```ts
    const evaluaciones = await sql<{ p: number; c: number }[]>(
      `SELECT id_puesto AS p, id_conocimiento AS c FROM evaluacion_criticidad ORDER BY id_puesto`,
    );
    expect(evaluaciones).toEqual([
      { p: puestoX, c: b },
      { p: puestoY, c: b },
    ]);
```

Agregar además un test nuevo al final del `describe`:

```ts
  it('la evaluación más reciente del par, sea del origen o del destino, queda como vigente', async () => {
    const a = await nuevoConocimiento('Git 1', 'git 1'); // origen
    const b = await nuevoConocimiento('Git', 'git'); // destino
    const puesto = await nuevoPuesto('P-0003');
    const usuario = (
      await sql<{ id: number }[]>(`SELECT id_usuario AS id FROM usuario WHERE nombre_usuario = 'rrhh-fusion'`)
    )[0].id;
    const evaluar = (conocimiento: number, fecha: string, nivel: string) =>
      sql(
        `INSERT INTO evaluacion_criticidad
           (id_puesto, id_conocimiento, id_nivel_impacto, id_nivel_dificultad, id_nivel_criticidad, fecha_evaluacion, id_usuario)
         SELECT $1, $2, i.id_nivel_impacto, d.id_nivel_dificultad, n.id_nivel_criticidad, $3, $4
         FROM nivel_impacto i, nivel_dificultad d, nivel_criticidad n
         WHERE i.codigo = 'alto' AND d.codigo = 'dificil' AND n.codigo = $5`,
        [puesto, conocimiento, fecha, usuario, nivel],
      );
    await evaluar(b, '2026-02-01', 'baja');
    await evaluar(a, '2026-03-01', 'alta'); // más reciente: la del origen
    await requisito(puesto, a, 'avanzado', true);
    await requisito(puesto, b, 'avanzado', true);

    await servicio.fusionar(a, { idDestino: b });

    const vigente = await sql<{ n: string }[]>(
      `SELECT n.codigo AS n FROM criticidad_vigente v
       JOIN nivel_criticidad n ON n.id_nivel_criticidad = v.id_nivel_criticidad
       WHERE v.id_puesto = $1 AND v.id_conocimiento = $2`,
      [puesto, b],
    );
    expect(vigente).toEqual([{ n: 'alta' }]);
    const [{ total }] = await sql<{ total: number }[]>(
      `SELECT count(*)::int AS total FROM evaluacion_criticidad WHERE id_puesto = $1 AND id_conocimiento = $2`,
      [puesto, b],
    );
    expect(total).toBe(2);
  });
```

Run: `cd backend && npx vitest run src/modules/conocimiento/conocimientos.service.spec.ts`
Expected: FAIL (`SQL_CONTAR_EVALUACIONES` no existe).

- [ ] **Step 2: Implementar**

En `fusion.sql.ts`, después de `SQL_CONTAR_PERSONAS`:

```ts
/** Cuántas evaluaciones de criticidad tiene el conocimiento (parámetro: id). */
export const SQL_CONTAR_EVALUACIONES = `SELECT count(*)::int AS n FROM evaluacion_criticidad WHERE id_conocimiento = $1`;
```

Actualizar el comentario de `PASOS_FUSION` agregando al final: «Las evaluaciones de criticidad del origen pasan al destino con su historial.» y sumar este elemento al final del arreglo (tras el paso 10):

```ts
  // 11. Las evaluaciones de criticidad del origen pasan al destino; la vigente sale de la vista.
  `UPDATE evaluacion_criticidad SET id_conocimiento = $2 WHERE id_conocimiento = $1`,
```

En `conocimientos.service.ts`: importar `SQL_CONTAR_EVALUACIONES` y, después del conteo de personas:

```ts
      const [{ n: evaluacionesMovidas }] = await manager.query<{ n: number }[]>(
        SQL_CONTAR_EVALUACIONES,
        [idOrigen],
      );
```

y devolver `{ idOrigen, idDestino, requisitosMovidos, personasMovidas, evaluacionesMovidas }`.

En `catalogo.dto.ts`, en `ResultadoFusionDto`:

```ts
  @ApiProperty({ description: 'Evaluaciones de criticidad del origen' })
  evaluacionesMovidas: number;
```

- [ ] **Step 3: Correr las pruebas**

Run: `cd backend && npx vitest run src/modules/conocimiento/conocimientos.service.spec.ts && npx vitest run --config vitest.integracion.config.ts src/modules/conocimiento/fusion.int.spec.ts`
Expected: PASS ambas.

- [ ] **Step 4: Batería completa**

Run: `cd backend && npm run lint && npm test && npm run test:integracion`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "Mover las evaluaciones de criticidad al fusionar conocimientos"
```

---

### Task 7: Frontend: pantalla de criticidad y diálogo de evaluación

**Files:**
- Modify: `frontend/src/api/esquema.d.ts` (solo por `npm run api:tipos`)
- Create: `frontend/src/features/criticidad/niveles.ts`
- Create: `frontend/src/features/criticidad/hooks/useCriticidad.ts`
- Create: `frontend/src/features/criticidad/components/HistorialEvaluaciones.tsx`
- Create: `frontend/src/features/criticidad/components/EvaluarDialog.tsx`
- Modify: `frontend/src/features/criticidad/pages/CriticidadPage.tsx`
- Modify: `frontend/src/features/conocimiento/components/FusionarDialog.tsx:65-67`

**Interfaces:**
- Consumes: endpoints de las tareas 3 a 6 (tipos generados `MatrizDto`, `ParCriticidadDto`, `AvanceDto`, `EvaluacionDto`, `ResultadoFusionDto`); `useSesion()` (`auth/useSesion`); `useValoresReferencia('nivel-criticidad', false)` y `('nivel-dominio', false)` (`features/admin/hooks/useValoresReferencia`); `mensajeError` (`features/admin/hooks/useGuardarValor`); `PaginaEnConstruccion`; árbol de unidades de `features/estructura/hooks/useUnidades` y puestos de `usePuestos` (revisar su API antes de usarlos).
- Produces: `useMatriz()`, `usePares(filtro)`, `useAvance(filtro)`, `useHistorialEvaluaciones(idPuesto, idConocimiento)`, `useEvaluar()`, `etiquetaNivel(codigo)` y `colorNivel(codigo)`, `EvaluarDialog`, `HistorialEvaluaciones`.

- [ ] **Step 1: Regenerar los tipos**

Con el backend corriendo (`docker compose up -d`):

Run: `cd frontend && npm run api:tipos`
Expected: `esquema.d.ts` incluye `/api/criticidad/pares`, `/api/criticidad/avance`, `/api/criticidad/matriz`, `/api/puestos/{idPuesto}/criticidad/{idConocimiento}` y `/historial`, y `evaluacionesMovidas` en `ResultadoFusionDto`.

- [ ] **Step 2: Helpers de nivel**

`niveles.ts`:

```ts
import type { ChipProps } from '@mui/material';

/** Color del chip de cada nivel de criticidad por su código (`baja`, `media`, `alta`). */
export function colorNivel(codigo: string | undefined): ChipProps['color'] {
  if (codigo === 'alta') return 'error';
  if (codigo === 'media') return 'warning';
  if (codigo === 'baja') return 'success';
  return 'default';
}
```

- [ ] **Step 3: Hooks**

`hooks/useCriticidad.ts` (seguir el estilo de `features/conocimiento/hooks/useAcreditaciones.ts`):

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from '../../admin/hooks/useGuardarValor';

export type Matriz = Esquemas['MatrizDto'];
export type Par = Esquemas['ParCriticidadDto'];
export type Avance = Esquemas['AvanceDto'];
export type Evaluacion = Esquemas['EvaluacionDto'];

export interface FiltroPares {
  idUnidad?: number;
  idPuesto?: number;
  estado?: 'pendiente' | 'evaluado';
}

export function useMatriz() {
  return useQuery({
    queryKey: ['criticidad', 'matriz'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/criticidad/matriz');
      if (error || !data) throw new Error('No se pudo cargar la matriz');
      return data;
    },
  });
}

export function usePares(filtro: FiltroPares) {
  return useQuery({
    queryKey: ['criticidad', 'pares', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/criticidad/pares', {
        params: { query: filtro },
      });
      if (error || !data) throw new Error('No se pudieron cargar los pares');
      return data;
    },
  });
}

export function useAvance(filtro: Pick<FiltroPares, 'idUnidad'>) {
  return useQuery({
    queryKey: ['criticidad', 'avance', filtro],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/criticidad/avance', {
        params: { query: filtro },
      });
      if (error || !data) throw new Error('No se pudo cargar el avance');
      return data;
    },
  });
}

export function useHistorialEvaluaciones(
  idPuesto: number,
  idConocimiento: number,
) {
  return useQuery({
    queryKey: ['criticidad', 'historial', idPuesto, idConocimiento],
    queryFn: async () => {
      const { data, error } = await api.GET(
        '/api/puestos/{idPuesto}/criticidad/{idConocimiento}/historial',
        { params: { path: { idPuesto, idConocimiento } } },
      );
      if (error || !data) throw new Error('No se pudo cargar el historial');
      return data;
    },
  });
}

export function useEvaluar() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (e: {
      idPuesto: number;
      idConocimiento: number;
      idNivelImpacto: number;
      idNivelDificultad: number;
      fechaEvaluacion: string;
      observaciones: string | null;
    }) => {
      const { data, error } = await api.POST(
        '/api/puestos/{idPuesto}/criticidad/{idConocimiento}',
        {
          params: {
            path: { idPuesto: e.idPuesto, idConocimiento: e.idConocimiento },
          },
          body: {
            idNivelImpacto: e.idNivelImpacto,
            idNivelDificultad: e.idNivelDificultad,
            fechaEvaluacion: e.fechaEvaluacion,
            observaciones: e.observaciones,
          },
        },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['criticidad'] }),
  });
}
```

- [ ] **Step 4: Historial del par**

`components/HistorialEvaluaciones.tsx`:

```ts
import {
  Alert,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { useHistorialEvaluaciones, useMatriz } from '../hooks/useCriticidad';
import { colorNivel } from '../niveles';

interface Props {
  idPuesto: number;
  idConocimiento: number;
}

/** Todas las evaluaciones del par; la primera es la vigente. */
export function HistorialEvaluaciones({ idPuesto, idConocimiento }: Props) {
  const { data, isLoading, isError } = useHistorialEvaluaciones(idPuesto, idConocimiento);
  const { data: matriz } = useMatriz();
  const { data: niveles } = useValoresReferencia('nivel-criticidad', true);
  const escala = (lista: { id: number; denominacion: string }[] | undefined, id: number) =>
    lista?.find((e) => e.id === id)?.denominacion ?? String(id);

  if (isLoading) return <CircularProgress size={20} aria-label="Cargando" />;
  if (isError) return <Alert severity="error">No se pudo cargar el historial.</Alert>;
  if (!data || data.length === 0) {
    return <Typography variant="body2">Todavía no se evaluó este par.</Typography>;
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Fecha</TableCell>
          <TableCell>Impacto</TableCell>
          <TableCell>Dificultad</TableCell>
          <TableCell>Criticidad</TableCell>
          <TableCell>Evaluó</TableCell>
          <TableCell>Observaciones</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.map((e, i) => {
          const nivel = niveles?.find((n) => n.id === e.idNivelCriticidad);
          return (
            <TableRow key={e.id}>
              <TableCell>
                {e.fechaEvaluacion}
                {i === 0 && <Chip size="small" label="Vigente" sx={{ ml: 1 }} />}
              </TableCell>
              <TableCell>{escala(matriz?.impactos, e.idNivelImpacto)}</TableCell>
              <TableCell>{escala(matriz?.dificultades, e.idNivelDificultad)}</TableCell>
              <TableCell>
                <Chip size="small" label={nivel?.denominacion ?? e.idNivelCriticidad} color={colorNivel(nivel?.codigo)} />
              </TableCell>
              <TableCell>{e.nombreUsuario}</TableCell>
              <TableCell>{e.observaciones ?? '—'}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 5: Diálogo de evaluación**

`components/EvaluarDialog.tsx` (mismo esquema de `AcreditarDialog`: react-hook-form + zod, se monta solo mientras está abierto):

```ts
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { useEvaluar, useMatriz } from '../hooks/useCriticidad';
import { colorNivel } from '../niveles';
import { HistorialEvaluaciones } from './HistorialEvaluaciones';

interface Props {
  idPuesto: number;
  idConocimiento: number;
  titulo: string;
  /** Sin permiso de escritura (autoridad) el diálogo solo muestra el historial. */
  puedeEvaluar: boolean;
  onCerrar: () => void;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
/** Hoy en el calendario local, `AAAA-MM-DD`. El servidor valida contra el de la base. */
const hoyLocal = () => new Date().toLocaleDateString('en-CA');

const esquema = z
  .object({
    idNivelImpacto: z.string().min(1, 'Elegí un nivel de impacto'),
    idNivelDificultad: z.string().min(1, 'Elegí un nivel de dificultad'),
    fechaEvaluacion: z.string().regex(FECHA, 'Elegí una fecha'),
    observaciones: z.string().max(2000, 'Máximo 2000 caracteres'),
  })
  .refine((d) => d.fechaEvaluacion <= hoyLocal(), {
    path: ['fechaEvaluacion'],
    message: 'No puede ser futura',
  });
type Datos = z.infer<typeof esquema>;

export function EvaluarDialog({ idPuesto, idConocimiento, titulo, puedeEvaluar, onCerrar }: Props) {
  const { data: matriz } = useMatriz();
  const { data: niveles } = useValoresReferencia('nivel-criticidad', true);
  const evaluar = useEvaluar();
  const [error, setError] = useState<string>();

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: { idNivelImpacto: '', idNivelDificultad: '', fechaEvaluacion: hoyLocal(), observaciones: '' },
  });
  const [impacto, dificultad] = useWatch({ control, name: ['idNivelImpacto', 'idNivelDificultad'] });

  // Vista previa: el servidor vuelve a calcular el nivel con la matriz al guardar.
  const celda = matriz?.celdas.find(
    (c) => c.idNivelImpacto === Number(impacto) && c.idNivelDificultad === Number(dificultad),
  );
  const resultado = niveles?.find((n) => n.id === celda?.idNivelCriticidad);
  const criterio = (
    lista: { id: number; criterio: string }[] | undefined,
    id: string,
  ) => lista?.find((e) => e.id === Number(id))?.criterio;

  const guardar = handleSubmit(async (datos) => {
    setError(undefined);
    try {
      await evaluar.mutateAsync({
        idPuesto,
        idConocimiento,
        idNivelImpacto: Number(datos.idNivelImpacto),
        idNivelDificultad: Number(datos.idNivelDificultad),
        fechaEvaluacion: datos.fechaEvaluacion,
        observaciones: datos.observaciones.trim() || null,
      });
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="md">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>{titulo}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {puedeEvaluar && (
              <>
                <TextField
                  select
                  label="Impacto de pérdida"
                  defaultValue=""
                  {...register('idNivelImpacto')}
                  error={!!errors.idNivelImpacto}
                  helperText={errors.idNivelImpacto?.message ?? criterio(matriz?.impactos, impacto) ?? 'Qué pasa si se pierde este conocimiento'}
                >
                  {(matriz?.impactos ?? []).map((n) => (
                    <MenuItem key={n.id} value={String(n.id)}>{n.denominacion}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Dificultad de reemplazo"
                  defaultValue=""
                  {...register('idNivelDificultad')}
                  error={!!errors.idNivelDificultad}
                  helperText={errors.idNivelDificultad?.message ?? criterio(matriz?.dificultades, dificultad) ?? 'Cuánto cuesta volver a tenerlo'}
                >
                  {(matriz?.dificultades ?? []).map((n) => (
                    <MenuItem key={n.id} value={String(n.id)}>{n.denominacion}</MenuItem>
                  ))}
                </TextField>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography>Criticidad resultante:</Typography>
                  {resultado ? (
                    <Chip label={resultado.denominacion} color={colorNivel(resultado.codigo)} />
                  ) : (
                    <Typography color="text.secondary">elegí impacto y dificultad</Typography>
                  )}
                </Stack>
                <TextField
                  label="Fecha de evaluación"
                  type="date"
                  slotProps={{ inputLabel: { shrink: true } }}
                  {...register('fechaEvaluacion')}
                  error={!!errors.fechaEvaluacion}
                  helperText={errors.fechaEvaluacion?.message}
                />
                <TextField
                  label="Observaciones (opcional)"
                  multiline
                  minRows={2}
                  {...register('observaciones')}
                  error={!!errors.observaciones}
                  helperText={errors.observaciones?.message ?? 'No cambian el nivel: lo fija la matriz.'}
                />
                <Divider />
              </>
            )}
            <Typography variant="subtitle2">Historial</Typography>
            <HistorialEvaluaciones idPuesto={idPuesto} idConocimiento={idConocimiento} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCerrar}>{puedeEvaluar ? 'Cancelar' : 'Cerrar'}</Button>
          {puedeEvaluar && (
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              Guardar evaluación
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
}
```
- [ ] **Step 6: Pantalla**

Reemplazar `pages/CriticidadPage.tsx` (el selector de unidad usa `useUnidades()` de `features/estructura/hooks/useUnidades`, que lista las unidades activas con `id` y `denominacion`):

```tsx
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useSesion } from '../../../auth/useSesion';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { useValoresReferencia } from '../../admin/hooks/useValoresReferencia';
import { useUnidades } from '../../estructura/hooks/useUnidades';
import { EvaluarDialog } from '../components/EvaluarDialog';
import { useAvance, usePares, type Par } from '../hooks/useCriticidad';
import { colorNivel } from '../niveles';

type Estado = 'todos' | 'pendiente' | 'evaluado';

/** Pares conocimiento-puesto con su criticidad vigente y el avance de OE5. */
export function CriticidadPage() {
  const { data: sesion } = useSesion();
  const { data: unidades } = useUnidades();
  const { data: niveles } = useValoresReferencia('nivel-criticidad', true);
  const [idUnidad, setIdUnidad] = useState('');
  const [estado, setEstado] = useState<Estado>('todos');
  const [texto, setTexto] = useState('');
  const [elegido, setElegido] = useState<Par>();

  const unidad = idUnidad ? Number(idUnidad) : undefined;
  const pares = usePares({ idUnidad: unidad, estado: estado === 'todos' ? undefined : estado });
  const avance = useAvance({ idUnidad: unidad });
  // La autoridad consulta pero no evalúa (RF24).
  const puedeEvaluar = sesion?.rol !== 'autoridad';

  const buscado = texto.trim().toLowerCase();
  const filas = (pares.data ?? []).filter(
    (p) =>
      !buscado ||
      `${p.codigoPuesto} ${p.denominacionPuesto} ${p.denominacionConocimiento}`
        .toLowerCase()
        .includes(buscado),
  );
  const porcentaje =
    avance.data && avance.data.total > 0
      ? (avance.data.evaluados / avance.data.total) * 100
      : 0;

  return (
    <PaginaEnConstruccion
      titulo="Criticidad"
      descripcion="Impacto de pérdida y dificultad de reemplazo de cada conocimiento que exige un puesto (RF12)."
    >
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" gutterBottom>
          {avance.data
            ? `${avance.data.evaluados} de ${avance.data.total} pares evaluados`
            : 'Calculando avance…'}
        </Typography>
        <LinearProgress variant="determinate" value={porcentaje} aria-label="Avance de la evaluación" />
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          select
          size="small"
          label="Unidad"
          value={idUnidad}
          onChange={(e) => setIdUnidad(e.target.value)}
          sx={{ minWidth: 220 }}
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
          label="Estado"
          value={estado}
          onChange={(e) => setEstado(e.target.value as Estado)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="todos">Todos</MenuItem>
          <MenuItem value="pendiente">Pendientes</MenuItem>
          <MenuItem value="evaluado">Evaluados</MenuItem>
        </TextField>
        <TextField
          size="small"
          label="Buscar puesto o conocimiento"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          sx={{ flexGrow: 1 }}
        />
      </Stack>

      {pares.isLoading && <CircularProgress aria-label="Cargando" />}
      {pares.isError && <Alert severity="error">No se pudieron cargar los pares.</Alert>}
      {pares.data && filas.length === 0 && (
        <Alert severity="info">No hay pares para estos filtros.</Alert>
      )}
      {filas.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Puesto</TableCell>
              <TableCell>Conocimiento</TableCell>
              <TableCell>Carácter</TableCell>
              <TableCell>Criticidad</TableCell>
              <TableCell>Evaluado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filas.map((p) => {
              const nivel = niveles?.find((n) => n.id === p.idNivelCriticidad);
              return (
                <TableRow key={`${p.idPuesto}-${p.idConocimiento}`}>
                  <TableCell>
                    {p.codigoPuesto} — {p.denominacionPuesto}
                  </TableCell>
                  <TableCell>{p.denominacionConocimiento}</TableCell>
                  <TableCell>{p.esExcluyente ? 'Excluyente' : 'Deseable'}</TableCell>
                  <TableCell>
                    {nivel ? (
                      <Chip size="small" label={nivel.denominacion} color={colorNivel(nivel.codigo)} />
                    ) : (
                      <Chip size="small" variant="outlined" label="Sin evaluar" />
                    )}
                  </TableCell>
                  <TableCell>{p.fechaEvaluacion ?? '—'}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setElegido(p)}>
                      {puedeEvaluar ? 'Evaluar' : 'Ver'}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {elegido && (
        <EvaluarDialog
          idPuesto={elegido.idPuesto}
          idConocimiento={elegido.idConocimiento}
          titulo={`${elegido.denominacionPuesto} · ${elegido.denominacionConocimiento}`}
          puedeEvaluar={puedeEvaluar}
          onCerrar={() => setElegido(undefined)}
        />
      )}
    </PaginaEnConstruccion>
  );
}
```

- [ ] **Step 7: Mostrar las evaluaciones movidas al fusionar**

En `FusionarDialog.tsx` (línea ~65) reemplazar el texto de éxito por:

```tsx
              Listo. Se movieron {resultado.requisitosMovidos} requisitos de
              puesto, {resultado.evaluacionesMovidas} evaluaciones de
              criticidad y los datos de {resultado.personasMovidas} personas; «
              {origen.denominacion}» quedó dado de baja.
```

- [ ] **Step 8: Compilar y revisar a mano**

Run: `cd frontend && npm run lint && npm run format && npm run build`
Expected: sin errores. Después, con `docker compose up`, entrar a http://localhost:5173/criticidad como `recursos_humanos` y verificar: la tabla lista los requisitos, «Evaluar» muestra el criterio de cada nivel y el resultado en vivo, guardar actualiza el avance y el historial muestra «Vigente» en la primera fila; como `autoridad` el botón dice «Ver» y no hay formulario; como `docente` no hay ítem de menú.

- [ ] **Step 9: Commit**

```bash
git add frontend
git commit -m "Agregar la pantalla de criticidad y el diálogo de evaluación"
```

---

### Task 8: Frontend: editor de la matriz en Administración

**Files:**
- Create: `frontend/src/features/admin/components/MatrizCriticidad.tsx`
- Modify: `frontend/src/features/criticidad/hooks/useCriticidad.ts`
- Modify: `frontend/src/features/admin/pages/AdminPage.tsx`

**Interfaces:**
- Consumes: `useMatriz()` (tarea 7), `useValoresReferencia('nivel-criticidad', true)`, `mensajeError`.
- Produces: `useEditarCelda()` y la pestaña «Matriz de criticidad».

- [ ] **Step 1: Hook de edición**

Agregar a `useCriticidad.ts`:

```ts
export function useEditarCelda() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (c: {
      idNivelImpacto: number;
      idNivelDificultad: number;
      idNivelCriticidad: number;
    }) => {
      const { data, error } = await api.PUT(
        '/api/criticidad/matriz/{idImpacto}/{idDificultad}',
        {
          params: {
            path: { idImpacto: c.idNivelImpacto, idDificultad: c.idNivelDificultad },
          },
          body: { idNivelCriticidad: c.idNivelCriticidad },
        },
      );
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: () =>
      cliente.invalidateQueries({ queryKey: ['criticidad', 'matriz'] }),
  });
}
```

- [ ] **Step 2: Componente**

`MatrizCriticidad.tsx`: una fila por nivel de impacto (de mayor a menor `orden`) y una columna por nivel de dificultad (de menor a mayor); cada celda es un selector con los niveles de criticidad activos.

```tsx
import {
  Alert,
  CircularProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useEditarCelda, useMatriz } from '../../criticidad/hooks/useCriticidad';
import { useValoresReferencia } from '../hooks/useValoresReferencia';

/** Matriz que combina impacto y dificultad en un nivel de criticidad (RF12). */
export function MatrizCriticidad() {
  const { data: matriz, isLoading, isError } = useMatriz();
  const { data: niveles } = useValoresReferencia('nivel-criticidad', false);
  const editar = useEditarCelda();
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string }>();

  if (isLoading) return <CircularProgress aria-label="Cargando" />;
  if (isError || !matriz) {
    return <Alert severity="error">No se pudo cargar la matriz.</Alert>;
  }

  const impactos = [...matriz.impactos].sort((a, b) => b.orden - a.orden);
  const dificultades = [...matriz.dificultades].sort((a, b) => a.orden - b.orden);
  const valorDe = (idImpacto: number, idDificultad: number) =>
    matriz.celdas.find(
      (c) => c.idNivelImpacto === idImpacto && c.idNivelDificultad === idDificultad,
    )?.idNivelCriticidad;

  const cambiar = async (idNivelImpacto: number, idNivelDificultad: number, valor: string) => {
    setMensaje(undefined);
    try {
      await editar.mutateAsync({
        idNivelImpacto,
        idNivelDificultad,
        idNivelCriticidad: Number(valor),
      });
      setMensaje({ tipo: 'success', texto: 'Celda actualizada' });
    } catch (e) {
      setMensaje({ tipo: 'error', texto: (e as Error).message });
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h2">
        Matriz de criticidad
      </Typography>
      <Alert severity="info">
        Cambiar la matriz no modifica las evaluaciones ya guardadas: cada una
        conserva el nivel que tenía al evaluarse. Las evaluaciones nuevas usan la
        matriz actual.
      </Alert>
      {mensaje && <Alert severity={mensaje.tipo}>{mensaje.texto}</Alert>}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Impacto \ Dificultad</TableCell>
            {dificultades.map((d) => (
              <TableCell key={d.id}>
                <Tooltip title={d.criterio}>
                  <span>{d.denominacion}</span>
                </Tooltip>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {impactos.map((i) => (
            <TableRow key={i.id}>
              <TableCell>
                <Tooltip title={i.criterio}>
                  <span>{i.denominacion}</span>
                </Tooltip>
              </TableCell>
              {dificultades.map((d) => (
                <TableCell key={d.id}>
                  <TextField
                    select
                    size="small"
                    value={String(valorDe(i.id, d.id) ?? '')}
                    onChange={(e) => cambiar(i.id, d.id, e.target.value)}
                    disabled={editar.isPending}
                    slotProps={{
                      htmlInput: { 'aria-label': `${i.denominacion} y ${d.denominacion}` },
                    }}
                  >
                    {(niveles ?? []).map((n) => (
                      <MenuItem key={n.id} value={String(n.id)}>
                        {n.denominacion}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Stack>
  );
}
```

- [ ] **Step 3: Pestaña**

En `AdminPage.tsx`: ampliar el tipo de `seccion` a `'referencia' | 'usuarios' | 'matriz'`, agregar `<Tab value="matriz" label="Matriz de criticidad" />` y `{seccion === 'matriz' && <MatrizCriticidad />}`. Actualizar la descripción: «Usuarios y roles (RF22), tablas de referencia (RF23) y matriz de criticidad (RF12).»

- [ ] **Step 4: Compilar y revisar a mano**

Run: `cd frontend && npm run lint && npm run format && npm run build`
Expected: sin errores. Con `docker compose up`, como `administrador` en `/admin` → «Matriz de criticidad»: cambiar una celda, recargar y ver que se conserva; evaluar un par como RR. HH. y ver que usa la matriz nueva; la evaluación anterior conserva su nivel.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "Agregar el editor de la matriz de criticidad a Administración"
```

---

### Task 9: Documentación y cierre

**Files:**
- Modify: `docs/requerimientos.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-10-16-criticidad-evaluacion-design.md` (línea de estado)
- Modify: `docs/superpowers/plans/2026-10-16-criticidad-evaluacion.md` (línea de estado)

- [ ] **Step 1: Actualizar `docs/requerimientos.md`**

- §4: «Las diecinueve tablas del modelo» no se toca (es de almacenamiento); en §5, fila «Base de datos»: «Modelo relacional de veinticinco tablas» pasa a «veintiocho».
- §5, después del párrafo de **Conocimiento**, agregar:

```
**Criticidad:** `evaluacion_criticidad` (historial de solo inserción; la vigente es la vista `criticidad_vigente`), `matriz_criticidad` y las escalas fijas `nivel_impacto` y `nivel_dificultad` (no son dominios de RF23); ver `docs/superpowers/specs/2026-10-16-criticidad-evaluacion-design.md`. Las consultas de detección leen solo `criticidad_vigente`. Un puesto es de criticidad alta si tiene al menos un requisito excluyente con criticidad vigente alta.
```

- §7: eliminar las filas «Criticidad del puesto» y «Regla de combinación».

- [ ] **Step 2: Actualizar `README.md`**

En la sección que documenta el uso por rol (cerca de las notas de Conocimiento, ~línea 88-110), agregar una sección corta «Criticidad» con: quién evalúa (RR. HH., jefatura y jefes de cátedra con el puesto en su alcance; las autoridades solo leen; el docente no accede), que el nivel lo calcula la matriz (editable en Administración → Matriz de criticidad) y que cambiarla no altera evaluaciones ya guardadas, y que solo se evalúan los conocimientos que el puesto exige.

- [ ] **Step 3: Verificación completa**

Run:

```bash
cd backend && npm run lint && npm run format && npm test && npm run test:integracion
cd ../frontend && npm run lint && npm run format && npm run build
```

Expected: todo en verde. Confirmar con `git status` que `npm run format` no dejó cambios sin commitear en archivos ajenos.

- [ ] **Step 4: Cerrar los estados**

- En la spec: `Estado: Implementada | Fecha: 2026-10-16 | Autor: IvanOchoa229`.
- En este plan: `Estado: Implementado | Fecha: 2026-10-16 | PR: <número del PR>` (o `—` si aún no hay PR).

- [ ] **Step 5: Commit**

```bash
git add docs README.md
git commit -m "Documentar la criticidad y marcar la spec y el plan como implementados"
```
