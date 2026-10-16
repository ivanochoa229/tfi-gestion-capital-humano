Estado: Aprobada | Fecha: 2026-10-16 | Autor: IvanOchoa229

# Criticidad: evaluación por par conocimiento-puesto

## Contexto y objetivo

El módulo `criticidad` es hoy un esqueleto. Este bloque implementa la evaluación de criticidad de cada
par conocimiento-puesto (impacto de pérdida y dificultad de reemplazo), el cálculo del nivel resultante
con una matriz, el historial de evaluaciones y el avance de OE5. Sobre la evaluación vigente se calculan
después el punto único de falla (RF16), el puesto crítico sin sucesor (RF18) y el horizonte de riesgo
(RF20), y se arman los planes de sucesión de OE7.

Contexto leído: `docs/requerimientos.md`, `docs/primer-avance.md` y las specs de Referencia, Usuarios,
Estructura, Personas y Conocimiento.

## Requerimientos que cubre

| ID | Cobertura |
| --- | --- |
| RF12 | Evaluación por par conocimiento-puesto con impacto y dificultad; el servidor calcula el nivel resultante con una matriz |
| RF24 | Evaluar y leer criticidad queda restringido a RR. HH., autoridades (solo lectura) y jefatura involucrada por alcance; el docente no accede |
| RNF01 | Todas las rutas con `@Roles`; alcance por unidad |
| RNF03 | Escalas y matriz en tablas, con claves y CHECKs en la base |
| RNF04 | La evaluación vigente y el avance se calculan por consulta; el nivel de cada evaluación es un registro del juicio emitido, no un indicador (decisión 3) |
| RNF05 | `evaluacion_criticidad` ya figura en el subscriber de auditoría; se escribe con `save()` |

Apoya OE5 (criticidad de todos los conocimientos de los puestos relevados) y fija el contrato que usan
OE6 y OE7.

Cierra dos puntos abiertos de `docs/requerimientos.md` §7: **regla de combinación** (supuesto 5 del
primer avance) y **criticidad del puesto**. No toca los demás.

## Decisiones

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Escalas | Tres niveles por eje, con un criterio observable por nivel (tabla abajo) |
| 2 | Combinación | Matriz 3×3 en la tabla `matriz_criticidad`, que da `baja`, `media` o `alta` (`nivel_criticidad` ya existe). El administrador edita los resultados de la matriz |
| 3 | Guardar o calcular | El nivel se **guarda** al evaluar, como foto. Cambiar la matriz solo afecta evaluaciones futuras; no hay recálculo automático |
| 4 | Ajuste manual | No existe. El nivel sale siempre de la matriz; si da un resultado equivocado se corrige la matriz. `observaciones` es texto libre sin efecto |
| 5 | Pares evaluables | Solo los de `requisito_puesto`, con puesto y conocimiento activos |
| 6 | Varios evaluadores | Una evaluación por par: RR. HH., jefatura y jefe de cátedra evalúan con la misma operación; la más reciente es la vigente. RR. HH. «consolida» evaluando de nuevo. Sin estados ni propuestas |
| 7 | Historial | Tabla de solo inserción. Vigente: mayor `fecha_evaluacion` y, en empate, mayor `id_evaluacion` |
| 8 | Puesto de criticidad alta | Tiene al menos un requisito **excluyente** con criticidad vigente `alta` (contrato, sin columna) |
| 9 | Permisos | Evalúan RR. HH. (global), jefatura y jefe de cátedra (puesto en su alcance). Leen además las autoridades. El docente, `analista_puestos` y `administrador` no leen evaluaciones |
| 10 | Evaluador | Se guarda `id_usuario` de la sesión, no una persona. Se aparta de `id_evaluador → persona` del modelo original: RR. HH. puede no tener persona vinculada y la auditoría ya registra usuario |
| 11 | Autoevaluación | Sin restricción: la criticidad es del conocimiento en el puesto, no de quien lo ocupa |
| 12 | Escalas fijas | `nivel_impacto` y `nivel_dificultad` **no** se registran en `DOMINIOS` ni se administran por RF23: agregar o quitar un nivel dejaría la matriz incompleta. Se cargan por migración, como `rol` |

