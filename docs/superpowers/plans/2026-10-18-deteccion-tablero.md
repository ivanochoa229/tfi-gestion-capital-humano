Estado: Implementado | Fecha: 2026-10-18 | PR: #9

# Detección y tablero de riesgo: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** que el sistema detecte por consulta los puntos únicos de falla, las cátedras sostenidas por una sola persona, los puestos críticos sin sucesor preparado, la brecha de perfil y los retiros que dejan un conocimiento crítico sin poseedores, y los consolide en un tablero para RR. HH. y las autoridades (RF16 a RF21, RF24, RNF04; cierra OE6).

**Arquitectura:** siete vistas de PostgreSQL escritas a mano en cuatro migraciones, una por tarea que las usa (dos bases internas y cinco `deteccion_*`; la spec preveía tres, se separa la brecha para que cada tarea lleve su migración), sin parámetros. `DeteccionService` las consulta con SQL crudo, aplica alcance por unidad, el plazo del horizonte y el enmascarado de personas fuera del alcance de una jefatura, y arma los DTOs. Un controlador expone los listados (con CSV para roles globales), la brecha y el tablero; el tablero reutiliza `ParesService.avance` (Criticidad) y `CoberturaService.cobertura` (Sucesión). Un script SQL fuera de las migraciones carga el juego de datos con resultados esperados conocidos, que verifican los tests de integración.

**Tech Stack:** NestJS 12, TypeORM 0.3, PostgreSQL 16, class-validator, vitest, React 19, MUI, Recharts, TanStack Query, react-hook-form, zod.

**Spec:** `docs/superpowers/specs/2026-10-18-deteccion-tablero-design.md`. Antes de empezar, leer también `docs/requerimientos.md` §5 a §7 y las specs de Usuarios (matriz de roles y alcance), Conocimiento (contrato para Detección), Criticidad (contrato para Detección y Sucesión) y Sucesión (contrato para Detección). El plan de Sucesión (`2026-10-18-sucesion-planes.md`) es el modelo de estilo, de SQL en `*.sql.ts` y de pruebas.

## Global Constraints

- Nombres de dominio y de código en español; snake_case en la base y camelCase en el código. Imports ESM con extensión `.js`.
- `synchronize` desactivado: las vistas son migraciones escritas a mano (`CREATE VIEW` en `up`, `DROP VIEW` en `down`), no entidades. Si `migration:generate` propusiera algo sobre ellas, se descarta.
- «Hoy» es `CURRENT_DATE` de la base; en SQL crudo las columnas `date` se devuelven con `::text`. Los niveles se comparan por `nivel_dominio.orden`, nunca por id. «Sin acreditar» = faltante igual al `orden` requerido completo.
- **Poseedor** (decisión 1): persona `activo`, con al menos una ocupación vigente (`fecha_desde <= hoy` y `fecha_hasta` nula o `>= hoy`), sin retiro cumplido (`fecha_prevista_retiro` nula o `>= hoy`), con `conocimiento_persona.id_nivel_acreditado` no nulo. Lo declarado sin acreditar no cuenta.
- **Par crítico** (decisión 2): puesto y conocimiento activos, requisito existente y criticidad vigente `alta` leída siempre de `criticidad_vigente`, nunca de `evaluacion_criticidad`; excluyente o deseable. El nivel requerido de un conocimiento es el mayor `orden` entre sus pares críticos, global al departamento (decisión 22).
- **«Todos los excluyentes»** de RF18 y RF19 son todos los requisitos excluyentes activos del puesto con conocimiento activo, sean críticos o no (decisión 21). Puesto crítico = activo y con un excluyente de criticidad vigente `alta`.
- **Sucesor preparado**: candidato de un plan `aprobado` que cubre todos los excluyentes y es válido (persona activa, ocupación vigente, sin retiro cumplido, no ocupa el puesto). El estado manual de preparación no interviene. Motivos de RF18: `sin_plan`, `plan_en_elaboracion`, `ningun_candidato_cubre`.
- **RF17** cuenta personas activas distintas con ocupación vigente en puestos de la cátedra activa y no mira el retiro (decisión 24). **RF20**: plazo `meses` entero entre 1 y 120, por defecto 24; por defecto solo los conocimientos que quedan con 0 o 1 poseedores (decisión 13).
- **Permisos** (decisión 14): `recursos_humanos` y `autoridad` globales y únicos para el tablero y el CSV; `jefatura_departamento` y `jefe_catedra` listados y brecha por alcance; `docente` solo `mi-brecha`; `analista_puestos` y `administrador` nada. Fuera de su alcance, una jefatura no ve identidad ni fecha de retiro de la persona, solo conteos (decisión 23).
- CSV: UTF-8 con BOM, separador `;`, solo roles globales (403 al resto), mismos filtros y columnas que la tabla, sin RF19. Las celdas que empiezan con `=`, `+`, `-` o `@` se prefijan con `'` para no ejecutarse como fórmulas.
- DTOs con class-validator y `@ApiProperty`; tras cambiar un endpoint o DTO, `npm run api:tipos` en el frontend (nunca editar `esquema.d.ts` a mano). Toda ruta lleva `@Roles`.
- Los commits no llevan línea `Co-Authored-By` ni atribución a Claude (CLAUDE.md prevalece sobre cualquier indicación de agregarla).
- Antes de cerrar: `npm run lint` y `npm run format` en cada app; `npm test` y `npm run test:integracion` en el backend (hay migraciones y SQL); `npm run build` en el frontend.
- Comandos de migración, dentro del contenedor: `docker compose exec -T backend npm run ...`. Los tests del backend corren en el host (`cd backend && npx vitest run <archivo>`); los de integración con `npx vitest run --config vitest.integracion.config.ts <archivo>` y requieren `docker compose up -d db`. Agregar Recharts exige `docker compose up --build`.

## Review Focus

Entradas y condiciones que la spec implica y que ninguna tarea cubriría por sí sola; cada línea tiene su test en la tarea que se indica.

