Estado: Propuesta | Fecha: 2026-10-15 | Autor: IvanOchoa229

# Conocimiento: catálogo, requisitos y conocimiento de las personas

## Contexto y objetivo

El módulo `conocimiento` es hoy un esqueleto. Este bloque implementa el catálogo único de
conocimientos (RF08), los requisitos de cada puesto (RF09) y el conocimiento de las personas, con el
flujo en que el docente declara y el evaluador acredita (RF10). Sobre estos datos se calculan después
las detecciones de punto único de falla (RF16), brecha de perfil (RF19) y puesto sin sucesor preparado
(RF18).

Contexto leído: `docs/requerimientos.md`, `docs/primer-avance.md` y las specs de Usuarios, Estructura y
Personas. El catálogo de referencia (RF23) ya tiene `nivel_dominio` y `tipo_conocimiento`.

## Requerimientos que cubre

| ID | Cobertura |
| --- | --- |
| RF08 | Catálogo único de conocimientos con control de duplicados por nombre normalizado y fusión |
| RF09 | Requisitos por puesto (nivel requerido, excluyente o deseable), con copia entre puestos |
| RF10 | El docente declara su nivel; el jefe de cátedra o la jefatura acredita con nivel, fecha, tipo de evidencia y observaciones; historial de acreditaciones |
| RF23 | Dos dominios nuevos de referencia (`area_tematica`, `tipo_evidencia`): el catálogo pasa de 15 a 17 |
| RNF01 | Lecturas y escrituras con `@Roles`; alcance por unidad para acreditar |
| RNF02 | El perfil de conocimiento de una persona queda restringido por rol y por alcance |
| RNF03 | Dominios cerrados por tabla de referencia; duplicados impedidos por la base |
| RNF06 | Pantalla "Mis conocimientos" para que el docente declare sin capacitación previa |

Cierra dos puntos abiertos de `docs/requerimientos.md` §7: **historial de evaluaciones** y
**declarado y acreditado**. No toca los demás (validación y aprobación, criticidad del puesto, regla de
combinación). No cubre RF11 (activos de conocimiento).

## Decisiones

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Detección de duplicados | Columna `denominacion_normalizada` (minúsculas, sin tildes, espacios colapsados) calculada por la aplicación, con índice único parcial `(id_tipo_conocimiento, denominacion_normalizada)` entre los activos. No se usa la extensión `unaccent`: es `STABLE` y no sirve en un índice |
| 2 | Duplicados existentes | Fusión explícita de dos conocimientos del mismo tipo; el origen queda inactivo con `id_fusionado_en` |
| 3 | Área temática | Tabla de referencia `area_tematica`, administrada por RF23 |
| 4 | Requisitos repetidos | Copia puntual de los requisitos de un puesto a otro. Sin plantilla por cargo tipo ni vínculo posterior |
| 5 | Declarado y acreditado | Una fila por persona y conocimiento (`conocimiento_persona`) con nivel declarado y nivel acreditado vigente |
| 6 | Historial | Tabla `acreditacion`, de solo inserción, con una fila por evaluación. Vigente: mayor `fecha_evaluacion` y, en empate, mayor `id_acreditacion`. El servicio refleja la vigente en `conocimiento_persona` en la misma transacción |
| 7 | Evaluador | `jefe_catedra` y `jefatura_departamento`, sobre personas con una ocupación vigente en su alcance. Sin autoacreditación. `recursos_humanos` solo lee |
| 8 | Nivel para las detecciones | Solo cuenta el nivel acreditado vigente. Lo declarado sin acreditar no cuenta |
| 9 | Evidencia | Tipo de evidencia como tabla de referencia `tipo_evidencia` más una observación de texto. **Sin archivo adjunto**: RNF08 queda limitado a los activos de conocimiento (RF11) |
| 10 | Usabilidad | Pantalla "Mis conocimientos" precargada con los requisitos de los puestos que el docente ocupa hoy |
| 11 | Carácter del requisito | Booleano `es_excluyente`, como `funcion.es_critica`: son dos valores y no se administran |
| 12 | Jefatura sin acreditador | La persona que ocupa la jefatura de departamento no tiene quién la acredite. Se documenta como riesgo, sin excepción a la matriz de roles |
| 13 | Auditoría | Estas entidades no se auditan: RNF05 cubre solo criticidad y sucesión, y `acreditacion` ya es el historial |

