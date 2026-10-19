Estado: Implementada | Fecha: 2026-10-18 | Autor: IvanOchoa229

# Detección y tablero de riesgo

## Contexto y objetivo

El módulo `deteccion` es hoy un esqueleto (`deteccion.module.ts` vacío). Este bloque implementa las
cinco consultas de detección (RF16 a RF20) como vistas de PostgreSQL creadas por migración y el tablero
de riesgo que las consolida (RF21). Es el último bloque de datos: lee lo que dejaron Estructura, Personas,
Conocimiento, Criticidad y Sucesión, y no guarda nada (RNF04). Cierra OE6.

Contexto leído: `docs/requerimientos.md` (incluidas §5 y §7), `docs/primer-avance.md` (incluida §8.4) y las
specs de Usuarios, Estructura, Personas, Importación CSV, Conocimiento (catálogo y activos), Criticidad y
Sucesión. Las definiciones de cada indicador las acordó el usuario con la propuesta del 2026-10-18; lo que
quedó a criterio del autor se marca «(mi decisión)».

## Requerimientos que cubre

| ID | Cobertura |
| --- | --- |
| RF16 | Conocimientos críticos con un único poseedor, y aparte los que no tienen ninguno |
| RF17 | Cátedras sostenidas por una sola persona, y aparte las cátedras sin dotación |
| RF18 | Puestos críticos sin sucesor preparado, con el motivo |
| RF19 | Brecha de perfil por persona y puesto (ocupante) y por candidato y puesto del plan |
| RF20 | Conocimientos críticos que pierden poseedores por retiro dentro de un plazo configurable |
| RF21 | Tablero que consolida RF16 a RF20, con filtros y pasaje al listado detallado |
| RF24 | Cada consulta respeta el alcance del rol; el docente y el candidato ven solo su propia brecha |
| RNF01 | Todas las rutas con `@Roles`; alcance por unidad |
| RNF02 | Los listados nombran personas: acceso restringido por rol y, para jefaturas, por alcance |
| RNF04 | Todo se calcula por consulta sobre vistas; ni indicadores ni instantáneas se almacenan |

Apoya OE6 (consultas de detección con resultados verificados), OE7 y OE8 (el tablero muestra la cobertura
de planes). No toca los puntos abiertos de `docs/requerimientos.md` §7.

