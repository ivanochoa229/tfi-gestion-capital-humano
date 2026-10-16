Estado: Propuesta | Fecha: 2026-10-16 | Autor: IvanOchoa229

# Conocimiento: activos de conocimiento

## Contexto y objetivo

Los activos de conocimiento son la documentación (manuales, instructivos, procedimientos) que respalda un
conocimiento del catálogo. Este bloque permite registrarlos, vincularlos a los conocimientos que
documentan y a la unidad que los mantiene, guardar su archivo en RustFS y consultarlos y descargarlos.
Deja la documentación localizable para las acciones de transferencia de tipo "documentación" que se
implementarán en el bloque de sucesión.

Contexto leído: `docs/requerimientos.md` (incluida la sección 4, decisión de almacenamiento),
`docs/primer-avance.md` y la spec del catálogo de conocimiento. `StorageService` ya ofrece `subir`,
`descargar` y `eliminar` sobre el bucket `activos-conocimiento`, que se crea al arrancar.

## Requerimientos que cubre

| ID | Cobertura |
| --- | --- |
| RF11 | Alta, edición, reemplazo de archivo, baja y consulta de activos, vinculados a uno o más conocimientos y a una unidad |
| RF23 | Dominio nuevo de referencia `tipo_documento`: el catálogo pasa de 17 a 18 dominios |
| RNF01 | Todas las operaciones con `@Roles`; alcance por unidad para jefaturas |
| RNF02 | Los activos no contienen datos personales; la lectura queda abierta a todo usuario autenticado |
| RNF03 | Dominio cerrado por tabla de referencia; coherencia archivo/enlace y duplicados impedidos por la base |
| RNF04 | La vigencia (`vencido`) se calcula por consulta y no se almacena |
| RNF08 | Los archivos van a RustFS; PostgreSQL guarda solo los metadatos y la clave del objeto |

Cierra el punto abierto de `docs/requerimientos.md` §7.2 sobre la relación de un activo con los
conocimientos (uno o muchos). No toca los demás puntos abiertos.

## Decisiones

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Relación con conocimientos | Muchos: tabla puente `activo_conocimiento_conocimiento`. `activo_conocimiento` pierde la FK `id_conocimiento` del modelo original. Se exige al menos un vínculo, validado en el servicio dentro de la transacción |
| 2 | Tipos de archivo | PDF, DOCX, XLSX, PPTX, ODT, TXT, PNG y JPG. Se valida por la firma de bytes y no solo por la extensión; TXT se acepta si es UTF-8 válido y sin bytes nulos. Otro tipo responde 415 |
| 3 | Tamaño máximo | 20 MB, configurable con `ACTIVOS_TAMANIO_MAX_MB` en `env.validation.ts`. Superado, responde 413 |
| 4 | Clave del objeto | `activos/{idActivo}/{uuid}-{nombreSaneado}`: sin colisiones y legible. El nombre se sanea (sin rutas ni caracteres de control) |
| 5 | Duplicados | SHA-256 calculado en el servidor. Si existe un activo **activo** con el mismo hash se responde 409 con el `idActivo` existente. Lo respalda un índice único parcial en la base, y se captura la violación en una carrera |
| 6 | Versiones | Sin historial de archivos. Reemplazar sobrescribe `ubicacion`, `nombre_original`, `tipo_mime`, `tamanio` y `hash`, y borra el objeto anterior. Los metadatos se editan sin tocar el archivo |
| 7 | Activo sin archivo | Se admite: `origen = 'enlace'` con `ubicacion` igual a una URL `http(s)`. Los enlaces no entran en el control de duplicados |
| 8 | Vigencia | Informativa. `fecha_vigencia` es opcional; `vencido` se calcula por consulta (`fecha_vigencia < CURRENT_DATE`). Sin bloqueo de descarga ni avisos; hay etiqueta y filtro |
| 9 | Escritura | `analista_puestos` y `administrador` en cualquier unidad. `jefe_catedra` y `jefatura_departamento` solo si la unidad del activo está en su alcance (`AlcanceService`), verificado también sobre la unidad destino en una edición |
| 10 | Lectura y descarga | Todos los roles autenticados, incluido `docente`. La descarga pasa por el backend; no se exponen URLs de RustFS. Los activos dados de baja solo los ven y descargan los roles de escritura |
| 11 | Baja | Baja lógica con `activo = false`. El objeto se conserva en RustFS y la baja se revierte con reactivar. La baja libera el hash; reactivar vuelve a comprobarlo. Sin borrado físico por la API |
| 12 | Subida | Multipart al backend (Multer en memoria). Se descartan la URL prefirmada y el streaming con hash incremental: el backend debe ver los bytes para validar y calcular el hash, y 20 MB no justifica más complejidad |
| 13 | Consistencia | Subir a RustFS y guardar en PostgreSQL no es atómico. Alta: se sube, se guarda en transacción y, si la base falla, se borra el objeto recién subido. Reemplazo: se sube el nuevo, se actualiza la fila y recién después se borra el anterior. Si falla la subida, no se escribe nada en la base |
| 14 | Auditoría | Sin auditoría de RNF05 (cubre solo criticidad y sucesión). Alcanzan `creado_en` y `actualizado_en` |

## Modelo de datos

El modelo pasa de 25 a 26 tablas (suma la tabla puente; `activo_conocimiento` ya figuraba en el modelo
original). Una migración nueva.

### Tabla de referencia nueva

`tipo_documento`, con la misma estructura que las existentes (`id`, `codigo` único, `denominacion`
única, `activo`). Se carga por migración con manual, instructivo y procedimiento, y se registra en
`DOMINIOS`.

### `activo_conocimiento`

