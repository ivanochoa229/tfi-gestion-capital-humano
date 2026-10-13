# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Sistema de gestión del conocimiento crítico y sucesión (TFI, UTN-FRT). Monorepo con `backend/` (NestJS 12 + TypeORM + PostgreSQL), `frontend/` (React 19 + Vite + MUI + TanStack Query) y RustFS (S3-compatible) vía `docker-compose.yml`. Solo entorno local. README.md (en español) tiene el detalle de puesta en marcha.

## Commands

Setup: `cp .env.example .env && docker compose up --build` (`.env` está en `.gitignore`; las variables esperadas están en `backend/src/infra/config/env.validation.ts`) (frontend :5173, API :3000/api, Swagger :3000/api/docs, salud :3000/api/salud). `backend/src` y `frontend/src` están montados en los contenedores (hot reload); agregar dependencias requiere `--build`.

Sin Docker en las apps (Node 24+ / npm 11 requerido): `docker compose up -d db storage`, luego `npm run start:dev` en `backend/` y `npm run dev` en `frontend/`.

Backend (`cd backend`):
- `npm run lint` (oxlint), `npm run format` (prettier), `npm test` (vitest), un test: `npx vitest run src/infra/database/snake-naming.strategy.spec.ts` o `npx vitest run -t "nombre"`, `npm run test:integracion` (contra PostgreSQL real, requiere `db`)
- Migraciones (compilan primero, usan `dist/`): `npm run migration:generate -- src/infra/database/migrations/Nombre`, `migration:create -- <ruta>` (SQL a mano), `migration:run`, `migration:revert`, `migration:show`. Revisar siempre la migración generada.

Frontend (`cd frontend`): `npm run dev`, `npm run build` (tsc -b + vite), `npm run lint`, `npm run format`. No hay tests.
- `npm run api:tipos` regenera `src/api/esquema.d.ts` desde `/api/docs-json` (backend corriendo); correrlo cada vez que cambia un endpoint o DTO. No editar ese archivo a mano.

## Architecture

- **Backend**: `src/modules/<dominio>` (estructura, personas, conocimiento, criticidad, sucesion, deteccion, usuarios, referencia), cada uno con `entities/`, `dto/`, controller, service y module; todos registrados en `app.module.ts`. Por ahora la mayoría son esqueletos (`.gitkeep`). `src/infra/` tiene config (validación de env en `env.validation.ts`), database, storage (cliente S3), auditoria y salud; `src/common/` guards y decoradores.
- Imports ESM con extensión `.js` (`'./app.module.js'`). `main.ts` usa prefijo global `api`, `ValidationPipe` con `whitelist` + `forbidNonWhitelisted` + `transform`, y publica Swagger en `/api/docs`.
- **Base de datos**: `synchronize` desactivado; el esquema cambia solo por migraciones, que se aplican al arrancar. Nombres de tabla/columna en snake_case y código en camelCase mediante `snake-naming.strategy.ts`. Las vistas de detección se escriben como migraciones SQL manuales.
- **Env**: `.env` en la raíz (leído como `.env` o `../.env`); el backend falla al arrancar listando variables inválidas. En Docker, `docker-compose.yml` sobreescribe hosts/puertos internos (`DB_HOST=db`, `S3_ENDPOINT=http://storage:9000`).
- **Frontend**: `src/features/<sección>/{pages,components,hooks}`; rutas en `router.tsx`. El cliente `api` (openapi-fetch, `src/api/cliente.ts`) usa rutas relativas `/api/...` que el proxy de Vite reenvía al backend (`API_URL`).

## Conventions

- Nombres en español (dominio y código). DTOs con class-validator + `@ApiProperty` (alimentan Swagger y los tipos del frontend).
- Formularios con react-hook-form + zod; llamadas a la API con hooks de TanStack Query dentro de cada feature.
- Antes de subir cambios: `npm run lint` y `npm run format` en cada app, y `npm test` (más `npm run test:integracion` si tocaste migraciones o SQL) en el backend.

## Git

- Los commits no llevan línea `Co-Authored-By` ni ninguna otra atribución a Claude.

## Spec-driven development (Superpowers)

- Flujo: superpowers:brainstorming → spec; superpowers:writing-plans → plan; ejecución con superpowers:executing-plans o superpowers:subagent-driven-development.
- Contexto obligatorio antes de especificar: docs/requerimientos.md y docs/primer-avance.md. Toda spec indica los RF y RNF que cubre.
- Si una spec depende de un punto abierto (docs/requerimientos.md, sección 7), se pregunta y la decisión queda escrita en la spec.
- Specs en docs/superpowers/specs/ y planes en docs/superpowers/plans/, en español, commiteados en la misma rama que el código.
- Cada archivo empieza con una línea de estado:
  - Specs: Estado: Propuesta | Aprobada | Parcial | Implementada | Descartada, más Fecha y Autor.
  - Planes: Estado: Pendiente | En curso | Implementado | Descartado, más Fecha y PR.
- Al cerrar el trabajo se actualiza el Estado; es lo único que indica si está hecho.
- Los planes respetan el stack y la arquitectura de docs/requerimientos.md (secciones 5 y 6): módulos NestJS en capas, cambios de esquema solo por migraciones, DTO con @ApiProperty, frontend con TanStack Query, react-hook-form y zod.