## Decisiones

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Poseedor | Persona **activa**, con **al menos una ocupación vigente** (definición de Personas), **sin retiro cumplido** (`fecha_prevista_retiro` nula o `>= hoy`) y con `id_nivel_acreditado` vigente de `orden` mayor o igual al del nivel requerido. Lo declarado sin acreditar no cuenta (Conocimiento, decisión 8). Un retiro futuro todavía cuenta: RF20 lo necesita |
| 2 | Par crítico | Par `(puesto, conocimiento)` con puesto activo, conocimiento activo, requisito existente y criticidad vigente `alta` (siempre `criticidad_vigente`). Vale excluyente o deseable |
| 3 | Nivel requerido de un conocimiento | Un conocimiento puede ser crítico en varios puestos. Para contar poseedores se toma el **nivel más exigente** (mayor `orden`) entre sus pares críticos: quien llega solo al menor no cubre el mayor. La fila lista los puestos que lo hacen crítico |
| 4 | RF16: alcance de los poseedores | Todo el departamento, no la cátedra. La unidad de análisis es el **conocimiento** (una fila por conocimiento). Se listan con **un** poseedor; los de **cero** poseedores van en otra lista («sin poseedor»), porque es el caso más grave |
| 5 | RF17 | Cátedras activas con exactamente **una persona distinta** (activa) entre las ocupaciones vigentes de sus puestos; la fila indica cuántos cargos concentra. Las cátedras con cero personas van en otra lista («sin dotación») |
| 6 | RF18: puesto crítico | Puesto activo con al menos un requisito excluyente de criticidad vigente `alta` (contrato de Criticidad). «No evaluado» no es «no crítico»: se informa aparte en el tablero |
| 7 | RF18: sucesor preparado | Contrato de Sucesión: algún candidato de un plan **`aprobado`** del puesto cubre, con su nivel acreditado vigente, **todos** los excluyentes. El estado manual no interviene. **Refinamiento de este bloque** (mi decisión): el candidato debe además ser persona activa, con ocupación vigente, sin retiro cumplido y no ocupar ya el puesto; si no, no cuenta |
| 8 | RF18: motivo | Un puesto sin plan aprobado cuenta como sin sucesor. El motivo es `sin_plan`, `plan_en_elaboracion` (hay `borrador` o `pendiente_aprobacion`) o `ningun_candidato_cubre` (incluye el plan aprobado cuyos candidatos no son válidos); con cantidad de candidatos y de candidatos válidos |
| 9 | RF19: cálculo | Por conocimiento: `faltante = max(0, orden_requerido − orden_acreditado)`. Sin nivel acreditado = **«sin acreditar»**, no nivel 0: el faltante es el `orden` requerido completo y cuenta como no cubierto. El nivel declarado se muestra a la propia persona como información |
| 10 | RF19: resumen | Dos contadores: **excluyentes cubiertos X de N** y **deseables cubiertos Y de M**. Sin porcentaje único ni ponderación: mezclaría dos pesos que el modelo no define. El de excluyentes es el mismo criterio de RF18 |
| 11 | RF19: contextos | Ocupante: cada puesto con ocupación vigente de la persona. Candidato: el puesto de cada plan donde figura, no el que ocupa. El docente solo ve sus candidaturas en planes `aprobado` (igual que `mis-planes`); la jefatura, también las de planes en elaboración |
| 12 | RF20: plazo | Parámetro `meses`, por defecto **24**, entre 1 y 120. Es un parámetro de la consulta, no un valor guardado; el tablero lo cambia en pantalla. La constante por defecto vive en código |
| 13 | RF20: qué lista | Conocimientos críticos con al menos un poseedor que se retira dentro del plazo (`fecha_prevista_retiro <= hoy + meses`). Por defecto solo los que **quedan con 0 o 1** poseedores tras esos retiros; el interruptor `incluirConDosOMas` suma el resto. Cada fila trae cuántos quedan |
| 14 | Permisos | `recursos_humanos` y `autoridad`: todo, global, incluido el tablero. `jefatura_departamento` y `jefe_catedra`: listados de RF16 a RF20 en su alcance, sin tablero (mi decisión; amplía la matriz de Usuarios). `docente`: solo su brecha. `analista_puestos` y `administrador`: nada |
| 15 | Nombres de poseedores para jefaturas | Una jefatura ve la persona poseedora solo si esa persona tiene una ocupación vigente dentro de su alcance; fuera del alcance ve el conocimiento y el conteo sin nombre |
| 16 | Tablero | Cantidades y gráficos de los cinco indicadores más una franja de calidad de datos (decisión 20). Filtros por unidad y por plazo. Cada tarjeta lleva a su listado con el mismo filtro |
| 17 | RF19 en el tablero | No hay indicador organizacional natural de RF19: se muestra «candidatos de planes aprobados con excluyentes sin cubrir» |
| 18 | Exportación | CSV de los listados RF16, RF17, RF18 y RF20 (`?formato=csv`) solo para roles globales; RF19 no se exporta (mi decisión: es la vista más sensible sobre personas y no es un listado de gestión) |
| 19 | Vistas y parámetros | Una vista no recibe parámetros. Las vistas exponen filas completas (fechas de retiro, niveles) y el servicio aplica alcance, unidad y `meses` con `WHERE` y una consulta sobre ellas |
| 20 | Calidad de datos | Franja del tablero con tres razones de cobertura: criticidad evaluada (`GET /criticidad/avance`), puestos críticos con plan aprobado (`GET /sucesion/cobertura`) y requisitos de puestos ocupados con nivel acreditado (calculado desde la vista de brecha). Mientras OE4 y OE5 no estén completos, RF16 y RF18 sobreestiman el riesgo; la franja lo dice (mi decisión) |
| 21 | Qué excluyentes cuentan | «Todos los excluyentes» de RF18 y RF19 son **todos los requisitos excluyentes activos del puesto, cualquiera sea su criticidad** (contrato de Sucesión y `candidatos.sql.ts`). La criticidad `alta` solo decide qué puesto es crítico (RF18) y qué conocimiento es crítico (RF16, RF20). RF19 cuenta todos los requisitos del puesto con conocimiento activo, críticos o no (mi decisión de lectura) |
| 22 | Nivel requerido global | El nivel exigente de la decisión 3 es global al departamento, aun con filtro o alcance: el conocimiento es del departamento. Para una jefatura, la fila lista los puestos críticos de su alcance y «y N más fuera de tu alcance», así el conteo se explica sin revelar otras unidades (mi decisión). Las vistas siguen sin parámetros |
| 23 | Enmascarado por alcance | Fuera del alcance de la jefatura se enmascaran la identidad de la persona (id y nombre) y su fecha de retiro. Se conservan los conteos (`cantidad_poseedores`, `quedan`). La fila de RF16 aparece si algún par crítico del conocimiento está en su alcance (mi decisión) |
| 24 | RF17 y el retiro | Deliberado, como lo definió el usuario: RF17 usa la ocupación vigente de Personas y no mira el retiro. Una cátedra sostenida por alguien con retiro cumplido sigue figurando como «una persona»; el retiro lo resuelven RF16, RF18 y RF20 |
| 25 | Tarjetas del tablero | Cada tarjeta muestra una cifra principal y, si hay, una secundaria: RF16 = conocimientos con un poseedor (y «N sin poseedor»); RF17 = cátedras con una persona (y «N sin dotación»); RF18 = puestos críticos sin sucesor (los motivos van en el gráfico); RF19 = candidatos de planes aprobados con excluyentes sin cubrir; RF20 = conocimientos del listado por defecto (sin `incluirConDosOMas`). «No evaluado» aparece solo en la franja de calidad de datos |
| 26 | Series de los gráficos | Barras por cátedra: cantidad de conocimientos únicos poseídos por una persona de esa cátedra (RF16, por unidad del puesto crítico). Barras apiladas: puestos de RF18 por motivo. Línea de tiempo: retiros de poseedores de conocimientos críticos por semestre dentro del plazo. La forma exacta de la respuesta de `/deteccion/tablero` la define el plan |
| 27 | `mi-brecha` | Muestra la ocupación vigente propia y las candidaturas en planes `aprobado` para los tres roles; las candidaturas en planes en elaboración las ve la jefatura solo en `brecha` sobre otras personas (mi decisión: el candidato no ve un plan que aún no se aprobó) |
| 28 | Candidato que ya ocupa el puesto | La fila de `candidato` se conserva en `deteccion_brecha_perfil` con la marca `a_revisar`, y `candidatos_total` de RF18 lo cuenta; `candidatos_validos` no (decisión 7) |
| 29 | Escala de niveles | `orden` se siembra 1..4 sin saltos por migración. «Sin acreditar» equivale a estar por debajo del nivel 1: el faltante es el `orden` requerido completo |

