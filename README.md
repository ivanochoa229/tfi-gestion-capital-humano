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
- **El backend no arranca y lista variables inválidas:** falta el `.env` o le falta alguna variable de `.env.example`.
- **El almacenamiento figura sin conexión:** revisar `docker compose logs storage`. La imagen de RustFS está fijada en una versión candidata; si no existe en Docker Hub, usar la más reciente de https://github.com/rustfs/rustfs/releases.
- **Los cambios no se recargan en Windows o macOS:** es una limitación de los volúmenes montados; correr las aplicaciones fuera de Docker como se indica arriba.
