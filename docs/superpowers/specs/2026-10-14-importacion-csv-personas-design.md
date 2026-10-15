Estado: Aprobada | Fecha: 2026-10-14 | Autor: IvanOchoa229

# Importación de personas y ocupaciones desde CSV

## Contexto y objetivo

OE4 pide registrar a todos los docentes con ocupación vigente, incluidas las ocupaciones simultáneas.
El ABM de Personas (spec `2026-10-13-personas-ocupaciones-design.md`) carga de a una persona y de a una
ocupación, lo que es inviable para la carga inicial del departamento. Este bloque agrega una importación
masiva desde un CSV que Recursos Humanos prepara a partir de su planilla.

Es una **carga inicial única**, repetible mientras se depura la planilla. No es una sincronización: solo
da de alta, no actualiza personas existentes. Aplica exactamente las mismas reglas que el ABM, sin
atajos, y no deja cargas parciales.

## Requerimientos que cubre

| ID | Cobertura |
| --- | --- |
| RF06 | Alta masiva de personas, con fecha prevista de retiro opcional |
| RF07 | Alta masiva de ocupaciones con vigencia, carácter y dedicación; varias simultáneas por persona |
| RNF02 | El CSV contiene datos personales: se procesa en memoria, no se guarda ni se registra, y solo `recursos_humanos` lo usa y ve el reporte |
| RNF03 | Dominios cerrados y sin solapes, por las mismas reglas del ABM y la restricción de exclusión de la base |

Apoya el objetivo OE4 en su parte de personas y ocupaciones. No toca los puntos abiertos de
`docs/requerimientos.md` §7.

## Decisiones

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Uso | Carga inicial única, repetible durante la depuración. Sin sincronización |
| 2 | Quién | Solo `recursos_humanos` |
| 3 | Formato | Un CSV plano, una fila por ocupación; las filas con el mismo `legajo` forman una persona |
| 4 | Errores | Vista previa sin escribir y confirmación todo o nada, en una transacción |
| 5 | Existentes | Un legajo o documento ya existente es error; la importación solo da de alta |
| 6 | Puesto | Columnas `unidad` y `puesto` con denominaciones; una unidad ambigua falla listando las candidatas |
| 7 | Arquitectura | Reusar los servicios de personas y ocupaciones dentro de una transacción única, con un savepoint por fila |
| 8 | Dominios | Se nombran por su denominación, sin distinguir mayúsculas ni tildes |
| 9 | Sin estado | La confirmación reenvía el archivo y vuelve a validar todo; el servidor no guarda nada entre pasos |
| 10 | Auditoría | La importación no se audita (RNF05 cubre solo criticidad y sucesión) |

## Formato del CSV

- UTF-8, con BOM tolerado. El separador `;` o `,` se detecta en la cabecera; las comillas dobles admiten
  textos con separador.
- Cabecera obligatoria con las 14 columnas siguientes, con estos nombres exactos y en cualquier orden. Una
  columna faltante, repetida o desconocida rechaza el archivo (así un nombre mal escrito no descarta datos
  en silencio). Las filas completamente vacías, como las que deja Excel, se ignoran:

| Columna | Obligatoria | Notas |
| --- | --- | --- |
| `legajo`, `apellido`, `nombre`, `documento` | Sí | Mismas validaciones que `CrearPersonaDto` (documento de 7 u 8 dígitos sin puntos) |
| `fecha_nacimiento`, `fecha_ingreso` | Sí | `AAAA-MM-DD` o `DD/MM/AAAA` |
| `situacion_revista` | Sí | Denominación del dominio |
| `fecha_prevista_retiro` | No | |
| `unidad`, `puesto` | Con ocupación | Denominaciones; la unidad se busca entre las activas |
| `fecha_desde` | Con ocupación | |
| `fecha_hasta` | No | Vacía: ocupación sin fin |
| `caracter`, `dedicacion` | Con ocupación | Denominación del dominio |