## Modelo de datos

El modelo no suma tablas. Se crean vistas en migraciones escritas a mano, revisadas antes de aplicarse
(CLAUDE.md). Las bases son vistas de uso interno; las `deteccion_*` son las que consume la API.

| Vista | Qué devuelve |
| --- | --- |
| `poseedor_vigente` | `(id_persona, id_conocimiento, orden_acreditado, fecha_prevista_retiro)` de las personas que cumplen la decisión 1, con cualquier nivel acreditado. El nivel requerido se compara después |
| `par_critico` | `(id_puesto, id_conocimiento, orden_requerido, es_excluyente)` de la decisión 2 |
| `deteccion_punto_unico_falla` | Una fila por conocimiento con par crítico: `id_conocimiento`, `orden_requerido_max`, `cantidad_poseedores` (0 o más) y el `id_persona` del poseedor único si es uno. La API filtra 0 y 1 (RF16) |
| `deteccion_catedra_una_persona` | Una fila por cátedra activa: `id_unidad`, `cantidad_personas`, `cantidad_ocupaciones` y `id_persona` si hay una. La API filtra 0 y 1 (RF17) |
| `deteccion_puesto_sin_sucesor` | Una fila por puesto crítico sin sucesor preparado, con `motivo`, `candidatos_total` y `candidatos_validos`; `id_plan` del plan aprobado o en elaboración, si hay |
| `deteccion_brecha_perfil` | Una fila por `(contexto, id_persona, id_puesto, id_conocimiento)`: `contexto` (`ocupante` o `candidato`), `id_plan` (nulo en ocupante), `es_excluyente`, `orden_requerido`, `orden_acreditado` (nulo = sin acreditar), `faltante`, `cubierto` |
| `deteccion_retiro_poseedor` | Una fila por `(id_conocimiento, id_persona)` de poseedor con fecha de retiro: la fecha y `cantidad_poseedores`. El servicio aplica el plazo y calcula cuántos quedan |