| Columna | Detalle |
| --- | --- |
| `id_activo` | PK |
| `titulo` | Obligatorio, máximo 200 caracteres |
| `id_tipo_documento` | FK a `tipo_documento` |
| `id_unidad` | FK a `unidad_organizativa`: la unidad que mantiene el activo |
| `origen` | `archivo` o `enlace` |
| `ubicacion` | Clave del objeto en el bucket, o URL `http(s)` si es enlace |
| `nombre_original` | Nombre del archivo subido; nulo si es enlace |
| `tipo_mime`, `tamanio`, `hash` | Nulos si es enlace |
| `fecha_vigencia` | Opcional |
| `activo` | Booleano, para la baja lógica |
| `creado_en`, `actualizado_en` | Marcas de tiempo |

- CHECK: `tipo_mime`, `tamanio`, `hash` y `nombre_original` están todos presentes si `origen = 'archivo'`
  y todos nulos si `origen = 'enlace'`.
- Índice único parcial sobre `hash` donde `activo` es verdadero y `hash` no es nulo.

### `activo_conocimiento_conocimiento` (puente)

PK `(id_activo, id_conocimiento)`, con FK a `activo_conocimiento` y a `conocimiento`.

## API

Módulo `conocimiento` (controller, service y DTOs de activos; no se crea un módulo nuevo). Rutas bajo
`/api/activos`, con `@Roles` y `@ApiProperty` en los DTOs.

| Método y ruta | Qué hace | Roles |
| --- | --- | --- |
| `GET /activos` | Lista paginada. Filtros: `idConocimiento`, `idUnidad`, `idTipoDocumento`, `vencido`, `q` (título), `incluirBajas` | Todos los autenticados |
| `GET /activos/:id` | Detalle con conocimientos vinculados e indicador `vencido` y días a vencer | Todos |
| `GET /activos/:id/descarga` | Streamea el archivo con `Content-Disposition: attachment` y el `tipo_mime` guardado. Para un enlace responde 409 | Todos |
| `POST /activos` | Alta, `multipart/form-data` con campo `archivo` opcional; sin archivo exige `ubicacion` (URL) | Escritura |
| `PATCH /activos/:id` | Edita metadatos y vínculos, sin tocar el archivo | Escritura |
| `PUT /activos/:id/archivo` | Reemplaza el archivo (solo activos de origen `archivo`) | Escritura |
| `POST /activos/:id/baja` y `/reactivar` | Baja lógica y su reversa | Escritura |

Reglas adicionales: en el reemplazo, si el hash nuevo coincide con otro activo activo se rechaza como en
el alta, y si coincide con el del propio activo se responde 409 "el archivo es idéntico". Las listas de
roles de escritura y de alcance se centralizan en el módulo, como en el resto del código.

## Frontend

Dentro de la feature `conocimiento` (`pages/`, `components/`, `hooks/`). Antes de escribir código se
regeneran los tipos con `npm run api:tipos`.

- **Rutas:** `conocimiento/activos` → `ActivosPage`, visible para todos los roles autenticados. La ficha
  de cada conocimiento suma un bloque "Documentación" con sus activos y un botón "Agregar activo" con el
  conocimiento precargado.
- **`ActivosPage`:** tabla paginada (título, tipo, unidad, conocimientos, vigencia, origen) con filtros
  por título, conocimiento, unidad, tipo, "solo vencidos" y "mostrar bajas" (solo roles de escritura).
  Acciones por fila: descargar o abrir el enlace, y para quienes escriben, editar, reemplazar y
  baja/reactivar. Los botones se ocultan según rol y alcance, pero decide el backend.
- **Componentes nuevos:** `FormularioActivo` (react-hook-form + zod; selector archivo/enlace, selector
  múltiple de conocimientos con al menos uno, validación previa de tamaño y tipo en el cliente),
  `ReemplazarArchivoDialog`, `BajaActivoDialog` y `ChipVigencia` ("Vencido" o "Vence en N días" si
  faltan 30 o menos; lleva texto, no solo color).
- **Hooks:** `hooks/useActivos.ts` con lista, detalle y mutaciones, que invalidan las consultas de
  activos. El alta y el reemplazo usan `FormData` (serialización propia o `fetch` directo, porque
  `openapi-fetch` no maneja multipart cómodamente). La descarga es una petición autenticada que arma un
  `Blob`, porque un enlace simple no llevaría el token.
- **Errores:** 409 por duplicado con el título del activo existente y enlace a su fila; 413 y 415 con
  el tamaño máximo y los tipos permitidos leídos de la respuesta; si falla la red, el formulario
  conserva lo ingresado y permite reintentar. La subida admite arrastrar y soltar y el selector clásico.

## Pruebas

- **Unitarias (backend, vitest):** validación por firma de bytes, saneado de nombres, armado de la clave,
  cálculo del hash, permisos y alcance, y el orden subir/guardar/borrar con el borrado compensatorio si
  falla la base.
- **Integración (contra PostgreSQL):** el CHECK archivo/enlace, el índice único parcial de hash (incluida
  la carrera de dos altas simultáneas), la tabla puente y la baja que libera el hash.
- **Frontend:** sin tests en el proyecto; se verifica con `lint` y `build` y una pasada manual con el stack
  levantado.

## Fuera de alcance

- Historial de versiones de un archivo.
- Notificaciones o avisos de vencimiento.
- Borrado físico de objetos en RustFS.
- Vista previa en línea del contenido.
- Vínculo de un activo con acciones de transferencia (bloque de sucesión).

## Riesgos

- **Objetos huérfanos:** si el proceso se cae entre la subida a RustFS y el guardado en la base, queda un
  objeto sin fila. Es aceptable en un entorno local; una limpieza periódica queda fuera de alcance.
- **Crecimiento del bucket:** la baja lógica conserva los objetos y el reemplazo borra solo el anterior.
