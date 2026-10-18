Estado: Pendiente | Fecha: 2026-10-18 | PR: —

# Sucesión: planes, candidatos y acciones de transferencia: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** que la jefatura elabore planes de sucesión por puesto con candidatos, que la autoridad los apruebe, que RR. HH. registre acciones de transferencia que su responsable actualiza, y que el sistema informe qué puestos críticos no tienen plan aprobado (RF13, RF14, RF15, RF24, RNF05; apoya OE7 y OE8).

**Arquitectura:** el módulo `sucesion` suma tres tablas (`plan_sucesion`, `candidato_sucesion`, `accion_transferencia`) y el valor `cerrado` de `estado_plan`. Cuatro servicios: `PlanesService` (circuito y versiones, bajo el bloqueo 7004), `CandidatosService` (alta, seguimiento, orden; mismo bloqueo), `AccionesService` (bajo el bloqueo de conocimiento 7003, para no cruzarse con una fusión) y `CoberturaService` (cobertura de OE7 y «mis planes», por SQL). El alcance reutiliza `AlcanceService`; la auditoría ya cubre `plan_sucesion` y `candidato_sucesion` y exige `save()`. La fusión de conocimientos pasa a mover también las acciones.

**Tech Stack:** NestJS 12, TypeORM 0.3, PostgreSQL 16, class-validator, vitest, React 19, MUI, TanStack Query, react-hook-form, zod.

**Spec:** `docs/superpowers/specs/2026-10-18-sucesion-planes-design.md`. Antes de empezar, leer también `docs/requerimientos.md` §5 a §7 y las specs de Usuarios (matriz de roles), Conocimiento (acreditación y fusión) y Criticidad (contrato para Sucesión). El plan de Criticidad (`2026-10-16-criticidad-evaluacion.md`) es el modelo de estilo y de pruebas.

## Global Constraints

- Nombres de dominio y de código en español; snake_case en la base y camelCase en el código (`SnakeNamingStrategy`).
- Imports ESM con extensión `.js`.
- `synchronize` desactivado: el esquema cambia solo por migraciones, escritas o revisadas a mano. Si `migration:generate` propone algo ajeno al bloque (por ejemplo `DROP INDEX "IDX_persona_apellido_nombre"` o el borrado de los índices parciales y de la restricción `DEFERRABLE` de este bloque, que TypeORM no conoce), se borra de la migración.
- Fechas de negocio como cadenas `AAAA-MM-DD`. «Hoy» es siempre `CURRENT_DATE` de la base (`hoyDeLaBase` de `personas/fechas.ts`). En SQL crudo, las columnas `date` se devuelven con `::text`.
- Estados de plan: `borrador` → `pendiente_aprobacion` → `aprobado` o `rechazado`; `rechazado` → `borrador`; `cerrado` es final y se alcanza desde `borrador`, `rechazado` o `aprobado`. Estados de acción: `pendiente` → `en_curso` → `completada`; `pendiente` o `en_curso` → `cancelada`; los dos últimos son finales. Las transiciones viven en el código, por código de estado (`codigo`), nunca por id.
- Como mucho un plan `aprobado` y uno en elaboración (`borrador` o `pendiente_aprobacion`) por puesto. Aprobar una versión nueva cierra la anterior en la misma transacción.
- Solo `autoridad` aprueba o rechaza; rechazar exige `motivo`. Se guarda `id_usuario_resolucion` (no persona) y `fecha_resolucion`.
- En un plan `aprobado` no se agregan ni quitan candidatos, no cambia la prioridad ni el responsable; sí se edita el seguimiento (`idEstadoPreparacion`, `fechaDisponibilidadEstimada`, `observaciones`).
- Presentar exige al menos un candidato (409).
- Candidato: persona activa con ocupación vigente en cualquier puesto, que no sea ocupante vigente del puesto del plan; una vez por plan. Prioridad entera ≥ 1, única por plan (`DEFERRABLE INITIALLY IMMEDIATE`). Plazo: `fecha_disponibilidad_estimada`.
- «Sucesor preparado» (contrato para Detección): candidato de un plan `aprobado` cuyo `conocimiento_persona.id_nivel_acreditado` (por `orden` de `nivel_dominio`) alcanza, en **cada** requisito excluyente del puesto, el nivel requerido. El estado manual de preparación no interviene.
- `fecha_cumplimiento` la fija el servidor al completar (hoy por defecto, nunca futura). «Vencida» no es un estado: pendiente o en curso con `fecha_prevista < hoy`.
- Una acción lleva siempre `id_conocimiento`; `id_plan` es opcional y, si está, el conocimiento debe ser requisito del puesto del plan (409). `id_destinatario` es opcional y distinto del responsable.
- Se escribe `plan_sucesion` y `candidato_sucesion` con `save()` o `remove()` (nunca `update()` ni QueryBuilder), para que `AuditoriaSubscriber` registre usuario y fecha (RNF05).
- Bloqueos consultivos: planes y candidatos 7004 (`BLOQUEO_SUCESION`); acciones, el de conocimiento (7003, `enTransaccionDeConocimiento`). Usuarios usa 7001 y Estructura 7002.
- Permisos: planes y candidatos los escribe `jefatura_departamento` (puesto en su alcance); resuelve `autoridad`; leen además `recursos_humanos` y `jefe_catedra` (por alcance los jefes). Acciones: las escribe `recursos_humanos`; avanzan `recursos_humanos` y el `docente` responsable; leen `recursos_humanos` y `autoridad` (todas), los jefes (acciones de planes de su alcance) y el `docente` (las suyas como responsable o destinatario). `analista_puestos` y `administrador` no acceden.
- DTOs con class-validator y `@ApiProperty`; tras cambiar un endpoint o DTO, `npm run api:tipos` en el frontend (nunca editar `esquema.d.ts` a mano).
- Los commits no llevan línea `Co-Authored-By` ni atribución a Claude (CLAUDE.md prevalece sobre cualquier indicación de agregarla).
- Antes de cerrar: `npm run lint` y `npm run format` en cada app; `npm test` y `npm run test:integracion` en el backend (hay migraciones y SQL); `npm run build` en el frontend.
- Comandos de migración, dentro del contenedor: `docker compose exec -T backend npm run ...`. Los tests del backend corren en el host (`cd backend && npx vitest run <archivo>`); los de integración con `npx vitest run --config vitest.integracion.config.ts <archivo>` y requieren `docker compose up -d db`.