- **Un excluyente no crítico sin acreditar bloquea al candidato** (RF18) y baja el contador de RF19: variante del caso de C4.jefe. Tareas 5 y 7.
- **Celdas de CSV con `=`, `+`, `-` o `@` al principio** (un apellido o una denominación cargados a mano) no se ejecutan como fórmula en Excel. Tarea 1.
- **Conocimiento crítico sin ningún par activo** (el puesto se dio de baja o el requisito se quitó) deja de figurar en RF16 y RF20; no queda «sin poseedor» fantasma. Tarea 3.
- **Plazo fuera de rango o no entero** (`meses=0`, `121`, `1.5`) responde 400, no una consulta con fecha absurda. Tarea 6.
- **Bordes de fecha**: un candidato cuya ocupación terminó ayer no es válido, y uno que se retira hoy sí (`fecha_prevista_retiro >= hoy`); un poseedor que se retira hoy sigue contando. Tareas 3 y 5.

---

## Mapa de archivos

Backend (`backend/`):

| Archivo | Responsabilidad |
| --- | --- |
| `src/common/roles.ts` | `ROLES_LECTORES_DE_DETECCION`, `ROLES_GLOBALES_DE_DETECCION`, `ROLES_LECTORES_DE_BRECHA_PROPIA` |
| `src/modules/deteccion/deteccion.constantes.ts` | `MESES_HORIZONTE_DEFECTO`, `MESES_HORIZONTE_MAX`, códigos de motivo, contextos de brecha |
| `src/modules/deteccion/deteccion.sql.ts` | Fragmentos SQL compartidos: subunidades, persona en alcance, ocupación vigente |
| `src/modules/deteccion/csv-salida.ts` | `aCsv`: escape, separador, BOM y neutralización de fórmulas |
| `src/modules/deteccion/dto/*.ts` | Filtros y DTOs de salida por consulta y del tablero |
| `src/modules/deteccion/*.sql.ts` | Una consulta por indicador, sobre las vistas |
| `src/modules/deteccion/deteccion.service.ts` | Armado de listados, brecha y horizonte; alcance y enmascarado |
| `src/modules/deteccion/tablero.service.ts` | Composición del tablero |
| `src/modules/deteccion/deteccion.controller.ts`, `tablero.controller.ts` | Rutas |
| `src/infra/database/migrations/*` | Tres migraciones de vistas |
| `src/testing/datos-deteccion.ts` | Carga el script de datos de prueba en la base temporal y devuelve los ids por nombre |
| `scripts/datos-prueba-deteccion.sql` | Juego de datos de la spec |

Frontend (`frontend/src/`):

| Archivo | Responsabilidad |
| --- | --- |
| `features/deteccion/hooks/useDeteccion.ts` | Listados, brecha, mi brecha y descarga de CSV |
| `features/deteccion/pages/*.tsx`, `components/*.tsx` | Cuatro listados y la brecha |
| `features/tablero/hooks/useTablero.ts`, `pages/TableroPage.tsx`, `components/*.tsx` | Tablero con tarjetas, gráficos y calidad de datos |
| `router.tsx`, `auth/permisos.ts` | Rutas y menú |
| `features/sucesion/pages/MiSucesionPage.tsx` | Enlace a la brecha detallada |

---

### Task 1: Cimientos: roles, constantes, fragmentos SQL y CSV

**Files:**
- Modify: `backend/src/common/roles.ts`, `backend/src/common/roles.spec.ts`
- Create: `backend/src/modules/deteccion/deteccion.constantes.ts`, `deteccion.sql.ts`, `csv-salida.ts`
- Test: `backend/src/modules/deteccion/csv-salida.spec.ts`

**Interfaces:**
- Produces (`roles.ts`): `ROLES_LECTORES_DE_DETECCION` (rrhh, autoridad, jefatura_departamento, jefe_catedra), `ROLES_GLOBALES_DE_DETECCION` (rrhh, autoridad), `ROLES_LECTORES_DE_BRECHA_PROPIA` (docente, jefe_catedra, jefatura_departamento).
- Produces (`deteccion.constantes.ts`): `MESES_HORIZONTE_DEFECTO = 24`, `MESES_HORIZONTE_MAX = 120`, `MOTIVO_SIN_SUCESOR = { sinPlan: 'sin_plan', planEnElaboracion: 'plan_en_elaboracion', ningunCandidatoCubre: 'ningun_candidato_cubre' }`, `CONTEXTO_BRECHA = { ocupante: 'ocupante', candidato: 'candidato' }`.
- Produces (`deteccion.sql.ts`): `SQL_SUBUNIDADES` (CTE recursiva `subunidades(id_unidad)` desde el parámetro `$2::int`, mismo patrón que `sucesion/cobertura.sql.ts`) y `sqlPersonaEnAlcance(columnaPersona: string): string`, un predicado booleano que es verdadero si `$1::int[]` es nulo o la persona tiene una ocupación vigente en un puesto de esas unidades.
- Produces (`csv-salida.ts`): `aCsv(columnas: { clave: string; titulo: string }[], filas: Record<string, unknown>[]): string`.

- [x] **Step 1: Escribir los tests (fallan)**. En `csv-salida.spec.ts`: empieza con el BOM `﻿`; separa con `;` y termina cada fila con `\r\n`; una celda con `;`, comillas o salto de línea va entre comillas con las comillas duplicadas; `null` y `undefined` salen vacíos; una celda de texto que empieza con `=`, `+`, `-` o `@` sale prefijada con `'` (por ejemplo `=SUMA(A1)` → `'=SUMA(A1)`), pero un número negativo (tipo `number`) no se prefija; booleanos como `sí` y `no`. En `roles.spec.ts`: las tres listas nuevas contienen exactamente los roles de Interfaces, y `analista_puestos` y `administrador` no están en ninguna.
- [x] **Step 2: Correr los tests y ver que fallan.** Esperado: FAIL por exportaciones inexistentes.
- [x] **Step 3: Implementar** las listas, las constantes, `aCsv` (neutralización solo para `string`) y los dos fragmentos SQL. `sqlPersonaEnAlcance` usa la definición de ocupación vigente de Personas con `CURRENT_DATE`.
- [x] **Step 4: Correr los tests.** Esperado: PASS. Correr también `npx vitest run src/common/cobertura-roles.spec.ts`: sigue en verde.
- [x] **Step 5: Commit**