- **Agrupación:** las filas con el mismo `legajo` forman una persona y sus datos personales deben ser
  idénticos; la fila que discrepa da error. Una fila con `unidad`, `puesto`, `fecha_desde`, `caracter` y
  `dedicacion` vacíos registra la persona sin ocupación. Una fila con solo algunas de esas columnas es
  error.
- **Límites:** 2 MB y 2000 filas. Más que eso se rechaza entero.
- **Plantilla:** `GET /personas/importacion/plantilla` devuelve un CSV con la cabecera y una fila de
  ejemplo.

## Arquitectura

Código nuevo en `backend/src/modules/personas/importacion/`; el resto son cambios chicos en servicios
existentes.

### Refactor de los servicios existentes

`PersonasService.crear` y `OcupacionesService.crear` abren hoy su propia transacción sobre sus
repositorios inyectados, así que no pueden sumarse a una transacción externa. Cada uno separa el cuerpo
de la operación en un método que recibe el `EntityManager` y no abre transacción (`crearCon(manager,
dto)`). El método público actual queda como un envoltorio: abre la transacción con
`enTransaccionDePersonas` y llama al cuerpo. Su comportamiento y sus tests no cambian.

### Componentes de la importación

- **Parser de CSV** (`csv-parse`): convierte el archivo en filas con número de fila, detecta el
  separador, valida la cabecera, normaliza las fechas y aplica los límites.
- **Agrupador:** arma las personas por legajo y detecta discrepancias entre filas y filas con la
  ocupación incompleta.
- **Resolvedor de referencias:** una lectura previa de los dominios (situación, carácter, dedicación) y
  de las unidades y puestos activos; traduce denominaciones a ids. Una unidad con más de una coincidencia
  falla con las candidatas, y un puesto se busca dentro de su unidad.
- **`ImportacionService`:** orquesta el flujo y devuelve el reporte.
- **`ImportacionController`:** los dos endpoints. Solo `recursos_humanos`. El test existente que exige
  `@Roles` en toda ruta no pública cubre las rutas nuevas.

### Ejecución

1. Parsear y validar la forma del archivo. Cabecera incompleta o con columnas desconocidas, archivo
   vacío o más de 2000 filas dan 400; un archivo de más de 2 MB da 413 (lo corta la carga multipart).
   No se sigue.
2. Resolver las referencias de cada fila. Los errores se acumulan con su número de fila.
3. Abrir una transacción con el bloqueo de estructura (una sola vez) y recorrer las filas en orden. Cada
   persona se da de alta con `PersonasService.crearCon` y cada ocupación con
   `OcupacionesService.crearCon`. Cada fila corre en un savepoint, de modo que un fallo no aborta la
   transacción y se reúnen todos los errores del archivo. Si una persona falla, sus ocupaciones se
   omiten con el error "persona rechazada".
4. Si hay errores o `confirmar` es `false`, rollback. Si no, commit.

Los solapes dentro del propio archivo los detectan las mismas reglas que el ABM, porque las ocupaciones
anteriores del archivo ya están insertadas en la transacción; la exclusión de la base es el respaldo.

## API

Todo bajo `/api`; DTOs con class-validator y `@ApiProperty`; tipos del frontend regenerados con
`npm run api:tipos`.

| Endpoint | Rol | Notas |
| --- | --- | --- |
| `POST /personas/importacion` | `recursos_humanos` | Multipart: campo `archivo` y `confirmar` (booleano, por defecto `false`) |
| `GET /personas/importacion/plantilla` | `recursos_humanos` | CSV de ejemplo |

Respuesta de `POST` (200 siempre que el archivo se pueda procesar):

```
{ importado: boolean,            // true solo si confirmar=true y no hubo errores
  filas, personas, ocupaciones,  // lo creado, o lo que se crearía en la vista previa
  errores: [{ fila, columna?, mensaje }] }
```

