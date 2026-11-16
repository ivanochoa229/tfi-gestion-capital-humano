Estado: Implementado | Fecha: 2026-11-16 | PR: #13

# Datos de demostración y guion de prueba: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas `- [ ]`.

**Objetivo:** que, con el `.env` copiado de `.env.example`, `docker compose up --build` deje el sistema con datos de demo realistas y siete usuarios (uno por rol), y que exista un guion manual verificado de los ocho casos de uso.

**Arquitectura:** un servicio del backend (`DemoService`) que al arrancar, si `CARGAR_DATOS_DEMO=true`, llama a una función pura `cargarDatosDemo(dataSource, hashearClave)`. Esa función inserta los datos declarados en `datos-demo.ts` por SQL directo en una sola transacción y es idempotente (marca: usuario `demo.admin`). Sin migraciones ni cambios de frontend.

**Stack:** NestJS 12, TypeORM (`DataSource`/`QueryRunner`), PostgreSQL, argon2 vía `PasswordService`, vitest (unitarios e integración con `crearBaseTemporal`).

**Spec:** `docs/superpowers/specs/2026-11-16-demo-datos-y-guion-design.md`

## Global Constraints

- Sin migraciones: el esquema no cambia (`synchronize` sigue desactivado).
- Nombres de dominio y código en español; imports ESM con extensión `.js`.
- Clave única de demo: `DemoUTN2026` (11 caracteres; el mínimo del sistema es `LARGO_MINIMO_CLAVE = 10`), hasheada con `PasswordService.hashear` (argon2id), nunca con hashes escritos a mano.
- Usuarios: `demo.admin`, `demo.rrhh`, `demo.analista`, `demo.autoridad`, `demo.jefatura`, `demo.jefecatedra`, `demo.docente`, uno por rol (`administrador`, `recursos_humanos`, `analista_puestos`, `autoridad`, `jefatura_departamento`, `jefe_catedra`, `docente`).
- Marca de demo: existe el usuario `demo.admin`. Todo o nada en una transacción. Si falta `demo.admin` pero hay datos de demo, advertir y omitir; la carga nunca tumba el backend.
- Las cátedras cuelgan de la única unidad de tipo `departamento` sin superior (la que crea la migración), buscada por tipo, no por nombre. No se crea otro departamento.
- Fechas relativas a `CURRENT_DATE`. Horizonte de riesgo por defecto: 24 meses (`MESES_HORIZONTE_DEFECTO`).
- Variable `CARGAR_DATOS_DEMO`: opcional, booleana, por defecto `false` en el código; `.env.example` la trae en `true`.
- Reinicio entre ensayos: `docker compose down -v && docker compose up --build`.
- Commits sin línea `Co-Authored-By` ni atribución a Claude (CLAUDE.md del proyecto prevalece).
- Antes de cerrar: `npm run lint`, `npm run format`, `npm test` y `npm run test:integracion` en `backend/`.
- Fuera de alcance: RF05, RF03, RF04, RF23, tests automáticos del guion, cambios de frontend (salvo defecto que revele el guion).

## Review Focus

1. Backend reiniciado varias veces con la demo ya cargada: no duplica ni falla.
2. `demo.admin` borrado pero con datos de demo restantes: advierte, omite y el backend arranca.
3. Tablas inexistentes (`DB_MIGRATIONS_RUN=false` sobre una base vacía): la carga falla con un log claro y el backend no se cae.
4. Error a mitad de la carga: rollback completo, sin datos parciales ni `demo.admin` huérfano.
5. Pasada de fecha: un retiro "a 10 meses" entra al horizonte de 24 y no al de 6, sin valores absolutos en los tests.

---

### Task 1: Variable `CARGAR_DATOS_DEMO`