```bash
git add backend/src
git commit -m "Agregar los roles, constantes y el CSV de salida de Detección"
```

---

### Task 2: Juego de datos de prueba y cargador

**Files:**
- Create: `backend/scripts/datos-prueba-deteccion.sql`, `backend/src/testing/datos-deteccion.ts`
- Modify: `README.md`
- Test: `backend/src/testing/datos-deteccion.int.spec.ts`

**Interfaces:**
- Produces (`datos-deteccion.ts`): `cargarDatosDeDeteccion(ds: DataSource): Promise<DatosDeteccion>` ejecuta el script y devuelve `DatosDeteccion` con `persona: Record<'Ana' | 'Beto' | 'Carla' | 'Diego' | 'Eva' | 'Fede' | 'Gus' | 'Hugo', number>`, `catedra: Record<'C1' | 'C2' | 'C3' | 'C4' | 'C5', number>`, `puesto: Record<'C1.jefe' | 'C1.JTP' | 'C2.jefe' | 'C2.aux' | 'C3.jefe' | 'C4.jefe' | 'C4.aux', number>`, `conocimiento: Record<'K1' | 'K2' | 'K3' | 'K4' | 'K5' | 'K6' | 'K7' | 'K8', number>` y `plan: Record<'C2.jefe' | 'C3.jefe' | 'C4.jefe' | 'C4.aux', number>` (ids resueltos por consulta a los legajos, nombres y códigos que el script fija). El resto de las tareas de integración usan estos ids.

- [x] **Step 1: Escribir `datos-deteccion.int.spec.ts` (falla)**: sobre la base temporal (`crearBaseTemporal`), tras `cargarDatosDeDeteccion`, hay 8 personas, 5 cátedras activas más la inactiva, 7 puestos con requisitos, ocupaciones vigentes de Ana (dos en C1), Beto, Carla, Diego, Eva y Gus, y Fede con la ocupación cerrada hace un mes; `fecha_prevista_retiro` de Beto a 10 meses, Diego a 30 y Gus ayer; Hugo inactivo; y los cuatro planes en los estados de la spec. Los niveles acreditados de la tabla de K1 a K8 están en `conocimiento_persona`.
- [x] **Step 2: Correr el test y ver que falla.** Esperado: FAIL, el script no existe.
- [x] **Step 3: Escribir `datos-prueba-deteccion.sql`** con exactamente el juego de la spec (sección «Juego de datos»): personas con legajos `DET-ANA`… `DET-HUGO`, cátedras con nombres fijos y una cátedra inactiva, los siete puestos, ocupaciones, requisitos con los niveles y el carácter de la tabla, evaluaciones de criticidad (`alta` en los pares críticos; `media` para K7 en C2.aux y `baja` para K8 en C4.jefe, con un `usuario` auxiliar `det-evaluador`, niveles de impacto y dificultad coherentes con la matriz), `conocimiento_persona` con los acreditados, y los planes y candidatos. Todas las fechas relativas a `CURRENT_DATE` (`fecha_ingreso` 10 años atrás para respetar los CHECK). Encabezado con el uso por `psql` como `catedras-ejemplo.sql` y la advertencia de que corre **una sola vez** (un segundo intento falla por legajo duplicado). Sin metacomandos de `psql`, para poder ejecutarlo también con `ds.query`.
- [x] **Step 4: Implementar `cargarDatosDeDeteccion`** (lee el script con `readFileSync` y lo ejecuta en una sola consulta; resuelve los ids por legajo, denominación y código).
- [x] **Step 5: Correr el test.** Esperado: PASS. Documentar en `README.md`, junto a `catedras-ejemplo.sql`, cómo cargarlo para la demostración del tablero.
- [x] **Step 6: Commit**

```bash
git add backend/scripts backend/src/testing README.md
git commit -m "Agregar el juego de datos de prueba de Detección"
```

---

### Task 3: RF16: puntos únicos de falla

**Files:**
- Create: `backend/src/infra/database/migrations/<marca>-CrearVistasBaseDeDeteccion.ts`, `<marca>-CrearVistasDeConteoDeDeteccion.ts`, `backend/src/modules/deteccion/dto/filtro-deteccion.dto.ts`, `dto/punto-unico-falla.dto.ts`, `puntos-unicos.sql.ts`, `deteccion.service.ts`, `deteccion.controller.ts`
- Modify: `deteccion.module.ts`, `backend/src/modules/criticidad/criticidad.module.ts` (exporta `ParesService`), `backend/src/modules/sucesion/sucesion.module.ts` (exporta `CoberturaService`)
- Test: `deteccion.service.spec.ts`, `puntos-unicos.int.spec.ts`