## Modelo de datos

El modelo pasa de 24 a 25 tablas (suma `acreditacion`; `conocimiento`, `requisito_puesto` y
`conocimiento_persona` ya figuraban en el modelo original).

### Tablas de referencia nuevas

Misma estructura que las existentes (`id`, `codigo` único, `denominacion` única, `activo`). Se cargan
por migración y se registran en `DOMINIOS`, que pasa de quince a diecisiete dominios.

| Tabla | Valores iniciales |
| --- | --- |
| `area_tematica` | Programación, Bases de datos, Redes y comunicaciones, Ingeniería de software, Sistemas operativos, Matemática, Gestión y organización, Docencia universitaria (el administrador las edita) |
| `tipo_evidencia` | `titulo` Título; `certificado` Certificado; `produccion` Producción académica; `observacion_directa` Observación directa; `entrevista` Entrevista |

### `conocimiento`

| Columna | Detalle |
| --- | --- |
| `id_conocimiento` | Clave primaria |
| `denominacion` | `varchar(150)`, obligatoria |
| `denominacion_normalizada` | `varchar(150)`, calculada por la aplicación; el DTO no la acepta |
| `id_tipo_conocimiento`, `id_area_tematica` | → referencia, obligatorios |
| `descripcion` | Texto, opcional |
| `activo` | Booleano, por defecto `true` |
| `id_fusionado_en` | → `conocimiento`, opcional; lo llena la fusión |

Restricciones: índice único parcial `(id_tipo_conocimiento, denominacion_normalizada)` donde `activo`;
CHECK `id_fusionado_en <> id_conocimiento`.

### `requisito_puesto`

| Columna | Detalle |
| --- | --- |
| `id_puesto`, `id_conocimiento` | Clave compuesta, → `puesto` y `conocimiento` |
| `id_nivel_requerido` | → `nivel_dominio`, obligatorio |
| `es_excluyente` | Booleano, obligatorio |

### `conocimiento_persona` (declaración vigente y reflejo de la acreditación vigente)

| Columna | Detalle |
| --- | --- |
| `id_persona`, `id_conocimiento` | Clave compuesta |
| `id_nivel_declarado`, `fecha_declaracion` | Opcionales; los llena el docente. `fecha_declaracion` es una fecha |
| `id_nivel_acreditado`, `fecha_evaluacion`, `id_tipo_evidencia`, `id_evaluador` | Reflejo de la acreditación vigente; los llena solo el servicio. `id_evaluador` → `persona` |

CHECKs: al menos uno de `id_nivel_declarado` e `id_nivel_acreditado` no es nulo; los campos de
acreditación (`id_nivel_acreditado`, `fecha_evaluacion`, `id_tipo_evidencia`, `id_evaluador`) están todos
presentes o todos nulos; `id_nivel_declarado` y `fecha_declaracion` están ambos o ninguno. Un jefe puede
acreditar a quien nunca declaró (OE4 pide el 80 % acreditado), por eso el declarado es opcional.

### `acreditacion` (historial, solo inserción)

| Columna | Detalle |
| --- | --- |
| `id_acreditacion` | Clave primaria |
| `id_persona`, `id_conocimiento` | FK compuesta → `conocimiento_persona` |
| `id_nivel_acreditado`, `id_tipo_evidencia` | → referencia, obligatorios |
| `fecha_evaluacion` | Fecha, obligatoria; CHECK `fecha_evaluacion <= current_date` |
| `id_evaluador` | → `persona`, obligatorio |
| `observaciones` | Texto, opcional |
| `registrada_en` | `timestamptz`, por defecto `now()` |