### Escalas

| Eje | Nivel | Criterio |
| --- | --- | --- |
| Impacto de pérdida | Bajo | La cátedra o el departamento sigue funcionando con ajustes menores |
| | Medio | Una función se degrada o se demora |
| | Alto | Una función crítica no puede cumplirse (por ejemplo, no se puede dictar o evaluar) |
| Dificultad de reemplazo | Fácil | Otra persona del departamento lo cubre en menos de un mes |
| | Moderada | Se forma o se contrata en uno a seis meses |
| | Difícil | Más de seis meses, o nadie en el departamento lo tiene |

### Matriz inicial

| Impacto \ Dificultad | Fácil | Moderada | Difícil |
| --- | --- | --- | --- |
| Alto | media | alta | alta |
| Medio | baja | media | alta |
| Bajo | baja | baja | media |

## Modelo de datos

El modelo pasa de 25 a 28 tablas: suman `nivel_impacto`, `nivel_dificultad` y `matriz_criticidad`.
`evaluacion_criticidad` ya figuraba en el modelo original.

### `nivel_impacto` y `nivel_dificultad`

Misma base ordinal que las tablas de referencia (`id`, `codigo` único, `denominacion` única, `orden`
único, `activo`) más `criterio` (`text`, obligatorio). Tres valores cada una, cargados por migración.
Solo lectura para la aplicación: el criterio se cambia con una migración.

### `matriz_criticidad`

| Columna | Detalle |
| --- | --- |
| `id_nivel_impacto`, `id_nivel_dificultad` | Clave compuesta, → `nivel_impacto` y `nivel_dificultad` |
| `id_nivel_criticidad` | → `nivel_criticidad`, obligatorio |

La migración carga las nueve celdas. Nunca se borran filas: solo se edita `id_nivel_criticidad`.

### `evaluacion_criticidad` (historial, solo inserción)

| Columna | Detalle |
| --- | --- |
| `id_evaluacion` | Clave primaria |
| `id_puesto`, `id_conocimiento` | → `puesto` y `conocimiento`. **Sin FK compuesta** a `requisito_puesto`: si el requisito se quita o se fusiona, la evaluación queda como historial |
| `id_nivel_impacto`, `id_nivel_dificultad` | → escalas, obligatorios |
| `id_nivel_criticidad` | → `nivel_criticidad`, obligatorio; foto del resultado de la matriz al evaluar |
| `fecha_evaluacion` | Fecha, obligatoria; CHECK `fecha_evaluacion <= current_date` |
| `id_usuario` | → `usuario`, obligatorio (decisión 10) |
| `observaciones` | Texto, opcional |
| `registrada_en` | `timestamptz`, por defecto `now()` |

Índice `(id_puesto, id_conocimiento, fecha_evaluacion)` (ascendente: TypeORM no declara columnas descendentes y PostgreSQL lo recorre al revés). No hay edición ni
borrado: un error se corrige con una evaluación nueva.

### Vista `criticidad_vigente`

Una fila por `(id_puesto, id_conocimiento)` con la evaluación vigente (decisión 7), por
`DISTINCT ON`. Se escribe a mano en una migración. Una evaluación con fecha anterior a la vigente queda
en el historial y no la reemplaza.

### Migraciones

1. Escalas `nivel_impacto` y `nivel_dificultad` con sus valores.
2. `matriz_criticidad` con las nueve celdas.
3. `evaluacion_criticidad`, su índice y los CHECKs.
4. Vista `criticidad_vigente`.

Se revisan a mano antes de aplicarse (CLAUDE.md). La vista y los CHECKs se escriben en SQL.

## Reglas de negocio

### Evaluar (`CriticidadService`)

