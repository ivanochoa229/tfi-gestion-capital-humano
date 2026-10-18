Estado: Implementada | Fecha: 2026-10-18 | Autor: IvanOchoa229

# Sucesión: planes, candidatos y acciones de transferencia

## Contexto y objetivo

El módulo `sucesion` es hoy un esqueleto (`sucesion.module.ts` vacío). Este bloque implementa los
planes de sucesión por puesto con su circuito de aprobación, los candidatos con su estado de
preparación y las acciones de transferencia de conocimiento. Cierra OE7 y OE8 y fija el contrato que
usa Detección para el puesto crítico sin sucesor preparado (RF18) y la brecha del candidato (RF19).

Contexto leído: `docs/requerimientos.md`, `docs/primer-avance.md` y las specs de Usuarios y roles,
Estructura, Personas, Importación CSV, Conocimiento (catálogo y activos) y Criticidad. Código revisado:
`modules/referencia` (dominios `estado_plan`, `estado_preparacion`, `tipo_accion_transferencia`,
`estado_accion_transferencia`, ya cargados por migración) y `infra/auditoria`.

## Requerimientos que cubre

| ID | Cobertura |
| --- | --- |
| RF13 | Plan por puesto con estado y responsable, circuito presentar → aprobar o rechazar, versiones |
| RF14 | Candidatos con estado de preparación, prioridad única en el plan y fecha estimada de disponibilidad |
| RF15 | Acciones de transferencia con tipo, responsable, fecha prevista y estado; el responsable actualiza su avance |
| RF24 | Planes y candidatos restringidos a RR. HH., autoridades y jefatura por alcance; el docente solo ve sus acciones y su fila de candidato |
| RNF01 | Todas las rutas con `@Roles`; alcance por unidad |
| RNF03 | Dominios cerrados por tabla de referencia; unicidades y CHECKs en la base |
| RNF04 | Cobertura, acciones vencidas y discrepancias se calculan por consulta; no se almacenan |
| RNF05 | `plan_sucesion` y `candidato_sucesion` ya están en el subscriber de auditoría; se escriben con `save()` o `remove()` |

Apoya OE7 (un plan con al menos un candidato por puesto de criticidad alta) y OE8 (al menos una acción
por punto único de falla). Cierra en `docs/requerimientos.md` §7 la parte de RF13 del punto abierto
«Validación y aprobación»; la parte de RF05 (`relevamiento`) sigue abierta.

## Decisiones

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Planes por puesto | Como mucho un plan `aprobado` y uno en elaboración (`borrador` o `pendiente_aprobacion`) por puesto, con dos índices únicos parciales. El historial son los planes `cerrado` y `rechazado` |
| 2 | Cambiar un plan aprobado | La estructura de un plan aprobado no se edita: se crea una **versión nueva** (copia en borrador, con `id_plan_anterior`). Al aprobarla, la anterior pasa a `cerrado` en la misma transacción. El puesto nunca queda sin plan vigente |
| 3 | Estados | `borrador` → `pendiente_aprobacion` → `aprobado` o `rechazado`; `rechazado` → `borrador`; `cerrado` es final. Se agrega el valor `cerrado` a `estado_plan` por migración. Las transiciones son código, no dato: los valores no se renombran ni se quitan desde RF23 |
| 4 | Quién aprueba | Solo `autoridad`. La jefatura elabora y presenta; no aprueba |
| 5 | Qué se registra al resolver | `id_usuario_resolucion`, `fecha_resolucion` y `motivo_resolucion` (obligatorio al rechazar). Se guarda el usuario, no una persona, como en Criticidad |
| 6 | Seguimiento en un plan aprobado | Sigue editable el seguimiento de cada candidato (`estado_preparacion` y fecha estimada de disponibilidad). No se pueden agregar ni quitar candidatos, cambiar prioridades ni el responsable |
| 7 | Qué puestos tienen plan | Se puede crear plan para cualquier puesto activo. Los de criticidad alta (regla de Criticidad) se informan como indicador de cobertura de OE7; el sistema no obliga |
| 8 | Presentar | Exige al menos un candidato (409 si no), por OE7 |
| 9 | Candidato | Persona activa con ocupación vigente en cualquier puesto, que no sea ocupante vigente del puesto del plan (409). Una vez por plan; puede estar en planes de otros puestos. Sin ocupación vigente no podría ser acreditada y nunca contaría para RF18 |
| 10 | Prioridad | Entero ≥ 1, único dentro del plan (restricción `DEFERRABLE` para poder reordenar en una transacción) |
| 11 | Plazo | `fecha_disponibilidad_estimada`, fecha opcional. Se aparta del `plazo_estimado` del modelo original: una cantidad de meses envejece y no se puede consultar |
| 12 | «Sucesor preparado» | Para RF18 manda el **cálculo**: el nivel acreditado vigente del candidato cubre cada requisito excluyente del puesto. Solo cuentan candidatos de planes `aprobado`. El estado de preparación manual es el juicio de la jefatura sobre el plazo; no entra en RF18 |
| 13 | Discrepancia | La pantalla marca cuando el estado manual y el cálculo no coinciden (por ejemplo «listo ahora» con excluyentes sin cubrir). Es información, no bloquea |
| 14 | Estados de la acción | `pendiente` → `en_curso` → `completada`; `pendiente` o `en_curso` → `cancelada`. `completada` y `cancelada` son finales |
| 15 | Cumplimiento | `fecha_cumplimiento` la fija el servidor al completar (hoy por defecto, nunca futura). CHECK: está presente si y solo si el estado es `completada` |
| 16 | Vencida | No es un estado: pendiente o en curso con `fecha_prevista < hoy`, por consulta |
| 17 | Qué hace el responsable | Un docente responsable pasa su acción a `en_curso` o `completada` y escribe una nota de avance. No cambia fecha prevista, responsable ni destinatario, y no cancela |
| 18 | Destinatario | Nueva columna `id_destinatario → persona`, opcional: quien recibe el conocimiento. CHECK `id_destinatario <> id_responsable`. No es obligatorio ni para mentoría ni para capacitación |
| 19 | Acciones sin plan | `id_conocimiento` es obligatorio e `id_plan` opcional. Con plan, el conocimiento debe ser un requisito del puesto del plan (409) |
| 20 | Responsable de un plan | Persona activa, obligatoria (`id_responsable → persona`, como el modelo) |
| 21 | Evaluador y aprobador | Se guarda `id_usuario`, no persona (misma razón que la decisión 10 de Criticidad) |

