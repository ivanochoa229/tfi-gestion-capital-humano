Estado: Aprobada | Fecha: 2026-10-13 | Autor: IvanOchoa229

# Estructura: unidades organizativas y puestos

## Contexto y objetivo

Los módulos `estructura`, `personas`, `conocimiento`, `criticidad` y `sucesion` son esqueletos. Este
bloque implementa la base de todos los demás: la estructura del departamento (unidades) y el
inventario de puestos con su cadena de mando. De él dependen la descripción de puestos (RF03 en
adelante), las ocupaciones, las consultas de detección (RF17 cuenta ocupaciones por cátedra) y el
alcance por unidad definido en la spec de Usuarios.

También cierra dos pendientes de `2026-10-12-usuarios-roles-design.md`: la clave foránea
`usuario_unidad.id_unidad → unidad_organizativa`, con la prueba de `AlcanceService` contra la base
real, y la asignación de unidades a usuarios en la pantalla de administración.

## Requerimientos que cubre

| ID | Cobertura |
| --- | --- |
| RF01 | Redefinido por la decisión 1: la aplicación **consulta** las unidades y su jerarquía; las carga el DBA por SQL. Con esa redacción queda cubierto |
| RF02 | Alta, modificación y baja (lógica) de puestos, con datos de identificación y superior inmediato |
| RF22 | Asignación de unidades a usuarios `jefe_catedra` y `jefatura_departamento`, pendiente desde la spec de Usuarios |
| RF23 | Tres dominios nuevos de referencia (`tipo_unidad`, `nivel_jerarquico`, `tipo_relacion_contractual`): el catálogo pasa de 10 a 13 |
| RNF01 | Lecturas para cualquier rol autenticado; escrituras con `@Roles` |
| RNF03 | Dominios cerrados por tabla de referencia; jerarquía de unidades íntegra por restricciones en la base |

No toca RF05 (validación de descripciones) ni los puntos abiertos de `docs/requerimientos.md` §7.

## Decisiones

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Carga de unidades | La aplicación no crea, edita ni da de baja unidades. El DBA carga las cátedras por SQL; una migración carga solo el Departamento de Sistemas. RF01 se reescribe en `docs/requerimientos.md` como consulta |
| 2 | Jerarquía de unidades | Recursiva (`id_unidad_superior`) pero forzada a dos niveles. El departamento no tiene superior y la cátedra tiene como superior un departamento. Sin ciclos posibles. Las reglas viven en la base (CHECK y trigger), porque la carga no pasa por la aplicación |
| 3 | Tipo de unidad | Tabla de referencia `tipo_unidad` con `departamento` y `catedra`, identificados por `codigo` |
| 4 | Puesto por cátedra | Cada cargo es un puesto distinto en cada cátedra. La acción "Crear puestos tipo" crea los cuatro cargos de una vez; la lista de cargos es una constante en código, no una tabla |
| 5 | Código de puesto | Generado desde una secuencia de PostgreSQL, formato `P-0001`; único e inmutable; no se reutiliza. El límite es `P-9999` |
| 6 | Superior inmediato | Opcional. Debe estar en la misma unidad o en una unidad ancestra, y activo. Sin ciclos. La unidad de un puesto no cambia después del alta |
| 7 | Nivel jerárquico | Tabla de referencia ordinal `nivel_jerarquico` |
| 8 | Rango retributivo y relación contractual | Opcionales. `rango_retributivo` es texto libre descriptivo (no hay liquidación de haberes). `tipo_relacion_contractual` es una tabla de referencia |
| 9 | Baja | Lógica (`activo`), sin borrado físico. Se bloquea si hay dependientes activos |
| 10 | Permisos | Escrituras de puestos solo para `analista_puestos`. Lecturas para cualquier rol autenticado y sin filtro por alcance: la estructura no es sensible y alimenta los selectores. El alcance se aplica en criticidad y sucesión |
| 11 | Auditoría | Estas entidades no se auditan (RNF05 cubre solo criticidad y sucesión) |

## Modelo de datos

Tres tablas de referencia nuevas, con la misma estructura que las existentes (`id`, `codigo` único,
`denominacion` única, `activo`; las ordinales suman `orden` único). Se cargan por migración y se
registran en `DOMINIOS`, por lo que RF23 las administra.

