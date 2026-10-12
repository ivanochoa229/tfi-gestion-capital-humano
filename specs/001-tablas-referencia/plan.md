# Implementation Plan: Tablas de referencia

**Branch**: `001-tablas-referencia` (trabajo sobre `main`, sin rama dedicada) | **Date**: 2026-10-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-tablas-referencia/spec.md`

## Summary

Diez tablas de referencia (dominios cerrados del modelo) creadas y pobladas por migración, y un
módulo `referencia` que expone su consulta y mantenimiento por una API única parametrizada por
dominio. El borrado de un valor en uso se rechaza (el uso se detecta a partir de las claves
foráneas que apunten a la tabla) y se ofrece desactivarlo. En el frontend, la sección de
administración suma una pantalla con una pestaña por dominio. Cubre RF23 y RNF03; el control de
acceso es provisorio hasta que exista RF22 (ver Complexity Tracking).

## Technical Context

**Language/Version**: TypeScript 6, Node 24+ (backend NestJS 12; frontend React 19 + Vite)

**Primary Dependencies**: TypeORM 1.x, class-validator/class-transformer, @nestjs/swagger; MUI 9, TanStack Query, react-hook-form + zod, openapi-fetch

**Storage**: PostgreSQL (diez tablas nuevas; RustFS no interviene)

**Testing**: vitest en el backend (unitarios con repositorios simulados); el frontend no tiene tests, se valida con `quickstart.md`

**Target Platform**: Docker Compose local (RNF09)

**Project Type**: Aplicación web (backend + frontend en monorepo)

**Performance Goals**: Dominios de decenas de valores; consultas triviales, sin objetivos específicos

**Constraints**: `synchronize` desactivado; migraciones revisadas; nombres en español, snake_case en la base y camelCase en el código

**Scale/Scope**: 10 tablas, ~35 valores iniciales, 1 módulo de backend, 1 pantalla de frontend

Sin NEEDS CLARIFICATION pendientes; las decisiones están en [research.md](research.md).

## Constitution Check

*GATE: debe pasar antes de la Fase 0 y re-evaluarse tras la Fase 1.*

| Principio | Evaluación |
| --- | --- |
| I. Stack fijo | Cumple: no se agregan tecnologías. |
| II. Capas por módulo | Cumple: `referencia.controller` → `referencia.service` → repositorios de TypeORM. Sin lógica de negocio en el controller. |
| III. Esquema solo por migraciones | Cumple: dos migraciones (estructura y datos iniciales), revisadas a mano. |
| IV. Nombres | Cumple: tablas `nivel_dominio`, `estado_plan`, etc.; propiedades en camelCase; DTOs con `@ApiProperty`; tipos del frontend regenerados con `npm run api:tipos`. |
| V. Dominios cerrados en tablas | Es la feature misma. |
| VI. Indicadores no almacenados | No aplica. |
| VII. Trazabilidad | Cubre RF23 y RNF03; RNF01 y RF24 de forma parcial (ver abajo). |
| VIII. Calidad | Plan incluye tests de servicio, catálogo y guard; lint y formato en ambas apps. |
| RNF01 (autenticación obligatoria) | **Desvío justificado** hasta RF22: ver Complexity Tracking. |

Re-evaluación tras la Fase 1: sin cambios; el único desvío es el de RNF01.

## Project Structure

### Documentation (this feature)

```text
specs/001-tablas-referencia/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── referencia.openapi.md
└── tasks.md             # lo genera /speckit-tasks
```

### Source Code (repository root)

```text
backend/src/
├── modules/referencia/
│   ├── entities/
│   │   ├── valor-referencia.base.ts        # codigo, denominacion, activo (+ orden en la variante ordinal)
│   │   ├── nivel-dominio.entity.ts         # una entidad por dominio (10)
│   │   └── ... (nivel-criticidad, tipo-conocimiento, tipo-responsabilidad, tipo-riesgo,
│   │            caracter-ocupacion, estado-preparacion, tipo-accion-transferencia,
│   │            estado-accion-transferencia, estado-plan)
│   ├── dto/                                # crear, actualizar, valor, dominio
│   ├── dominios.ts                         # catálogo: slug → entidad, tabla, ordinal
│   ├── referencia.controller.ts
│   ├── referencia.service.ts
│   ├── referencia.service.spec.ts
│   ├── dominios.spec.ts
│   └── referencia.module.ts                # exporta ReferenciaService
├── common/guards/admin-provisorio.guard.ts (+ .spec.ts)
└── infra/database/migrations/
    ├── <ts>-CrearTablasReferencia.ts
    └── <ts>-CargarValoresReferencia.ts

frontend/src/features/admin/
├── pages/AdminPage.tsx                     # incorpora la sección de tablas de referencia
├── components/{TablaReferencia,FormularioValor}.tsx
└── hooks/{useDominiosReferencia,useValoresReferencia,useGuardarValor}.ts
```

**Structure Decision**: aplicación web existente; se completan los esqueletos
`backend/src/modules/referencia` y `frontend/src/features/admin`, según la constitución. Se
agrega `common/guards` (ya previsto en la arquitectura) y se registra la variable opcional
`ADMIN_TOKEN` en `env.validation.ts` y `.env.example`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| RNF01/RF24 no se cumplen del todo: las escrituras se protegen con un guard provisorio por token (`ADMIN_TOKEN`) y las lecturas quedan abiertas | RF22 (usuarios y roles) no existe aún y esta feature no puede esperar: el resto de los módulos depende de estos valores | Implementar usuarios y roles acá excede el alcance; dejar las escrituras sin protección permitiría alterar dominios cerrados. El guard se reemplaza por el guard de rol real al implementar RF22 |