**Interfaces:**
- Consumes: Tarea 1 (roles, fragmentos, `aCsv`), Tarea 2 (`cargarDatosDeDeteccion`); `AlcanceService.unidadesVisibles(sesion): Promise<number[] | null>`.
- Produces (vistas, migraciones a mano, marcas posteriores a `1792280003000`): `poseedor_vigente(id_persona, id_conocimiento, orden_acreditado, fecha_prevista_retiro)`; `par_critico(id_puesto, id_conocimiento, id_unidad, orden_requerido, es_excluyente)`; `deteccion_punto_unico_falla(id_conocimiento, orden_requerido_max, cantidad_poseedores, id_persona_unica)` con una fila por conocimiento que tenga algún par crítico y `cantidad_poseedores` contando los poseedores con `orden_acreditado >= orden_requerido_max`; `deteccion_catedra_una_persona(id_unidad, cantidad_personas, cantidad_ocupaciones, id_persona_unica)` con una fila por cátedra activa; `deteccion_retiro_poseedor(id_conocimiento, id_persona, fecha_prevista_retiro, orden_requerido_max, cantidad_poseedores)` con una fila por poseedor (nivel suficiente) con fecha de retiro. `id_persona_unica` es nulo salvo que haya exactamente una.
- Produces (DTOs): `FiltroDeteccionDto { idUnidad?: number; formato?: 'csv' }` (`idUnidad` entero positivo), `PersonaDeteccionDto { idPersona: number; apellido: string; nombre: string }`, `PuestoCriticoDto { idPuesto: number; codigo: string; denominacion: string; idUnidad: number }`, `PuntoUnicoFallaDto { idConocimiento: number; denominacion: string; nivelRequerido: string; cantidadPoseedores: 0 | 1; poseedor: PersonaDeteccionDto | null; puestosCriticos: PuestoCriticoDto[]; puestosFueraDeAlcance: number }`, `PuntosUnicosFallaDto { unicoPoseedor: PuntoUnicoFallaDto[]; sinPoseedor: PuntoUnicoFallaDto[] }`.
- Produces (`DeteccionService`): `puntosUnicosFalla(filtro: FiltroDeteccionDto, sesion: SesionUsuario): Promise<PuntosUnicosFallaDto>`. Alcance: el conocimiento figura si algún par crítico está en las unidades visibles (y en `idUnidad` con descendientes si viene); `puestosCriticos` lista solo los de esa selección y `puestosFueraDeAlcance` cuenta el resto; el poseedor único se enmascara (`poseedor: null`) si no cumple `sqlPersonaEnAlcance`.
- Produces (`DeteccionController`): `GET /deteccion/puntos-unicos-falla` con `ROLES_LECTORES_DE_DETECCION`; con `formato=csv` exige `ROLES_GLOBALES_DE_DETECCION` (403 si no) y devuelve `text/csv` con una columna `categoria` (`unico_poseedor` o `sin_poseedor`).

- [x] **Step 1: Escribir los tests (fallan)**:
  - `deteccion.service.spec.ts` (consulta simulada): el servicio pasa `unidadesVisibles` y `idUnidad` al SQL; separa las filas en `unicoPoseedor` y `sinPoseedor` por `cantidad_poseedores`; con `puestosFueraDeAlcance > 0` el DTO lo informa; enmascara al poseedor cuando la fila viene con `en_alcance = false`.
  - `puntos-unicos.int.spec.ts` (PostgreSQL real, con el juego de datos): `unicoPoseedor` = solo K2 (poseedor Ana); `sinPoseedor` = K4 y K5; K1 (dos poseedores: Beto y Carla; Eva no alcanza N3; Fede sin ocupación, Gus retirado y Hugo inactivo no cuentan), K3, K6 y K7 no figuran; el nivel requerido de K1 es el más exigente (N3). Con la sesión de una jefatura que solo ve C2, K1 y K4 se ven, K2 no; una fila con poseedor fuera del alcance lo trae enmascarado. **Un conocimiento cuyos pares críticos desaparecen** (se dan de baja los dos puestos críticos de K2, C1.jefe y C1.JTP) deja de figurar en ambas listas. Borde de fecha: un poseedor con retiro **hoy** sigue contando.
  - Rutas: el test existente de `@Roles` en toda ruta no pública cubre el controlador nuevo (`npx vitest run src/common/cobertura-roles.spec.ts`).
- [x] **Step 2: Correr los tests y ver que fallan.** Esperado: FAIL por módulo/vistas inexistentes.
- [x] **Step 3: Escribir las dos migraciones** con las vistas de Interfaces. `par_critico` y `poseedor_vigente` aplican las definiciones de Global Constraints; `deteccion_punto_unico_falla` calcula el máximo de `orden_requerido` por conocimiento sobre `par_critico` y cuenta poseedores contra él. Verificar con `EXPLAIN` sobre el juego de datos; sin índices nuevos salvo que haga falta.
- [x] **Step 4: Implementar el SQL, `DeteccionService.puntosUnicosFalla` y la ruta**; registrar `DeteccionService` y `DeteccionController` en `DeteccionModule` (con `UsuariosModule`) y agregar los `exports` de los otros dos módulos.
- [x] **Step 5: Correr los tests unitarios y de integración del módulo.** Esperado: PASS.
- [x] **Step 6: Commit**

```bash
git add backend/src
git commit -m "Implementar los puntos únicos de falla (RF16)"
```

---

### Task 4: RF17: cátedras sostenidas por una sola persona

**Files:**
- Create: `backend/src/modules/deteccion/dto/catedra-una-persona.dto.ts`, `catedras.sql.ts`
- Modify: `deteccion.service.ts`, `deteccion.controller.ts`
- Test: `deteccion.service.spec.ts`, `catedras.int.spec.ts`

**Interfaces:**
- Consumes: Tarea 3 (`deteccion_catedra_una_persona`, `FiltroDeteccionDto`, `PersonaDeteccionDto`).
- Produces (DTOs): `CatedraUnaPersonaDto { idUnidad: number; denominacion: string; cantidadPersonas: 0 | 1; cantidadCargos: number; persona: PersonaDeteccionDto | null }`, `CatedrasUnaPersonaDto { unaPersona: CatedraUnaPersonaDto[]; sinDotacion: CatedraUnaPersonaDto[] }`.
- Produces (`DeteccionService`): `catedrasUnaPersona(filtro: FiltroDeteccionDto, sesion): Promise<CatedrasUnaPersonaDto>`; la cátedra debe estar en las unidades visibles (y en `idUnidad` con descendientes); la persona se enmascara fuera del alcance de una jefatura.
- Produces (ruta): `GET /deteccion/catedras-una-persona`, mismos roles y CSV que la Tarea 3 (columna `categoria`: `una_persona` o `sin_dotacion`).

- [x] **Step 1: Escribir los tests (fallan)**: `catedras.int.spec.ts` con el juego de datos: `unaPersona` = C1 (Ana, 2 cargos) y C3 (Gus: el retiro cumplido no excluye, decisión 24); `sinDotacion` = C5 (la cátedra inactiva no figura); C2 y C4 (dos personas) no figuran; Fede, con ocupación cerrada, no cuenta para C3 ni otra. Una persona **inactiva** con ocupación vigente no cuenta como sostén. En `deteccion.service.spec.ts`: la jefatura con alcance de C1 no ve C3 y recibe `persona: null` si la persona está fuera de su alcance.
- [x] **Step 2: Correr los tests y ver que fallan.** Esperado: FAIL.
- [x] **Step 3: Implementar** `catedras.sql.ts`, el método del servicio y la ruta.
- [x] **Step 4: Correr los tests del módulo.** Esperado: PASS.
- [x] **Step 5: Commit**

