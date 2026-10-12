Estado: Implementada | Fecha: 2026-10-12 | Autor: IvanOchoa229

# Usuarios y roles: autenticación, autorización, alcance y auditoría

## Contexto y objetivo

El sistema hoy no tiene autenticación. Las tablas de referencia (RF23) se protegen de forma
provisoria con un token (`ADMIN_TOKEN`, `AdminProvisorioGuard`) y sus lecturas están abiertas. Este
bloque incorpora usuarios, roles, sesión, control de alcance por unidad y bitácora de auditoría, y
reemplaza el guard provisorio.

## Requerimientos que cubre

| ID | Cobertura |
| --- | --- |
| RF22 | Gestión de usuarios y roles por el administrador del sistema |
| RF24 | Restricción de criticidad y sucesión a RR. HH., autoridades y jefatura involucrada; el docente solo ve lo propio. Se entregan los mecanismos (roles, alcance, propio); cada módulo de negocio los aplica al implementarse |
| RNF01 | Autenticación obligatoria y autorización por rol en toda operación |
| RNF05 | Usuario y fecha en cada alta o modificación de evaluaciones de criticidad y planes de sucesión |

Cierra el punto abierto "Usuarios y roles" de `docs/requerimientos.md` §7. El resto de los puntos
abiertos de esa sección no depende de este bloque.

## Decisiones

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Modelo de acceso | Roles fijos. Las reglas de qué puede hacer cada rol viven en el código (`@Roles`); no hay permisos configurables |
| 2 | Usuario-persona | `id_persona` opcional y único. `docente` es un rol sin funciones de gestión (requiere persona); candidato a sucesión se deduce de la persona vinculada |
| 3 | Alcance por unidad | Asignación explícita `usuario_unidad`; el alcance incluye las unidades descendientes |
| 4 | Auditoría | Tabla de bitácora `auditoria`, llenada por un subscriber de TypeORM |
| 5 | Autenticación | Passport (estrategia local) con sesión guardada en PostgreSQL; claves con argon2id |
| 6 | Primer administrador | Se crea al arrancar desde `ADMIN_USUARIO` y `ADMIN_CLAVE` si no hay usuarios |
| 7 | Mecanismo | Decoradores y guards propios más un `AlcanceService`; sin CASL ni RLS |
| 8 | Roles por usuario | Un solo rol por usuario |
| 9 | Dependencias aún inexistentes | `id_persona` e `id_unidad` quedan como enteros sin clave foránea; las FK las agregan las migraciones de `personas` y `estructura` |

## Modelo de datos

Cinco tablas nuevas (el modelo pasa de 19 a 24), con nombres en snake_case, creadas por migración.

| Tabla | Contenido y reglas |
| --- | --- |
| `rol` | Siete valores cargados por migración: `analista_puestos`, `recursos_humanos`, `autoridad`, `jefatura_departamento`, `jefe_catedra`, `administrador`, `docente`. Solo lectura: no forma parte de RF23, porque los permisos viven en el código |
| `usuario` | `id_usuario`; `nombre_usuario` (único); `clave_hash`; `id_rol` → `rol` (obligatorio); `id_persona` (opcional, único, sin FK por ahora); `activo` (por defecto `true`). Un usuario con rol `docente` MUST tener `id_persona`. Los usuarios se desactivan, no se borran |
| `usuario_unidad` | Clave compuesta `id_usuario` + `id_unidad` (`id_unidad` sin FK por ahora). Solo se admiten filas para `jefatura_departamento` y `jefe_catedra` |
| `sesion` | La crea el store de sesiones de PostgreSQL (`sid`, `sess`, `expire`) |
| `auditoria` | `id_auditoria`; `entidad`; `id_registro` (texto, admite claves compuestas); `operacion` (`alta`, `modificacion`, `baja`); `id_usuario` → `usuario`; `fecha`; `valores_anteriores` y `valores_nuevos` (JSON) |