**Files:**
- Modify: `backend/src/infra/config/env.validation.ts` (clase `Env`)
- Modify: `backend/src/infra/config/env.validation.spec.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `Env.CARGAR_DATOS_DEMO: boolean` (por defecto `false`), leída después con `config.get('CARGAR_DATOS_DEMO', { infer: true })`.

- [ ] **Step 1: Escribir los tests fallidos** en `env.validation.spec.ts`: `it('CARGAR_DATOS_DEMO es false si no se define')`, `it('acepta "true" y lo convierte a booleano')`, `it('"false" da false')`.
- [ ] **Step 2: Correr** `cd backend && npx vitest run src/infra/config/env.validation.spec.ts`. Esperado: FALLA (propiedad inexistente).
- [ ] **Step 3: Agregar** `CARGAR_DATOS_DEMO: boolean = false` a `Env` con el mismo `@Transform` + `@IsBoolean()` que `DB_MIGRATIONS_RUN`, pero con `undefined` → `false`, y un comentario de una línea ("Carga los datos de demostración al arrancar").
- [ ] **Step 4: Agregar a `.env.example`**, en la sección Backend, `CARGAR_DATOS_DEMO=true` con un comentario en español (datos y usuarios de demo; poner `false` para desactivarlos).
- [ ] **Step 5: Correr** el test del Step 2. Esperado: PASA.
- [ ] **Step 6: Commit** `git add backend/src/infra/config .env.example && git commit -m "Agregar la variable CARGAR_DATOS_DEMO"`.

---

### Task 2: Datos de demo declarativos

**Files:**
- Create: `backend/src/demo/datos-demo.ts`
- Create: `backend/src/demo/datos-demo.spec.ts`

**Interfaces:**
- Produces (todo exportado de `datos-demo.ts`):
  - `CLAVE_DEMO = 'DemoUTN2026'`
  - `interface UsuarioDemo { nombreUsuario: string; rol: CodigoRol; legajo: string | null; catedras: string[] }` (`catedras` = denominaciones de las unidades asignadas en `usuario_unidad`; vacío para roles globales y docente)
  - `export const USUARIOS_DEMO: UsuarioDemo[]` (los siete)
  - `export const DATOS_DEMO: DatosDemo`, con una clave por tabla, todo referenciado por **denominación, legajo o código de referencia**, nunca por id: `catedras`, `puestos`, `conocimientos`, `requisitos`, `personas`, `ocupaciones`, `conocimientosPersona`, `evaluaciones`, `planes`, `candidatos`, `acciones`, `activosEnlace`. Los retiros y fechas se expresan como desplazamientos relativos (por ejemplo `{ meses: 10 }` o `{ dias: -30 }`), nunca fechas absolutas.
- Consumes: `CodigoRol` de `backend/src/common/roles.ts`.

Contenido a definir (el spec lo deja al constructor, con estas garantías mínimas, todas con docentes y cátedras plausibles para Sistemas de la UTN-FRT):
- 3 a 5 cátedras con puesto de jefe y de auxiliar/JTP; docentes con ocupaciones vigentes, alguno con varias.
- Unos 10 conocimientos reales (SQL, Java, Redes, etc.), con requisitos excluyentes y deseables.
- ≥1 punto único de falla (RF16), ≥1 cátedra sostenida por una sola persona (RF17), ≥1 puesto crítico sin sucesor preparado y otro con sucesor preparado (RF18), un poseedor con retiro dentro de 24 meses y otro fuera (RF20), brecha de perfil visible para un docente y para un candidato (RF19).
- Evaluaciones de criticidad en algunos pares y otros pares **sin evaluar** (RF12 en vivo).
- Un plan en `pendiente_aprobacion` (para aprobar en vivo con `demo.autoridad`) y otro `aprobado`, con candidatos y acciones de transferencia en distinto estado (RF13 a RF15).
- `demo.docente` con conocimientos declarados y alguno sin acreditar (RF10); `demo.jefecatedra` a cargo de una sola cátedra y `demo.jefatura` del departamento (RF24).
- 1 a 2 activos de tipo enlace (RF11); el activo con archivo se sube en vivo.

- [ ] **Step 1: Escribir los tests fallidos** en `datos-demo.spec.ts`:
  - `it('hay un usuario por cada uno de los siete roles')`: `USUARIOS_DEMO.map(u => u.rol)` contiene exactamente `TODOS_LOS_ROLES`, sin repetidos.
  - `it('los nombres de usuario empiezan con demo.')`.
  - `it('toda referencia apunta a algo definido')`: legajos de ocupaciones, conocimientosPersona, planes, candidatos, acciones y usuarios existen en `personas`; puestos y conocimientos de requisitos/evaluaciones/planes existen; cátedras de puestos y usuarios existen en `catedras`.
  - `it('los legajos y documentos son únicos y los legajos empiezan con DEMO-')`.
  - `it('no hay fechas absolutas')`: ninguna cadena `AAAA-MM-DD` en `DATOS_DEMO`.
- [ ] **Step 2: Correr** `npx vitest run src/demo/datos-demo.spec.ts`. Esperado: FALLA (módulo inexistente).
- [ ] **Step 3: Escribir `datos-demo.ts`** con los tipos y los datos que cumplan las garantías de arriba. Los códigos de referencia (`nivel_dominio`, `estado_plan`, `estado_preparacion`, `tipo_evidencia`, `caracter_ocupacion`, `dedicacion`, `nivel_jerarquico`, `tipo_accion_transferencia`, etc.) se copian de los que usan las migraciones `CargarValoresReferencia`, `CrearReferencia*` y de `backend/scripts/datos-prueba-deteccion.sql`.
- [ ] **Step 4: Correr** el test del Step 2. Esperado: PASA.
- [ ] **Step 5: Commit** `git add backend/src/demo && git commit -m "Agregar los datos declarativos de la demo"`.

---

### Task 3: Carga transaccional e idempotente

**Files:**
- Create: `backend/src/demo/cargar-demo.ts`
- Create: `backend/src/demo/cargar-demo.int.spec.ts`

**Interfaces:**
- Consumes: `DATOS_DEMO`, `USUARIOS_DEMO`, `CLAVE_DEMO` (Task 2); `crearBaseTemporal` de `backend/src/testing/base-temporal.ts`.
- Produces: `export type ResultadoCarga = 'cargado' | 'omitido' | 'parcial'` y `export async function cargarDatosDemo(dataSource: DataSource, hashearClave: (clave: string) => Promise<string>): Promise<ResultadoCarga>`.
  - `'omitido'`: existe `demo.admin`. `'parcial'`: no existe `demo.admin` pero hay personas con legajo `DEMO-%`; no escribe nada. `'cargado'`: todo insertado.

Enfoque: un `QueryRunner` con `startTransaction`/`commitTransaction`/`rollbackTransaction`; SQL directo con subconsultas por código/denominación (como `datos-prueba-deteccion.sql`); el hash se calcula una vez y se reutiliza para los siete usuarios. SQL directo no pasa por el subscriber de auditoría de TypeORM, que exige usuario en contexto (`usuarioDelContexto()`); se crea `demo.admin` primero y su id se usa como `id_usuario` / `id_usuario_resolucion` de evaluaciones y planes. Dejar en el encabezado del archivo un comentario que diga que los datos de demo son fixtures y por eso no generan filas de auditoría. Departamento raíz: la única `unidad_organizativa` de `tipo_unidad.codigo = 'departamento'` con `id_unidad_superior IS NULL`.

- [ ] **Step 1: Escribir los tests fallidos** en `cargar-demo.int.spec.ts` con `crearBaseTemporal()` (`afterEach` destruye). Hash de prueba: `async (c) => 'h:' + c`.
  - `it('carga y devuelve "cargado"')` y verifica cantidades según `DATOS_DEMO` (personas, puestos, planes).
  - `it('una segunda carga devuelve "omitido" y no duplica filas')` (mismos conteos de `persona`, `usuario`, `plan_sucesion`).
  - `it('crea un usuario por rol con alcance por unidad')`: siete usuarios; `demo.jefecatedra` tiene filas en `usuario_unidad` solo para sus cátedras; `demo.docente` tiene `id_persona`.
  - `it('si falta demo.admin pero hay datos DEMO- devuelve "parcial" y no escribe')`.
  - `it('un error a mitad de la carga hace rollback completo')`: pasar un `hashearClave` que lance en la segunda llamada (o forzar el fallo con un dato inválido) y comprobar que no queda ninguna persona `DEMO-%` ni usuario `demo.%`.
  - `it('RF16 a RF20 dan los resultados que promete el guion')`: consulta las vistas `deteccion_punto_unico_falla`, `deteccion_catedra_una_persona`, `deteccion_puesto_sin_sucesor`, `deteccion_brecha_perfil` y `deteccion_retiro_poseedor` (SQL de `modules/deteccion/*.sql.ts`) y comprueba: ≥1 punto único de falla, ≥1 cátedra de una persona, un puesto crítico sin sucesor y otro con sucesor, brecha para el docente y el candidato; y, para el horizonte, que el poseedor con retiro cercano aparece con 24 meses y **no** con 6, y el lejano no aparece con 24 (relaciones, no fechas absolutas).
- [ ] **Step 2: Correr** `docker compose up -d db` y `npx vitest run --config vitest.integracion.config.ts src/demo/cargar-demo.int.spec.ts`. Esperado: FALLA (módulo inexistente).
- [ ] **Step 3: Implementar `cargarDatosDemo`** en `cargar-demo.ts` según el enfoque de arriba.
- [ ] **Step 4: Correr** el test del Step 2. Esperado: PASA. Si un resultado de detección no coincide, corregir **los datos** de `datos-demo.ts` (no el test) y repetir Task 2 Step 4.
- [ ] **Step 5: Commit** `git add backend/src/demo && git commit -m "Cargar los datos de demo en una transacción idempotente"`.

---

### Task 4: Servicio de arranque y módulo

**Files:**
- Create: `backend/src/demo/demo.service.ts`
- Create: `backend/src/demo/demo.module.ts`
- Create: `backend/src/demo/demo.service.spec.ts`
- Modify: `backend/src/app.module.ts` (agregar `DemoModule` a `imports`)

**Interfaces:**
- Consumes: `cargarDatosDemo`, `ResultadoCarga` (Task 3); `PasswordService` (de `UsuariosModule`, que ya exporta `AuthService`, `UsuariosService`, `AlcanceService`: agregar `PasswordService` a sus `exports` si hace falta); `Env.CARGAR_DATOS_DEMO` (Task 1).
- Produces: `DemoService implements OnApplicationBootstrap` con `onApplicationBootstrap(): Promise<void>`.

Comportamiento: si `CARGAR_DATOS_DEMO` es `false`, no hace nada. Si es `true`, llama `cargarDatosDemo(this.dataSource, (c) => this.passwords.hashear(c))` y registra con `Logger` (`cargado` → info con la clave de demo y los usuarios; `omitido` → debug; `parcial` → warn). Cualquier excepción se captura y se registra con `Logger.error`; **nunca se relanza** (el backend arranca igual).

- [ ] **Step 1: Escribir los tests fallidos** en `demo.service.spec.ts` (unitarios, con `cargarDatosDemo` mockeado con `vi.mock`):
  - `it('no carga nada si CARGAR_DATOS_DEMO es false')`.
  - `it('carga si es true')`: se llamó una vez.
  - `it('registra una advertencia y no lanza si el resultado es "parcial"')`.
  - `it('no relanza si la carga falla, por ejemplo por tablas inexistentes')`: `onApplicationBootstrap()` resuelve y se llamó a `Logger.error`.
- [ ] **Step 2: Correr** `npx vitest run src/demo/demo.service.spec.ts`. Esperado: FALLA.
- [ ] **Step 3: Implementar** `DemoService`, `DemoModule` (importa `UsuariosModule`; provee `DemoService`) y registrar `DemoModule` en `app.module.ts`.
- [ ] **Step 4: Correr** el test del Step 2 y `npm test`. Esperado: PASA.
- [ ] **Step 5: Verificar el arranque real:** `cp .env.example .env` (si no existe), `docker compose down -v && docker compose up --build -d`, esperar `/api/salud`, y comprobar en los logs del backend el mensaje de carga. Luego `docker compose restart backend` y comprobar que el log dice omitido y que `SELECT count(*) FROM persona WHERE legajo LIKE 'DEMO-%'` no cambia. Con `CARGAR_DATOS_DEMO=false` en `.env` y `down -v`, la base arranca sin datos de demo. Esperado: los tres comportamientos se cumplen.
- [ ] **Step 6: Commit** `git add backend/src/demo backend/src/app.module.ts backend/src/modules/usuarios && git commit -m "Cargar la demo al arrancar el backend"`.

---

### Task 5: Archivos de ejemplo para el guion

**Files:**
- Create: `docs/demo/archivos/manual-ejemplo.pdf` (o `.txt`/`.docx`; el tipo debe estar entre los aceptados por `backend/src/modules/conocimiento/archivo.ts`: pdf, png, jpg, txt, docx, xlsx, pptx, odt)
- Create: `docs/demo/archivos/personas-importacion.csv`

**Interfaces:**
- Consumes: columnas del CSV de `backend/src/modules/personas/importacion/plantilla.ts` (14 columnas exactas, separador `;` o `,`); denominaciones de unidades, puestos y referencias de `DATOS_DEMO`.
- Produces: dos archivos que el guion cita por ruta.

El CSV tiene unas cinco filas válidas (personas nuevas con legajos que no choquen con `DEMO-*`, sobre puestos y cátedras de la demo) y **una** fila con un error evidente y explicable (por ejemplo una dedicación inexistente), para mostrar la vista previa que valida antes de importar. El archivo del activo es pequeño, con contenido legible y sin datos personales reales.

- [ ] **Step 1: Crear** el archivo de activo y el CSV.
- [ ] **Step 2: Verificar** con el sistema levantado (Task 4 Step 5): iniciar sesión como `demo.rrhh` y llamar al endpoint de vista previa de importación (ver Swagger `/api/docs`, módulo importación) con el CSV; esperado: N filas válidas y exactamente 1 con error, con el mensaje en español. Subir el archivo de activo con `demo.analista` y comprobar que se acepta; esperado: se crea el activo y el archivo aparece en el bucket. **Después `down -v` y levantar de nuevo** para dejar la base limpia.
- [ ] **Step 3: Commit** `git add docs/demo/archivos && git commit -m "Agregar los archivos de ejemplo de la demo"`.

---

### Task 6: Guion de demo, README y cierre

**Files:**
- Create: `docs/demo/guion-demo.md`
- Modify: `README.md` (sección nueva "Demostración")
- Modify: `docs/superpowers/specs/2026-11-16-demo-datos-y-guion-design.md` (línea de estado)
- Modify: este plan (línea de estado)

**Interfaces:**
- Consumes: usuarios y clave (Task 2), archivos (Task 5), pantallas y rutas de `frontend/src/router.tsx` (`/tablero`, `/estructura`, `/personas`, `/personas/importar`, `/conocimiento`, `/conocimiento/mios`, `/conocimiento/pendientes`, `/conocimiento/activos`, `/criticidad`, `/sucesion`, `/sucesion/planes/:id`, `/sucesion/mia`, `/acciones`, `/deteccion/*`, `/admin`).
- Produces: el guion y la sección de README.

Estructura del guion, según el spec: (1) Preparación (requisitos, `.env`, `docker compose up --build`, URLs frontend :5173, Swagger :3000/api/docs, consola RustFS :9101, tabla de usuarios y clave, reinicio con `down -v`); (2) Recorrido en el orden de la historia "se detecta el riesgo y se actúa", con los ocho casos (ingreso y permisos; puestos y requisitos; personas, ocupaciones e importación CSV; declaración y acreditación; activos; criticidad; sucesión, candidatos y acciones; detección y tablero) y vuelta final al tablero; (3) por caso: objetivo en una frase, RF cubiertos, usuario, tabla Paso / Dónde / Acción y datos exactos / Resultado esperado; (4) al menos un paso de permisos denegados (RF24); (5) contingencia; (6) tiempo por caso y total; (7) pie con la fecha y el commit contra los que se verificó. Los nombres de pantallas y botones se copian de la interfaz real (no de memoria), sin referencias RFxx en la interfaz; los RFxx solo van en el guion, para trazabilidad.

- [ ] **Step 1: Levantar de cero** (`docker compose down -v && docker compose up --build -d`) y recorrer la interfaz real, caso por caso, tomando nota de textos exactos, rutas y resultados. Si hay navegador disponible (skill claude-in-chrome), usarlo; si no, usar la API con curl y la sesión por cookie, y marcar en el guion qué pasos se comprobaron solo por API.
- [ ] **Step 2: Escribir `docs/demo/guion-demo.md`** con lo observado en el Step 1.
- [ ] **Step 3: Ejecutar el guion completo, en orden, sobre una base recién creada** (`down -v`, `up --build`) y anotar cualquier diferencia entre lo escrito y lo observado; corregir el guion (o el dato de demo si el dato es el defecto) hasta que no haya ninguna. Esperado: cada paso da el resultado escrito. Un defecto de la interfaz que impida un paso se informa a la persona usuaria antes de arreglarlo.
- [ ] **Step 4: README:** agregar la sección "Demostración" con el comando de arranque, la tabla de usuarios, `CARGAR_DATOS_DEMO`, el reinicio con `down -v`, un enlace al guion, y una nota de que `backend/scripts/*.sql` son para pruebas de detección y no de demo.
- [ ] **Step 5: Verificación final:** en `backend/`, `npm run lint`, `npm run format`, `npm test` y `npm run test:integracion`; esperado: todo en verde, sin cambios de formato pendientes (`git status` limpio salvo lo que se va a commitear).
- [ ] **Step 6: Estados:** pasar la línea de estado del spec a `Implementada` y la de este plan a `Implementado` con el número de PR.
- [ ] **Step 7: Commit** `git add docs README.md && git commit -m "Agregar el guion de la demo y documentar la carga de datos"`.

---

## Autorrevisión contra el spec

- **Un solo comando / repetible / desactivable:** Tasks 1, 3, 4 (Step 5 lo verifica de punta a punta).
- **Siete usuarios con alcance por unidad (RF24):** Tasks 2 y 3.
- **Datos realistas con historia (RF16 a RF20, RF12, RF13 a RF15, RF10):** Task 2, comprobados por consulta en Task 3.
- **Archivos de ejemplo (CSV con error, activo con archivo en vivo):** Task 5.
- **Guion con ocho casos, permisos denegados, contingencia y verificación completa:** Task 6.
- **Auditoría (RNF05):** decisión documentada en Task 3 (SQL directo, fixtures).
- **Precisiones de la revisión** (horizonte 24, raíz por tipo, estado parcial, test por relaciones): Global Constraints, Tasks 3 y 4.
