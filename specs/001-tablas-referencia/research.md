# Research: Tablas de referencia

## R1. Una tabla por dominio o una tabla genérica
- **Decision**: diez tablas físicas, con entidades que comparten una clase base.
- **Rationale**: las demás tablas del modelo necesitan claves foráneas con integridad referencial
  real (RNF03); además el uso de un valor se detecta por esas claves.
- **Alternatives**: una tabla única `valor_referencia(dominio, codigo, …)`: más simple de
  mantener pero sin FK por dominio, permitiría asignar un valor del dominio equivocado.

## R2. Detección de "valor en uso"
- **Decision**: consultar el catálogo de PostgreSQL (`pg_constraint`) por las claves foráneas que
  apuntan a la tabla del valor y contar filas que lo referencian.
- **Rationale**: las tablas consumidoras todavía no existen y se agregarán en otras features; así
  el borrado queda protegido sin tocar este módulo cada vez. La FK además impide el borrado
  desde la base como segunda barrera (se traduce el error 23503 a 409).
- **Alternatives**: lista fija de tablas consumidoras (se desactualiza); solo capturar el error
  de FK (no permite dar el mensaje ni el conteo previo).

## R3. Orden de los dominios ordinales
- **Decision**: son ordinales `nivel_dominio`, `nivel_criticidad` y `estado_preparacion`; tienen
  `orden` entero obligatorio con restricción de unicidad. Los demás no tienen columna `orden`
  y se listan por denominación.
- **Rationale**: el spec pide orden "cuando es ordinal"; la comparación nivel acreditado vs.
  requerido usa `orden`.
- **Alternatives**: `orden` opcional en todos (ruido sin uso). Limitación aceptada: la unicidad
  inmediata impide intercambiar dos órdenes en un paso; se resuelve usando un orden libre
  intermedio.

## R4. Formato del código
- **Decision**: se rechaza (no se normaliza) un código que no cumpla `^[a-z][a-z0-9_]{1,39}$`.
- **Rationale**: el código es identificador estable; normalizar en silencio oculta errores.
- **Alternatives**: normalizar a snake_case automáticamente.

## R5. Inmutabilidad del código y desactivación
- **Decision**: el código solo se puede cambiar si el valor no está en uso (409 si lo está). La
  desactivación es el campo `activo` editable por PATCH. Los módulos consumidores validan que
  el valor sea activo mediante `ReferenciaService.validarActivo(dominio, id)`, exportado.
- **Rationale**: FR-011 y FR-012; una FK no puede expresar "activo", por lo que la regla vive en
  la capa de servicio de quien asigna.
- **Alternatives**: trigger en la base (oculto y difícil de revisar).

## R6. Control de acceso provisorio
- **Reemplazada** por usuarios y roles (2026-10-12): las escrituras exigen el rol `administrador`; las lecturas, sesión iniciada.
- **Decision** (histórica): `AdminProvisorioGuard` en las escrituras, que exige el encabezado `x-admin-token`
  igual a `ADMIN_TOKEN` (variable opcional; si no está definida, las escrituras se rechazan
  con 403). Lecturas abiertas hasta contar con autenticación (RF22).
- **Rationale**: no inventa un modelo de usuarios y es fácil de reemplazar por un guard de rol.
- **Alternatives**: esperar a RF22 (bloquea al resto); escrituras abiertas (inseguro).

## R7. Último valor activo y concurrencia
- **Decision**: desactivar el último valor activo se permite; la respuesta incluye
  `advertencia`. Las ediciones concurrentes son de último-guardado-gana, sin columna de versión.
- **Rationale**: es un caso raro con un único rol administrador; coherente con los edge cases
  del spec.

## R8. Valores iniciales
- **Decision**: se cargan en una migración distinta de la de estructura, con `INSERT … ON
  CONFLICT (codigo) DO NOTHING`. Valores en [data-model.md](data-model.md).
- **Rationale**: separar estructura y datos facilita revisar y revertir; la idempotencia evita
  fallos si un valor ya existe.

## R9. Frontend
- **Decision**: una pantalla en `features/admin` con una pestaña por dominio (MUI Tabs), tabla
  de valores con acciones de editar, activar/desactivar y borrar; formulario con
  react-hook-form + zod. El token provisorio se pide una vez y se guarda en `sessionStorage`.
- **Rationale**: respeta convenciones del repo; mínima superficie.