Decisiones 2, 6, 11, 18 y 21 se apartan del modelo original o lo completan; quedan documentadas acá.

## Modelo de datos

El modelo no suma tablas: `plan_sucesion`, `candidato_sucesion` y `accion_transferencia` ya estaban
contados. Se completan sus columnas.

### `plan_sucesion`

| Columna | Detalle |
| --- | --- |
| `id_plan` | Clave primaria |
| `id_puesto` | → `puesto`, obligatorio |
| `id_responsable` | → `persona`, obligatorio |
| `id_estado_plan` | → `estado_plan`, obligatorio |
| `fecha_elaboracion` | Fecha, obligatoria; por defecto hoy |
| `id_plan_anterior` | → `plan_sucesion`, opcional: la versión que reemplaza |
| `id_usuario_resolucion`, `fecha_resolucion`, `motivo_resolucion` | Resolución de aprobación; opcionales hasta resolver. CHECK: los tres campos de fecha y usuario van juntos |
| `observaciones` | Texto, opcional |

Índices únicos parciales sobre `id_puesto`: uno `WHERE estado = aprobado` y otro `WHERE estado IN
(borrador, pendiente_aprobacion)`. Se escriben en SQL a mano en la migración porque dependen del
código del estado.

### `candidato_sucesion`

| Columna | Detalle |
| --- | --- |
| `id_plan`, `id_persona` | Clave compuesta, → `plan_sucesion` y `persona` |
| `id_estado_preparacion` | → `estado_preparacion`, obligatorio |
| `prioridad` | Entero, CHECK `>= 1`; único por `(id_plan, prioridad)`, `DEFERRABLE INITIALLY IMMEDIATE` |
| `fecha_disponibilidad_estimada` | Fecha, opcional |
| `observaciones` | Texto, opcional |

### `accion_transferencia`

| Columna | Detalle |
| --- | --- |
| `id_accion` | Clave primaria |
| `id_tipo_accion` | → `tipo_accion_transferencia`, obligatorio |
| `id_conocimiento` | → `conocimiento`, obligatorio |
| `id_plan` | → `plan_sucesion`, opcional |
| `id_responsable` | → `persona`, obligatorio |
| `id_destinatario` | → `persona`, opcional; CHECK distinto del responsable |
| `descripcion` | Texto, obligatoria |
| `fecha_prevista` | Fecha, obligatoria |
| `fecha_cumplimiento` | Fecha, opcional; CHECK de la decisión 15 y `<= current_date` |
| `id_estado_accion` | → `estado_accion_transferencia`, obligatorio; por defecto `pendiente` |
| `nota_avance` | Texto, opcional; una sola nota que el responsable reescribe |
| `registrada_en`, `actualizada_en` | `timestamptz` |