`POST /puestos/:id/criticidad/:idConocimiento` con
`{idNivelImpacto, idNivelDificultad, fechaEvaluacion?, observaciones?}`.

- El par debe existir en `requisito_puesto`; puesto y conocimiento deben estar activos. Si no, 409 para
  un par sin requisito y 404 para puesto o conocimiento inexistentes.
- Impacto y dificultad deben existir y estar activos. `fechaEvaluacion` no puede ser futura; por defecto
  es hoy.
- El nivel lo calcula el servidor con `matriz_criticidad`. El DTO no acepta el nivel (la validación
  `forbidNonWhitelisted` devuelve 400).
- Alcance: el puesto debe estar en `AlcanceService.unidadesVisibles` (403 si no). `recursos_humanos` no
  tiene restricción. El usuario del contexto es el evaluador; no se exige persona vinculada.
- Se inserta con `save()` para que `AuditoriaSubscriber` registre usuario y fecha (RNF05). La respuesta
  devuelve la evaluación con su nivel.

### Matriz

- `PUT /criticidad/matriz/:idImpacto/:idDificultad {idNivelCriticidad}`, solo `administrador`. El nivel
  debe existir y estar activo. No afecta a las evaluaciones ya guardadas.
- No hay alta ni baja de celdas.

### Fusión de conocimientos (cambio sobre el bloque Conocimiento)

`PASOS_FUSION` agrega un paso: las evaluaciones del origen pasan al destino
(`UPDATE evaluacion_criticidad SET id_conocimiento = $2 WHERE id_conocimiento = $1`). No hay unicidad que
violar: el historial del par conserva las dos series y la vigente sale de la regla de siempre. La
respuesta de la fusión suma cuántas evaluaciones se movieron. Se actualizan `fusion.sql.ts`, su servicio
y su test de integración.

### Avance de OE5

Para el alcance de quien consulta: `evaluados` = requisitos activos (puesto y conocimiento activos) con
fila en `criticidad_vigente`; `total` = requisitos activos. Una evaluación de un requisito ya quitado no
cuenta. Si se vuelve a agregar el requisito, su evaluación vigente vuelve a contar.

## API

Todo bajo `/api`; DTOs con class-validator y `@ApiProperty`; tipos del frontend regenerados con
`npm run api:tipos`.

| Endpoint | Roles | Notas |
| --- | --- | --- |
| `GET /criticidad/pares` | `recursos_humanos`, `autoridad` (globales); `jefatura_departamento`, `jefe_catedra` por alcance | Filtros `idUnidad`, `idPuesto`, `estado` (`pendiente`, `evaluado`). Cada fila: puesto, conocimiento, nivel y carácter del requisito, evaluación vigente (impacto, dificultad, nivel, fecha) |
| `GET /criticidad/avance` | Los mismos | `{evaluados, total}` por alcance, con filtro `idUnidad` |
| `POST /puestos/:id/criticidad/:idConocimiento` | `recursos_humanos`, `jefatura_departamento`, `jefe_catedra` | Alcance por puesto |
| `GET /puestos/:id/criticidad/:idConocimiento/historial` | Los mismos que `pares`, con alcance | Más reciente primero, con el nombre de usuario del evaluador |
| `GET /criticidad/matriz` | `recursos_humanos`, `autoridad`, `jefatura_departamento`, `jefe_catedra`, `administrador` | Escalas con criterio y las nueve celdas |
| `PUT /criticidad/matriz/:idImpacto/:idDificultad` | `administrador` | |

`docente` y `analista_puestos` no tienen acceso a ninguna ruta de este módulo. El test que exige `@Roles`
en toda ruta no pública cubre las rutas nuevas.

## Contrato para Detección y Sucesión

No se implementa acá, pero queda fijado:

