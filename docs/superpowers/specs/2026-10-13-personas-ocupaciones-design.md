Estado: Propuesta | Fecha: 2026-10-13 | Autor: IvanOchoa229

# Personas y ocupaciones

## Contexto y objetivo

El módulo `personas` es hoy un esqueleto. Este bloque implementa el registro de las personas del
departamento (RF06) y de sus ocupaciones de puestos con vigencia, carácter y dedicación (RF07). Sobre
estos datos se calculan después las detecciones de cátedras sostenidas por una sola persona (RF17) y de
retiros próximos (RF20), y la brecha de perfil (RF19).

También cierra tres pendientes de bloques anteriores:

- La FK `usuario.id_persona → persona` y la asignación de persona en Administración → Usuarios
  (spec de Usuarios, decisión 9).
- El bloqueo de la baja de un puesto con ocupaciones (spec de Estructura, "Fuera de alcance").
- Las FK a `persona` que necesitarán `relevamiento`, `evaluacion_criticidad`, `plan_sucesion` y las
  demás tablas de bloques posteriores (no se crean acá).

## Requerimientos que cubre

| ID | Cobertura |
| --- | --- |
| RF06 | ABM de personas con baja lógica y fecha prevista de retiro |
| RF07 | Ocupaciones con vigencia, carácter y dedicación; varias simultáneas; historial |
| RNF02 | `documento` y `fechaNacimiento` solo visibles para `recursos_humanos` y `administrador` |
| RNF03 | Dominios cerrados por tabla de referencia; sin ocupaciones solapadas de la misma persona en el mismo puesto, garantizado por la base |

No toca los puntos abiertos de `docs/requerimientos.md` §7.

## Decisiones

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Situación de revista y dedicación | Dos tablas de referencia nuevas, `situacion_revista` y `dedicacion`, administradas por RF23 |
| 2 | Identidad | `legajo` y `documento` obligatorios y únicos. Los edita solo `recursos_humanos`, y un duplicado da 409 |
| 3 | Datos personales | `documento` y `fechaNacimiento` se omiten en la API para los demás roles (RNF02) |
| 4 | Representación de la ocupación | Clave compuesta `(id_persona, id_puesto, fecha_desde)`, como el modelo. El solapamiento lo impide una restricción de exclusión (`btree_gist`) |
| 5 | Solapamiento | Prohibido para la misma persona y el mismo puesto; permitido en puestos distintos (supuesto 3 del avance). Fechas adyacentes no se solapan, porque el rango es `[]` y el cierre y la apertura caen en días distintos |
| 6 | Historial | Una ocupación con `fecha_hasta` anterior a hoy es inmutable. Solo se corrige una ocupación vigente o futura. `fecha_desde` no se edita: se anula y se recarga |
| 7 | Anulación | `DELETE` solo para ocupaciones que aún no comenzaron (`fecha_desde > hoy`) |
| 8 | Baja de persona | Lógica; 409 si tiene ocupaciones vigentes o futuras. No desactiva el usuario vinculado, solo advierte |
| 9 | Baja de puesto | `PuestosService` pasa a dar 409 si el puesto tiene ocupaciones vigentes o futuras |
| 10 | Vínculo con usuario | FK `usuario.id_persona → persona`. Se asigna desde Administración → Usuarios, no desde Personas |
| 11 | Permisos | Escrituras solo para `recursos_humanos`. Lecturas para todos los roles menos `docente`, sin filtro por alcance. El `docente` solo accede a su propia persona |
| 12 | Auditoría | Estas entidades no se auditan (RNF05 cubre solo criticidad y sucesión) |

Definiciones: una ocupación es **vigente** si `fecha_desde <= hoy` y (`fecha_hasta` es nula o
`fecha_hasta >= hoy`); es **futura** si `fecha_desde > hoy`; es **pasada** si `fecha_hasta < hoy`.

## Modelo de datos

### Tablas de referencia nuevas

Misma estructura que las existentes (`id`, `codigo` único, `denominacion` única, `activo`; las
ordinales suman `orden` único). Se cargan por migración y se registran en `DOMINIOS`, que pasa de trece
a quince dominios.

| Tabla | Valores iniciales (`codigo` → denominación) | Tipo |
| --- | --- | --- |
| `situacion_revista` | `planta_permanente` → Planta permanente; `contratado` → Contratado; `ad_honorem` → Ad honorem; `licencia` → Licencia | Simple |
| `dedicacion` | `simple` → Simple (1); `semiexclusiva` → Semiexclusiva (2); `exclusiva` → Exclusiva (3) | Ordinal |