| Tabla | Valores iniciales (`codigo` → denominación) | Tipo |
| --- | --- | --- |
| `tipo_unidad` | `departamento` → Departamento; `catedra` → Cátedra | Simple |
| `nivel_jerarquico` | `conduccion_departamento` → Conducción de departamento (1); `conduccion_catedra` → Conducción de cátedra (2); `coordinacion_docente` → Coordinación docente (3); `operativo_docente` → Operativo docente (4) | Ordinal |
| `tipo_relacion_contractual` | `planta_permanente` → Planta permanente; `contratado` → Contratado; `ad_honorem` → Ad honorem | Simple |

Los códigos de `tipo_unidad` y `nivel_jerarquico` los usa el código de la aplicación; el administrador
puede cambiar denominaciones, pero cambiar un `codigo` en uso ya lo impide `ReferenciaService`.

### `unidad_organizativa`

| Columna | Detalle |
| --- | --- |
| `id_unidad` | Clave primaria |
| `denominacion` | Texto de hasta 150 caracteres, obligatorio |
| `id_tipo_unidad` | → `tipo_unidad`, obligatorio |
| `id_unidad_superior` | → `unidad_organizativa`, opcional |
| `activo` | Booleano, por defecto `true`; lo cambia el DBA |

Restricciones, todas en la base:

- Índice único parcial sobre `(id_unidad_superior, lower(denominacion))` para unidades activas
  (la denominación del departamento, sin superior, se cubre con un segundo índice único parcial
  sobre `lower(denominacion)` donde `id_unidad_superior IS NULL`).
- Trigger `BEFORE INSERT OR UPDATE` sobre `id_tipo_unidad` e `id_unidad_superior`: si el tipo es
  `departamento`, exige `id_unidad_superior` nulo; si es `catedra`, exige que el superior exista y sea
  de tipo `departamento`. Falla con un mensaje que nombra la unidad.

La migración carga el Departamento de Sistemas. Las cátedras se cargan con `INSERT` del DBA; el
README documenta un ejemplo y `backend/scripts/catedras-ejemplo.sql` ofrece datos para el entorno
local (no es una migración).

### `puesto`

| Columna | Detalle |
| --- | --- |
| `id_puesto` | Clave primaria |
| `codigo` | `varchar(10)`, único, no nulo, sin valor por defecto. Lo genera `PuestosService` al crear el puesto con `nextval('puesto_codigo_seq')` (`'P-'` más el número con cuatro dígitos); la secuencia tiene `MAXVALUE 9999`, así que agotarla falla en lugar de repetir códigos. Se genera en la aplicación para que `migration:generate` no proponga cambios sobre un valor por defecto que las entidades no declaran |
| `denominacion` | Hasta 150 caracteres, obligatorio |
| `proposito`, `condiciones_trabajo` | Texto, opcionales |
| `rango_retributivo` | Hasta 100 caracteres, opcional |
| `dotacion_prevista` | Entero ≥ 1 (CHECK), por defecto 1 |
| `id_unidad` | → `unidad_organizativa`, obligatorio |
| `id_nivel_jerarquico` | → `nivel_jerarquico`, obligatorio |
| `id_tipo_relacion_contractual` | → `tipo_relacion_contractual`, opcional |
| `id_puesto_superior` | → `puesto`, opcional |
| `activo` | Booleano, por defecto `true` |

Restricciones: índice único parcial `(id_unidad, lower(denominacion))` donde `activo`; CHECK
`id_puesto_superior <> id_puesto`; índices por `id_unidad` y por `id_puesto_superior`.

### Migraciones

1. Tablas de referencia y sus valores.
2. `unidad_organizativa` con su trigger e índices, el Departamento de Sistemas, `puesto` y la secuencia.
3. FK `usuario_unidad.id_unidad → unidad_organizativa`. Si hay filas huérfanas, la migración aborta y
   lista los ids.

Se revisan a mano antes de aplicarse, como indica CLAUDE.md. El trigger, la secuencia y los índices
parciales se escriben en SQL.

