Estado: Implementado | Fecha: 2026-11-17 | PR: pendiente

# Documento del plan de sucesión y evidencia de la acreditación: plan de implementación

**Objetivo:** subir y descargar el documento de un plan de sucesión (uno por plan, reemplazable en borrador) y adjuntar un archivo de evidencia opcional al acreditar un conocimiento.

**Spec:** `docs/superpowers/specs/2026-11-17-documentos-adjuntos-design.md`

**Arquitectura:** las validaciones de archivo de los activos (`archivo.ts`) pasan a ser compartidas (`prepararArchivo`, `claveEnCarpeta`). Columnas nuevas en `plan_sucesion` y `acreditacion` por migración manual; los servicios suben a RustFS antes de escribir la base y borran el objeto si la transacción falla.

## Global Constraints

- Esquema solo por migración (`1792500000000-AgregarDocumentosAdjuntos`), con `@Check` equivalente en las entidades.
- El plan se escribe con `save()` para que la auditoría registre el cambio de documento (RNF05).
- Tipos y tamaño: los de los activos (`ACTIVOS_TAMANIO_MAX_MB`).
- `esquema.d.ts` regenerado con `npm run api:tipos` y sin formatear.

## Tareas

### 1. Base y archivos compartidos

- [x] Migración con las columnas `documento_*` y `evidencia_*` y sus CHECK de todo o nada.
- [x] `prepararArchivo`, `ArchivoSubido`, `ArchivoPreparado` y `claveEnCarpeta` en `conocimiento/archivo.ts`; `ActivosService` los usa.
- [x] `ArchivoAdjuntoDto` y `aArchivoAdjunto`.

### 2. Evidencia de la acreditación

- [x] `AcreditarDto` convierte los números de un multipart (`@Type(() => Number)`).
- [x] `AcreditacionesService.acreditar` acepta el archivo opcional; `evidencia()` lo descarga tras `exigirLectura`.
- [x] `POST …/acreditaciones` acepta JSON o multipart; `GET …/acreditaciones/:id/evidencia`.
- [x] Unitarios (clave, metadatos, tipo inválido, compensación, acceso) e integración (CHECK).

### 3. Documento del plan

- [x] `PlanesService.subirDocumento` (solo borrador, alcance de la jefatura) y `documento()`; `nuevaVersion` copia la referencia.
- [x] `PUT /planes/:id/documento` y `GET /planes/:id/documento`; Multer en `SucesionModule`.
- [x] Integración: subir, reemplazar con auditoría, descargar, 409 fuera de borrador, 403 fuera de alcance, copia en la nueva versión.

### 4. Frontend

- [x] `src/api/archivos.ts` (`enviarMultipart`, `descargarArchivo`), usado también por los activos.
- [x] `AcreditarDialog` con «Evidencia (opcional)»; historial con **Descargar evidencia**.
- [x] `DocumentoDelPlan` en `PlanPage`.

### 5. Demo y verificación

- [x] Archivos de ejemplo `certificado-sql-avanzado.txt` y `plan-sucesion-redes.txt`; guion (pasos 4.5, 4.6, 7.6b a 7.8).
- [x] Prueba por la API contra RustFS y recorrido en el navegador con Playwright.
