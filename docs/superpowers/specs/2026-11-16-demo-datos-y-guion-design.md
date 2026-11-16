Estado: Implementada | Fecha: 2026-11-16 | Autor: IvanOchoa229

# Datos de demostración y guion de prueba de los casos de uso

## Contexto y objetivo

El sistema está implementado de punta a punta (estructura, personas, conocimiento, criticidad, sucesión, detección y tablero), pero hoy no se puede mostrar bien:

- Después de clonar y levantar, la base queda casi vacía (solo el Departamento de Sistemas y el admin del `.env`).
- Los scripts de `backend/scripts/` se corren a mano con `psql`. `datos-prueba-deteccion.sql` usa nombres artificiales ("Conocimiento K1", "C1.jefe"), corre una sola vez y deja un usuario `det-evaluador` con hash falso que no permite iniciar sesión.
- No hay un usuario por rol, así que no se puede mostrar cómo cambia lo que ve cada actor.
- No hay un recorrido escrito de los casos de uso.

Objetivo: que cualquiera clone el repositorio en otra computadora, agregue el `.env`, corra `docker compose up --build` y tenga el sistema listo para mostrarle al profesor los casos de uso core, con datos realistas y un guion para ejecutar a mano.

**Requerimientos que cubre:** RNF09 (reproducible por todo el grupo con un solo comando) y, como recorrido de demostración, RF02, RF06, RF07, RF09 a RF18, RF19, RF20, RF21, RF22 y RF24. No agrega ni cambia requerimientos funcionales. **Fuera de la demo:** RF05 (validación de descripciones; es el punto abierto de la sección 7 de `docs/requerimientos.md`), RF03, RF04, RF08 en detalle, RF23 y RF01 más allá de mostrar la estructura.

Contexto leído: `docs/requerimientos.md`, `docs/primer-avance.md` (resumen), `README.md`, `docker-compose.yml`, `backend/scripts/*.sql`, `usuarios-bootstrap.service.ts`, `router.tsx`.

## Goals

1. **Un solo comando.** Con el `.env` copiado de `.env.example`, `docker compose up --build` deja el sistema con los datos de demo ya cargados y las pantallas con contenido.
2. **Repetible.** Reiniciar el backend o volver a levantar no duplica ni rompe datos. Para volver al estado inicial entre ensayos: `docker compose down -v && docker compose up --build`.
3. **Un usuario por cada uno de los siete roles**, con la misma clave simple, documentados en el README y en el guion.
4. **Datos realistas y con una historia.** Docentes con nombres creíbles, cátedras reales del Departamento de Sistemas, conocimientos reales (por ejemplo SQL, Java, Redes), y un historial armado para que cada pantalla de los ocho casos de uso muestre algo.
5. **Guion para ejecutar a mano** en `docs/demo/guion-demo.md`, con los ocho casos de uso. Por cada paso: usuario con el que entrar, pantalla o ruta, qué hacer, qué datos escribir exactamente y qué resultado esperar. Cada caso cita sus RF.

## Non-goals

- Tests automatizados que recorran el guion (se decidió que el guion es manual).
- Datos de demo en producción: el sistema es solo local.
- Cubrir RF05 ni cargar descripciones de puesto.
- Reemplazar los datos de los tests de integración (`backend/src/testing/`) ni borrar los scripts SQL actuales (siguen sirviendo para pruebas de detección; el README los marca como de desarrollo, no de demo).
- Una interfaz para reiniciar los datos.

## Anti-goals (sería un fracaso aunque "funcione")

- Que la demo dependa de pasos manuales ocultos (correr SQL, crear usuarios a mano, editar archivos) además del `.env`.
- Que el guion prometa un resultado que la pantalla no muestra, o que se rompa si se ejecuta una segunda vez. Todo resultado esperado del guion debe haberse comprobado ejecutándolo sobre una base recién creada.
- Que los datos de demo contaminen el arranque normal de quien no los quiere (debe poder desactivarse).
- Que las claves de demo queden en el código como si fueran un secreto real: son de demostración y se dicen así.

## Decisiones tomadas por el usuario

- Los ocho casos de uso entran en el guion: (1) ingreso y permisos por rol, (2) puestos y requisitos de conocimiento, (3) personas, ocupaciones e importación CSV, (4) declaración y acreditación de conocimiento, (5) activos de conocimiento con archivo, (6) evaluación de criticidad, (7) planes de sucesión, candidatos y acciones de transferencia, (8) detección y tablero de riesgo.
- El guion es para ejecutar a mano, frente al profesor.
- Los datos de demo son realistas y nuevos, no los "K1..K8" actuales.

## Decisiones propuestas (calls del autor, a confirmar al leer)