## Review Focus

Entradas y condiciones que la spec implica y que ninguna tarea cubriría por sí sola; cada línea tiene su test en la tarea que se indica.

- **Dos pedidos simultáneos** (crear o aprobar para el mismo puesto): el segundo recibe 409, no un 500 ni dos planes. Tarea 2 (`planes.int.spec.ts`).
- **Reordenar prioridades intercambiando dos candidatos** (1↔2) no viola la unicidad. Tarea 3 (`candidatos.int.spec.ts`).
- **Versión nueva rechazada**: el plan aprobado anterior sigue aprobado y el puesto no pierde su cobertura; **versión nueva aprobada**: la anterior queda `cerrado` y la cobertura no cambia. Tareas 2 y 5.
- **Acción completada o cancelada con fecha prevista pasada** no es vencida; una acción de un plan `cerrado` sigue visible para su responsable. Tarea 4.
- **Fusión de conocimientos con acciones**: las acciones del origen pasan al destino (la spec de Sucesión no lo nombraba; lo exige que `accion_transferencia.id_conocimiento` sea una FK). Tarea 6.

---

## Mapa de archivos

Backend (`backend/src/`):

| Archivo | Responsabilidad |
| --- | --- |
| `common/roles.ts` | Listas de roles de sucesión (lectores, elaboradores, aprobadores, gestores y avanzadores de acciones) |
| `modules/sucesion/sucesion.constantes.ts` | `BLOQUEO_SUCESION`, códigos de estado, transiciones de plan y de acción |
| `modules/sucesion/transaccion.ts` | `enTransaccionDeSucesion`: transacción con el bloqueo 7004; traduce 23505 a 409 |
| `modules/sucesion/entities/plan-sucesion.entity.ts`, `candidato-sucesion.entity.ts`, `accion-transferencia.entity.ts` | Entidades |
| `infra/database/migrations/*` | Cuatro migraciones: valor `cerrado`, plan, candidato, acción |
| `modules/sucesion/dto/plan.dto.ts`, `candidato.dto.ts`, `accion.dto.ts`, `cobertura.dto.ts` | DTOs de entrada y salida |
| `modules/sucesion/sucesion.mapper.ts` | Entidad o fila SQL → DTO |
| `modules/sucesion/planes.service.ts`, `planes.controller.ts` | Circuito del plan, listado y detalle |
| `modules/sucesion/candidatos.sql.ts`, `candidatos.service.ts`, `candidatos.controller.ts` | Candidatos con preparación calculada |
| `modules/sucesion/acciones.service.ts`, `acciones.controller.ts` | Acciones de transferencia |
| `modules/sucesion/cobertura.sql.ts`, `cobertura.service.ts`, `sucesion.controller.ts` | Cobertura de OE7 y `mis-planes` |
| `modules/sucesion/sucesion.module.ts` | Registro |
| `modules/conocimiento/fusion.sql.ts`, `conocimientos.service.ts`, `dto/catalogo.dto.ts` | Paso de fusión y contador de acciones |

Frontend (`frontend/src/`):

| Archivo | Responsabilidad |
| --- | --- |
| `features/sucesion/hooks/useSucesion.ts` | Cobertura, planes, candidatos, acciones, mis planes y mutaciones |
| `features/sucesion/pages/SucesionPage.tsx` | Cobertura de OE7 y tabla de puestos críticos y planes |
| `features/sucesion/pages/PlanPage.tsx`, `components/*` | Detalle del plan y sus diálogos |
| `features/sucesion/pages/AccionesPage.tsx`, `MiSucesionPage.tsx` | Acciones y vista del docente |
| `router.tsx`, `auth/permisos.ts` | Rutas y menú |
| `features/conocimiento/components/FusionarDialog.tsx` | Muestra las acciones movidas |

---

### Task 1: Esquema, entidades, roles y constantes

**Files:**
- Create: `backend/src/infra/database/migrations/1792280000000-AgregarEstadoPlanCerrado.ts`, `1792280001000-CrearPlanSucesion.ts`, `1792280002000-CrearCandidatoSucesion.ts`, `1792280003000-CrearAccionTransferencia.ts`
- Create: `backend/src/modules/sucesion/entities/{plan-sucesion,candidato-sucesion,accion-transferencia}.entity.ts`, `sucesion.constantes.ts`, `transaccion.ts`
- Modify: `backend/src/common/roles.ts`
- Test: `backend/src/modules/sucesion/sucesion.esquema.int.spec.ts`, `sucesion.constantes.spec.ts`