Notas de implementación:

- «Vigente», «retiro cumplido» y «hoy» usan `CURRENT_DATE` del servidor, igual que Personas (su riesgo
  lo advierte: todas las vistas deben contar igual).
- Los niveles se comparan por `nivel_dominio.orden`, nunca por id.
- `deteccion_brecha_perfil` en contexto `candidato` incluye planes `aprobado`, `borrador` y
  `pendiente_aprobacion`; el servicio filtra por rol (decisión 11).
- Índices: se verifican con `EXPLAIN` contra el juego de prueba; si hace falta alguno (por ejemplo sobre
  `ocupacion(fecha_hasta)`), va en una migración. No se anticipan.

### Migraciones

1. Vistas base `poseedor_vigente` y `par_critico`.
2. `deteccion_punto_unico_falla`, `deteccion_catedra_una_persona` y `deteccion_retiro_poseedor`.
3. `deteccion_puesto_sin_sucesor` y `deteccion_brecha_perfil`.

## API

Módulo `deteccion` (controller, service, DTOs de respuesta y un `*.sql.ts` por consulta, como Sucesión).
Todo bajo `/api`; DTOs con `@ApiProperty`; tipos del frontend con `npm run api:tipos`.

| Endpoint | Roles | Notas |
| --- | --- | --- |
| `GET /deteccion/puntos-unicos-falla` | `recursos_humanos`, `autoridad`; `jefatura_departamento`, `jefe_catedra` por alcance | Devuelve `{ unicoPoseedor: [...], sinPoseedor: [...] }`. Filtro `idUnidad` (la de los puestos críticos, con descendientes) |
| `GET /deteccion/catedras-una-persona` | Los mismos | `{ unaPersona: [...], sinDotacion: [...] }`; filtro `idUnidad` |
| `GET /deteccion/puestos-sin-sucesor` | Los mismos | Filtros `idUnidad`, `motivo` |
| `GET /deteccion/horizonte-riesgo` | Los mismos | `meses` (1 a 120, defecto 24), `incluirConDosOMas`, `idUnidad` |
| `GET /deteccion/brecha` | `recursos_humanos`, `autoridad`; `jefatura_departamento`, `jefe_catedra` por alcance | Filtros `idPersona`, `idPuesto`, `idUnidad`, `contexto`. Devuelve filas por conocimiento y el resumen por persona y puesto |
| `GET /deteccion/mi-brecha` | `docente`, `jefe_catedra`, `jefatura_departamento` | Solo la persona de la sesión (como ocupante, y como candidato en planes aprobados); sin ella, 400 |
| `GET /deteccion/tablero` | `recursos_humanos`, `autoridad` | Cantidades de los cinco indicadores, series de los gráficos y calidad de datos; filtros `idUnidad`, `meses` |