Reglas de validación: `nombre_usuario` de 3 a 50 caracteres; clave de al menos 10 caracteres.

## Autenticación

Módulo `modules/usuarios` (con `auth.controller` y `usuarios.controller`) y guards en `common/guards`.

- `POST /api/auth/login` (`nombreUsuario`, `clave`): estrategia local de Passport. Éxito: cookie de
  sesión `httpOnly`, `sameSite=lax`. Cualquier fallo (usuario inexistente, clave incorrecta o
  usuario desactivado) responde 401 con el mismo mensaje genérico.
- `POST /api/auth/logout`: destruye la sesión.
- `GET /api/auth/yo`: `{ id, nombreUsuario, rol, idPersona, unidades }`.
- `PATCH /api/auth/clave`: el usuario cambia su propia clave (clave actual y nueva).
- Sesión: `express-session` con `connect-pg-simple` (tabla `sesion`), vencimiento de 8 horas de
  inactividad, firmada con la variable `SESION_SECRETO`.
- Hash: argon2id (paquete `argon2`, parámetros por defecto).

Fuera de alcance: recuperación de clave por correo, bloqueo por intentos fallidos y tokens CSRF
(sistema solo local; cookie `sameSite=lax` y CORS limitado a `FRONTEND_URL`).

## Autorización

- `SesionGuard` global: exige sesión en toda ruta, salvo las marcadas `@Publico()` (login y
  `/api/salud`).
- `RolesGuard` global: lee `@Roles(...)` de cada endpoint.
- Un test recorre todos los controllers y falla si alguna ruta no pública carece de `@Roles`.
- Módulo `referencia`: las lecturas admiten cualquier rol autenticado; las escrituras llevan
  `@Roles('administrador')`. Se elimina `AdminProvisorioGuard`, `ADMIN_TOKEN` y el campo de token
  de la pantalla de administración.

### Matriz de roles

| Rol | Puede | Alcance |
| --- | --- | --- |
| `analista_puestos` | Estructura, descripciones, relevamientos, catálogo de conocimientos, requisitos y activos (RF01-04, 08, 09, 11) | Global |
| `recursos_humanos` | Personas y ocupaciones (RF06-07), criticidad (RF12), acciones de transferencia (RF15), consultas (RF16-20) y lectura de la bitácora | Global |
| `autoridad` | Tablero y consultas (RF16-21), aprobación de planes (RF13) y lectura de la bitácora | Global |
| `jefatura_departamento` | Validar descripciones (RF05), criticidad (RF12), planes y candidatos (RF13-14) | Sus unidades y descendientes |
| `jefe_catedra` | Validar su cátedra (RF05), acreditar conocimientos de su equipo (RF10) y criticidad (RF12) | Sus unidades y descendientes |
| `administrador` | Usuarios y roles (RF22) y tablas de referencia (RF23). Sin acceso a criticidad ni sucesión | No aplica |
| `docente` | Declarar sus conocimientos (RF10), actualizar sus acciones asignadas (RF15), ver su brecha (RF19). Si figura en `candidato_sucesion`, ve además su plan (candidato) | Solo lo propio, por `id_persona` |

Esta matriz se aplica en cada módulo de negocio al implementarse; este bloque entrega el
mecanismo y lo prueba.

## Alcance por unidad

`AlcanceService` (en `modules/usuarios`):

- `unidadesVisibles(usuario)`: `null` (sin restricción) para los roles globales; para
  `jefatura_departamento` y `jefe_catedra`, las unidades de `usuario_unidad` más sus descendientes,
  calculadas con una consulta recursiva sobre `unidad_organizativa.id_unidad_superior`.
- `exigirUnidad(usuario, idUnidad)`: lanza 403 si la unidad queda fuera del alcance.
- Los services de criticidad y sucesión filtran por `puesto.id_unidad` con ese resultado. Lo propio
  se resuelve comparando con `usuario.id_persona`.