**Interfaces:**
- Produces (`sucesion.constantes.ts`): `BLOQUEO_SUCESION = 7004`; `ESTADO_PLAN` y `ESTADO_ACCION` (objetos `as const` con los códigos); `TRANSICIONES_PLAN` y `TRANSICIONES_ACCION: Record<string, readonly string[]>`; `puedePasar(transiciones, desde: string, hasta: string): boolean`.
- Produces (`transaccion.ts`): `enTransaccionDeSucesion<T>(repositorio: { manager: EntityManager }, trabajo: (manager: EntityManager) => Promise<T>): Promise<T>`; toma `pg_advisory_xact_lock(BLOQUEO_SUCESION)` y convierte `23505` en `ConflictException`.
- Produces (`roles.ts`): `ROLES_LECTORES_DE_SUCESION` (RR. HH., autoridad, jefatura, jefe de cátedra), `ROLES_ELABORADORES_DE_PLANES` (jefatura), `ROLES_APROBADORES_DE_PLANES` (autoridad), `ROLES_GESTORES_DE_ACCIONES` (RR. HH.), `ROLES_LECTORES_DE_ACCIONES` (los lectores y docente), `ROLES_AVANZADORES_DE_ACCIONES` (RR. HH. y docente).
- Produces (entidades): `PlanSucesion` (`id`, `idPuesto`, `idResponsable`, `idEstadoPlan`, `fechaElaboracion`, `idPlanAnterior`, `idUsuarioResolucion`, `fechaResolucion`, `motivoResolucion`, `observaciones`, con relaciones `puesto`, `responsable`, `estadoPlan`), `CandidatoSucesion` (clave `idPlan` + `idPersona`; `idEstadoPreparacion`, `prioridad`, `fechaDisponibilidadEstimada`, `observaciones`), `AccionTransferencia` (`id`, `idTipoAccion`, `idConocimiento`, `idPlan`, `idResponsable`, `idDestinatario`, `descripcion`, `fechaPrevista`, `fechaCumplimiento`, `idEstadoAccion`, `notaAvance`, `registradaEn`, `actualizadaEn`).

- [ ] **Step 1: Escribir los tests del esquema (fallan)** en `sucesion.esquema.int.spec.ts`, con `crearBaseTemporal()` como `evaluacion.esquema.int.spec.ts`:
  - `it('estado_plan tiene el valor cerrado')`: `SELECT 1 FROM estado_plan WHERE codigo = 'cerrado'` devuelve una fila.
  - `it('rechaza dos planes aprobados del mismo puesto')` y `it('rechaza dos planes en elaboración del mismo puesto')`: el segundo `INSERT` falla con código `23505`; un aprobado más uno en borrador del mismo puesto sí entra; un `cerrado` o `rechazado` extra también.
  - `it('exige usuario y fecha de resolución juntos')`: `id_usuario_resolucion` sin `fecha_resolucion` falla con `23514`.
  - `it('la prioridad es única por plan pero permite intercambiar dentro de una transacción')`: dos candidatos con prioridad 1 en el mismo plan fallan con `23505`; con `SET CONSTRAINTS ALL DEFERRED` el intercambio 1↔2 en una transacción se confirma.
  - `it('prioridad mínima 1')`: prioridad 0 falla con `23514`.
  - `it('fecha_cumplimiento solo con estado completada')`: completada sin fecha, y pendiente con fecha, fallan con `23514`; completada con fecha de hoy entra; fecha futura falla.
  - `it('el destinatario no puede ser el responsable')`: falla con `23514`.
  - `it('una acción puede existir sin plan')`: `id_plan` nulo entra.
  Y `sucesion.constantes.spec.ts`: `puedePasar(TRANSICIONES_PLAN, 'borrador', 'pendiente_aprobacion')` es `true`; `('aprobado', 'borrador')`, `('cerrado', 'borrador')` y `('pendiente_aprobacion', 'cerrado')` son `false`; `('aprobado', 'cerrado')` y `('rechazado', 'cerrado')` son `true`; en acciones, `('completada', 'en_curso')` es `false` y `('en_curso', 'cancelada')` es `true`.

- [ ] **Step 2: Correr los tests y ver que fallan** (`npx vitest run src/modules/sucesion/sucesion.constantes.spec.ts` y el de integración). Esperado: FAIL por archivos o tablas inexistentes.

- [ ] **Step 3: Escribir `sucesion.constantes.ts`, `transaccion.ts` (patrón de `modules/estructura/transaccion.ts`) y las listas de `common/roles.ts`** con las firmas de Interfaces y los valores de Global Constraints.

- [ ] **Step 4: Escribir las tres entidades** siguiendo `evaluacion-criticidad.entity.ts` (columnas con `name` explícito para las FK, `Relation<>` en las relaciones, `@Check` para los CHECKs que no dependen de ids). Columnas y nulabilidad según la spec, secciones «Modelo de datos». `CandidatoSucesion` usa dos `@PrimaryColumn`. Comentar en cada entidad que se audita (solo `plan_sucesion` y `candidato_sucesion`) y que los índices parciales, la restricción `DEFERRABLE` y los CHECKs que usan el id de un estado viven solo en la migración.

- [ ] **Step 5: Escribir las cuatro migraciones a mano** (`migration:create`), en este orden:
  1. Inserta `('cerrado', 'Cerrado')` en `estado_plan`; `down` lo borra.
  2. Crea `plan_sucesion` con FK y el CHECK `CK_plan_sucesion_resolucion` (`(id_usuario_resolucion IS NULL) = (fecha_resolucion IS NULL)`). Los dos índices únicos parciales sobre `id_puesto` (`UQ_plan_sucesion_aprobado`, `UQ_plan_sucesion_en_elaboracion`) leen primero los ids de `aprobado`, `borrador` y `pendiente_aprobacion` con `SELECT` e interpolan esos números en el `WHERE`, porque un índice parcial no puede consultar otra tabla.
  3. Crea `candidato_sucesion` con CHECK `prioridad >= 1` y `CONSTRAINT "UQ_candidato_sucesion_prioridad" UNIQUE ("id_plan", "prioridad") DEFERRABLE INITIALLY IMMEDIATE`.
  4. Crea `accion_transferencia` con los CHECKs `CK_accion_cumplimiento_fecha_no_futura`, `CK_accion_destinatario_distinto` y `CK_accion_cumplimiento_estado` (`(fecha_cumplimiento IS NOT NULL) = (id_estado_accion = <id de completada>)`, leído por código como en la migración 2); índices por `id_responsable`, `id_destinatario`, `id_plan` e `id_conocimiento`.
  Cada `down` deshace lo suyo.