- Los cuatro listados aceptan `?formato=csv` solo para `recursos_humanos` y `autoridad`; otro rol recibe
  403. El CSV usa los mismos filtros y las mismas columnas que la tabla, en UTF-8 con BOM para Excel.
- Alcance: `AlcanceService.unidadesVisibles` filtra por `puesto.id_unidad` (RF16, RF18, RF20) o por
  `id_unidad` de la cátedra (RF17), y por unidad de la ocupación o del puesto del plan en RF19. Decisión 15
  para los nombres.
- Un docente sin persona vinculada recibe 400 en `mi-brecha`. `docente` que consulta `GET /deteccion/brecha`
  recibe 403: la ruta propia es `mi-brecha`.
- El test que exige `@Roles` en toda ruta no pública cubre las rutas nuevas.

## Permisos (RF24, RNF02)

| Rol | Listados RF16 a RF20 | Brecha (RF19) | Tablero | CSV |
| --- | --- | --- | --- | --- |
| `recursos_humanos`, `autoridad` | Global | Todas | Sí | Sí |
| `jefatura_departamento` | Su alcance, nombres según decisión 15 | Personas y candidatos de su alcance | No | No |
| `jefe_catedra` | Su alcance, nombres según decisión 15 | Personas y candidatos de su alcance (mi decisión: acredita a ese equipo) | No | No |
| `docente` | No | Solo la propia (`mi-brecha`) | No | No |
| `analista_puestos`, `administrador` | No | No | No | No |

Los listados identifican a la persona que es único punto de falla: es información sensible (RNF02, Ley
25.326). Por eso el acceso global queda en dos roles y la exportación no se abre a jefaturas.

## Frontend (`features/tablero` y `features/deteccion`)

- **Tablero** (`/tablero`; `recursos_humanos`, `autoridad`): selector de unidad y de plazo (por defecto
  24 meses); cinco tarjetas con cantidad y color más texto (RNF06); gráficos de Recharts: barras por
  cátedra de los puntos únicos de falla, barras apiladas de los motivos de RF18 y una línea de tiempo de
  retiros por semestre. Franja de calidad de datos con las tres coberturas. Cada tarjeta lleva al listado
  con el filtro de unidad y plazo en la URL.
- **Listados** (`/deteccion/puntos-unicos-falla`, `/catedras`, `/puestos-sin-sucesor`, `/horizonte`;
  `recursos_humanos`, `autoridad`, `jefatura_departamento`, `jefe_catedra`): tablas con filtros, las listas
  secundarias («sin poseedor», «sin dotación») en una segunda pestaña, y botón «Exportar CSV» solo para
  roles globales.
- **Brecha** (`/deteccion/brecha`; roles de lectura): selector de persona y puesto, tabla por
  conocimiento (requerido, acreditado o «sin acreditar», faltante, excluyente o deseable) y los dos
  contadores. **Mi brecha** (`docente`, `jefe_catedra`, `jefatura_departamento`): lo propio. Reemplaza el
  conteo simple de «Mi sucesión» por el detalle, con un enlace desde ahí.
- Textos claros sobre qué significa «sin acreditar» y por qué un conocimiento puede figurar sin poseedor
  mientras OE4 no esté completo.
- Formularios y filtros con react-hook-form y zod; llamadas con TanStack Query dentro del feature.

## Validación (OE6)

### Juego de datos