La entidad `accion_transferencia` no está en la lista del subscriber de auditoría y RNF05 no la exige;
`actualizada_en` y la nota bastan para el seguimiento.

### Migraciones

1. Valor `cerrado` en `estado_plan`.
2. `plan_sucesion` con sus índices únicos parciales y CHECKs.
3. `candidato_sucesion` con la unicidad de prioridad.
4. `accion_transferencia`.

Se revisan a mano antes de aplicarse (CLAUDE.md); los índices parciales y los CHECKs van en SQL.

## Reglas de negocio

### Planes (`PlanesService`)

- **Crear:** puesto activo, sin plan en elaboración (409). Responsable persona activa. Alcance: el puesto
  debe estar en `AlcanceService.unidadesVisibles` (403 si no). Nace en `borrador`.
- **Editar** (`responsable`, `observaciones`): solo en `borrador`.
- **Presentar:** `borrador` → `pendiente_aprobacion`, con al menos un candidato (decisión 8).
- **Resolver:** solo `autoridad`. `aprobar` o `rechazar` desde `pendiente_aprobacion`; rechazar exige
  motivo. Al aprobar una versión con `id_plan_anterior` aprobado, esa anterior pasa a `cerrado` en la
  misma transacción. Queda registrado quién y cuándo.
- **Reabrir:** `rechazado` → `borrador`, para corregir y volver a presentar.
- **Nueva versión:** desde un plan `aprobado`, copia candidatos y responsable en un `borrador` nuevo con
  `id_plan_anterior`. 409 si ya hay un plan en elaboración.
- **Cerrar:** `borrador`, `rechazado` o `aprobado` → `cerrado` (descartar o dar de baja un plan sin
  reemplazo). Un plan aprobado cerrado deja al puesto sin plan vigente y vuelve a aparecer en el aviso.
- Todas las escrituras usan `save()` o `remove()` para que el subscriber audite (RNF05).

### Candidatos (`CandidatosService`)

- **Agregar, quitar y reordenar:** solo en `borrador`. Reglas de la decisión 9. La persona no puede ser
  ocupante vigente del puesto (409).
- **Seguimiento** (`estado_preparacion`, `fecha_disponibilidad_estimada`, `observaciones`): editable en
  `borrador` y en `aprobado` (decisión 6).
- Si una persona candidata pasa a ocupar el puesto o pierde su ocupación después de agregarse, la fila
  se conserva y se marca en el listado como «a revisar».

### Acciones (`AccionesService`)

- **Crear y editar:** `recursos_humanos`. Responsable y destinatario personas activas. Reglas de las
  decisiones 18 y 19. Cancelar también es de RR. HH.
- **Avanzar:** RR. HH. (cualquiera) y el responsable (`usuario.id_persona = id_responsable`) si su rol es
  `docente`, `jefatura_departamento` o `jefe_catedra`; la autoridad no. Un destinatario que no es el
  responsable no avanza (403). Transiciones de la decisión 14, más actualizar la nota de una acción
  `en_curso` (`estado: 'en_curso'` sobre una acción en curso, sin cambiar el estado). Solo el
  responsable escribe `nota_avance` sin ser RR. HH.
- Sin borrado: se cancela.

### Cobertura y avisos (OE7)

Por consulta, para el alcance de quien consulta:

- `criticos` = puestos activos de criticidad alta (contrato de Criticidad).
- `conPlan` = los `criticos` con plan `aprobado`.
- La lista de puestos críticos sin plan aprobado se devuelve con el estado del plan en elaboración, si
  existe. Un puesto «no evaluado» (sin evaluación vigente) no figura entre los críticos y se informa
  aparte, como define Criticidad.

## Contrato para Detección

No se implementa acá, pero queda fijado para RF18 y RF19:

- Un puesto crítico tiene sucesor preparado si algún candidato de un plan `aprobado` de ese puesto
  tiene, para **todos** sus requisitos excluyentes, `conocimiento_persona.id_nivel_acreditado >=
  requisito_puesto.id_nivel` (por `orden`).
- El estado manual `estado_preparacion` no interviene.
- La brecha del candidato (RF19) se calcula contra el puesto del plan, no contra el que ocupa.

## API

Todo bajo `/api`; DTOs con class-validator y `@ApiProperty`; tipos del frontend con `npm run api:tipos`.