- [ ] **Step 6: Correr migraciones y tests**: `docker compose exec -T backend npm run migration:run`, `npx vitest run src/modules/sucesion/sucesion.constantes.spec.ts` y el de integración. Esperado: PASS. Verificar con `migration:generate -- src/infra/database/migrations/Tmp` que el único cambio propuesto son los objetos que TypeORM no conoce (se descarta el archivo temporal).

- [ ] **Step 7: Commit**

```bash
git add backend/src
git commit -m "Crear el esquema de planes, candidatos y acciones de sucesión"
```

---

### Task 2: Planes: circuito de aprobación y versiones

**Files:**
- Create: `backend/src/modules/sucesion/dto/plan.dto.ts`, `sucesion.mapper.ts`, `planes.service.ts`, `planes.controller.ts`
- Modify: `backend/src/modules/sucesion/sucesion.module.ts`
- Test: `planes.service.spec.ts`, `plan.dto.spec.ts`, `planes.int.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`PlanSucesion`, `CandidatoSucesion`, `ESTADO_PLAN`, `TRANSICIONES_PLAN`, `puedePasar`, `enTransaccionDeSucesion`, listas de roles).
- Produces (DTOs): `CrearPlanDto {idPuesto: number; idResponsable: number; observaciones?: string}`, `EditarPlanDto {idResponsable?: number; observaciones?: string}`, `ResolverPlanDto {decision: 'aprobar' | 'rechazar'; motivo?: string}`, `FiltroPlanesDto {idPuesto?; idUnidad?; estado?: string}`, `PlanDto {id, idPuesto, codigoPuesto, denominacionPuesto, idUnidad, idResponsable, nombreResponsable, estado: string (codigo), fechaElaboracion, idPlanAnterior: number | null, nombreUsuarioResolucion: string | null, fechaResolucion: string | null, motivoResolucion: string | null, observaciones: string | null, cantidadCandidatos: number}`.
- Produces (`PlanesService`): `crear(dto: CrearPlanDto, sesion: SesionUsuario): Promise<PlanDto>`, `editar(id: number, dto: EditarPlanDto, sesion): Promise<PlanDto>`, `presentar(id, sesion)`, `resolver(id, dto: ResolverPlanDto, sesion)`, `reabrir(id, sesion)`, `nuevaVersion(id, sesion)`, `cerrar(id, sesion)`, `listar(filtro: FiltroPlanesDto, sesion): Promise<PlanDto[]>`, `buscar(id, sesion): Promise<PlanDto>` (404 si no existe; 403 fuera de alcance). Todos devuelven el plan resultante.

- [ ] **Step 1: Escribir los tests unitarios (fallan)** en `planes.service.spec.ts` (repositorios simulados con `vi.fn`, como `evaluaciones.service.spec.ts`):
  - `crear`: puesto inexistente → `NotFoundException`; puesto de baja → `BadRequestException`; responsable inexistente o inactivo → `BadRequestException`; puesto con plan en elaboración → `ConflictException`; puesto con plan aprobado → `ConflictException` con mensaje que menciona «nueva versión»; fuera de alcance → `ForbiddenException`; caso feliz crea en `borrador` con `fechaElaboracion` de hoy y guarda con `save()`.
  - `editar`: fuera de `borrador` → 409.
  - `presentar`: sin candidatos → 409; con candidatos pasa a `pendiente_aprobacion`.
  - `resolver`: aprobar guarda `idUsuarioResolucion = sesion.id` y `fechaResolucion`; rechazar sin motivo → `BadRequestException`; desde otro estado que `pendiente_aprobacion` → 409; aprobar una versión cuyo `idPlanAnterior` apunta a un plan aprobado guarda ese plan como `cerrado` en la misma transacción.
  - `reabrir`: solo desde `rechazado`. `nuevaVersion`: solo desde `aprobado`; 409 si ya hay plan en elaboración; la copia lleva responsable, observaciones, `idPlanAnterior` y los candidatos. `cerrar`: válido desde `borrador`, `rechazado` y `aprobado`; 409 desde `pendiente_aprobacion` y `cerrado`.
  - `plan.dto.spec.ts`: `ResolverPlanDto` rechaza una `decision` distinta de `aprobar` o `rechazar`; el DTO de creación rechaza `estado` (whitelist con `forbidNonWhitelisted`).

- [ ] **Step 2: Correr los tests y ver que fallan** (`npx vitest run src/modules/sucesion/planes.service.spec.ts`). Esperado: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar los DTOs, `aPlanDto` en `sucesion.mapper.ts` y `PlanesService`** con las firmas de Interfaces. Toda escritura va en `enTransaccionDeSucesion` y usa `save()`. Los estados se leen por `codigo` desde `EstadoPlan`; las transiciones se validan con `puedePasar`. Alcance: `AlcanceService.exigirUnidad(sesion, puesto.idUnidad)` en las operaciones de la jefatura; `resolver` solo exige el rol. `listar` filtra por `AlcanceService.unidadesVisibles`.

- [ ] **Step 4: Implementar `PlanesController`** (`@ApiTags('sucesion')`, ruta `planes`) con `@Roles` y las respuestas de Swagger según la tabla de la spec: `GET /planes` y `GET /planes/:id` (lectores), `POST /planes`, `PATCH /planes/:id`, `POST /planes/:id/presentar`, `/reabrir`, `/nueva-version`, `/cerrar` (elaboradores), `POST /planes/:id/resolver` (aprobadores). Registrar controller y servicio en `SucesionModule` (importar `TypeOrmModule.forFeature`, `ReferenciaModule` y `UsuariosModule` como `CriticidadModule`).

- [ ] **Step 5: Correr los tests unitarios.** Esperado: PASS.

- [ ] **Step 6: Escribir `planes.int.spec.ts` (PostgreSQL real)** y correrlo:
  - Circuito completo: crear → agregar un candidato por SQL → presentar → aprobar; cada paso deja una fila en `auditoria` (`entidad = 'plan_sucesion'`), con el usuario de la sesión.
  - **Versión nueva aprobada**: tras aprobarla, el plan anterior está `cerrado` y la nueva `aprobado`; **versión nueva rechazada**: el anterior sigue `aprobado`.
  - **Pedidos simultáneos**: dos `crear` en paralelo para el mismo puesto con `Promise.allSettled` → uno cumple y el otro es `ConflictException`; igual con dos `resolver` aprobando dos versiones.
  - Alcance con la consulta recursiva real: la jefatura de otra unidad recibe 403.

- [ ] **Step 7: Commit**

```bash
git add backend/src
git commit -m "Implementar el circuito de aprobación de planes de sucesión"
```

---

### Task 3: Candidatos con preparación calculada

**Files:**
- Create: `backend/src/modules/sucesion/dto/candidato.dto.ts`, `candidatos.sql.ts`, `candidatos.service.ts`, `candidatos.controller.ts`
- Modify: `sucesion.module.ts`, `sucesion.mapper.ts`
- Test: `candidatos.service.spec.ts`, `candidato.dto.spec.ts`, `candidatos.int.spec.ts`

**Interfaces:**
- Consumes: Task 2 (`PlanSucesion`, `ESTADO_PLAN`, `enTransaccionDeSucesion`).
- Produces (DTOs): `AgregarCandidatoDto {idPersona: number; prioridad: number; idEstadoPreparacion: number; fechaDisponibilidadEstimada?: string; observaciones?: string}`, `SeguimientoCandidatoDto {idEstadoPreparacion?; fechaDisponibilidadEstimada?: string | null; observaciones?}`, `OrdenCandidatosDto {orden: number[]}` (ids de persona en la prioridad nueva), `CandidatoDto {idPlan, idPersona, apellido, nombre, estadoPreparacion: string (codigo), prioridad, fechaDisponibilidadEstimada: string | null, observaciones: string | null, excluyentesSinCubrir: number, totalExcluyentes: number, discrepancia: boolean, aRevisar: boolean}`.
- Produces (`CandidatosService`): `agregar(idPlan: number, dto: AgregarCandidatoDto, sesion): Promise<CandidatoDto>`, `seguimiento(idPlan, idPersona, dto: SeguimientoCandidatoDto, sesion): Promise<CandidatoDto>`, `reordenar(idPlan, dto: OrdenCandidatosDto, sesion): Promise<CandidatoDto[]>`, `quitar(idPlan, idPersona, sesion): Promise<void>`, `listarDePlan(idPlan: number): Promise<CandidatoDto[]>` (ordenados por prioridad, sin validar alcance: lo valida quien lo llama).
- Produces (`candidatos.sql.ts`): `SQL_CANDIDATOS_DEL_PLAN` (parámetro `$1` = id del plan) con `excluyentes_sin_cubrir`, `total_excluyentes` y `a_revisar`.

- [ ] **Step 1: Escribir los tests unitarios (fallan)** en `candidatos.service.spec.ts`:
  - `agregar`: plan fuera de `borrador` → 409; persona inactiva o sin ocupación vigente → `BadRequestException`; ocupante vigente del puesto → 409; ya candidata del plan → 409; estado de preparación inexistente o inactivo → 400; fuera de alcance → 403; caso feliz guarda con `save()`.
  - `seguimiento`: en `borrador` y `aprobado` funciona; en `pendiente_aprobacion`, `rechazado` o `cerrado` → 409; candidato inexistente → 404.
  - `quitar` y `reordenar`: solo en `borrador`; `orden` con ids repetidos, faltantes o ajenos al plan → 400.
  - `candidato.dto.spec.ts`: prioridad 0 y fecha mal formada → rechazadas; el seguimiento rechaza `prioridad` y `idPersona` (whitelist).
  - Mapper: `discrepancia = (estadoPreparacion === 'listo_ahora') !== (excluyentesSinCubrir === 0)`.

- [ ] **Step 2: Correr los tests y ver que fallan.** Esperado: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar `SQL_CANDIDATOS_DEL_PLAN`** y el servicio con las firmas de Interfaces. `excluyentes_sin_cubrir` = requisitos excluyentes del puesto del plan (con conocimiento activo) para los que el candidato no tiene `conocimiento_persona.id_nivel_acreditado` o este tiene `orden` menor que el del nivel requerido (`nivel_dominio.orden`). `a_revisar` = el candidato hoy es ocupante vigente del puesto, o no tiene ninguna ocupación vigente (misma definición de vigente que Personas, con `CURRENT_DATE`). `reordenar` toma `SET CONSTRAINTS "UQ_candidato_sucesion_prioridad" DEFERRED` dentro de la transacción y guarda cada candidato con `save()`.

- [ ] **Step 4: Implementar `CandidatosController`** (ruta `planes/:idPlan/candidatos`): `POST` (alta), `PATCH :idPersona` (seguimiento), `PUT orden`, `DELETE :idPersona` (todos con `ROLES_ELABORADORES_DE_PLANES`); registrar en `SucesionModule`. `PUT orden` va declarado antes que `:idPersona`.

- [ ] **Step 5: Correr los tests unitarios.** Esperado: PASS.

- [ ] **Step 6: Escribir `candidatos.int.spec.ts` (PostgreSQL real)** y correrlo:
  - **Intercambio 1↔2** con `reordenar` en un plan de tres candidatos: termina con las prioridades cruzadas y una fila de auditoría por cambio.
  - `excluyentesSinCubrir`: sin acreditaciones es igual a `totalExcluyentes`; con nivel acreditado igual al requerido baja a 0; con nivel menor no cuenta; un requisito deseable no cuenta.
  - `aRevisar`: verdadero si la persona pasa a ocupar el puesto o si su ocupación termina.
  - Quitar y agregar dejan alta y baja en `auditoria` (`entidad = 'candidato_sucesion'`, `idRegistro = '<plan>-<persona>'`).

- [ ] **Step 7: Commit**

```bash
git add backend/src
git commit -m "Implementar los candidatos de sucesión y su preparación calculada"
```

---

### Task 4: Acciones de transferencia

**Files:**
- Create: `backend/src/modules/sucesion/dto/accion.dto.ts`, `acciones.service.ts`, `acciones.controller.ts`
- Modify: `sucesion.module.ts`, `sucesion.mapper.ts`
- Test: `acciones.service.spec.ts`, `accion.dto.spec.ts`, `acciones.int.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`AccionTransferencia`, `ESTADO_ACCION`, `TRANSICIONES_ACCION`, `puedePasar`), `enTransaccionDeConocimiento` de `modules/conocimiento/transaccion.ts`.
- Produces (DTOs): `CrearAccionDto {idTipoAccion: number; idConocimiento: number; idPlan?: number; idResponsable: number; idDestinatario?: number; descripcion: string; fechaPrevista: string}`, `EditarAccionDto` (los mismos campos opcionales y `cancelar?: boolean`; sin `idConocimiento` ni `idPlan`), `AvanzarAccionDto {estado: 'en_curso' | 'completada'; notaAvance?: string; fechaCumplimiento?: string}`, `FiltroAccionesDto {idPlan?; idConocimiento?; estado?: string; vencidas?: boolean}`, `AccionDto {id, tipo: string, idConocimiento, denominacionConocimiento, idPlan: number | null, idResponsable, nombreResponsable, idDestinatario: number | null, nombreDestinatario: string | null, descripcion, fechaPrevista, fechaCumplimiento: string | null, estado: string, notaAvance: string | null, vencida: boolean}`.
- Produces (`AccionesService`): `crear(dto: CrearAccionDto, sesion): Promise<AccionDto>`, `editar(id: number, dto: EditarAccionDto, sesion): Promise<AccionDto>`, `avanzar(id, dto: AvanzarAccionDto, sesion): Promise<AccionDto>`, `listar(filtro: FiltroAccionesDto, sesion): Promise<AccionDto[]>`, `listarDePlan(idPlan: number): Promise<AccionDto[]>` (sin validar alcance).

