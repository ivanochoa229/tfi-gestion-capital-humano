# Gestión del conocimiento crítico

Sistema de gestión del conocimiento crítico y planificación de la sucesión del Departamento de Sistemas (UTN-FRT). Trabajo Final Integrador de Gestión de Capital Humano.

| Capa | Tecnología |
| --- | --- |
| Backend | NestJS, TypeORM, PostgreSQL |
| Archivos | RustFS (compatible con S3) |
| Frontend | React, Vite, MUI, TanStack Query, React Router |
| Entorno | Docker Compose, solo local |

## Requisitos

- Docker con Docker Compose.
- Node.js 24 o superior, para correr comandos fuera de Docker (migraciones, tipos, lint). Node 24 trae npm 11; con npm 10 la instalación del backend falla.

## Puesta en marcha

```bash
cp .env.example .env
docker compose up --build
```

| Servicio | Dirección |
| --- | --- |
| Frontend | http://localhost:5173 |
| API | http://localhost:3000/api |
| Documentación de la API (Swagger) | http://localhost:3000/api/docs |
| Estado de los servicios | http://localhost:3000/api/salud |
| Consola de RustFS | http://localhost:9101 (usuario y clave: los de `S3_ACCESS_KEY` y `S3_SECRET_KEY`) |
| PostgreSQL | localhost:5433 (puerto `DB_PORT` y credenciales del `.env`) |

El backend crea el bucket de archivos y aplica las migraciones pendientes al arrancar. El tablero del frontend muestra si la base y el almacenamiento están conectados.

**Acceso:** todo el sistema requiere iniciar sesión. Al arrancar con la tabla de usuarios vacía, el backend crea el administrador con `ADMIN_USUARIO` y `ADMIN_CLAVE` del `.env` (al menos 10 caracteres de clave); `SESION_SECRETO` (32 caracteres o más) firma la cookie de sesión. Las tablas de referencia se administran en http://localhost:5173/admin (rol administrador). Los usuarios y sus roles se gestionan en la pestaña Usuarios de la misma pantalla.

El código de `backend/src` y `frontend/src` está montado en los contenedores: los cambios se recargan solos. Si se agrega una dependencia, hay que reconstruir con `docker compose up --build`.

Para trabajar sin Docker en las aplicaciones, se levanta solo la infraestructura y se corre cada app con npm:

```bash
docker compose up -d db storage
cd backend && npm install && npm run start:dev
cd frontend && npm install && npm run dev
```

## Estructura

```
backend/src/
├── modules/      # un módulo por dominio: estructura, personas, conocimiento,
│                 # criticidad, sucesion, deteccion, usuarios, referencia
├── infra/        # config, database (TypeORM y migraciones), storage, auditoria, salud
└── common/       # guards de rol, decoradores
frontend/src/
├── features/     # una carpeta por sección: pages/, components/, hooks/
├── api/          # cliente tipado y tipos generados desde Swagger
├── auth/         # sesión y rutas protegidas
└── components/   # componentes compartidos
```

Cada módulo del backend sigue la misma forma: `entities/`, `dto/`, `<modulo>.controller.ts`, `<modulo>.service.ts` y `<modulo>.module.ts`.

## Unidades organizativas

La aplicación **no** crea ni edita unidades: las carga el DBA por SQL. La migración deja solo el Departamento de Sistemas. Las cátedras se cargan con `INSERT` bajo ese departamento; el trigger `trg_validar_jerarquia_unidad` rechaza un departamento con superior, una cátedra sin superior y una cátedra cuyo superior no es un departamento.

```sql
INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
SELECT 'Bases de Datos', t.id_tipo_unidad, d.id_unidad
FROM tipo_unidad t, unidad_organizativa d
WHERE t.codigo = 'catedra'
  AND d.denominacion = 'Departamento de Sistemas' AND d.id_unidad_superior IS NULL;
```

Para el entorno local, `backend/scripts/catedras-ejemplo.sql` carga tres cátedras de ejemplo (se puede correr más de una vez):

```bash
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backend/scripts/catedras-ejemplo.sql
```

Cuidados del DBA: el trigger revisa la unidad, no sus puestos. Si se cambia el superior o el tipo de una unidad que ya tiene puestos, o se desactiva una cátedra con puestos activos o usuarios asignados, la aplicación no lo impide: conviene revisar los superiores de los puestos afectados.

## Personas y ocupaciones

- Personas y ocupaciones las carga Recursos Humanos desde la aplicación (`/personas`); no hay `DELETE`: se dan de baja (personas) o se cierran y anulan (ocupaciones).
- Una ocupación no se solapa con otra de la misma persona en el mismo puesto (lo garantiza la base con `btree_gist`); cerrar fija el último día y el siguiente queda libre. Una ocupación que termina antes de hoy es historial y no se modifica.
- Datos personales (Ley 25.326, RNF02): `documento` y `fechaNacimiento` solo los devuelve la API a `recursos_humanos` y `administrador`.
- La baja de una persona o de un puesto se bloquea mientras tengan ocupaciones vigentes o futuras; la baja de la persona no desactiva su usuario.
- La extensión `btree_gist` se crea en la migración y requiere permiso `CREATE EXTENSION` (el usuario de la base del compose lo tiene).