`caracter_ocupacion` ya existe (titular, interino, suplente).

### `persona`

| Columna | Detalle |
| --- | --- |
| `id_persona` | Clave primaria |
| `legajo` | `varchar(20)`, único, obligatorio |
| `apellido`, `nombre` | `varchar(100)`, obligatorios |
| `documento` | `varchar(8)`, único, obligatorio; CHECK de 7 u 8 dígitos |
| `fecha_nacimiento` | Fecha, obligatoria |
| `fecha_ingreso` | Fecha, obligatoria |
| `id_situacion_revista` | → `situacion_revista`, obligatorio |
| `fecha_prevista_retiro` | Fecha, opcional |
| `activo` | Booleano, por defecto `true` |

CHECKs: `fecha_ingreso > fecha_nacimiento`; `fecha_prevista_retiro >= fecha_ingreso` cuando no es nula.
Índice por `lower(apellido), lower(nombre)` para la búsqueda.

### `ocupacion`

| Columna | Detalle |
| --- | --- |
| `id_persona` | → `persona`, parte de la clave |
| `id_puesto` | → `puesto`, parte de la clave |
| `fecha_desde` | Fecha, parte de la clave |
| `fecha_hasta` | Fecha, opcional; CHECK `fecha_hasta >= fecha_desde` |
| `id_caracter_ocupacion` | → `caracter_ocupacion`, obligatorio |
| `id_dedicacion` | → `dedicacion`, obligatorio |

Restricción de exclusión, en la base:

```sql
EXCLUDE USING gist (
  id_persona WITH =,
  id_puesto WITH =,
  daterange(fecha_desde, fecha_hasta, '[]') WITH &&
)
```

Un `fecha_hasta` nulo equivale a un rango abierto. Índices por `id_puesto` y por `id_persona`.

### Migraciones

1. Tablas de referencia y sus valores.
2. Extensión `btree_gist`, `persona` y `ocupacion`, con la restricción de exclusión y los CHECKs en SQL.
3. FK `usuario.id_persona → persona`. Si hay filas huérfanas, la migración aborta y lista los ids.

Se revisan a mano antes de aplicarse, como indica CLAUDE.md. La exclusión y los CHECKs se escriben
en SQL.

## Reglas de negocio

### `PersonasService`

- **Alta y edición**: solo `recursos_humanos`. Un legajo o documento duplicado da 409 con un mensaje que
  nombra el campo. La situación de revista debe existir y estar activa.
- **Baja**: lógica. Da 409 si la persona tiene ocupaciones vigentes o futuras, y el mensaje las lista.
  Si tiene usuario vinculado, la baja procede y la respuesta incluye la advertencia de que el
  administrador debe desactivarlo. `reactivar` es simétrica.
- Una persona inactiva no admite ocupaciones nuevas y no aparece en selectores. Su historial se conserva.

### `OcupacionesService`

- **Alta**: exige persona y puesto activos, carácter y dedicación activos, y `fechaHasta >= fechaDesde`.
  Si hay solape con otra ocupación de la misma persona y el mismo puesto, el error `23P01` de la
  exclusión se traduce a 409 con las fechas de la ocupación en conflicto.
- **Edición** (`PATCH`): solo carácter, dedicación y `fechaHasta`, y solo en ocupaciones vigentes o
  futuras. Una ocupación pasada da 409. Extender `fechaHasta` hasta solaparse también da 409.
- **Cerrar**: `POST …/cerrar {fechaHasta}` es el atajo para fijar `fechaHasta`, con las mismas validaciones.
- **Anular** (`DELETE`): solo si `fechaDesde > hoy`; si no, 409 con la indicación de cerrar.
- **Baja de puestos**: `PuestosService.baja` consulta las ocupaciones vigentes o futuras del puesto y da
  409 si existen.

### `UsuariosService`

`idPersona` debe existir y estar activa (si no, 400) y no estar vinculada a otro usuario (si no, 409).
Un usuario con rol `docente` sigue exigiendo persona.

## API

Todo bajo `/api`; DTOs con class-validator y `@ApiProperty`; tipos del frontend regenerados con
`npm run api:tipos`.