- [ ] **Step 1: Escribir los tests unitarios (fallan)** en `acciones.service.spec.ts`:
  - `crear`: conocimiento inexistente → 404 y de baja → 400; responsable o destinatario inactivo → 400; destinatario igual al responsable → 400; plan inexistente → 404 y `cerrado` → 409; conocimiento que no es requisito del puesto del plan → 409; sin plan se crea; caso feliz nace `pendiente`.
  - `editar`: en una acción `completada` o `cancelada` → 409; `cancelar: true` desde `pendiente`/`en_curso` pasa a `cancelada`.
  - `avanzar`: un docente que no es el responsable → `ForbiddenException`; el responsable pasa `pendiente` → `en_curso` → `completada`; `completada` fija `fechaCumplimiento` de hoy si no viene y 400 si es futura; de `completada` a `en_curso` → 409; RR. HH. avanza cualquiera; el destinatario no escribe `notaAvance`.
  - `listar`: el docente ve solo las acciones donde es responsable o destinatario (y lista vacía sin `idPersona`); la jefatura, solo las de planes de su alcance; RR. HH. y autoridad, todas.
  - `vencida`: pendiente o en curso con fecha prevista de ayer → `true`; **completada o cancelada con fecha prevista pasada → `false`**.
  - `accion.dto.spec.ts`: `AvanzarAccionDto` rechaza `estado: 'cancelada'` y campos ajenos; `EditarAccionDto` rechaza `idConocimiento`.