### Importación desde CSV

- Recursos Humanos puede cargar personas y ocupaciones de una vez desde **Personas → Importar CSV** (`/personas/importar`). Es una carga inicial: solo da de alta; un legajo o documento ya existente es un error.
- Descargá la plantilla desde esa pantalla ("Descargar la plantilla"). El archivo tiene una fila por ocupación; las filas con el mismo `legajo` son la misma persona y deben traer los mismos datos personales. Una fila con `unidad`, `puesto`, `fecha_desde`, `fecha_hasta`, `caracter` y `dedicacion` todos vacíos registra a la persona sin ocupación.
- Columnas (todas deben estar en la cabecera, sin repetir ni agregar otras): `legajo`, `apellido`, `nombre`, `documento`, `fecha_nacimiento`, `fecha_ingreso`, `situacion_revista`, `fecha_prevista_retiro`, `unidad`, `puesto`, `fecha_desde`, `fecha_hasta`, `caracter`, `dedicacion`. Fechas `AAAA-MM-DD` o `DD/MM/AAAA`; separador `;` o `,`. La codificación puede ser UTF-8 o Windows-1252 (ANSI, la que genera Excel en español al guardar como CSV); se detecta sola. Pueden quedar vacías `fecha_prevista_retiro` y `fecha_hasta` (esta última, en una ocupación sin fin). En una fila que solo registra a la persona deben estar vacías las seis columnas de ocupación (`unidad`, `puesto`, `fecha_desde`, `fecha_hasta`, `caracter`, `dedicacion`); si completás alguna, las cinco obligatorias (`unidad`, `puesto`, `fecha_desde`, `caracter`, `dedicacion`) deben estar completas. Las filas totalmente vacías (como las deja Excel) se ignoran. No se aceptan libros `.xlsx`: guardalos como CSV.
- `situacion_revista`, `caracter` y `dedicacion` se escriben como la denominación de la tabla de referencia; `unidad` y `puesto`, como las denominaciones de la estructura (solo unidades y puestos activos; si una unidad se repite en ramas distintas, el error lista las rutas candidatas para desambiguar). Unidad, puesto, situación, carácter y dedicación se comparan sin distinguir mayúsculas, tildes ni espacios repetidos.
- Primero se muestra una vista previa sin escribir nada; al confirmar se valida todo de nuevo y se importa todo o nada. Máximo 2 MB (HTTP 413) y 2000 filas (HTTP 400, igual que una cabecera inválida). La tabla de errores muestra el número de fila como en Excel y los mensajes están en español. Mientras corre una importación se toma el bloqueo de estructura: las demás escrituras de estructura y personas esperan a que termine. Si se corta la conexión durante la importación, revisá Personas antes de reintentar. Los errores inesperados del servidor responden con un mensaje genérico y nunca incluyen contenido del CSV.
- El CSV contiene datos personales (Ley 25.326, RNF02): el sistema no lo guarda, pero su custodia y su borrado después de la carga son responsabilidad de Recursos Humanos.

### Catálogo de conocimientos

- **Duplicados:** dos conocimientos activos del mismo tipo no pueden tener la misma `denominacion_normalizada` (minúsculas, sin tildes, espacios colapsados; la `ñ` se conserva). La calcula la aplicación al dar de alta o editar. Si cargás conocimientos con `INSERT` directo en la base, tenés que completar vos esa columna con la misma regla, o el control de duplicados no te protege.
- **Fusión:** un duplicado se retira con «Fusionar» en la pantalla del catálogo (no se puede deshacer). Pasa sus requisitos y los datos de las personas al conocimiento que se conserva.
- **Acreditar:** solo lo hacen la jefatura y los jefes de cátedra, sobre personas con una ocupación vigente en sus unidades. Para que un jefe pueda acreditar, el administrador tiene que vincular su usuario con su persona y asignarle sus unidades. La persona que ocupa la jefatura de departamento no puede ser acreditada por nadie en esta etapa.

### Activos de conocimiento