- **Mecanismo de carga:** el backend carga los datos de demo al arrancar, después de las migraciones y del administrador inicial, si `CARGAR_DATOS_DEMO=true`. `.env.example` lo trae en `true`; vacío o `false` lo desactiva. No hay servicio extra en el compose, para no sumar un servicio que esperar.
- **Idempotencia:** la carga se omite si ya existe la marca de demo (por ejemplo el usuario `demo.admin` o el prefijo de legajo `DEMO-`). No se intenta reparar una carga a medias: se hace en una sola transacción, todo o nada.
- **Clave de los usuarios de demo:** una sola, definida como constante documentada (propuesta: `DemoUTN2026`). Se hashea con el mismo `PasswordService` (argon2id) que el resto del sistema, no con hashes escritos a mano.
- **Usuarios:** uno por rol: `demo.admin`, `demo.rrhh`, `demo.analista`, `demo.autoridad`, `demo.jefatura`, `demo.jefecatedra`, `demo.docente`. Los de jefatura, jefe de cátedra y docente quedan vinculados a una persona y a las unidades que corresponden (RF24, alcance por unidad). El administrador del `.env` sigue existiendo aparte.
- **Fechas relativas:** retiros, ocupaciones y plazos se calculan a partir de la fecha actual, para que "retira dentro del horizonte" funcione cuando se haga la demo, no cuando se escribió el script.
- **Activos:** la carga deja uno o dos activos de tipo enlace. El activo con archivo se sube en vivo durante el guion con un archivo de ejemplo versionado en `docs/demo/archivos/`, para mostrar RustFS de verdad.
- **Implementación:** código TypeScript dentro del backend (servicio de demo), usando SQL directo o los repositorios según resulte más simple; los datos viven en un archivo de datos legible, no mezclados con la lógica. Los nombres de dominio van en español.

## Historia de los datos (nivel de diseño)

Los datos arman una historia de riesgo de sucesión en el Departamento de Sistemas. El constructor define las personas y cantidades exactas, pero el juego debe garantizar, como mínimo:

- Tres a cinco cátedras reales con puestos de jefe y de auxiliar/JTP, y docentes con ocupaciones vigentes, algunos con varias ocupaciones.
- Un catálogo de unos diez conocimientos reales y requisitos de puesto, con excluyentes y deseables.
- **Al menos un punto único de falla** (RF16): un conocimiento crítico que una sola persona posee con el nivel requerido.
- **Al menos una cátedra sostenida por una sola persona** (RF17).
- **Al menos un puesto crítico sin sucesor preparado** (RF18) y otro que sí lo tiene, para mostrar el contraste.
- **Al menos un poseedor con retiro dentro del horizonte** (RF20), y otro fuera del horizonte, para que el filtro por plazo se note.
- **Brecha de perfil** (RF19) visible para un docente y para un candidato a sucesión.
- Evaluaciones de criticidad cargadas para algunos pares, y **otros pares sin evaluar**, para que el guion pueda evaluar uno en vivo (RF12).
- Un plan de sucesión en cada estado útil para la demo: uno en borrador o pendiente (para presentarlo y aprobarlo en vivo con `demo.autoridad`) y uno ya aprobado, con candidatos y acciones de transferencia en distinto avance.
- Un docente (`demo.docente`) con conocimientos declarados y alguno sin acreditar, para el caso de declaración y acreditación.
- Un CSV de ejemplo para importación en `docs/demo/archivos/`, con filas válidas y al menos una fila con error, para mostrar la vista previa que valida antes de importar.

El efecto buscado: el tablero arranca mostrando riesgo, y el guion lo reduce en vivo (aprobar un plan, cargar un candidato que cubre los excluyentes), de modo que al volver al tablero el cambio se vea.

## El guion (`docs/demo/guion-demo.md`)

Estructura:

1. **Preparación:** requisitos, `.env`, `docker compose up --build`, URLs (frontend :5173, Swagger :3000/api/docs, consola RustFS), tabla de usuarios y clave, cómo reiniciar el estado.
2. **Recorrido** en el orden de la historia *"se detecta el riesgo y se actúa"*: empieza por el tablero y el caso 8 (qué está mal), sigue por los casos que construyen los datos y terminan en la acción (puestos y requisitos, personas, conocimiento, activos, criticidad, sucesión) y vuelve al tablero para mostrar el cambio. El constructor ajusta el orden fino; el principio es que el profesor vea primero el problema y después cómo el sistema lo resuelve.
3. **Por cada caso de uso:** objetivo en una frase, RF cubiertos, usuario, y una tabla de pasos con columnas Paso / Dónde / Acción y datos exactos / Resultado esperado.
4. **Permisos (RF24):** al menos un paso donde un rol sin permiso intenta algo y el sistema lo impide, con el mensaje o comportamiento esperado.
5. **Contingencia:** qué hacer si falla algo en vivo (reiniciar el estado, qué caso saltear, dónde mirar los logs).
6. **Tiempo estimado** por caso y total.

