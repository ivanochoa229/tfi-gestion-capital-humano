<!--
Sync Impact Report
- Version change: (plantilla sin completar) → 1.0.0
- Principios agregados: I. Stack tecnológico fijo; II. Arquitectura en capas por dominio;
  III. Esquema solo por migraciones revisadas; IV. Convenciones de nombres;
  V. Dominios cerrados en tablas de referencia; VI. Indicadores calculados, no almacenados;
  VII. Trazabilidad a requerimientos; VIII. Calidad antes de integrar
- Secciones agregadas: Restricciones adicionales, Flujo de desarrollo, Governance
- Secciones eliminadas: ninguna
- TODOs diferidos: ninguno
-->
# Constitución del sistema de gestión del conocimiento crítico

## Core Principles

### I. Stack tecnológico fijo
El backend MUST usar NestJS 12 con TypeORM, PostgreSQL y RustFS (almacenamiento compatible con S3).
El frontend MUST usar React, TypeScript y Vite con MUI y TanStack Query. Cambiar o agregar una
tecnología de capa (ORM, motor, librería de UI, gestor de estado) requiere enmendar esta
constitución. Los archivos de los activos de conocimiento se guardan en RustFS y PostgreSQL guarda
solo sus metadatos (RNF08).

### II. Arquitectura en capas por módulo de dominio
Cada dominio del backend es un módulo de NestJS con controller (HTTP y validación de DTO), service
(reglas de negocio) y repositorio de TypeORM. No se usa arquitectura hexagonal ni DDD. Los
controllers MUST NOT contener reglas de negocio ni acceder a repositorios directamente. El
frontend se organiza en `features/<sección>/{pages,components,hooks}`.

### III. Esquema solo por migraciones revisadas
`synchronize` MUST permanecer desactivado. El esquema cambia únicamente mediante migraciones
versionadas; toda migración generada se revisa antes de aplicarse y las vistas de detección se
escriben a mano como migraciones SQL.

### IV. Convenciones de nombres
Los nombres de dominio y de código están en español. En la base se usa snake_case y en el código
camelCase, resueltos por la estrategia de nombres de TypeORM. Los DTOs usan class-validator y
`@ApiProperty`, de modo que Swagger y los tipos generados del frontend reflejen el contrato.

### V. Dominios cerrados en tablas de referencia
Todo atributo de dominio cerrado MUST resolverse mediante una tabla de referencia, no mediante
enums ni textos libres (RNF03). Agregar un valor es un cambio de datos, no de código.

### VI. Indicadores calculados, nunca almacenados
Los indicadores de detección se calculan por consulta sobre los datos vigentes, mediante vistas de
PostgreSQL, y MUST NOT persistirse en columnas ni tablas (RNF04).

### VII. Trazabilidad a requerimientos
Toda feature (spec, plan y tareas) MUST referenciar los RF y RNF de `docs/requerimientos.md` que
cubre. Una feature sin requerimiento asociado no se implementa hasta que se agregue el
requerimiento o se justifique su alcance.

### VIII. Calidad antes de integrar (NON-NEGOTIABLE)
Antes de integrar, el código MUST pasar lint (oxlint) y formato (Prettier) en cada aplicación
modificada, y los tests (vitest) del backend. La lógica nueva de servicios y las vistas de
detección MUST tener tests.

## Restricciones adicionales

- Autenticación obligatoria y autorización por rol en toda operación (RNF01); datos personales
  conforme a la Ley 25.326 (RNF02).
- Altas y modificaciones de criticidad y planes de sucesión registran usuario y fecha (RNF05).
- Entorno exclusivamente local con Docker Compose, imágenes con versión fija y volúmenes
  persistentes (RNF09). Configuración por `.env`, validada al arrancar.
- Los tipos del frontend se generan con `npm run api:tipos`; no se editan a mano.

## Flujo de desarrollo

- El alcance es gestión del conocimiento crítico y sucesión; liquidación de haberes, asistencia y
  evaluación de desempeño quedan fuera.
- Los puntos abiertos del modelo (sección 7 de `docs/requerimientos.md`) se deciden antes de
  implementar el bloque que los usa.
- Los commits no llevan atribución a Claude.

## Governance

Esta constitución prevalece sobre otras prácticas del proyecto. Las enmiendas se documentan en un
commit propio, indicando el cambio y su justificación, y actualizan la versión según SemVer: MAJOR
por eliminar o redefinir un principio de forma incompatible, MINOR por agregar o ampliar
materialmente un principio o sección, PATCH por aclaraciones. Toda revisión de cambios MUST
verificar el cumplimiento de los principios; las desviaciones se justifican por escrito en el plan
de la feature. La guía de trabajo diaria está en `CLAUDE.md` y `README.md`.

**Version**: 1.0.0 | **Ratified**: 2026-10-12 | **Last Amended**: 2026-10-12