- [ ] **Step 2: Correr los tests y ver que fallan.** Esperado: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar DTOs, mapper y `AccionesService`** con las firmas de Interfaces. Las escrituras corren en `enTransaccionDeConocimiento` y usan `save()`; `actualizadaEn` se actualiza en cada cambio. La visibilidad del `listar` se resuelve en la consulta, no filtrando después en memoria.

- [ ] **Step 4: Implementar `AccionesController`** (ruta `acciones`): `GET` (`ROLES_LECTORES_DE_ACCIONES`), `POST` y `PATCH :id` (`ROLES_GESTORES_DE_ACCIONES`), `POST :id/avanzar` (`ROLES_AVANZADORES_DE_ACCIONES`). Registrar en `SucesionModule`.

- [ ] **Step 5: Correr los tests unitarios.** Esperado: PASS.

- [ ] **Step 6: Escribir `acciones.int.spec.ts` (PostgreSQL real)** y correrlo: ciclo de vida completo con `fecha_cumplimiento` en la base; el CHECK impide completar sin fecha; la acción de un plan `cerrado` sigue visible para su responsable; filtro `vencidas` con fechas reales de la base; alcance de la jefatura con la consulta recursiva.

- [ ] **Step 7: Commit**

```bash
git add backend/src
git commit -m "Implementar las acciones de transferencia de conocimiento"
```

---

### Task 5: Cobertura de OE7, detalle del plan y «mis planes»

**Files:**
- Create: `backend/src/modules/sucesion/dto/cobertura.dto.ts`, `cobertura.sql.ts`, `cobertura.service.ts`, `sucesion.controller.ts`
- Modify: `planes.service.ts`, `planes.controller.ts`, `dto/plan.dto.ts`, `sucesion.module.ts`
- Test: `cobertura.service.spec.ts`, `cobertura.int.spec.ts`, `planes.detalle.int.spec.ts`