## Reglas de negocio (`UnidadesService`, `PuestosService`, `PuestosTipoService` y `JerarquiaService`)

### Puestos

Todas las escrituras de puestos (alta, modificación, baja, reactivación y puestos tipo) corren en una transacción con el bloqueo consultivo de `estructura`, de modo que quedan serializadas.

- **Alta**: `analista_puestos`. La unidad debe existir y estar activa. El nivel y el tipo contractual
  se validan con `ReferenciaService.validarActivo`. `codigo` lo genera la base y no se acepta en el DTO.
- **Modificación**: se editan denominación, propósito, condiciones, rango, dotación, nivel, tipo
  contractual y superior. No se editan `codigo` ni `idUnidad` (el DTO los rechaza por
  `forbidNonWhitelisted`). Nivel y tipo contractual se revalidan solo si cambian.
- **Superior inmediato**: debe estar activo y su unidad debe ser la del puesto o una ancestra
  (recorrido recursivo sobre `id_unidad_superior`). Se rechaza (400) que sea el propio puesto o un
  subordinado suyo directo o indirecto, recorriendo hacia arriba la cadena de superiores del
  candidato. La verificación y el guardado van en una transacción con bloqueo consultivo de
  transacción (clave propia de `estructura`), para que dos ediciones simultáneas no cierren un ciclo.
- **Baja** (`activo = false`): 409 si el puesto tiene subordinados activos; el mensaje los lista.
  Cuando exista `ocupacion`, el bloqueo se extiende a las ocupaciones vigentes (lo agrega el bloque
  de personas). No hay `DELETE`.
- **Reactivación**: 409 si su unidad o su superior están inactivos.
- **Denominación duplicada** en una unidad entre puestos activos: 409.

### Crear puestos tipo

`POST /api/unidades/:id/puestos-tipo`, solo para una cátedra activa (si no, 400 o 404). Crea en una
transacción, todo o nada:

| Denominación | Nivel | Superior |
| --- | --- | --- |
| Jefe de cátedra | `conduccion_catedra` | Puesto activo de nivel `conduccion_departamento` en el departamento de la cátedra |
| Profesor auxiliar | `coordinacion_docente` | Jefe de cátedra |
| Jefe de trabajos prácticos | `coordinacion_docente` | Jefe de cátedra |
| Auxiliar de trabajos prácticos | `operativo_docente` | Jefe de trabajos prácticos |

- Si no hay exactamente un puesto de jefatura activo en el departamento, el jefe de cátedra se crea
  sin superior y la respuesta incluye una advertencia.
- Si ya existe un puesto activo con alguna de las cuatro denominaciones en la cátedra, responde 409
  y no crea nada.
- Dotación 1; los demás campos opcionales quedan vacíos para completarlos después.
- La Jefatura de Departamento no es un puesto tipo: se crea a mano, con nivel
  `conduccion_departamento`.

## API

Todo bajo el prefijo `/api`; DTOs con class-validator y `@ApiProperty`; tipos del frontend
regenerados con `npm run api:tipos`.

| Endpoint | Rol | Notas |
| --- | --- | --- |
| `GET /unidades` | Cualquier rol autenticado | Lista plana; `?incluirInactivas=true` suma las inactivas |
| `GET /unidades/arbol` | Cualquier rol autenticado | Árbol anidado; también admite `?incluirInactivas=true` |
| `GET /unidades/:id` | Cualquier rol autenticado | Incluye tipo, superior y cantidad de puestos activos |
| `GET /puestos` | Cualquier rol autenticado | Filtros `idUnidad`, `activo`, `q` (código o denominación). Sin paginación: el volumen es de decenas de unidades y cientos de puestos |
| `GET /puestos/:id` | Cualquier rol autenticado | Incluye superior y subordinados directos |
| `POST /puestos`, `PATCH /puestos/:id` | `analista_puestos` | |
| `POST /puestos/:id/baja`, `POST /puestos/:id/reactivar` | `analista_puestos` | |
| `POST /unidades/:id/puestos-tipo` | `analista_puestos` | Devuelve los puestos creados y las advertencias |

El test existente que exige `@Roles` en toda ruta no pública cubre las rutas nuevas.