| Endpoint | Roles | Notas |
| --- | --- | --- |
| `GET /sucesion/cobertura` | `recursos_humanos`, `autoridad` (globales); `jefatura_departamento`, `jefe_catedra` por alcance | `{criticos, conPlan}` y lista de críticos sin plan; filtro `idUnidad` |
| `GET /planes` | Los mismos | Filtros `idPuesto`, `idUnidad`, `estado` |
| `GET /planes/:id` | Los mismos; `docente` candidato solo vía `mis-planes` | Candidatos, acciones, discrepancias y resolución |
| `POST /planes` | `jefatura_departamento` | `{idPuesto, idResponsable, observaciones?}` |
| `PATCH /planes/:id` | `jefatura_departamento` | Solo borrador |
| `POST /planes/:id/presentar` | `jefatura_departamento` | |
| `POST /planes/:id/resolver` | `autoridad` | `{decision: aprobar \| rechazar, motivo?}` |
| `POST /planes/:id/reabrir` | `jefatura_departamento` | Solo rechazado |
| `POST /planes/:id/nueva-version` | `jefatura_departamento` | Solo aprobado |
| `POST /planes/:id/cerrar` | `jefatura_departamento` | |
| `POST /planes/:id/candidatos` | `jefatura_departamento` | `{idPersona, prioridad, idEstadoPreparacion, fechaDisponibilidadEstimada?}` |
| `PATCH /planes/:id/candidatos/:idPersona` | `jefatura_departamento` | Seguimiento; el resto solo en borrador |
| `PUT /planes/:id/candidatos/orden` | `jefatura_departamento` | Reordena en una transacción |
| `DELETE /planes/:id/candidatos/:idPersona` | `jefatura_departamento` | Solo borrador |
| `GET /sucesion/mis-planes` | `docente` | Solo su fila de candidato en cada plan; ver Permisos |
| `GET /acciones` | `recursos_humanos`, `autoridad`; `jefatura_departamento`, `jefe_catedra` por alcance del plan; `docente` las propias | Filtros `idPlan`, `idConocimiento`, `estado`, `vencidas` |
| `POST /acciones` | `recursos_humanos` | |
| `PATCH /acciones/:id` | `recursos_humanos` | Campos de la acción y cancelar |
| `POST /acciones/:id/avanzar` | `recursos_humanos`; `docente`, `jefatura_departamento` y `jefe_catedra` si son el responsable | `{estado, notaAvance?, fechaCumplimiento?}` |

`analista_puestos` y `administrador` no acceden a ninguna ruta. El test que exige `@Roles` en toda ruta
no pública cubre las rutas nuevas.

## Permisos (RF24)

| Rol | Planes y candidatos | Acciones |
| --- | --- | --- |
| `jefatura_departamento` | Crea, edita y presenta los de su alcance; lee | Lee las de planes de su alcance y las suyas como responsable o destinatario; avanza las suyas como responsable |
| `autoridad` | Lee todo; aprueba y rechaza | Lee todas |
| `recursos_humanos` | Lee todo; no edita planes | Crea, edita, cancela y avanza cualquiera |
| `jefe_catedra` | Solo lectura de los de su alcance (mi decisión: la matriz de roles no lo excluye y evalúa criticidad sobre esos puestos) | Lee las de su alcance y las suyas como responsable o destinatario; avanza las suyas como responsable |
| `docente` | Si es candidato: solo su propia fila (estado de preparación, fecha estimada, estado del plan) y su brecha. No ve a los demás candidatos ni la prioridad | Las que tiene como responsable o destinatario; avanza las suyas como responsable |

Sin plan, una acción no tiene puesto: la ven RR. HH., las autoridades, su responsable y su destinatario.
Los juicios sobre personas (prioridad, comparación entre candidatos) quedan fuera de la vista del
docente.

## Frontend (`features/sucesion`)

- **Sucesión** (`/sucesion`; `recursos_humanos`, `autoridad`, `jefatura_departamento`, `jefe_catedra`):
  barra de cobertura de OE7 y tabla de puestos críticos con el estado de su plan. La jefatura ve el botón
  de crear.
- **Detalle del plan**: estado, responsable, resolución, candidatos ordenados por prioridad con su
  estado de preparación y la marca de discrepancia, y acciones del plan. Los botones dependen del estado
  y del rol (presentar, aprobar, rechazar con motivo, nueva versión, cerrar).
- **Acciones** (`/acciones`): filtros por estado, vencidas y conocimiento. RR. HH. crea; el responsable
  (docente o jefatura) ve el botón de avanzar en las suyas.
- **Mi sucesión** (`docente`): su fila de candidato, sus acciones y su brecha.
- Formularios con react-hook-form y zod; llamadas con TanStack Query dentro del feature.

## Pruebas