**Interfaces:**
- Consumes: Tasks 2 a 4 (`PlanesService.buscar`, `CandidatosService.listarDePlan`, `AccionesService.listarDePlan`).
- Produces (DTOs): `CoberturaDto {criticos: number; conPlan: number; sinPlan: PuestoSinPlanDto[]}`, `PuestoSinPlanDto {idPuesto, codigo, denominacion, idUnidad, idPlanEnElaboracion: number | null, estadoPlanEnElaboracion: string | null}`, `MiPlanDto {idPlan, idPuesto, denominacionPuesto, estadoPlan: string, estadoPreparacion: string, fechaDisponibilidadEstimada: string | null}`, `PlanDetalleDto extends PlanDto {candidatos: CandidatoDto[]; acciones: AccionDto[]}`.
- Produces (`CoberturaService`): `cobertura(filtro: {idUnidad?: number}, sesion): Promise<CoberturaDto>`, `misPlanes(sesion): Promise<MiPlanDto[]>`; y `PlanesService.detalle(id: number, sesion): Promise<PlanDetalleDto>`.

- [ ] **Step 1: Escribir los tests (fallan)**:
  - `cobertura.service.spec.ts`: filtra por `unidadesVisibles` (RR. HH. y autoridad sin límite); con `idUnidad` pasa el filtro al SQL; `misPlanes` sin `idPersona` devuelve `[]`.
  - `cobertura.int.spec.ts` (PostgreSQL real, con `criticidad_vigente`): puesto crítico = requisito **excluyente** con criticidad vigente `alta`; un requisito deseable `alta` no hace crítico; un puesto sin evaluaciones no figura (no es «crítico» ni «no crítico»); `conPlan` cuenta solo planes `aprobado`; un puesto con plan en borrador figura en `sinPlan` con su `estadoPlanEnElaboracion`; un puesto dado de baja no cuenta; tras aprobar una versión nueva la cobertura no cambia, y tras cerrar el aprobado sin reemplazo el puesto vuelve a `sinPlan`.
  - `misPlanes` (misma suite): el docente candidato recibe una fila por cada plan `aprobado` en el que figura, con su estado de preparación y **sin** `prioridad` ni otros candidatos; un plan en `borrador` o `pendiente_aprobacion` no aparece.
  - `planes.detalle.int.spec.ts`: el detalle trae candidatos con `discrepancia` y las acciones del plan.

- [ ] **Step 2: Correr los tests y ver que fallan.** Esperado: FAIL.

- [ ] **Step 3: Implementar `SQL_COBERTURA`** (parámetros: `$1` unidades visibles o `null`, `$2` unidad filtrada con sus descendientes o `null`; la recursión de subunidades sigue el patrón de `criticidad/pares.sql.ts`), `CoberturaService`, `PlanesService.detalle` y `PlanDetalleDto`.

- [ ] **Step 4: Implementar `SucesionController`** con `GET /sucesion/cobertura` (`ROLES_LECTORES_DE_SUCESION`) y `GET /sucesion/mis-planes` (`@Roles('docente')`), y cambiar `GET /planes/:id` para devolver `PlanDetalleDto`. Registrar en el módulo.

- [ ] **Step 5: Correr todos los tests del módulo** (`npx vitest run src/modules/sucesion` y la suite de integración de `sucesion`) y `npx vitest run src/common/cobertura-roles.spec.ts`. Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "Informar la cobertura de OE7 y el detalle de los planes"
```

---

### Task 6: La fusión de conocimientos mueve las acciones

**Files:**
- Modify: `backend/src/modules/conocimiento/fusion.sql.ts`, `conocimientos.service.ts`, `dto/catalogo.dto.ts`, `fusion.int.spec.ts`, `conocimientos.service.spec.ts`, `frontend/src/features/conocimiento/components/FusionarDialog.tsx`

**Interfaces:**
- Produces: `SQL_CONTAR_ACCIONES` (parámetro: id del conocimiento); un paso nuevo al final de `PASOS_FUSION`; campo `accionesMovidas: number` en la respuesta de la fusión (junto a `evaluacionesMovidas`).

- [ ] **Step 1: Escribir los tests (fallan)**: en `conocimientos.service.spec.ts`, la respuesta de `fusionar` incluye `accionesMovidas` con el valor del contador; en `fusion.int.spec.ts`, una fusión de punta a punta con dos acciones del conocimiento origen deja ambas con `id_conocimiento` del destino, `accionesMovidas = 2`, y sin acciones en el origen.

- [ ] **Step 2: Correr los tests y ver que fallan.**

- [ ] **Step 3: Implementar**: `SQL_CONTAR_ACCIONES`, el paso `UPDATE accion_transferencia SET id_conocimiento = $2 WHERE id_conocimiento = $1`, el contador previo a la fusión en el servicio, el campo del DTO (`@ApiProperty`) y la línea «Acciones de transferencia movidas» en `FusionarDialog.tsx` (tras `npm run api:tipos`).

- [ ] **Step 4: Correr `npx vitest run src/modules/conocimiento` y la integración de fusión.** Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src frontend/src
git commit -m "Mover las acciones de transferencia al fusionar conocimientos"
```

---

### Task 7: Frontend: cobertura, planes y detalle del plan

**Files:**
- Create: `frontend/src/features/sucesion/hooks/useSucesion.ts`, `pages/PlanPage.tsx`, `components/{CrearPlanDialog,ResolverPlanDialog,AgregarCandidatoDialog,CandidatosTabla,AccionesDelPlan}.tsx`
- Modify: `pages/SucesionPage.tsx`, `router.tsx`, `auth/permisos.ts`, `api/esquema.d.ts` (regenerado)