La fila es la del archivo con la cabecera como fila 1, para ubicarla en Excel. Los mensajes reusan los
del ABM (por ejemplo, "El legajo X ya lo tiene Pérez, Ana").

## Frontend (`features/personas`)

- Botón "Importar CSV" en Personas, solo para `recursos_humanos`, que lleva a `/personas/importar`.
- **Tres pasos:** (1) elegir el archivo, con enlace para descargar la plantilla; (2) vista previa, que
  llama con `confirmar=false` y muestra el resumen y la tabla de errores (fila, columna, mensaje), con
  confirmar deshabilitado mientras haya errores; (3) confirmar, que reenvía el mismo archivo con
  `confirmar=true`, bloquea los botones mientras corre y al terminar enlaza a la lista de personas.
- Si la confirmación devuelve errores (algo cambió entre la vista previa y la confirmación), se vuelve
  al paso 2 con el nuevo reporte; no se escribió nada.
- Un hook de TanStack Query (`useMutation`) sube el `FormData`. No usa react-hook-form ni zod, porque el
  formulario es solo un archivo. Si `openapi-fetch` no maneja bien el multipart, se usa `fetch` directo;
  se resuelve en el plan.

## Pruebas

- **Unitarias (vitest):**
  - Parseo: separadores `;` y `,`, BOM, comillas, cabecera faltante, fechas en ambos formatos.
  - Agrupación: datos de persona discrepantes y ocupación incompleta.
  - Referencias: unidad ambigua con candidatas, puesto inexistente, denominación con otras mayúsculas o
    tildes.
  - Orquestación con servicios simulados: se acumulan los errores de varias filas, una persona
    rechazada omite sus ocupaciones, y `confirmar=false` o cualquier error provoca rollback.
  - Límites de tamaño y de filas.
  - Regresión: los tests existentes de `PersonasService` y `OcupacionesService` pasan sin cambios.
- **Integración contra PostgreSQL real (`*.int.spec.ts`):** importación confirmada deja todo creado; la
  vista previa no deja nada; un error en la fila N no deja nada y se reportan todos los errores juntos;
  un solape dentro del archivo se rechaza; un legajo existente se reporta; ocupaciones simultáneas en
  puestos distintos se aceptan; un `23P01` dentro de un savepoint no deja abortada la transacción.
- **Frontend:** validado por escenarios de uso, como el resto.

## Cambios en documentos

- `docs/requerimientos.md`: §5 referencia esta spec bajo Personas.
- `README.md`: cómo preparar y cargar el CSV, formato de las columnas, que es solo alta y que contiene
  datos personales (RNF02).
- `docs/superpowers/specs/2026-10-13-personas-ocupaciones-design.md`: una línea que apunta a esta spec
  como extensión (la importación masiva, que figuraba fuera de alcance).
- Esta spec pasa a `Aprobada` tras la revisión y a `Implementada` al cerrar el trabajo.

## Dependencias

`csv-parse` (dependencia) y `@types/multer` (desarrollo). `multer` ya viene con
`@nestjs/platform-express`. Agregarlas requiere reconstruir el contenedor (`--build`).

## Fuera de alcance

Actualizar o sincronizar personas existentes, importar conocimientos y niveles acreditados (RF10),
exportar datos, plantilla en `.xlsx` y auditar la importación.

## Riesgos

- El refactor toca dos servicios ya implementados; su regresión es criterio de aceptación.
- Los savepoints por fila dentro de una transacción de TypeORM deben comprobarse contra PostgreSQL real:
  un `23P01` en un savepoint no debe dejar la transacción abortada.
- La transacción mantiene el bloqueo de estructura durante toda la importación. El límite de 2000 filas
  lo acota, y es aceptable en una carga inicial.
- El CSV contiene datos personales y circula fuera del sistema. El sistema no lo guarda, pero la
  custodia del archivo es responsabilidad de RRHH; el README lo advierte.