## Asignación de unidades a usuarios (RF22)

`UsuariosService` ya acepta `idUnidades`; ahora las valida contra `unidad_organizativa`:

- Cada unidad debe existir y estar activa; si no, 400.
- `jefe_catedra` solo admite unidades de tipo `catedra` y `jefatura_departamento` solo admite
  unidades de tipo `departamento`. Los demás roles no admiten unidades, como hasta ahora.
- La FK de la migración 3 evita asignaciones a unidades inexistentes aunque se escriba directo en la base.

## Frontend (`features/estructura`)

- **Estructura** (ruta `/estructura`, visible para todos los roles): panel izquierdo con el árbol de
  unidades de solo lectura (interruptor para mostrar inactivas) y panel derecho con los puestos de la
  unidad elegida, que se pueden filtrar por texto y por activos.
- **Formulario de puesto** (react-hook-form + zod): el selector de superior ofrece solo puestos activos
  de la misma unidad o de las ancestras, sin el propio puesto ni sus subordinados. El código se muestra
  y no se edita. Los controles de alta, edición, baja, reactivación y "Crear puestos tipo" aparecen
  solo para `analista_puestos`.
- **Administración → Usuarios**: para los roles `jefe_catedra` y `jefatura_departamento`, selector
  múltiple de unidades (alimentado por `GET /unidades`); la lista de usuarios muestra las asignadas.
  La asignación de persona sigue pendiente hasta el módulo `personas`.
- **Administración → Referencia**: los tres dominios nuevos aparecen sin trabajo extra, por el registro
  en `DOMINIOS`.

## Pruebas

- **Unitarias (vitest, repositorios simulados)**: reglas de puesto (superior válido en misma unidad y en
  unidad ancestra, superior inactivo, ciclo directo e indirecto, unidad inmutable), bajas bloqueadas
  por subordinados, reactivación, denominación duplicada, puestos tipo (éxito, conflicto, sin
  jefatura, unidad no cátedra) y validación de unidades en `UsuariosService`.
- **Integración contra PostgreSQL real** (`*.int.spec.ts`, script `npm run test:integracion`, requiere
  `docker compose up -d db`; crea una base temporal y aplica las migraciones): CHECK y trigger de
  jerarquía (departamento con superior, cátedra sin superior, cátedra bajo cátedra), unicidades
  parciales, generación de `codigo`, FK de `usuario_unidad` y `AlcanceService.unidadesVisibles` con la
  consulta recursiva real para jefatura y jefe de cátedra con descendientes.
- **Frontend**: validado por escenarios de uso, como el resto.

## Cambios en documentos

- `docs/requerimientos.md`: RF01 pasa a "Consultar las unidades organizativas (departamento y
  cátedras) con su jerarquía; las carga el DBA", con actor "Todos"; se agrega a §5 la referencia
  a esta spec. El recuento de 24 tablas del modelo no cambia, porque no
  cuenta las tablas de referencia.
- `README.md`: cómo cargar cátedras por SQL.
- Esta spec pasa a `Implementada` al cerrar el trabajo.

## Fuera de alcance

Descripción del puesto (funciones, tareas, responsabilidades, riesgos), relevamientos, requisitos de
conocimiento, ocupaciones y el bloqueo de baja por ocupaciones (bloques posteriores). Alta, edición y
baja de unidades desde la aplicación.

## Riesgos

- Los invariantes de unidades dependen del trigger. Si el DBA cambia el superior o el tipo de una
  unidad que ya tiene puestos, el trigger revisa la unidad pero no los puestos: puede quedar un puesto
  cuyo superior ya no está en una unidad válida. Se acepta como responsabilidad del DBA y se documenta
  en el README.
- Si el DBA desactiva una cátedra con usuarios o puestos activos, la aplicación no lo impide. Los
  puestos siguen visibles pero no se pueden reactivar mientras la unidad esté inactiva, y la
  asignación en `usuario_unidad` se conserva.
- La cadena de mando de los puestos tipo está fija en código: cambiarla requiere un cambio de código.
- El límite de `P-9999` es holgado para el alcance (un departamento), pero cambiarlo exige migración.
