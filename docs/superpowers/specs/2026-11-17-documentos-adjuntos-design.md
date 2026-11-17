Estado: Implementada | Fecha: 2026-11-17 | Autor: IvanOchoa229

# Documento del plan de sucesión y evidencia de la acreditación

## Contexto y objetivo

En la revisión del 17/11/2026 faltaron dos cargas de archivo:

1. **El plan de sucesión no tiene documento.** El plan existe como registro (puesto, responsable, estado, candidatos y acciones), pero no hay dónde subir el documento del plan que se presenta para aprobación.
2. **La acreditación no guarda la evidencia.** Al acreditar se elige el *tipo* de evidencia (certificado, título, entrevista…), pero el certificado o el título en sí no se puede adjuntar.

El sistema ya sube archivos para los activos de conocimiento (RF11): RustFS guarda el archivo y PostgreSQL los metadatos (RNF08), con validación del tipo por contenido y límite de tamaño. Esta spec reutiliza ese camino.

**Requerimientos que cubre:** RF13 (planes de sucesión), RF10 (acreditación con tipo de evidencia), RNF08 (archivos en almacenamiento de objetos) y RNF05 (auditoría de los planes). Relacionado: RNF02 (la evidencia es un dato personal: se lee con las mismas reglas que el perfil).

## Decisiones

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Documentos por plan | **Uno, reemplazable** (decisión del usuario). Subir otro reemplaza al anterior en el plan; el objeto anterior no se borra de RustFS y su clave queda en la auditoría |
| 2 | Cuándo se sube el documento del plan | Solo con el plan en **borrador**, como el resto de la edición del plan: lo que se presenta para aprobación es lo que la autoridad aprueba |
| 3 | Quién sube el documento del plan | Los mismos que editan el plan: `jefatura_departamento`, dentro de su alcance |
| 4 | Quién descarga el documento del plan | Los lectores de sucesión (`recursos_humanos`, `autoridad`, `jefatura_departamento`, `jefe_catedra`), con el alcance por unidad de siempre |
| 5 | Nueva versión de un plan aprobado | Copia la referencia al documento, igual que copia los candidatos. Las dos versiones apuntan al mismo objeto |
| 6 | Evidencia de la acreditación | **Opcional.** Un archivo por acreditación, que se adjunta al acreditar. Hay tipos de evidencia sin archivo (observación directa) |
| 7 | Cambiar la evidencia | No se puede: la acreditación es de solo inserción. Una evidencia equivocada se corrige con una acreditación nueva |
| 8 | Quién descarga la evidencia | Quien puede leer el perfil de la persona (`exigirLectura`): la propia persona, RR. HH., autoridades y las jefaturas por alcance |
| 9 | Tipos y tamaño | Los de los activos: PDF, DOCX, XLSX, PPTX, ODT, TXT, PNG y JPG, detectados por contenido y coherentes con la extensión; máximo `ACTIVOS_TAMANIO_MAX_MB` |
| 10 | Duplicados | No se rechazan: el mismo certificado puede respaldar varias acreditaciones. Se guarda el hash igual, como dato |

## Modelo

Migración manual `AgregarDocumentosAdjuntos`. El modelo no suma tablas.

**`plan_sucesion`**: `documento_clave` (varchar 500), `documento_nombre` (varchar 255), `documento_tipo_mime` (varchar 100), `documento_tamanio` (int), `documento_hash` (varchar 64). Todas nulas o todas con valor (`CK_plan_sucesion_documento`). Se escriben con `save()`, así que la auditoría registra quién y cuándo cambió el documento, con la clave anterior y la nueva.

**`acreditacion`**: `evidencia_clave`, `evidencia_nombre`, `evidencia_tipo_mime`, `evidencia_tamanio`, `evidencia_hash`, con el mismo criterio (`CK_acreditacion_evidencia`).

Claves en RustFS (bucket `activos-conocimiento`): `planes/{idPlan}/{uuid}-{nombre}` y `evidencias/{idPersona}/{uuid}-{nombre}`.

## API

| Método y ruta | Roles | Qué hace |
| --- | --- | --- |
| `PUT /planes/:id/documento` (multipart, campo `archivo`) | Elaboradores de planes | Sube o reemplaza el documento. 409 si el plan no está en borrador; 415 por tipo; 413 por tamaño. Devuelve el plan |
| `GET /planes/:id/documento` | Lectores de sucesión | Descarga el documento. 404 si el plan no tiene |
| `POST /personas/:id/conocimientos/:idConocimiento/acreditaciones` | Evaluadores | Acepta además `multipart/form-data` con el campo opcional `archivo`. Sin archivo sigue aceptando JSON |
| `GET /personas/:id/conocimientos/:idConocimiento/acreditaciones/:idAcreditacion/evidencia` | Lectores de perfil | Descarga la evidencia. 404 si la acreditación no tiene |

`PlanDto` suma `documento: ArchivoAdjuntoDto | null` y `AcreditacionDto` suma `evidencia: ArchivoAdjuntoDto | null`, con `nombre`, `tipoMime` y `tamanio` (la clave no sale de la API).

Orden de escritura, como en los activos: se valida el archivo, se sube a RustFS y después se escribe la base en una transacción. Si la transacción falla, se borra el objeto recién subido.

## Frontend

- **Plan** (`PlanPage`): bloque «Documento del plan» con el nombre y **Descargar**. En borrador, la jefatura ve **Subir documento** (o **Reemplazar documento**).
- **Acreditar** (`AcreditarDialog`): selector de archivo opcional «Evidencia (opcional)», con los tipos y el tamaño máximo. Si hay archivo, el formulario se envía como `multipart/form-data`.
- **Historial de acreditaciones**: columna con **Descargar evidencia** cuando la hay.

## Pruebas

- Unitarias de los servicios: estado del plan, tipo inválido, compensación (se borra el objeto si falla la base), evidencia ausente.
- Integración contra PostgreSQL con almacenamiento falso (`almacen-falso.ts`): subir y reemplazar el documento del plan, copia en la nueva versión, CHECKs de la migración, acreditación con y sin evidencia.

## Demo y guion

- Archivos de ejemplo en `docs/demo/archivos/`: `plan-sucesion-redes.txt` y `certificado-sql-avanzado.txt`.
- Caso 4: al acreditar a Martín en SQL avanzado se adjunta el certificado y se descarga desde el historial.
- Caso 7: en el plan de Redes (borrador) la jefatura sube el documento antes de presentarlo; la autoridad lo descarga antes de aprobar.

## Fuera de alcance

- Varios documentos por plan, o adjuntos en candidatos y acciones.
- Evidencia obligatoria según el tipo de evidencia.
- Previsualizar archivos en el navegador.