- **Qué son:** manuales, instructivos y procedimientos vinculados a uno o más conocimientos y a la unidad que los mantiene. Cada uno es un **archivo** (guardado en RustFS, bucket `activos-conocimiento`) o un **enlace** externo.
- **Archivos:** PDF, DOCX, XLSX, PPTX, ODT, TXT, PNG y JPG, hasta `ACTIVOS_TAMANIO_MAX_MB` (20 por defecto). El tipo se valida por el contenido y debe coincidir con la extensión. El servidor calcula el SHA-256: un archivo idéntico al de otro activo vigente se rechaza.
- **Clave del objeto:** `activos/{idActivo}/{uuid}-{nombre}`. La base guarda la clave en `ubicacion`; no hay URLs públicas, la descarga pasa por la API.
- **Vigencia:** `fecha_vigencia` es opcional e informativa. «Vencido» se calcula al consultar; no bloquea nada ni envía avisos.
- **Baja:** lógica. El objeto se conserva en RustFS y la baja libera el hash. Reemplazar un archivo borra el anterior, sin historial.
- **Vínculos:** al editar un activo se conservan los vínculos a conocimientos que después se dieron de baja; solo los conocimientos que se agregan deben estar activos.
- **Quién escribe:** analista de puestos y administrador en cualquier unidad; jefe de cátedra y jefatura de departamento dentro de su alcance. Todos los usuarios consultan y descargan.
- **Si cargás datos por SQL:** respetá el CHECK (un `archivo` lleva `nombre_original`, `tipo_mime`, `tamanio` y `hash`; un `enlace`, ninguno) y subí el objeto con la clave que pongas en `ubicacion`.

### Criticidad

- **Quién evalúa:** Recursos Humanos, la jefatura y los jefes de cátedra con el puesto en su alcance. Las autoridades solo leen; el docente, el analista de puestos y el administrador no acceden a las evaluaciones (el administrador solo edita la matriz).
- **Cómo se calcula:** se cargan el impacto de pérdida y la dificultad de reemplazo, y el nivel lo calcula la matriz de criticidad, editable en Administración → Matriz de criticidad. Cambiar la matriz no altera las evaluaciones ya guardadas.
- **Qué se evalúa:** solo los conocimientos que el puesto exige (sus requisitos).

## Flujo de trabajo

### Migraciones

El esquema cambia solo por migraciones (`synchronize` está desactivado). Desde `backend/`, con la base levantada:

```bash
# Genera una migración a partir de los cambios en las entidades
npm run migration:generate -- src/infra/database/migrations/NombreDeLaMigracion

# Crea una migración vacía para escribir SQL a mano (por ejemplo, las vistas de detección)
npm run migration:create -- src/infra/database/migrations/NombreDeLaMigracion

npm run migration:run      # aplica las pendientes
npm run migration:revert   # deshace la última
npm run migration:show     # lista aplicadas y pendientes
```

Revisen siempre la migración generada antes de aplicarla.

Los índices con `lower()`, el trigger y la secuencia de `estructura` se escriben a mano en la migración y no están en las entidades: si `migration:generate` propone borrarlos, quitar esas líneas.

### Tests de integración

`npm test` corre solo tests unitarios. `npm run test:integracion` (requiere `docker compose up -d db`; dentro de Docker, `docker compose exec -T backend npm run test:integracion`) crea una base PostgreSQL temporal, le aplica las migraciones y prueba restricciones, triggers y consultas recursivas reales. Los archivos se llaman `*.int.spec.ts`.

### Tipos de la API en el frontend

Con el backend corriendo, desde `frontend/`:

```bash
npm run api:tipos
```

Regenera `src/api/esquema.d.ts` a partir del Swagger. El cliente `api` de `src/api/cliente.ts` queda tipado con esas rutas. Hay que correrlo cada vez que cambia un endpoint o un DTO.

### Convenciones

- Nombres en español, como el modelo de datos. En la base, snake_case (`fecha_prevista_retiro`); en el código, camelCase (`fechaPrevistaRetiro`). La conversión es automática.
- DTO validados con class-validator y documentados con `@ApiProperty`, para que aparezcan en Swagger y en los tipos del frontend.
- Formularios con react-hook-form y zod; llamadas a la API con hooks de TanStack Query dentro de cada feature.
- Antes de subir cambios: `npm run lint` y `npm run format` en cada aplicación, y `npm test` en el backend.

## Problemas comunes

- **"port is already allocated":** otro programa usa ese puerto en tu máquina. Cambiá el puerto correspondiente en el `.env` (`DB_PORT`, `S3_PORT`, `S3_CONSOLE_PORT`, `PORT` o `FRONTEND_PORT`); si es `S3_PORT`, actualizá también `S3_ENDPOINT`.
- **El backend no arranca y pide ADMIN_USUARIO y ADMIN_CLAVE:** la base no tiene usuarios; definilos en el `.env` (o restaurá la base).
- **El backend no arranca y lista variables inválidas:** falta el `.env` o le falta alguna variable de `.env.example`.
- **El almacenamiento figura sin conexión:** revisar `docker compose logs storage`. La imagen de RustFS está fijada en una versión candidata; si no existe en Docker Hub, usar la más reciente de https://github.com/rustfs/rustfs/releases.
- **Los cambios no se recargan en Windows o macOS:** es una limitación de los volúmenes montados; correr las aplicaciones fuera de Docker como se indica arriba.