Los textos y nombres de pantalla del guion deben coincidir con los de la interfaz actual (la interfaz ya no muestra referencias RFxx, el guion sí las cita aparte para trazabilidad).

## Constraints

- Stack y arquitectura de `docs/requerimientos.md` secciones 5 y 6: módulos NestJS en capas, cambios de esquema solo por migraciones (esta tarea **no** debería necesitar migraciones: solo carga datos), frontend sin cambios salvo que el guion revele un defecto.
- Sin nuevas dependencias salvo necesidad clara.
- Nombres en español.
- Antes de subir: `npm run lint` y `npm run format` en el backend, `npm test` y `npm run test:integracion` (la carga toca SQL y datos contra PostgreSQL real). Si se toca el frontend, también lint y format allí.
- Commits sin línea `Co-Authored-By` según el CLAUDE.md del proyecto.

## Criterios de éxito (verificación)

1. En una carpeta limpia y con `docker volume` vacíos: copiar `.env.example` a `.env`, `docker compose up --build`, esperar el arranque. Sin ningún otro paso, se puede iniciar sesión con los siete usuarios de demo.
2. Reiniciar solo el backend no duplica datos ni da error.
3. Con `CARGAR_DATOS_DEMO=false` el sistema arranca sin datos de demo.
4. Cada paso del guion, ejecutado en orden sobre una base recién creada, da el resultado que dice el guion. Se ejecuta completo al menos una vez antes de darlo por terminado, y se anota cualquier diferencia.
5. La carga tiene un test de integración (idempotencia y que los resultados clave de detección, RF16 a RF20, coinciden con lo que promete el guion).

## Qué queda a criterio del constructor

- Nombres concretos de personas, cátedras (deben ser plausibles para Sistemas de la UTN-FRT), conocimientos y cantidades.
- Estructura interna del servicio de demo y formato del archivo de datos.
- Orden fino de los pasos y redacción del guion.
- Si el activo con archivo conviene también precargado además de subirse en vivo.
- Qué hacer con los scripts SQL actuales dentro del README (mantenerlos, anotando que son para pruebas de detección).

## Precisiones tras la revisión del diseño

- **Auditoría (RNF05):** el subscriber de auditoría (`auditoria.subscriber.ts`) falla si no hay un usuario en el contexto (`usuarioDelContexto()`). La carga de demo debe crear primero `demo.admin` y ejecutar el resto dentro del contexto de ese usuario, o escribir con SQL directo documentando por qué se saltea la auditoría. Es una decisión del constructor, pero no puede dejar entidades auditadas sin el usuario. *(Respondida con el código.)*
- **Horizonte de riesgo (RF20):** el valor por defecto es 24 meses (`MESES_HORIZONTE_DEFECTO`, máximo 120) y es un parámetro de la consulta, no una configuración global. Los datos de demo se arman respecto de 24 meses: un retiro dentro y otro fuera. *(Respondida con el código.)* La lógica exacta de poseedor, nivel requerido y sucesor preparado está en `docs/requerimientos.md` sección 5 y en las migraciones de las vistas: el constructor las lee antes de diseñar los datos.
- **Fecha en el test de integración:** se comprueban relaciones (por ejemplo "el poseedor con retiro a 10 meses aparece en el horizonte de 24 y no en el de 6"), no fechas absolutas. *(Mi decisión.)*
- **Raíz de la estructura:** las cátedras de demo cuelgan del Departamento de Sistemas que crea la migración, ubicado como la única unidad de tipo `departamento` sin superior, no por nombre. No se crea otro departamento. *(Mi decisión.)*
- **Marca de demo y estado a medias:** la marca es la existencia del usuario `demo.admin`. Si no existe, se carga todo en una transacción. Si fue borrado pero quedan otros datos de demo, el arranque registra una advertencia y omite la carga; nunca tumba el backend. *(Mi decisión.)*
- **`CARGAR_DATOS_DEMO`:** se agrega como variable opcional booleana a `env.validation.ts`; el cargador es un servicio propio que solo se ejecuta cuando está en `true`. El valor `true` en `.env.example` es intencional: la persona que copia el ejemplo quiere la demo. Se desactiva poniendo `false` o borrando la línea. *(Mi decisión.)*
- **Verificación del guion:** la ejecución completa sobre una base nueva es una tarea del plan, hecha con la API y, si hay navegador disponible, con la interfaz; queda además una pasada final a mano de la persona que va a presentar, antes de la demo. *(Mi decisión.)*

## Riesgos

- **Resultados de detección que cambian con la fecha:** mitigado con fechas relativas; el test de integración debe fijar la fecha de referencia o comprobar relaciones, no valores absolutos.
- **El guion se desactualiza** cuando cambia la interfaz: queda anotado en el propio guion con la fecha y el commit contra el que se verificó.
- **Claves de demo conocidas:** aceptable porque el sistema es solo local y el README lo dice.