- **Unitarias (vitest, repositorios simulados)**:
  - Todas las transiciones de plan y de acción, válidas e inválidas.
  - Presentar sin candidatos, rechazar sin motivo y aprobar con versión anterior (la cierra).
  - Candidato ocupante del puesto o sin ocupación vigente; duplicado en el plan.
  - Acción con conocimiento fuera del puesto del plan; destinatario igual al responsable.
  - Permisos: el docente avanza solo las suyas; la jefatura fuera de alcance recibe 403; el DTO rechaza
    campos que no le corresponden.
- **Integración contra PostgreSQL real** (`*.int.spec.ts`):
  - Índices únicos parciales (dos aprobados, dos en elaboración) y unicidad de prioridad con reordenado
    en transacción.
  - CHECKs de resolución y de cumplimiento.
  - Auditoría: alta, presentación y resolución de un plan quedan en `auditoria`.
  - Versión nueva de punta a punta: aprobación que cierra la anterior.
  - Cobertura con la vista `criticidad_vigente` y alcance con la consulta recursiva real.
- **Frontend**: validado por escenarios de uso, como el resto.

## Cambios en documentos

- `docs/requerimientos.md`: §5 referencia esta spec; se cierra en §7 la parte de RF13.
- `docs/superpowers/specs/2026-10-12-usuarios-roles-design.md`: la matriz agrega la lectura de planes y
  acciones al `jefe_catedra` y la lectura de acciones propias y como destinatario al `docente`.
- Esta spec pasa a `Implementada` al cerrar el trabajo.

## Decisiones tomadas durante la implementación

- Las acciones de transferencia pasan al conocimiento destino al fusionar conocimientos (la spec no lo
  mencionaba); el paso está en `fusion.sql.ts` de Conocimiento.
- `PATCH /acciones/:id` cancela con `cancelar: true` en el cuerpo, no con un endpoint aparte.
- `GET /mis-planes` devuelve solo planes `aprobado` donde figura la persona.
- El filtro `idUnidad` de `GET /planes` incluye las unidades descendientes, siempre dentro del alcance.
- `reabrir` conserva el motivo del rechazo y limpia usuario y fecha de la resolución (la jefatura no
  lee la bitácora y necesita el motivo para corregir); el detalle lo muestra en un borrador. Se niega
  con 409 si el puesto tiene un plan `aprobado` que no es el anterior del plan a reabrir, porque ese
  plan quedaría imposible de aprobar (`resolver` no cierra aprobados ajenos).
- Una acción `en_curso` admite `avanzar` con `estado: 'en_curso'`: solo actualiza la nota (RF15).
- Visibilidad de jefes: además del alcance por unidad, `jefatura_departamento` y `jefe_catedra` ven las
  acciones, con o sin plan, de las que son responsable o destinatario.
- «Su brecha» en Mi sucesión es un conteo («Te faltan N de M requisitos excluyentes»), calculado como
  en los candidatos y solo de la propia persona; el detalle por conocimiento es RF19 (Detección).
- La marca de discrepancia no se emite cuando el puesto no tiene requisitos excluyentes.
- Decisión del usuario: `jefatura_departamento` y `jefe_catedra` que son responsables de una acción la
  avanzan (se amplió `ROLES_AVANZADORES_DE_ACCIONES`); `autoridad` sigue sin avanzar.
- El CHECK `CK_accion_cumplimiento_estado` y los índices únicos parciales de `plan_sucesion` viven solo
  en la migración (dependen de ids de estados); las entidades lo documentan, y `migration:generate`
  puede proponer eliminarlos: hay que descartar esa parte al revisar.

## Fuera de alcance

Las consultas y vistas de Detección (RF16 a RF20) y el tablero (RF21), notificaciones de acciones
vencidas, historial de notas de avance, recálculo automático del estado de preparación y adjuntos en las
acciones.

## Riesgos

- **Estado manual y cálculo divergen**: la jefatura puede declarar «listo ahora» sin que el nivel
  acreditado lo respalde. La marca de discrepancia lo muestra, pero no lo impide.
- **Candidatos sin acreditaciones**: mientras OE4 no llegue al 80 % de acreditaciones, RF18 va a mostrar
  casi todos los puestos sin sucesor preparado.
- **Autoaprobación**: solo `autoridad` aprueba, pero una persona con ese rol y con vínculo a la unidad
  podría aprobar un plan donde figura. No se bloquea en esta etapa.
- **Candidato que pasa a ocupar el puesto**: la fila queda en el plan y solo se marca; hay que quitarla a
  mano en la siguiente versión.
- **Jefatura de departamento sin acreditador** (riesgo heredado de Conocimiento): quien ocupa la jefatura
  no puede ser acreditado, así que no cuenta como sucesor calculado.