```bash
git add backend/src
git commit -m "Implementar las cátedras sostenidas por una sola persona (RF17)"
```

---

### Task 5: RF18: puestos críticos sin sucesor preparado

**Files:**
- Create: `backend/src/infra/database/migrations/<marca>-CrearVistaDePuestoSinSucesor.ts`, `backend/src/modules/deteccion/dto/puesto-sin-sucesor.dto.ts`, `sin-sucesor.sql.ts`
- Modify: `deteccion.service.ts`, `deteccion.controller.ts`
- Test: `deteccion.service.spec.ts`, `sin-sucesor.int.spec.ts`

**Interfaces:**
- Consumes: Tarea 3 (`par_critico`, `poseedor_vigente`).
- Produces (vista): `deteccion_puesto_sin_sucesor(id_puesto, motivo, id_plan, candidatos_total, candidatos_validos)` con una fila por puesto crítico (decisión 6) que **no** tiene sucesor preparado; `motivo` según los códigos de `MOTIVO_SIN_SUCESOR`; `id_plan` es el plan aprobado o, si no hay, el que está en elaboración; `candidatos_total` cuenta todas las filas de candidato del plan aprobado y `candidatos_validos` solo las de la decisión 7. Un candidato cubre si, para cada excluyente activo del puesto, su `id_nivel_acreditado` tiene `orden` mayor o igual al requerido.
- Produces (DTOs): `FiltroSinSucesorDto extends FiltroDeteccionDto { motivo?: 'sin_plan' | 'plan_en_elaboracion' | 'ningun_candidato_cubre' }`, `PuestoSinSucesorDto { idPuesto: number; codigo: string; denominacion: string; idUnidad: number; motivo: string; idPlan: number | null; candidatosTotal: number; candidatosValidos: number }`.
- Produces (`DeteccionService`): `puestosSinSucesor(filtro: FiltroSinSucesorDto, sesion): Promise<PuestoSinSucesorDto[]>`, filtrado por unidad del puesto y alcance.
- Produces (ruta): `GET /deteccion/puestos-sin-sucesor`, mismos roles y CSV.

- [x] **Step 1: Escribir los tests (fallan)**: `sin-sucesor.int.spec.ts` con el juego de datos: figuran C1.jefe y C1.JTP (`sin_plan`), C2.jefe (`ningun_candidato_cubre`, 2 de 2 válidos: Carla cubre K1 pero no K4; Eva no cubre K1), C3.jefe (`ningun_candidato_cubre`, 1 candidato y 0 válidos: Gus está retirado), C4.aux (`plan_en_elaboracion`, plan en borrador); **no** figura C4.jefe (Eva cubre K3 y también el excluyente no crítico K8). **Variante (Review Focus)**: tras borrar la acreditación de Eva en K8, C4.jefe pasa a `ningun_candidato_cubre`. Otras variantes: un candidato que pasa a ocupar el puesto cuenta en `candidatos_total` pero no en `candidatos_validos`; uno cuya ocupación terminó **ayer** no es válido y uno que se retira **hoy** sí; un puesto dado de baja no figura; el filtro `motivo` filtra. En `deteccion.service.spec.ts`: alcance y filtros llegan al SQL.
- [x] **Step 2: Correr los tests y ver que fallan.** Esperado: FAIL.
- [x] **Step 3: Escribir la migración de la vista, el SQL, el método y la ruta.**
- [x] **Step 4: Correr los tests del módulo.** Esperado: PASS.
- [x] **Step 5: Commit**

```bash
git add backend/src
git commit -m "Implementar los puestos críticos sin sucesor preparado (RF18)"
```

---

### Task 6: RF20: horizonte de riesgo

**Files:**
- Create: `backend/src/modules/deteccion/dto/horizonte.dto.ts`, `horizonte.sql.ts`
- Modify: `deteccion.service.ts`, `deteccion.controller.ts`
- Test: `deteccion.service.spec.ts`, `horizonte.dto.spec.ts`, `horizonte.int.spec.ts`

**Interfaces:**
- Consumes: Tarea 3 (`deteccion_retiro_poseedor`, `par_critico`).
- Produces (DTOs): `FiltroHorizonteDto extends FiltroDeteccionDto { meses?: number; incluirConDosOMas?: boolean }` (`meses` entero entre 1 y `MESES_HORIZONTE_MAX`, por defecto `MESES_HORIZONTE_DEFECTO`; `incluirConDosOMas` booleano desde cadena `true`/`false`), `RetiroRiesgoDto { idPersona: number | null; apellido: string | null; nombre: string | null; fechaPrevistaRetiro: string | null }` (nulos si se enmascara), `HorizonteRiesgoDto { idConocimiento: number; denominacion: string; nivelRequerido: string; cantidadPoseedores: number; quedan: number; retiros: RetiroRiesgoDto[]; puestosCriticos: PuestoCriticoDto[]; puestosFueraDeAlcance: number }`.
- Produces (`DeteccionService`): `horizonteRiesgo(filtro: FiltroHorizonteDto, sesion): Promise<{ meses: number; conocimientos: HorizonteRiesgoDto[] }>`. `retiros` son los poseedores con `fecha_prevista_retiro <= hoy + meses` y `quedan = cantidadPoseedores - retiros.length`. Por defecto solo `quedan <= 1`; con `incluirConDosOMas`, todos. Orden: menos `quedan` primero y después la fecha de retiro más próxima. Alcance y enmascarado como la Tarea 3 (el conteo `quedan` se conserva; se enmascaran persona y fecha).
- Produces (ruta): `GET /deteccion/horizonte-riesgo`, mismos roles y CSV (una fila por retiro, con `quedan`).

