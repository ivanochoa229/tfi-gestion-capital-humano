---
description: "Lista de tareas de Tablas de referencia (RF23)"
---

# Tasks: Tablas de referencia

**Input**: `specs/001-tablas-referencia/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Requerimientos cubiertos**: RF23, RNF03 (RNF01 y RF24 de forma provisoria, ver plan.md)

**Tests**: se incluyen tests de backend (vitest) porque la constitución (principio VIII) los exige para la lógica de servicios; el frontend no tiene tests y se valida con `quickstart.md`.

## Formato: `[ID] [P?] [Story] Descripción con ruta`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario del spec (US1 a US4)
- Todos los nombres de dominio y de código en español; snake_case en la base y camelCase en el código

## Phase 1: Setup

**Purpose**: configuración compartida

- [x] T001 Agregar la variable opcional `ADMIN_TOKEN` (`@IsOptional() @IsString()`) a la clase `Env` en `backend/src/infra/config/env.validation.ts`
- [x] T002 [P] Agregar `ADMIN_TOKEN=cambiame` con un comentario que indique que es provisorio hasta RF22 en `.env.example` (no hizo falta tocar `docker-compose.yml`: el backend ya recibe el `.env` por `env_file`)

---

## Phase 2: Foundational (bloquea todas las historias)

**Purpose**: tablas, valores iniciales, catálogo de dominios, guard y módulo

**⚠️ CRITICAL**: ninguna historia puede empezar antes de terminar esta fase

- [x] T003 Crear las clases base `ValorReferencia` (columnas `codigo` texto ≤40 obligatorio y único con formato `^[a-z][a-z0-9_]{1,39}$`, `denominacion` texto ≤100 obligatoria y única, `activo` booleano por defecto `true`) y `ValorReferenciaOrdinal` (agrega `orden` entero ≥ 1, obligatorio y único) en `backend/src/modules/referencia/entities/valor-referencia.base.ts`
- [x] T004 [P] Crear la entidad `NivelDominio` (tabla `nivel_dominio`, clave primaria generada `idNivelDominio` con columna `id_nivel_dominio`, extiende `ValorReferenciaOrdinal`) en `backend/src/modules/referencia/entities/nivel-dominio.entity.ts`
- [x] T005 [P] Crear la entidad `NivelCriticidad` (tabla `nivel_criticidad`, clave primaria generada `idNivelCriticidad` con columna `id_nivel_criticidad`, extiende `ValorReferenciaOrdinal`) en `backend/src/modules/referencia/entities/nivel-criticidad.entity.ts`
- [x] T006 [P] Crear la entidad `EstadoPreparacion` (tabla `estado_preparacion`, clave primaria generada `idEstadoPreparacion` con columna `id_estado_preparacion`, extiende `ValorReferenciaOrdinal`) en `backend/src/modules/referencia/entities/estado-preparacion.entity.ts`
- [x] T007 [P] Crear la entidad `TipoConocimiento` (tabla `tipo_conocimiento`, clave primaria generada `idTipoConocimiento` con columna `id_tipo_conocimiento`, extiende `ValorReferencia`) en `backend/src/modules/referencia/entities/tipo-conocimiento.entity.ts`
- [x] T008 [P] Crear la entidad `TipoResponsabilidad` (tabla `tipo_responsabilidad`, clave primaria generada `idTipoResponsabilidad` con columna `id_tipo_responsabilidad`, extiende `ValorReferencia`) en `backend/src/modules/referencia/entities/tipo-responsabilidad.entity.ts`
- [x] T009 [P] Crear la entidad `TipoRiesgo` (tabla `tipo_riesgo`, clave primaria generada `idTipoRiesgo` con columna `id_tipo_riesgo`, extiende `ValorReferencia`) en `backend/src/modules/referencia/entities/tipo-riesgo.entity.ts`
- [x] T010 [P] Crear la entidad `CaracterOcupacion` (tabla `caracter_ocupacion`, clave primaria generada `idCaracterOcupacion` con columna `id_caracter_ocupacion`, extiende `ValorReferencia`) en `backend/src/modules/referencia/entities/caracter-ocupacion.entity.ts`
- [x] T011 [P] Crear la entidad `TipoAccionTransferencia` (tabla `tipo_accion_transferencia`, clave primaria generada `idTipoAccionTransferencia` con columna `id_tipo_accion_transferencia`, extiende `ValorReferencia`) en `backend/src/modules/referencia/entities/tipo-accion-transferencia.entity.ts`
- [x] T012 [P] Crear la entidad `EstadoAccionTransferencia` (tabla `estado_accion_transferencia`, clave primaria generada `idEstadoAccionTransferencia` con columna `id_estado_accion_transferencia`, extiende `ValorReferencia`) en `backend/src/modules/referencia/entities/estado-accion-transferencia.entity.ts`
- [x] T013 [P] Crear la entidad `EstadoPlan` (tabla `estado_plan`, clave primaria generada `idEstadoPlan` con columna `id_estado_plan`, extiende `ValorReferencia`) en `backend/src/modules/referencia/entities/estado-plan.entity.ts`
- [x] T014 Crear el catálogo `DOMINIOS` (slug → entidad, tabla, ordinal; ordinales: `nivel-dominio`, `nivel-criticidad`, `estado-preparacion`) en `backend/src/modules/referencia/dominios.ts`
- [x] T015 [P] Test del catálogo: 10 dominios, slugs únicos, exactamente 3 ordinales, cada entidad extiende la base correcta, en `backend/src/modules/referencia/dominios.spec.ts`
- [x] T016 Generar y revisar a mano la migración que crea las diez tablas con sus restricciones de unicidad (`codigo`, `denominacion`, `orden` en ordinales) con `npm run migration:generate -- src/infra/database/migrations/CrearTablasReferencia` en `backend/src/infra/database/migrations/`
- [x] T017 Crear con `npm run migration:create` y escribir a mano la migración `CargarValoresReferencia` con `INSERT … ON CONFLICT (codigo) DO NOTHING` de los valores iniciales exactos de `data-model.md` (nivel_dominio: basico, intermedio, avanzado, experto; nivel_criticidad: baja, media, alta; estado_preparacion: en_desarrollo, mediano_plazo, listo_ahora; los siete dominios restantes según la lista); su `down` borra solo esos códigos, en `backend/src/infra/database/migrations/`
- [x] T018 [P] Crear `AdminProvisorioGuard` (exige el encabezado `x-admin-token` igual a `ADMIN_TOKEN`; 403 si falta, es inválido o `ADMIN_TOKEN` no está definida) en `backend/src/common/guards/admin-provisorio.guard.ts`
- [x] T019 [P] Test del guard (token correcto, incorrecto, ausente, variable sin definir) en `backend/src/common/guards/admin-provisorio.guard.spec.ts`
- [x] T020 Registrar las diez entidades con `TypeOrmModule.forFeature` y exportar `ReferenciaService` en `backend/src/modules/referencia/referencia.module.ts`; asegurar que `DatabaseModule` las incluya (autoload o listado) en `backend/src/infra/database/database.module.ts`
- [x] T021 Aplicar las migraciones (`npm run migration:run`) y verificar que las diez tablas existen y están pobladas; ejecutar `npm run migration:revert` dos veces y volver a aplicar

**Checkpoint**: base lista; las historias pueden comenzar.

---

## Phase 3: User Story 1 - Consultar los dominios con sus valores iniciales (P1) 🎯 MVP

**Goal**: listar los diez dominios y los valores de cada uno.

**Independent Test**: con base nueva, `GET /api/referencia` devuelve 10 dominios y `GET /api/referencia/nivel-dominio` devuelve 4 valores ordenados (quickstart escenario 1).

- [x] T022 [P] [US1] DTOs de respuesta `DominioDto` (`dominio`, `denominacion`, `ordinal`) y `ValorReferenciaDto` (`id`, `codigo`, `denominacion`, `activo`, `orden?`, `enUso`) con `@ApiProperty` en `backend/src/modules/referencia/dto/dominio.dto.ts` y `backend/src/modules/referencia/dto/valor-referencia.dto.ts`
- [x] T023 [P] [US1] Test del servicio: listar dominios; listar valores solo activos por defecto y con `incluirInactivos`; orden por `orden` en ordinales y por denominación en el resto; 404 ante dominio inexistente, en `backend/src/modules/referencia/referencia.service.spec.ts`
- [x] T024 [US1] Implementar `ReferenciaService.listarDominios()` y `listarValores(dominio, incluirInactivos)` (repositorio resuelto con `DOMINIOS`) en `backend/src/modules/referencia/referencia.service.ts`
- [x] T025 [US1] Implementar `GET /api/referencia` y `GET /api/referencia/:dominio?incluirInactivos` con `@ApiTags('referencia')` y `@ApiOkResponse` en `backend/src/modules/referencia/referencia.controller.ts`; registrarlo en `referencia.module.ts`
- [x] T026 [P] [US1] Hook `useDominiosReferencia` y `useValoresReferencia(dominio, incluirInactivos)` con TanStack Query en `frontend/src/features/admin/hooks/useValoresReferencia.ts`
- [x] T027 [P] [US1] Componente `TablaReferencia` (MUI Table: código, denominación, orden si ordinal, estado) en `frontend/src/features/admin/components/TablaReferencia.tsx`
- [x] T028 [US1] Reemplazar el placeholder de `frontend/src/features/admin/pages/AdminPage.tsx` por una sección con una pestaña (MUI Tabs) por dominio que muestre `TablaReferencia`, con estados de carga y error en español
- [x] T029 [US1] Regenerar tipos con `npm run api:tipos` (backend corriendo) y verificar que `frontend/src/api/esquema.d.ts` incluye las rutas de referencia

**Checkpoint**: US1 funcional y demostrable (MVP).

---

## Phase 4: User Story 2 - Agregar y modificar valores (P2)

**Goal**: el administrador crea valores y cambia denominaciones.

**Independent Test**: quickstart escenario 2 (alta 201, código repetido 409, ordinal sin `orden` 400, sin token 403, PATCH reflejado).

- [x] T030 [P] [US2] DTOs `CrearValorDto` (`codigo` con `@Matches(/^[a-z][a-z0-9_]{1,39}$/)`, `denominacion` ≤100, `orden?`) y `ActualizarValorDto` (`codigo?`, `denominacion?`, `orden?`, `activo?`) con `@ApiProperty` en `backend/src/modules/referencia/dto/crear-valor.dto.ts` y `backend/src/modules/referencia/dto/actualizar-valor.dto.ts`
- [x] T031 [US2] Test del servicio: crear (código duplicado 409, denominación duplicada 409, `orden` faltante en ordinal 400, `orden` presente en no ordinal 400, orden repetido 409) y actualizar (denominación, 404 si no existe) en `backend/src/modules/referencia/referencia.service.spec.ts`
- [x] T032 [US2] Implementar `crear` y `actualizar` en `backend/src/modules/referencia/referencia.service.ts`, traduciendo violaciones de unicidad (código `23505`) a 409 con mensajes en español
- [x] T033 [US2] Implementar `POST /api/referencia/:dominio` y `PATCH /api/referencia/:dominio/:id` protegidos con `AdminProvisorioGuard`, con `@ApiForbiddenResponse` y `@ApiConflictResponse`, en `backend/src/modules/referencia/referencia.controller.ts`
- [x] T034 [P] [US2] Hook `useGuardarValor` (mutaciones crear y actualizar que invalidan `useValoresReferencia`; envía `x-admin-token` desde `sessionStorage`) en `frontend/src/features/admin/hooks/useGuardarValor.ts`
- [x] T035 [P] [US2] `FormularioValor` (react-hook-form + zod: código con el mismo formato, denominación ≤100, orden entero ≥ 1 solo si el dominio es ordinal) en un diálogo MUI, en `frontend/src/features/admin/components/FormularioValor.tsx`
- [x] T036 [US2] Agregar botones «Nuevo» y «Editar» a `TablaReferencia`, un campo para ingresar el token provisorio (guardado en `sessionStorage`) y mostrar los errores 400/403/409 del backend en español en `frontend/src/features/admin/components/TablaReferencia.tsx` y `frontend/src/features/admin/pages/AdminPage.tsx`
- [x] T037 [US2] Regenerar tipos con `npm run api:tipos` en `frontend/src/api/esquema.d.ts`

**Checkpoint**: US1 y US2 funcionan.

---

## Phase 5: User Story 3 - Desactivar en lugar de borrar valores en uso (P2)

**Goal**: impedir el borrado de valores en uso y permitir desactivar/reactivar.

**Independent Test**: quickstart escenario 3.

- [x] T038 [US3] Test del servicio: `DELETE` de valor en uso → 409 con sugerencia de desactivar; sin uso → borra; cambio de código de valor en uso → 409; `activo:false` y reactivación; `advertencia` al desactivar el último valor activo; `validarActivo` rechaza un valor inactivo, en `backend/src/modules/referencia/referencia.service.spec.ts`
- [x] T039 [US3] Implementar la detección de uso en `backend/src/modules/referencia/referencia.service.ts`: consultar `pg_constraint` por las claves foráneas que apuntan a la tabla del dominio y contar filas que referencian el valor; exponer `enUso` en el listado
- [x] T040 [US3] Implementar `eliminar`, la regla de código inmutable si está en uso, la `advertencia` al desactivar el último activo y `validarActivo(dominio, id)` exportado para otros módulos en `backend/src/modules/referencia/referencia.service.ts`; traducir el error `23503` a 409
- [x] T041 [US3] Implementar `DELETE /api/referencia/:dominio/:id` (204) protegido con `AdminProvisorioGuard` en `backend/src/modules/referencia/referencia.controller.ts`
- [x] T042 [US3] Agregar a `TablaReferencia` el interruptor activar/desactivar, la opción «Mostrar inactivos», el botón «Borrar» con confirmación MUI (sin usar `window.confirm`) y la advertencia de último valor activo; extender `useGuardarValor.ts` con la mutación de borrado en `frontend/src/features/admin/components/TablaReferencia.tsx` y `frontend/src/features/admin/hooks/useGuardarValor.ts`
- [x] T043 [US3] Regenerar tipos con `npm run api:tipos` en `frontend/src/api/esquema.d.ts`

**Checkpoint**: US1 a US3 funcionan.

---

## Phase 6: User Story 4 - Reordenar valores ordinales (P3)

**Goal**: ajustar el `orden` de los valores de un dominio ordinal.

**Independent Test**: quickstart escenario 4.

- [x] T044 [US4] Test del servicio: PATCH de `orden` a un valor libre actualiza la secuencia; a uno ya usado → 409; `orden` en dominio no ordinal → 400, en `backend/src/modules/referencia/referencia.service.spec.ts`
- [x] T045 [US4] Ajustar `actualizar` en `backend/src/modules/referencia/referencia.service.ts` para validar `orden` según la regla del dominio y traducir la unicidad de `orden` a 409
- [x] T046 [US4] Permitir editar `orden` en `FormularioValor` solo en dominios ordinales y mostrar la tabla ordenada por `orden` en `frontend/src/features/admin/components/FormularioValor.tsx` y `frontend/src/features/admin/components/TablaReferencia.tsx`

---

## Phase 7: Polish


- [x] T047 Recorrer los seis escenarios de `specs/001-tablas-referencia/quickstart.md` y anotar los resultados
- [x] T048 `npm run lint`, `npm run format` y `npm test` en `backend/`; `npm run lint`, `npm run format` y `npm run build` en `frontend/`
- [x] T049 [P] Confirmar que `README.md` documenta `ADMIN_TOKEN` y la sección de administración, y agregar una nota en `docs/requerimientos.md` si cambia algún supuesto

---

## Dependencies & Execution Order

- Setup → Foundational → US1 → (US2, US3 en cualquier orden) → US4 → Polish.
- US2, US3 y US4 dependen de `referencia.service.ts` y `referencia.controller.ts` de US1, por lo que **no** son paralelas entre sí en el backend (mismo archivo); sí lo son sus partes de frontend una vez regenerados los tipos.
- US4 depende de la lógica de `actualizar` de US2.

## Parallel Opportunities

- Fase 2: las diez entidades, el guard y su test en paralelo.
- US1: DTOs, hooks y `TablaReferencia` en paralelo; US2: DTOs, `useGuardarValor` y `FormularioValor`.

## Implementation Strategy

1. **MVP**: Setup + Foundational + US1 (consulta con valores iniciales, lo que desbloquea al resto de los módulos).
2. Luego US2 y US3 (mantenimiento y desactivación), finalmente US4.
3. Validar con `quickstart.md` al cierre de cada historia.