Una acreditación con fecha anterior a la vigente queda en el historial y no cambia el reflejo. No hay
edición ni borrado: un error se corrige con una acreditación nueva más reciente.

### Migraciones

1. Dominios de referencia nuevos y sus valores.
2. `conocimiento` y `requisito_puesto`.
3. `conocimiento_persona` y `acreditacion`, con los CHECKs en SQL.

Se revisan a mano antes de aplicarse, como indica CLAUDE.md. El índice parcial y los CHECKs se escriben
en SQL.

## Reglas de negocio

### Catálogo (`ConocimientosService`; escribe solo `analista_puestos`)

- **Alta y edición.** Se editan denominación, tipo, área y descripción, y se recalcula la normalizada.
  Un duplicado entre activos del mismo tipo da 409 y nombra el conocimiento existente con su id. Tipo y
  área deben existir y estar activos.
- **Baja lógica.** 409 si hay requisitos en puestos activos, y el mensaje los lista. Las declaraciones y
  acreditaciones de personas no la bloquean: son historial. Para retirar un duplicado se usa la fusión.
- **Reactivación.** 409 si ya hay un activo con la misma clave normalizada.
- **Fusión** (`POST /conocimientos/:id/fusionar {idDestino}`). Origen y destino deben estar activos, ser
  distintos y tener el mismo tipo. Corre en una transacción con bloqueo consultivo del dominio
  `conocimiento`:
  - Requisitos: se repuntan al destino. Si un puesto ya tenía ambos, queda el nivel más exigente y
    `es_excluyente` si alguno lo era.
  - Personas: si tenía ambos, el declarado es el nivel más alto. Las acreditaciones del origen pasan al
    destino y el vigente se recalcula con la regla de siempre (la más reciente).
  - El origen queda inactivo con `id_fusionado_en`.
  - La respuesta informa cuántos requisitos y personas se movieron. No se puede deshacer.

### Requisitos (`RequisitosService`; escribe solo `analista_puestos`)

- `PUT /puestos/:id/requisitos/:idConocimiento` da de alta o modifica (`idNivel`, `esExcluyente`). Puesto,
  conocimiento y nivel deben estar activos. `DELETE` quita el requisito.
- **Copiar** (`POST /puestos/:id/requisitos/copiar {idPuestoOrigen}`): origen y destino distintos, destino
  activo. Se copian los requisitos del origen cuyo conocimiento siga activo. Los que el destino ya tiene
  no se pisan: se devuelven como omitidos. Es una copia puntual, sin vínculo posterior.
- La baja de un puesto no se bloquea por sus requisitos.

### Declaración

- `PUT /personas/:id/conocimientos/:idConocimiento/declaracion {idNivel}`. `:id` debe ser
  `usuario.idPersona`; lo usan `docente`, `jefe_catedra` y `jefatura_departamento`, porque los jefes
  también son personas con conocimientos.
- Persona, conocimiento y nivel deben estar activos. Volver a declarar actualiza nivel y fecha. No toca
  lo acreditado.
- `DELETE` retira la declaración: si la fila no tiene acreditaciones se borra; si las tiene, queda con el
  declarado en nulo.

### Acreditación (`jefe_catedra` y `jefatura_departamento`)

`POST /personas/:id/conocimientos/:idConocimiento/acreditaciones` con
`{idNivel, fechaEvaluacion, idTipoEvidencia, observaciones?}`.

- El evaluador sale de la sesión, nunca del DTO. El usuario debe tener persona vinculada (si no, 400).
- Si `:id` es la persona del evaluador, 403.
- La persona evaluada debe tener una ocupación **vigente** en un puesto cuya unidad esté dentro de
  `AlcanceService.unidadesVisibles` (si no, 403). Las ocupaciones pasadas o futuras no habilitan.