- Todo consumidor lee `criticidad_vigente`, nunca `evaluacion_criticidad` directamente.
- **Puesto de criticidad alta**: tiene al menos un `requisito_puesto` con `es_excluyente` cuyo par tiene
  criticidad vigente `alta`. Se calcula por consulta (RNF04), sin columna en `puesto`.
- Un puesto sin ninguna evaluación vigente es «no evaluado», no «no crítico»; la detección lo informa
  aparte.
- Punto único de falla (RF16) y horizonte de riesgo (RF20) usan criticidad vigente `alta` del par, junto
  con el nivel acreditado vigente de Conocimiento.

## Frontend (`features/criticidad`)

- **Criticidad** (`/criticidad`; `recursos_humanos`, `autoridad`, `jefatura_departamento`,
  `jefe_catedra`): barra de avance de OE5 (evaluados sobre total), tabla de pares con estado y nivel, y
  filtros por unidad, puesto y estado. Las autoridades ven la tabla sin el botón de evaluar.
- **Evaluar**: diálogo con dos selectores (impacto y dificultad) que muestran el criterio de cada nivel,
  el resultado en vivo según la matriz, fecha (hoy por defecto) y observaciones. El historial del par se
  ve en el mismo diálogo. El cliente solo previsualiza; el servidor recalcula.
- **Administración → Matriz de criticidad**: tabla 3×3 con un selector por celda y aviso de que el
  cambio no afecta evaluaciones ya guardadas.
- Sin entrada de menú ni ruta para `docente`, `analista_puestos`; `administrador` solo ve la matriz.
- Formularios con react-hook-form y zod; llamadas con TanStack Query dentro del feature.

## Pruebas

- **Unitarias (vitest, repositorios simulados)**:
  - Cálculo del nivel para las nueve celdas.
  - Par sin requisito, puesto o conocimiento inactivo, escala inactiva y fecha futura.
  - Alcance dentro y fuera, y `recursos_humanos` sin restricción.
  - El DTO rechaza `nivelCriticidad`.
  - Edición de la matriz: nivel inexistente o inactivo.
  - Armado de `pares` y de `avance` (requisito quitado, evaluación anterior no reemplaza).
- **Integración contra PostgreSQL real** (`*.int.spec.ts`, `npm run test:integracion`):
  - Matriz completa tras la migración y CHECK de fecha.
  - Vista `criticidad_vigente`: empate de fecha, fecha anterior a la vigente, y par con varias series.
  - Auditoría: el alta de una evaluación queda en `auditoria`.
  - Fusión de punta a punta con evaluaciones.
  - Filtro por alcance con la consulta recursiva real.
- **Frontend**: validado por escenarios de uso, como el resto.

## Cambios en documentos

- `docs/requerimientos.md`: §5 referencia esta spec; el modelo pasa de 25 a 28 tablas; se cierran en §7
  la regla de combinación y la criticidad del puesto.
- Esta spec pasa a `Implementada` al cerrar el trabajo.

## Fuera de alcance

Las consultas y vistas de Detección y el tablero, el ajuste manual del nivel, propuestas y consolidación
con estados, el recálculo masivo tras cambiar la matriz, administración de las escalas y notificaciones
de pares pendientes.

## Riesgos

- **Criterios de las escalas**: los umbrales de tiempo y de impacto son una propuesta inicial; conviene
  validarlos con la jefatura antes de evaluar en serio. Cambiarlos es una migración.
- **Matriz cambiada, evaluaciones viejas**: las evaluaciones vigentes conservan el nivel de la matriz de
  su fecha. No hay recálculo; hay que re-evaluar los pares que se quieran actualizar.
- **Última evaluación gana**: un jefe puede pisar la de RR. HH. con una más reciente. El historial y la
  auditoría lo registran, pero no hay aviso de discrepancia.
- **Fusión de conocimientos**: toca un bloque ya implementado; la prueba de integración de la fusión
  debe actualizarse.
- **Evaluador por usuario**: si se desactiva o reemplaza un usuario, el historial conserva su
  `id_usuario` (los usuarios no se borran).