Mientras `unidad_organizativa` no exista, el servicio se prueba con la consulta simulada. La prueba
contra la base real queda como requisito de la spec de `estructura`.

## Auditoría

- `AuditoriaSubscriber` (en `infra/auditoria`) escucha alta, modificación y baja de una lista fija
  de entidades: `evaluacion_criticidad`, `plan_sucesion` y `candidato_sucesion`. La lista se declara
  ya, aunque esas tablas se creen en otros bloques.
- Escribe en `auditoria` dentro de la misma transacción del cambio. En alta y baja guarda el
  registro completo; en modificación, solo las columnas que cambiaron (valor anterior y nuevo).
- El usuario sale de un contexto por petición (`AsyncLocalStorage`), cargado después de
  `SesionGuard`. Si se escribe una entidad auditada sin usuario en el contexto, el subscriber falla
  y la operación se cancela.
- La bitácora es de solo lectura: `GET /api/auditoria` con filtros `entidad` e `idRegistro`, para
  `recursos_humanos` y `autoridad`. Sin pantalla en este bloque.
- Fuera de alcance: auditar usuarios y roles.

## Gestión de usuarios (RF22)

Endpoints, todos con `@Roles('administrador')`:

- `GET /api/usuarios`, `POST /api/usuarios`, `PATCH /api/usuarios/:id` (rol, `idPersona`,
  `idUnidades`, `activo`), `POST /api/usuarios/:id/restablecer-clave`.
- DTOs con class-validator y `@ApiProperty`; tipos del frontend regenerados con `npm run api:tipos`.

## Primer administrador

Al arrancar, si la tabla `usuario` está vacía, el backend crea el administrador (rol
`administrador`, sin persona) con `ADMIN_USUARIO` y `ADMIN_CLAVE`, hasheando la clave en ese
momento. Si no hay usuarios y faltan esas variables, el backend no arranca y lo informa. Si ya hay
usuarios, se ignoran. En `.env.example`, `ADMIN_TOKEN` se reemplaza por `ADMIN_USUARIO`,
`ADMIN_CLAVE` y `SESION_SECRETO`.

## Frontend

- `auth/`: `useSesion` (consulta `/api/auth/yo`), `LoginPage` y `RutaProtegida` con filtro por rol.
- `Layout`: menú filtrado por rol y botón de cerrar sesión.
- Administración: pestaña **Usuarios** (alta, edición, desactivación y restablecimiento de clave)
  con react-hook-form y zod. La asignación de persona y de unidades queda para cuando existan los
  módulos `personas` y `estructura`; hasta entonces el backend acepta los ids pero la pantalla no
  los edita.

## Pruebas

Tests de backend con vitest: hash y verificación de claves; login correcto, incorrecto y de usuario
desactivado; `RolesGuard` con cada rol; cobertura de `@Roles` en todas las rutas; `AlcanceService`
(roles globales, jefatura y jefe de cátedra, con descendientes); subscriber de auditoría (alta,
modificación, baja y falla sin usuario); arranque del primer administrador (con y sin usuarios,
con y sin variables). El frontend se valida por escenarios de uso.

## Cambios en documentos y constitución

- `docs/requerimientos.md`: 24 tablas; stack con `express-session`, `connect-pg-simple`,
  `passport-local` y `argon2`; se cierra el punto abierto de usuarios y roles.
- Constitución: enmienda MINOR del principio I (stack), por las dependencias nuevas.
- Se actualiza `specs/001-tablas-referencia` en lo que reemplaza el guard provisorio (plan,
  contrato y quickstart).

## Riesgos

- El alcance por unidad no se prueba contra la base real hasta que exista `unidad_organizativa`.
- Un rol por usuario puede quedar corto si alguien debe acumular funciones; se resolvería con una
  tabla `usuario_rol`, sin cambiar los guards.