- [x] **Step 1: Escribir los tests (fallan)**:
  - `horizonte.dto.spec.ts`: `meses` 0, 121, 1.5 y `"abc"` → rechazados (400); ausente → usa 24; `incluirConDosOMas` acepta `true`/`false`.
  - `horizonte.int.spec.ts` (juego de datos): con 24 meses aparece K1 con `quedan = 1` (retira Beto, queda Carla); K6 (Beto retira, `quedan = 2`) **solo** con `incluirConDosOMas`; K3 no aparece (Diego se retira a los 30 meses); con `meses = 36` se suma K3 con `quedan = 1` (queda Eva); K2 (Ana, sin retiro) y K4 y K5 (sin poseedores) no aparecen. Una jefatura que no ve la ocupación de Beto recibe el retiro enmascarado pero el mismo `quedan`. Borde: un retiro **dentro de exactamente** `meses` cuenta; un día después, no.
- [x] **Step 2: Correr los tests y ver que fallan.** Esperado: FAIL.
- [x] **Step 3: Implementar** el SQL (la vista ya expone `cantidad_poseedores`; el plazo se aplica con `WHERE` y un parámetro), el método y la ruta; el DTO valida con `@IsInt`, `@Min`, `@Max` y `@Type`.
- [x] **Step 4: Correr los tests del módulo.** Esperado: PASS.
- [x] **Step 5: Commit**

```bash
git add backend/src
git commit -m "Implementar el horizonte de riesgo de retiros (RF20)"
```

---

### Task 7: RF19: brecha de perfil

**Files:**
- Create: `backend/src/infra/database/migrations/<marca>-CrearVistaDeBrechaDePerfil.ts`, `backend/src/modules/deteccion/dto/brecha.dto.ts`, `brecha.sql.ts`
- Modify: `deteccion.service.ts`, `deteccion.controller.ts`
- Test: `brecha.service.spec.ts`, `brecha.int.spec.ts`

**Interfaces:**
- Consumes: Tarea 1 (roles y fragmentos SQL), Tarea 2 (juego de datos) y `FiltroDeteccionDto` de la Tarea 3; la vista lee `conocimiento_persona` y `nivel_dominio`.
- Produces (vista): `deteccion_brecha_perfil(contexto, id_persona, id_puesto, id_plan, estado_plan, id_conocimiento, es_excluyente, orden_requerido, orden_acreditado, faltante, cubierto, a_revisar)`. `contexto = 'ocupante'` (persona activa × puesto de cada ocupación vigente; `id_plan` y `estado_plan` nulos) o `'candidato'` (candidato de planes `aprobado`, `borrador` o `pendiente_aprobacion` × puesto del plan; `a_revisar` si ya ocupa el puesto o no tiene ocupación vigente). Una fila por requisito activo del puesto con conocimiento activo, excluyente o deseable. `orden_acreditado` nulo = sin acreditar; `faltante = GREATEST(0, orden_requerido - COALESCE(orden_acreditado, 0))`; `cubierto = faltante = 0`.
- Produces (DTOs): `FiltroBrechaDto { idPersona?: number; idPuesto?: number; idUnidad?: number; contexto?: 'ocupante' | 'candidato' }`, `BrechaConocimientoDto { idConocimiento: number; denominacion: string; esExcluyente: boolean; nivelRequerido: string; nivelAcreditado: string | null; nivelDeclarado: string | null; faltante: number; cubierto: boolean }`, `ResumenBrechaDto { excluyentesCubiertos: number; excluyentesTotal: number; deseablesCubiertos: number; deseablesTotal: number }`, `BrechaPuestoDto { contexto: string; idPersona: number; apellido: string; nombre: string; idPuesto: number; denominacionPuesto: string; idPlan: number | null; estadoPlan: string | null; aRevisar: boolean; resumen: ResumenBrechaDto; conocimientos: BrechaConocimientoDto[] }`. `nivelDeclarado` solo se completa en `mi-brecha`.
- Produces (`DeteccionService`): `brecha(filtro: FiltroBrechaDto, sesion): Promise<BrechaPuestoDto[]>` (alcance por unidad del puesto; `docente` no, 403) y `miBrecha(sesion): Promise<BrechaPuestoDto[]>` (ocupaciones vigentes propias y candidaturas en planes `aprobado`; sin `idPersona`, `BadRequestException`). El resumen se arma en el servicio.
- Produces (rutas): `GET /deteccion/brecha` con `ROLES_LECTORES_DE_DETECCION`; `GET /deteccion/mi-brecha` con `ROLES_LECTORES_DE_BRECHA_PROPIA`. Sin CSV.

- [x] **Step 1: Escribir los tests (fallan)**:
  - `brecha.service.spec.ts`: el resumen cuenta excluyentes y deseables cubiertos y totales por separado; un conocimiento sin acreditar cuenta como no cubierto con `nivelAcreditado: null`; `miBrecha` sin persona vinculada → `BadRequestException`; `miBrecha` descarta candidaturas de planes que no están `aprobado`; la jefatura recibe también las de planes en elaboración en `brecha`; el docente en `brecha` → 403.
  - `brecha.int.spec.ts` (juego de datos): Carla candidata a C2.jefe → K1 cubierto (faltante 0), K4 «sin acreditar» (faltante 2), excluyentes 1 de 2; Eva candidata a C2.jefe → K1 faltante 1, K4 sin acreditar, 0 de 2; Carla ocupante de C2.aux → sin excluyentes y deseables 0 de 1 (K7 sin acreditar); `a_revisar` verdadero para un candidato que ya ocupa el puesto; la jefatura con alcance de C2 no ve filas de puestos de C4; `mi-brecha` de Eva trae su ocupación en C4.aux y su candidatura aprobada a C4.jefe, y no la candidatura de Carla a C4.aux (plan en borrador, y ajena); `nivelDeclarado` aparece en `mi-brecha` cuando la persona declaró (en el test, Eva declara K4 en N2) y queda nulo si no.
- [x] **Step 2: Correr los tests y ver que fallan.** Esperado: FAIL.
- [x] **Step 3: Escribir la migración de la vista, el SQL, el armado del resumen y las rutas.** El nombre del nivel se toma de `nivel_dominio.denominacion`.
- [x] **Step 4: Correr los tests del módulo.** Esperado: PASS.
- [x] **Step 5: Commit**

