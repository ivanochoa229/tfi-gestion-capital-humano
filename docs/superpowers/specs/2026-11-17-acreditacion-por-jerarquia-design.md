Estado: Implementada | Fecha: 2026-11-17 | Autor: IvanOchoa229

# Acreditación de conocimiento según la jerarquía de puestos

## Contexto y objetivo

En la revisión del 17/11/2026 el profesor observó que la acreditación del conocimiento (RF10) no respeta la jerarquía. Hoy un jefe de cátedra o la jefatura acredita a **cualquier persona con una ocupación vigente en las unidades asignadas a su usuario** (`usuario_unidad`). Eso tiene tres problemas que él señaló:

1. **No mira quién está arriba de quién.** Dentro de una cátedra todos cuelgan de la misma unidad: si a cualquiera de sus integrantes se le diera el rol de jefe, podría acreditar al que está por encima. «No hay una relación que diga de jerarquía».
2. **La autoridad sale del usuario, no del puesto.** El vínculo usuario–cátedra es administrativo y puede quedar desalineado de lo que la persona efectivamente ocupa. La regla debe salir de la relación padre-hijo de los puestos: «siempre alguien de nivel 1 puede dar a los de nivel 2 que estén relacionados con una tablita de por medio, de padre y de hijo».
3. **En la facultad una persona tiene más de un jefe.** Puede ocupar cargos en varias cátedras y ser jefe en una y subordinado en otra. La regla tiene que funcionar por cargo, no por persona.

El modelo ya tiene la relación que hace falta: `puesto.id_puesto_superior` (supervisión recursiva, OE1). Solo que la acreditación no la usa y los datos de demo no la cargan.

**Objetivo:** que solo pueda acreditar el conocimiento de una persona quien ocupa hoy un puesto **superior** a alguno de los puestos que esa persona ocupa hoy, según la jerarquía de puestos.

**Requerimientos que cubre:** RF10 (quién acredita), RF24 (restricción por actor) y RNF01 (autorización en toda operación). Relacionados: RF02 (el superior inmediato del puesto pasa a tener efecto) y OE1.

Contexto leído: `docs/requerimientos.md`, `docs/primer-avance.md`, la spec `2026-10-15-conocimiento-catalogo-design.md` (decisión 7, que esta spec reemplaza), `acceso-perfil.service.ts`, `perfil.sql.ts`, `jerarquia.service.ts` y los datos de demo.

## Decisiones tomadas por el usuario

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Profundidad | **Toda la cadena hacia abajo.** El superior acredita a quien ocupa cualquier puesto por debajo del suyo, a cualquier profundidad (el jefe de cátedra acredita al JTP y a los auxiliares que dependen del JTP; la jefatura del departamento, a todos) |
| 2 | Rol | **Rol y jerarquía.** Siguen acreditando solo los usuarios con rol `jefe_catedra` o `jefatura_departamento` (los actores de RF10), pero ahora solo a sus subordinados por puesto |

## Regla

Un usuario puede acreditar el conocimiento de la persona P si se cumple todo:

1. Su rol es `jefe_catedra` o `jefatura_departamento`.
2. Tiene persona vinculada (E) y E no es P (sin autoacreditación, como antes).
3. Existen una ocupación vigente de E en un puesto S y una ocupación vigente de P en un puesto X, los dos puestos activos, tales que S es **ancestro estricto** de X siguiendo `id_puesto_superior` (S ≠ X).

«Vigente» es lo de siempre: `fecha_desde <= CURRENT_DATE` y `fecha_hasta` nula o `>= CURRENT_DATE` (el «hoy» de la base).

Consecuencias, a propósito:

- **Nadie acredita hacia arriba ni a un par.** Dos auxiliares de la misma cátedra no se acreditan entre sí, y un auxiliar no acredita a su jefe, aunque tengan el mismo rol o la misma unidad.
- **Varios cargos, varios jefes.** Si Martín es JTP de Bases de Datos y auxiliar de Algoritmos, lo pueden acreditar la jefa de Bases de Datos y la jefa de Algoritmos (y la jefatura del departamento). Basta con que esté por debajo en una de las cadenas.
- **No hay otra cátedra por la puerta de atrás.** Un jefe de cátedra no acredita a nadie de otra cátedra salvo que un puesto de esa cátedra cuelgue del suyo.
- **Cadenas cruzadas.** Si A es superior de B en una cadena y B es superior de A en otra, cada uno puede acreditar al otro: cada relación vale por sí misma. Es un caso que la estructura del departamento no tiene; se deja documentado.
- **Puesto sin superior cargado:** nadie acredita a sus ocupantes. Es un dato que falta en la estructura (RF02), no una excepción de la regla.
- **Cualquier conocimiento.** Como hasta ahora, se puede acreditar cualquier conocimiento del catálogo, no solo los que exige el puesto (spec del catálogo, sección Acreditación).
- **Jefatura sin acreditador.** Quien ocupa el puesto más alto no tiene superior que lo acredite. Ya estaba documentado como riesgo (decisión 12 de la spec del catálogo) y se mantiene.