- Persona, conocimiento, nivel y tipo de evidencia deben estar activos. `fechaEvaluacion` no puede ser
  futura.
- Se puede acreditar cualquier conocimiento del catálogo, no solo los que exige el puesto. Si la fila de
  `conocimiento_persona` no existe, se crea.
- Inserta en `acreditacion` y actualiza el reflejo en la misma transacción, con bloqueo de fila.

### Pendiente de acreditar

Un conocimiento está pendiente si hay declaración y, o no hay acreditación, o el declarado difiere del
acreditado y `fecha_declaracion > fecha_evaluacion`. Si declara y acreditan el mismo día no vuelve a
quedar pendiente: caso borde aceptado.

## API

Todo bajo `/api`; DTOs con class-validator y `@ApiProperty`; tipos del frontend regenerados con
`npm run api:tipos`.

| Endpoint | Rol | Notas |
| --- | --- | --- |
| `GET /conocimientos` | Cualquier rol autenticado | Filtros `q`, `idTipo`, `idArea`, `activo`. Sin paginación |
| `POST /conocimientos`, `PATCH /conocimientos/:id` | `analista_puestos` | |
| `POST /conocimientos/:id/baja`, `…/reactivar`, `…/fusionar` | `analista_puestos` | |
| `GET /puestos/:id/requisitos` | Todos menos `docente` | |
| `PUT` y `DELETE /puestos/:id/requisitos/:idConocimiento` | `analista_puestos` | |
| `POST /puestos/:id/requisitos/copiar` | `analista_puestos` | Devuelve copiados y omitidos |
| `GET /conocimientos/mios` | `docente`, `jefe_catedra`, `jefatura_departamento` | Su propia persona |
| `GET /conocimientos/pendientes-acreditacion` | `jefe_catedra`, `jefatura_departamento` | Filtrado por alcance |
| `GET /personas/:id/conocimientos`, `…/:idConocimiento/acreditaciones` | `recursos_humanos` y `autoridad` (globales); `jefe_catedra` y `jefatura_departamento` por alcance; `docente` solo los propios | `analista_puestos` y `administrador` no |
| `PUT` y `DELETE /personas/:id/conocimientos/:idConocimiento/declaracion` | `docente`, `jefe_catedra`, `jefatura_departamento` | Solo la propia persona |
| `POST /personas/:id/conocimientos/:idConocimiento/acreditaciones` | `jefe_catedra`, `jefatura_departamento` | Por alcance, sin autoacreditación |

`GET /conocimientos/mios` une los requisitos de los puestos con ocupación vigente (cada conocimiento una
vez, con el nivel más exigente y la lista de puestos que lo piden) y los conocimientos que la persona ya
tiene registrados. El docente ve completa su propia información, con evaluador y observaciones. El test
existente que exige `@Roles` en toda ruta no pública cubre las rutas nuevas.

## Contrato para el bloque de detección

No se implementa acá, pero queda fijado:

- Punto único de falla, brecha de perfil (RF19) y puesto sin sucesor preparado cuentan **solo el nivel
  acreditado vigente** (`conocimiento_persona.id_nivel_acreditado`).
- Lo declarado sin acreditar no cuenta. Puede mostrarse aparte como información.
- "Ocupación vigente" usa la misma definición que la spec de Personas.

## Frontend (`features/conocimiento`)

- **Catálogo** (`/conocimientos`, todos los roles menos `docente`): lista con búsqueda y filtros de tipo,
  área y activos; formulario de alta y edición; diálogo de fusión con confirmación. Un 409 por duplicado
  muestra el conocimiento existente con un enlace. Los controles de escritura aparecen solo para
  `analista_puestos`.
- **Requisitos del puesto**: pestaña en el panel del puesto de `/estructura`, con tabla de conocimiento,
  nivel y excluyente o deseable, edición en línea y botón "Copiar de otro puesto" que muestra copiados y
  omitidos. Escritura solo para `analista_puestos`.