| Endpoint | Rol | Notas |
| --- | --- | --- |
| `GET /personas` | Todos menos `docente` | Filtros `q` (legajo, apellido o nombre), `activo`, `sinUsuario` |
| `GET /personas/:id` | Todos menos `docente`; el `docente` solo la suya | Incluye situación de revista, ocupaciones vigentes e indicador de usuario vinculado |
| `GET /personas/:id/ocupaciones` | Ídem | Historial completo, por `fecha_desde` descendente |
| `POST /personas`, `PATCH /personas/:id` | `recursos_humanos` | |
| `POST /personas/:id/baja`, `POST /personas/:id/reactivar` | `recursos_humanos` | |
| `POST /personas/:id/ocupaciones` | `recursos_humanos` | |
| `PATCH /personas/:id/ocupaciones/:idPuesto/:fechaDesde` | `recursos_humanos` | |
| `POST /personas/:id/ocupaciones/:idPuesto/:fechaDesde/cerrar` | `recursos_humanos` | Cuerpo `{ fechaHasta }` |
| `DELETE /personas/:id/ocupaciones/:idPuesto/:fechaDesde` | `recursos_humanos` | Solo ocupaciones futuras |
| `GET /puestos/:id/ocupaciones` | Todos menos `docente` | Ocupantes vigentes del puesto |

El mapper de persona omite `documento` y `fechaNacimiento` salvo que el rol sea `recursos_humanos` o
`administrador`. El test existente que exige `@Roles` en toda ruta no pública cubre las rutas nuevas.
Las personas no se filtran por alcance, porque alimentan los selectores de criticidad y sucesión; el
alcance se aplica en esos módulos.

## Frontend (`features/personas`)

- **Personas** (ruta `/personas`, visible para todos los roles menos `docente`): lista a la izquierda,
  con búsqueda por texto, filtro de activos e indicador de usuario vinculado. A la derecha, la ficha con
  los datos y la tabla de ocupaciones: las vigentes primero y después el historial. Los controles de
  alta, edición, baja, reactivación y ocupaciones aparecen solo para `recursos_humanos`.
- **Formularios** (react-hook-form + zod): persona y ocupación. El selector de puesto ofrece solo puestos
  activos, con su código y su unidad. La ocupación se cierra con un diálogo de fecha.
- **Mi ficha** (ruta `/personas/yo`): para el `docente`, su persona y sus ocupaciones en solo lectura.
- **Administración → Usuarios**: selector de personas activas y sin usuario, alimentado por
  `GET /personas?activo=true&sinUsuario=true`.
- **Estructura**: el panel del puesto suma sus ocupantes vigentes (`GET /puestos/:id/ocupaciones`).
- **Administración → Referencia**: los dos dominios nuevos aparecen por el registro en `DOMINIOS`.

## Pruebas

- **Unitarias (vitest, repositorios simulados)**: reglas de fechas; baja de persona bloqueada y
  advertencia de usuario; persona inactiva sin ocupaciones nuevas; edición y anulación según vigencia;
  traducción de `23P01` y de las unicidades a 409; omisión de datos personales por rol; baja de puesto
  bloqueada por ocupaciones; validación de `idPersona` en `UsuariosService`.
- **Integración contra PostgreSQL real** (`*.int.spec.ts`, `npm run test:integracion`): la exclusión
  rechaza el solape en el mismo puesto, permite ocupaciones simultáneas en puestos distintos y permite
  fechas adyacentes; un `fecha_hasta` nulo solapa con una ocupación posterior; CHECKs de persona y de
  ocupación; FK de `usuario.id_persona`; creación de `btree_gist` en la base temporal.
- **Frontend**: validado por escenarios de uso, como el resto.

## Cambios en documentos

- `docs/requerimientos.md`: §5 referencia esta spec y suma los dominios `situacion_revista` y
  `dedicacion` a los administrados por RF23; el recuento de 24 tablas no cambia.
- `README.md`: notas sobre datos personales y sobre `btree_gist`.
- Esta spec pasa a `Implementada` al cerrar el trabajo.

## Fuera de alcance

Los conocimientos de la persona (RF10), las detecciones (RF17, RF19, RF20), las alertas de dotación
frente a `dotacion_prevista`, la importación masiva de personas y la auditoría de cambios.

## Riesgos

- `btree_gist` requiere el permiso `CREATE EXTENSION`. El usuario de la base del compose lo tiene, pero
  hay que verificarlo en la base temporal de integración antes de depender de él.
- "Vigente" depende de la fecha del servidor. Los servicios y las vistas de detección futuras deben usar
  la misma definición, para no contar distinto una ocupación que vence hoy.
- La baja de una persona no desactiva su usuario: queda una sesión posible hasta que el administrador lo
  haga. Se acepta y se advierte en la respuesta.