```bash
git add backend/src
git commit -m "Implementar la brecha de perfil por persona y puesto (RF19)"
```

---

### Task 8: RF21: tablero

**Files:**
- Create: `backend/src/modules/deteccion/dto/tablero.dto.ts`, `tablero.sql.ts`, `tablero.service.ts`, `tablero.controller.ts`
- Modify: `deteccion.module.ts`
- Test: `tablero.service.spec.ts`, `tablero.int.spec.ts`

**Interfaces:**
- Consumes: Tareas 3 a 7 (`DeteccionService`), `ParesService.avance(filtro: FiltroParesDto, sesion): Promise<AvanceDto>`, `CoberturaService.cobertura(filtro: {idUnidad?: number}, sesion): Promise<CoberturaDto>`.
- Produces (DTOs): `FiltroTableroDto { idUnidad?: number; meses?: number }` (mismas validaciones), y `TableroDto { puntosUnicosFalla: { unicoPoseedor: number; sinPoseedor: number }; catedras: { unaPersona: number; sinDotacion: number }; puestosSinSucesor: { total: number; porMotivo: { motivo: string; cantidad: number }[] }; candidatosConBrecha: number; horizonte: { meses: number; conocimientos: number }; graficos: { puntosUnicosPorCatedra: { idUnidad: number; denominacion: string; cantidad: number }[]; retirosPorSemestre: { semestre: string; cantidad: number }[] }; calidadDeDatos: { criticidad: { evaluados: number; total: number }; planes: { criticos: number; conPlan: number }; acreditacion: { acreditados: number; total: number } } }` (semestre con el formato `2027-S1`).
- Produces (`TableroService`): `tablero(filtro: FiltroTableroDto, sesion: SesionUsuario): Promise<TableroDto>`. Cada cifra sale de los mismos métodos de `DeteccionService` que los listados, así tarjeta y listado no divergen; `candidatosConBrecha` = candidatos distintos de planes `aprobado` con algún excluyente no cubierto; `puntosUnicosPorCatedra` = conocimientos con un poseedor, agrupados por unidad del puesto crítico (cátedra); `retirosPorSemestre` = retiros dentro del plazo de poseedores de conocimientos críticos, agrupados por semestre; `acreditacion` = requisitos de los puestos con ocupación vigente (filas `ocupante` de la brecha) con nivel acreditado sobre el total.
- Produces (ruta): `GET /deteccion/tablero` con `ROLES_GLOBALES_DE_DETECCION` (decisión 14); la jefatura y el jefe de cátedra reciben 403.

- [x] **Step 1: Escribir los tests (fallan)**: `tablero.service.spec.ts` con los servicios simulados: las cifras coinciden con las longitudes de las listas de `DeteccionService` y pasan filtros y plazo; `calidadDeDatos` toma `avance` y `cobertura` tal cual. `tablero.int.spec.ts` (juego de datos, `meses = 24`): `unicoPoseedor = 1`, `sinPoseedor = 2`; `unaPersona = 2`, `sinDotacion = 1`; `puestosSinSucesor.total = 5` con motivos `sin_plan` 2, `ningun_candidato_cubre` 2 y `plan_en_elaboracion` 1; `horizonte.conocimientos = 1` (K1; K6 queda fuera por defecto); `retirosPorSemestre` suma los retiros de Beto en el semestre que corresponde a hoy + 10 meses; `candidatosConBrecha` = candidatos de planes aprobados con excluyentes sin cubrir (Carla y Eva en C2.jefe, 2 personas distintas; Gus cubre su único excluyente en C3.jefe y Eva cubre C4.jefe); el filtro `idUnidad` de C2 baja las cifras a lo de esa cátedra. Un rol no global recibe 403 (test de controlador).
- [x] **Step 2: Correr los tests y ver que fallan.** Esperado: FAIL.
- [x] **Step 3: Implementar** `TableroService`, las consultas de gráficos y la ruta; importar `CriticidadModule` y `SucesionModule` en `DeteccionModule`.
- [x] **Step 4: Correr todos los tests del módulo** (`npx vitest run src/modules/deteccion`) y `src/common`. Esperado: PASS.
- [x] **Step 5: Commit**

```bash
git add backend/src
git commit -m "Implementar el tablero de riesgo (RF21)"
```

---

### Task 9: Frontend: listados y brecha

**Files:**
- Create: `frontend/src/features/deteccion/hooks/useDeteccion.ts`, `pages/{PuntosUnicosPage,CatedrasPage,PuestosSinSucesorPage,HorizontePage,BrechaPage}.tsx`, `components/{ListadoConPestanias,BotonExportarCsv,TablaBrecha}.tsx`
- Modify: `frontend/src/router.tsx`, `frontend/src/auth/permisos.ts`, `frontend/src/features/sucesion/pages/MiSucesionPage.tsx`, `frontend/src/api/esquema.d.ts` (regenerado)

**Interfaces:**
- Consumes: la API de las Tareas 3 a 7. Regenerar tipos con `npm run api:tipos` (backend corriendo) antes de escribir los hooks.
- Produces (`useDeteccion.ts`): `usePuntosUnicos(filtro)`, `useCatedras(filtro)`, `usePuestosSinSucesor(filtro)`, `useHorizonte(filtro)`, `useBrecha(filtro)`, `useMiBrecha()`, y `descargarCsv(ruta: string, filtro: Record<string, unknown>): Promise<void>` (petición autenticada con `?formato=csv` que arma un `Blob`, como la descarga de activos). Siguen el patrón de `features/sucesion/hooks/useSucesion.ts`.