**Interfaces:**
- Consumes: la API de las Tareas 2 a 5. Regenerar tipos con `npm run api:tipos` (backend corriendo) antes de escribir los hooks.
- Produces (`useSucesion.ts`): `useCobertura(filtro)`, `usePlanes(filtro)`, `usePlan(id)`, mutaciones `useCrearPlan`, `usePresentarPlan`, `useResolverPlan`, `useNuevaVersionPlan`, `useCerrarPlan`, `useReabrirPlan`, `useAgregarCandidato`, `useSeguimientoCandidato`, `useReordenarCandidatos`, `useQuitarCandidato`; los tipos `Plan`, `PlanDetalle`, `Candidato`, `Cobertura` exportados desde `Esquemas`. Cada mutación invalida `['sucesion']`. Siguen el patrón de `features/criticidad/hooks/useCriticidad.ts` (incluido `mensajeError`).

- [ ] **Step 1: Regenerar los tipos** (`npm run api:tipos`) y escribir los hooks.

- [ ] **Step 2: Reemplazar `SucesionPage`** (hoy `PaginaEnConstruccion`): barra de cobertura de OE7 (`conPlan` sobre `criticos`), tabla de puestos críticos sin plan con el estado del plan en elaboración, y tabla de planes con filtros de unidad y estado; la jefatura ve el botón «Crear plan» (diálogo con selector de puesto y de responsable; formulario con react-hook-form y zod).

- [ ] **Step 3: Escribir `PlanPage`** (`/sucesion/planes/:id`): estado, responsable, resolución (quién, cuándo y motivo), candidatos por prioridad con estado de preparación, marca de discrepancia («jefatura: listo ahora, pero faltan N excluyentes») y de «a revisar», y acciones del plan. Los botones salen del estado y del rol: presentar, reabrir, nueva versión y cerrar (jefatura); aprobar y rechazar con motivo (autoridad); agregar, quitar y reordenar candidatos solo en borrador; seguimiento editable también en aprobado. Los demás roles ven la pantalla sin botones de escritura.

- [ ] **Step 4: Rutas y menú**: `/sucesion` y `/sucesion/planes/:id` bajo `RutaProtegida` con `recursos_humanos`, `autoridad`, `jefatura_departamento`, `jefe_catedra`; en `permisos.ts`, la sección «Sucesión» pasa a esos roles (el docente la deja: su entrada es la Tarea 8).

- [ ] **Step 5: Verificar**: `npm run lint`, `npm run format` y `npm run build` en `frontend`. Esperado: sin errores. Recorrer en el navegador los escenarios: la jefatura crea un plan, agrega un candidato, presenta; la autoridad lo aprueba y lo rechaza (con motivo); RR. HH. ve todo sin botones de escritura; el docente no tiene la sección.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "Agregar las pantallas de cobertura, planes y detalle de sucesión"
```

---

### Task 8: Frontend: acciones y «Mi sucesión»

**Files:**
- Create: `frontend/src/features/sucesion/pages/AccionesPage.tsx`, `MiSucesionPage.tsx`, `components/{AccionDialog,AvanzarAccionDialog}.tsx`
- Modify: `hooks/useSucesion.ts`, `router.tsx`, `auth/permisos.ts`, `components/AccionesDelPlan.tsx`

**Interfaces:**
- Consumes: la API de las Tareas 4 y 5. Produces: `useAcciones(filtro)`, `useMisPlanes()`, `useCrearAccion`, `useEditarAccion`, `useAvanzarAccion`.

- [ ] **Step 1: Hooks nuevos** sobre `useSucesion.ts` (tras `npm run api:tipos` si cambió el contrato).

- [ ] **Step 2: `AccionesPage`** (`/acciones`; `recursos_humanos`, `autoridad`, `jefatura_departamento`, `jefe_catedra`, `docente`): tabla con filtros de estado, vencidas y conocimiento, y chip «Vencida». RR. HH. ve «Nueva acción» (diálogo con tipo, conocimiento, plan opcional, responsable, destinatario opcional, descripción y fecha prevista) y editar/cancelar. El docente ve solo las suyas y, si es responsable, el botón «Avanzar» (diálogo con estado en curso o completada, nota y fecha de cumplimiento); como destinatario las ve sin botones.

- [ ] **Step 3: `MiSucesionPage`** (`/sucesion/mia`; `docente`): sus planes (puesto, estado de preparación, fecha estimada) sin prioridad ni otros candidatos, y sus acciones. Menú: «Mi sucesión» para `docente`, «Acciones» para los roles de la ruta.

- [ ] **Step 4: Verificar**: `npm run lint`, `npm run format` y `npm run build`. Recorrer los escenarios: RR. HH. crea una acción sin plan y otra con plan; el docente responsable la pasa a en curso y a completada; el docente destinatario no ve el botón; un docente sin acciones ve el estado vacío; una acción atrasada muestra «Vencida».

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "Agregar las pantallas de acciones de transferencia y Mi sucesión"
```

---

### Task 9: Documentación y cierre

**Files:**
- Modify: `docs/requerimientos.md`, `docs/superpowers/specs/2026-10-12-usuarios-roles-design.md`, `docs/superpowers/specs/2026-10-18-sucesion-planes-design.md`, este plan

- [ ] **Step 1: `docs/requerimientos.md`**: §5 agrega el párrafo **Sucesión** con la referencia a la spec y la regla de sucesor preparado; §7 cierra la parte de RF13 de «Validación y aprobación» (queda RF05).
- [ ] **Step 2: Matriz de roles de Usuarios**: `jefe_catedra` lee planes y acciones de su alcance; `docente` lee acciones como responsable o destinatario.
- [ ] **Step 3: Verificación final**: `npm run lint`, `npm run format`, `npm test` y `npm run test:integracion` en `backend`; `npm run lint`, `npm run format` y `npm run build` en `frontend`. Esperado: todo en verde. Aplicar `migration:run` sobre una base limpia (`docker compose down -v` y levantar) y confirmar que arranca.
- [ ] **Step 4: Estados**: la spec pasa a `Estado: Implementada` y este plan a `Estado: Implementado`, con el número del PR.
- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "Documentar la sucesión y marcar la spec y el plan como implementados"
```
