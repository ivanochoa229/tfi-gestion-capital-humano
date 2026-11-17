Estado: Implementado | Fecha: 2026-11-17 | PR: pendiente

# Acreditación según la jerarquía de puestos: plan de implementación

**Objetivo:** que solo acredite el conocimiento de una persona quien tiene rol de evaluador y ocupa hoy un puesto superior, a cualquier profundidad, a alguno de los puestos que esa persona ocupa hoy.

**Spec:** `docs/superpowers/specs/2026-11-17-acreditacion-por-jerarquia-design.md`

**Arquitectura:** una consulta recursiva sobre `puesto.id_puesto_superior` en `perfil.sql.ts`, usada por `AccesoPerfilService` (acreditar y permiso) y por la bandeja de pendientes. Un endpoint de solo lectura para que el frontend sepa si ofrecer el botón. Sin migraciones.

## Global Constraints

- Sin cambios de esquema; nombres en español; imports ESM con `.js`.
- `usuario_unidad` sigue rigiendo la lectura, criticidad, sucesión y detección.
- DTO nuevo con `@ApiProperty`; tipos del frontend regenerados con `npm run api:tipos`.
- Antes de cerrar: `npm run lint`, `npm run format`, `npm test` y `npm run test:integracion` en `backend/`; `npm run lint`, `npm run format` y `npm run build` en `frontend/`.

## Tareas

### 1. Consulta de subordinación

- [x] `SQL_ES_SUBORDINADO` en `backend/src/modules/conocimiento/perfil.sql.ts`: CTE recursivo que parte de los puestos activos que el evaluador ocupa hoy y baja por `id_puesto_superior` (solo puestos activos, profundidad ≥ 1). Responde si la persona ocupa hoy alguno de esos puestos.
- [x] `SQL_PENDIENTES` filtra con el mismo CTE (parámetro: persona del evaluador) en lugar de unidades.

### 2. Servicio de acceso

- [x] `AccesoPerfilService.exigirEvaluacion`: rol evaluador → persona vinculada → no autoacreditación → `esSuperior`.
- [x] `AccesoPerfilService.permisoDeAcreditar`: las mismas reglas, devolviendo `{ puedeAcreditar, motivo }`.
- [x] Unitarios en `acceso-perfil.service.spec.ts`.

### 3. Bandeja y endpoint

- [x] `PerfilConocimientoService.pendientes` usa `sesion.idPersona`; sin persona, lista vacía.
- [x] `PermisosPerfilDto` y `GET /personas/:idPersona/conocimientos/permisos` (tras `exigirLectura`).
- [x] Integración en `acreditaciones.int.spec.ts` y en la de la bandeja: directo, dos niveles, par, hacia arriba, otra cátedra, dos cargos, ocupación vencida.

### 4. Datos de demo

- [x] `PuestoDemo` admite `unidad` (cátedra o departamento) y `superior`; `cargar-demo.ts` carga los superiores después de crear todos los puestos.
- [x] Puesto `P-DEP-JEF`, persona `DEMO-010` (Gómez, Andrea) y su ocupación; `demo.jefatura` vinculado a ella.
- [x] Evaluador histórico de cada acreditación: el superior de la persona.
- [x] `cargar-demo.int.spec.ts` comprueba superiores y la persona de `demo.jefatura`.

### 5. Frontend

- [x] Hook `usePermisosPerfil(idPersona)` y uso en `ConocimientosDePersona`: botones solo con `puedeAcreditar`; motivo visible si no.
- [x] `npm run api:tipos`.

### 6. Documentación y verificación

- [x] Guion de la demo (casos 2 y 4, tabla de usuarios) y README.
- [x] Nota en la spec del catálogo (decisión 7 reemplazada) y en `docs/requerimientos.md`.
- [x] Levantar con volúmenes vacíos y comprobar por la API: la jefa de Bases de Datos acredita a Martín y no a Diego; la jefatura acredita a Diego; bandejas de cada una.