- [x] **Step 1: Regenerar los tipos** y escribir los hooks.
- [x] **Step 2: Los cuatro listados** (`/deteccion/puntos-unicos-falla`, `/catedras`, `/puestos-sin-sucesor`, `/horizonte`; `recursos_humanos`, `autoridad`, `jefatura_departamento`, `jefe_catedra`): tabla con filtro de unidad; las listas secundarias («Sin poseedor», «Sin dotación») en una segunda pestaña; el horizonte con selector de plazo (24 por defecto) e interruptor «Incluir los que quedan con 2 o más»; los filtros viajan en la URL para que el tablero enlace con ellos. La persona enmascarada se muestra como «Fuera de tu alcance». Botón «Exportar CSV» solo para `recursos_humanos` y `autoridad`. Estado vacío con texto («Ningún conocimiento crítico tiene un único poseedor»).
- [x] **Step 3: `BrechaPage`** (`/deteccion/brecha`; mismos roles): selector de persona y puesto, y `TablaBrecha` con conocimiento, requerido, acreditado o «Sin acreditar», faltante y excluyente/deseable, más los dos contadores («Excluyentes cubiertos X de N», «Deseables cubiertos Y de M»). Una sección «Mi brecha» (`/deteccion/mi-brecha`; `docente`, `jefe_catedra`, `jefatura_departamento`) con la ocupación propia y las candidaturas aprobadas, que muestra además lo declarado. Textos que explican «sin acreditar» y por qué un conocimiento puede figurar sin poseedor mientras falten acreditaciones.
- [x] **Step 4: Rutas y menú**: entradas en `permisos.ts` («Detección» para los cuatro roles, «Mi brecha» para el docente) y enlace «Ver el detalle de mi brecha» en `MiSucesionPage`. Formularios con react-hook-form y zod donde haya.
- [x] **Step 5: Verificar**: `npm run lint`, `npm run format` y `npm run build` en `frontend`. Cargar el juego de datos (README) y recorrer los escenarios: RR. HH. ve K2 como único poseedor y exporta el CSV; una jefatura de C2 ve K1 y K4 y no el botón de CSV ni el tablero; el docente Eva ve su brecha con «Sin acreditar»; el horizonte cambia con 36 meses.
- [x] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "Agregar los listados de detección y la brecha de perfil"
```

---

### Task 10: Frontend: tablero de riesgo

**Files:**
- Create: `frontend/src/features/tablero/hooks/useTablero.ts`, `components/{TarjetaIndicador,GraficoPuntosUnicos,GraficoSinSucesor,GraficoRetiros,CalidadDeDatos,FiltrosTablero}.tsx`
- Modify: `frontend/src/features/tablero/pages/TableroPage.tsx`, `frontend/package.json` y `package-lock.json` (Recharts), `frontend/src/auth/permisos.ts`, `frontend/src/api/esquema.d.ts` (regenerado)

**Interfaces:**
- Consumes: `GET /deteccion/tablero` (Tarea 8). Produces: `useTablero(filtro: { idUnidad?: number; meses?: number })` y los componentes listados.

- [x] **Step 1: Instalar Recharts** (`npm install recharts` en `frontend`; reconstruir con `docker compose up --build`) y regenerar los tipos.
- [x] **Step 2: Reemplazar `TableroPage`** (hoy `PaginaEnConstruccion`; se conserva `EstadoServicios` en un pie). `FiltrosTablero`: selector de cátedra (con «Todo el departamento») y de plazo (24 por defecto), ambos en la URL. Cinco `TarjetaIndicador`, cada una con cifra principal, cifra secundaria si la hay (decisión 25), color **y** texto de estado (RNF06) y un enlace al listado con el mismo filtro y plazo. Tres gráficos de Recharts con la paleta del tema de MUI y etiquetas de texto: barras por cátedra, barras apiladas por motivo de RF18 y línea de retiros por semestre. `CalidadDeDatos`: tres barras de avance (criticidad evaluada, puestos críticos con plan aprobado, requisitos con nivel acreditado) y un aviso de que mientras no estén completas, los indicadores sobreestiman el riesgo. Ruta `/` visible para `recursos_humanos` y `autoridad`; los demás roles dejan de ver el tablero y su inicio queda en la primera sección que sí ven.
- [x] **Step 3: Verificar**: `npm run lint`, `npm run format` y `npm run build`. Con el juego de datos cargado, recorrer: las cinco tarjetas muestran 1 (+2 sin poseedor), 2 (+1 sin dotación), 5, 2 y 1; cada tarjeta lleva a su listado con el filtro; cambiar el plazo a 36 meses suma K3 al horizonte; filtrar por una cátedra recalcula todo; un tablero sin datos muestra estados vacíos; la autoridad lo ve y el jefe de cátedra no.
- [x] **Step 4: Commit**

```bash
git add frontend
git commit -m "Agregar el tablero de riesgo con tarjetas, gráficos y calidad de datos"
```

---

### Task 11: Documentación y cierre

**Files:**
- Modify: `docs/requerimientos.md`, `docs/superpowers/specs/2026-10-12-usuarios-roles-design.md`, `docs/superpowers/specs/2026-10-18-sucesion-planes-design.md`, `docs/superpowers/specs/2026-10-18-deteccion-tablero-design.md`, `README.md`, este plan

- [x] **Step 1: `docs/requerimientos.md`**: §5 agrega el párrafo **Detección** con la referencia a la spec, las siete vistas y las definiciones de poseedor y de sucesor preparado válido.
- [x] **Step 2: Matriz de roles de Usuarios**: `jefatura_departamento` y `jefe_catedra` leen los listados de detección y la brecha por alcance; `docente` lee `mi-brecha`; el tablero sigue siendo de `recursos_humanos` y `autoridad`.
- [x] **Step 3: Contrato de Sucesión**: el contrato de RF18 suma el filtro de candidato válido (decisión 7 de la spec); «Mi sucesión» enlaza a la brecha detallada.
- [x] **Step 4: Verificación final**: `npm run lint`, `npm run format`, `npm test` y `npm run test:integracion` en `backend`; `npm run lint`, `npm run format` y `npm run build` en `frontend`. Esperado: todo en verde. Aplicar `migration:run` sobre una base limpia (`docker compose down -v` y levantar), cargar el juego de datos y confirmar los resultados esperados de la spec en el tablero.
- [x] **Step 5: Estados**: la spec pasa a `Estado: Implementada` y este plan a `Estado: Implementado`, con el número del PR.
- [x] **Step 6: Commit**

```bash
git add docs README.md
git commit -m "Documentar la detección y el tablero y marcar la spec y el plan como implementados"
```