`usuario_unidad` **deja de intervenir en la acreditación.** Sigue rigiendo lo que ve cada jefatura: la lectura del perfil, criticidad, sucesión, detección y la lista de personas. Esta spec no cambia esos alcances.

## Cambios

### Backend

| Dónde | Cambio |
| --- | --- |
| `conocimiento/perfil.sql.ts` | Nueva consulta `SQL_ES_SUBORDINADO` (parámetros: evaluador, persona) con un CTE recursivo que baja desde los puestos que el evaluador ocupa hoy. `SQL_PENDIENTES` pasa a filtrar por la misma relación en lugar de por unidades |
| `conocimiento/acceso-perfil.service.ts` | `exigirEvaluacion` reemplaza el chequeo de alcance por unidad por `esSuperior(idEvaluador, idPersona)`. Mensaje: «Solo podés acreditar a quien ocupa un puesto por debajo del tuyo». Nuevo `permisoDeAcreditar(sesion, idPersona)` que devuelve `{ puedeAcreditar, motivo }` sin lanzar |
| `conocimiento/perfil-conocimiento.service.ts` | `pendientes` usa la persona de la sesión y la jerarquía, no las unidades. Sin persona vinculada, la bandeja queda vacía |
| `conocimiento/perfil-conocimiento.controller.ts` | `GET /personas/:idPersona/conocimientos/permisos` → `PermisosPerfilDto { puedeAcreditar: boolean; motivo: string \| null }`, con los roles lectores de perfil y después de `exigirLectura` |
| Sin migraciones | El esquema no cambia: `id_puesto_superior` e `IDX_puesto_superior` ya existen |

El control queda en el servicio, como el resto de las reglas de alcance del sistema. No se agrega un trigger: las acreditaciones históricas se registran con la jerarquía del momento y la jerarquía puede cambiar después.

### Frontend

- La ficha de la persona pide `GET …/conocimientos/permisos` y muestra **Acreditar** y **Acreditar otro conocimiento** solo si `puedeAcreditar`. Si no, y el usuario es evaluador, muestra el motivo en un texto chico. Antes el botón dependía solo del rol y el backend respondía 403 al guardar.
- La bandeja **Por acreditar** no cambia de pantalla: el backend ya filtra.
- `npm run api:tipos` regenera `src/api/esquema.d.ts`.

### Datos de demo

Para que la regla se vea en la demo hace falta cargar la jerarquía, que hoy está vacía:

| Cambio | Detalle |
| --- | --- |
| Puesto de jefatura | `P-DEP-JEF` «Jefe del Departamento de Sistemas», en la unidad departamento, nivel `conduccion_departamento` |
| Persona de la jefatura | `DEMO-010` Gómez, Andrea, ocupa `P-DEP-JEF`. Sin conocimientos cargados (no tiene quién la acredite) |
| `demo.jefatura` | Queda vinculado a `DEMO-010`. Antes no tenía persona y por eso no podía acreditar |
| Superiores | Los cinco jefes de cátedra dependen de `P-DEP-JEF`. JTP de Bases de Datos → jefe de Bases de Datos. Cada auxiliar → el jefe de su cátedra |
| Evaluadores históricos | Cada acreditación precargada la firma el superior de la persona (antes todas las firmaba Sofía Herrera, incluso las de otros jefes) |

No cambian los números del tablero, de criticidad ni de sucesión del guion: el puesto nuevo no tiene requisitos, así que no suma pares, brechas ni puestos críticos.

### Guion de la demo

- Caso 2: el puesto nuevo de Redes se crea con **Puesto superior** «Jefe de cátedra de Redes de Datos».
- Caso 4: se agrega cómo se ve la regla. La jefa de Bases de Datos no puede acreditar a Diego (de Algoritmos), y la jefatura del departamento ve en su bandeja lo pendiente de todas las cátedras.
- Tabla de usuarios: `demo.jefatura` es Andrea Gómez.

## Pruebas

- **Unitarias** (`acceso-perfil.service.spec.ts`): rol no evaluador, sin persona, autoacreditación, no subordinado y subordinado.
- **Integración** contra PostgreSQL: superior directo, superior a dos niveles, par de la misma unidad (rechazado), subordinado que intenta acreditar al jefe (rechazado), persona de otra cátedra (rechazada), persona con dos cargos acreditable por los dos jefes, ocupación vencida (rechazada) y bandeja filtrada por jerarquía.
- **Demo** (`cargar-demo.int.spec.ts`): los superiores quedan cargados y `demo.jefatura` tiene persona.

## Fuera de alcance

- Restringir qué conocimientos acredita cada superior (por ejemplo, solo los que exige el puesto del subordinado).
- Cambiar el alcance de lectura, criticidad o sucesión, que siguen por `usuario_unidad`.
- Validar la jerarquía en la base con triggers.
- RF05 (validación de descripciones), que sigue como punto abierto.