`backend/scripts/datos-prueba-deteccion.sql`, siguiendo el precedente de `catedras-ejemplo.sql`. No es una
migración: las migraciones corren en todos los entornos y no deben cargar datos de prueba. Lo usan los tests
de integración (sobre la base temporal) y la demostración del tablero (carga manual, documentada en el
README). Las fechas son relativas a `CURRENT_DATE`, así los resultados esperados no caducan. Los nombres son
ficticios. Niveles de dominio N1 a N4 por `orden`.

**Personas** (todas activas salvo que se indique):

| Persona | Situación |
| --- | --- |
| Ana | Jefe de cátedra y JTP de C1 (dos ocupaciones vigentes) |
| Beto | Jefe de C2; retiro previsto en 10 meses |
| Carla | Auxiliar de C2 |
| Diego | Jefe de C4; retiro previsto en 30 meses |
| Eva | Auxiliar de C4 |
| Fede | Ocupación cerrada hace un mes (sin ocupación vigente) |
| Gus | Ocupación vigente en C3; retiro previsto ayer |
| Hugo | Inactivo |

**Cátedras:** C1, C2, C3 (solo Gus), C4 y C5 (sin ocupaciones). Cátedra inactiva: no figura.

**Conocimientos críticos** (criticidad vigente `alta` en el par indicado) y acreditaciones:

| Conocimiento | Pares críticos (requisito) | Acreditado vigente |
| --- | --- | --- |
| K1 | C2.jefe N3 excl. y C4.aux N2 deseable | Beto N4, Carla N3, Eva N2, Fede N4, Gus N4, Hugo N4 |
| K2 | C1.jefe N3 excl. y C1.JTP N2 excl. | Ana N3 |
| K3 | C4.jefe N2 excl. y C3.jefe N2 excl. | Diego N2, Eva N2, Gus N3 |
| K4 | C2.jefe N2 excl. | Nadie (Fede lo declaró) |
| K5 | C4.aux N2 excl. | Gus N4 |
| K6 | C1.jefe N3 excl. | Ana N3, Beto N3, Carla N3 |
| K7 | C2.aux N2 deseable (criticidad `media`: no es un par crítico) | Ana N4 |
| K8 | C4.jefe N1 excluyente (criticidad `baja`: no es un par crítico) | Eva N1 |

**Planes:** C2.jefe `aprobado` con candidatos Eva y Carla; C3.jefe `aprobado` con candidato Gus; C4.jefe
`aprobado` con candidata Eva; C4.aux `borrador` con candidata Carla; C1.jefe sin plan.

### Resultados esperados (con `meses = 24`)

| Consulta | Resultado | Por qué |
| --- | --- | --- |
| RF16 un poseedor | K2 (Ana) | Único con nivel suficiente |
| RF16 sin poseedor | K4 y K5 | K4 nadie acredita; en K5 el único acreditado (Gus) está retirado |
| RF16 no figuran | K1 (Beto y Carla), K3 (Diego y Eva), K6 (tres), K7 | K1: Eva no alcanza el N3, Fede sin ocupación, Gus retirado y Hugo inactivo no cuentan. K7 no es crítico |
| RF17 una persona | C1 (Ana, 2 cargos) y C3 (Gus) | La regla cuenta personas activas con ocupación vigente; el retiro cumplido de Gus lo usan RF16 y RF20, no RF17 (decisión 5) |
| RF17 sin dotación | C5 | Sin ocupaciones vigentes |
| RF18 | C1.jefe y C1.JTP `sin_plan`; C2.jefe `ningun_candidato_cubre` (2 de 2 válidos); C3.jefe `ningun_candidato_cubre` (1 candidato, 0 válidos: Gus retirado); C4.aux `plan_en_elaboracion` | C2.jefe: Carla cubre K1 pero no K4; Eva no cubre K1 |
| RF18 no figura | C4.jefe | Eva cubre K3 N2 y también K8 N1, un excluyente no crítico que igualmente cuenta (decisión 21). Prueba de variante: sin la acreditación de Eva en K8, C4.jefe pasa a `ningun_candidato_cubre` |
| RF19 | Carla candidata a C2.jefe: K1 cubierto (faltante 0), K4 «sin acreditar» (faltante 2); excluyentes 1 de 2. Eva candidata a C2.jefe: K1 faltante 1, K4 sin acreditar (faltante 2); excluyentes 0 de 2. Carla ocupante de C2.aux: sin excluyentes; deseables 0 de 1 (K7 sin acreditar) | Decisiones 9 y 10 |
| RF20 | K1 con `quedan = 1` (Carla; Beto se retira) y K6 solo con `incluirConDosOMas` (`quedan = 2`) | Diego (30 meses) queda fuera del plazo |
| RF20 con `meses = 36` | Se suma K3 con `quedan = 1` (Eva) | |