- **Mis conocimientos** (`/conocimientos/mios`):
  - Precargada con los conocimientos que piden los puestos que ocupa hoy, con el nivel requerido debajo.
  - Cada fila tiene un selector de nivel con las cuatro opciones del dominio, que se guarda al elegir, sin
    botón "Guardar", y un texto corto que explica cada nivel.
  - Cada fila muestra "Sin declarar", "Declarado" o "Acreditado" (con nivel, fecha y tipo de evidencia).
  - Un buscador sobre el catálogo permite sumar un conocimiento fuera de los requisitos; no se pueden
    crear conocimientos nuevos.
  - Sin ocupaciones vigentes, la pantalla lo explica y ofrece solo el buscador.
  - Una sola pantalla, sin pasos ni vocabulario técnico (RNF06).
- **Acreditar** (`jefe_catedra` y `jefatura_departamento`): bandeja `/conocimientos/pendientes` y pestaña
  "Conocimientos" en la ficha de la persona (declarado, acreditado vigente e historial). El formulario pide
  nivel, fecha (hoy por defecto), tipo de evidencia y observaciones. El botón no aparece en el perfil propio.
- **Administración → Referencia**: `area_tematica` y `tipo_evidencia` aparecen por el registro en `DOMINIOS`.
- Formularios con react-hook-form y zod; llamadas con TanStack Query dentro del feature.

## Pruebas

- **Unitarias (vitest, repositorios simulados)**:
  - Normalización: tildes, mayúsculas, espacios y `ñ`.
  - Duplicado en alta, edición y reactivación; baja bloqueada por requisitos.
  - Fusión: requisitos en conflicto, personas con ambos conocimientos, tipos distintos y origen igual al
    destino.
  - Requisitos: dominios inactivos y copia con omitidos.
  - Declaración: solo la propia.
  - Acreditación: sin persona vinculada, autoacreditación, fuera de alcance, ocupación no vigente, fecha
    futura y fecha anterior a la vigente (no cambia el reflejo).
  - Criterio de pendiente y armado de `mios` con deduplicación entre puestos.
- **Integración contra PostgreSQL real** (`*.int.spec.ts`, `npm run test:integracion`): unicidad parcial
  normalizada (los inactivos no bloquean), CHECKs de `conocimiento_persona`, FK compuesta de
  `acreditacion`, fusión de punta a punta y alcance de la acreditación con la consulta recursiva real.
- **Frontend**: validado por escenarios de uso, como el resto.

## Cambios en documentos

- `docs/requerimientos.md`: §5 referencia esta spec; el modelo pasa de 24 a 25 tablas y los dominios de
  referencia de 15 a 17; se cierran los puntos abiertos de historial y de declarado y acreditado en §7.
- `README.md`: nota sobre la columna normalizada para cargas directas del DBA.
- Esta spec pasa a `Implementada` al cerrar el trabajo.

## Fuera de alcance

Archivos adjuntos como evidencia, activos de conocimiento (RF11), criticidad (RF12), vistas de detección,
el indicador del 80 % de OE4, importación masiva de conocimientos y recordatorios o notificaciones de
pendientes.

## Riesgos

- **Jefatura sin acreditador** (decisión 12): la persona de la jefatura de departamento no puede ser
  acreditada por nadie en esta etapa.
- **La fusión no se deshace**: hay que confirmar antes y revisar el resultado.
- **Normalización solo en la aplicación**: un `INSERT` directo que no cargue `denominacion_normalizada` se
  salta el control de duplicados. Se documenta en el README.
- **Jefes sin persona vinculada** no pueden acreditar ni declarar: el administrador debe asignarla en
  Usuarios.
- **Perfil de conocimiento como dato sensible**: `analista_puestos` y `administrador` quedan sin acceso.
  Hay que revisarlo si el tablero necesita más lecturas.