### Pruebas

- **Integración contra PostgreSQL real** (`*.int.spec.ts`, `npm run test:integracion`): carga del juego en
  la base temporal y una prueba por vista que compara contra la tabla de resultados esperados. Casos de
  borde: nivel igual y menor al requerido, retirado, inactivo, sin ocupación vigente, cátedra vacía,
  puesto sin plan, plan en borrador, candidato no válido, retiro dentro y fuera del plazo, y plazo
  cambiado. Alcance con la consulta recursiva real. Auditoría: no aplica, no se escribe.
- **Unitarias (vitest, repositorios simulados)**: armado del resumen de brecha, aplicación del plazo y de
  `incluirConDosOMas`, recorte de nombres por alcance, rechazo de CSV a roles no globales, 400 sin persona
  en `mi-brecha`, rangos del DTO de `meses`.
- **Frontend**: validado por escenarios de uso, como el resto, con el juego de datos cargado.

## Cambios en documentos

- `docs/requerimientos.md`: §5 referencia esta spec y suma las vistas de detección.
- `docs/superpowers/specs/2026-10-12-usuarios-roles-design.md`: la matriz agrega los listados de
  detección y la brecha por alcance a `jefatura_departamento` y `jefe_catedra`, y `mi-brecha` al `docente`.
- `docs/superpowers/specs/2026-10-18-sucesion-planes-design.md`: el contrato de RF18 suma el filtro de
  candidato válido (decisión 7) y «Mi sucesión» enlaza a la brecha detallada.
- `README.md`: cómo cargar el juego de datos de prueba.
- Esta spec pasa a `Implementada` al cerrar el trabajo.

## Fuera de alcance

Alertas y notificaciones, histórico o tendencias de los indicadores (RNF04 impide almacenarlos), recálculo
de criticidad, exportación a PDF, horizonte guardado por usuario o por instalación, indicadores por
persona con ponderación, el indicador de OE4 como pantalla propia y el borrado de datos de prueba.

## Riesgos

- **Datos incompletos**: con pocas acreditaciones y criticidades, RF16 y RF18 mostrarán casi todo como
  riesgo. La franja de calidad de datos y los textos explicativos lo mitigan; no lo resuelven.
- **Poseedor sin ocupación vigente excluido**: una persona con licencia sin ocupación abierta deja de
  contar como poseedora. Es la lectura conservadora; se corrige cargando su ocupación.
- **Nivel más exigente entre pares críticos**: un conocimiento exigente en un solo puesto marginal puede
  marcar punto único de falla aunque otros puestos lo piden más bajo. La fila lista los puestos para
  que se vea la causa.
- **Fecha del servidor**: las vistas dependen de `CURRENT_DATE`; los tests usan fechas relativas.
- **Información sensible**: el listado de puntos únicos de falla nombra personas. Se limita por rol y
  alcance, y el CSV a dos roles.
- **Rendimiento**: las vistas anidan joins sobre ocupación, requisito y acreditación. Con la escala del
  departamento no es un riesgo; se mide con `EXPLAIN` antes de agregar índices.
