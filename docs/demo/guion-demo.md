# Guion de demostración de los casos de uso

Recorrido manual de los casos de uso core del sistema, pensado para mostrárselo al profesor. Cuenta una historia: **se detecta el riesgo de perder conocimiento crítico y se actúa para reducirlo**.

Spec: `docs/superpowers/specs/2026-11-16-demo-datos-y-guion-design.md`. Duración estimada: unos 50 minutos (cada caso indica la suya).

> **Cómo se verificó este guion.** Se levantó el sistema desde cero (`down -v` y `up --build`) y se ejecutó la historia completa **por la API** con los siete usuarios, anotando cada resultado. Los nombres de pantallas, botones y campos se tomaron del código del frontend (no del navegador: la extensión del navegador no estaba conectada). Antes de presentar, conviene recorrerlo una vez a mano en la interfaz. Si un texto de pantalla difiere de lo escrito acá, vale el de la pantalla.

## 0. Preparación

1. Requisitos: Docker con Compose. Nada más.
2. Clonar el repositorio y copiar la configuración:
   ```bash
   cp .env.example .env
   docker compose up --build
   ```
   `.env.example` ya trae `CARGAR_DATOS_DEMO=true`: el backend carga los datos de demostración al arrancar (el log dice «Datos de demostración cargados»). La primera vez tarda unos minutos por la construcción de las imágenes. Está pensado para una base nueva: si ya hay datos propios (por ejemplo las cátedras de ejemplo de `backend/scripts/`), no lo actives, porque se mezclarían con los de la demo y los números del guion dejarían de valer.
3. Direcciones:

   | Qué | URL |
   | --- | --- |
   | Aplicación | http://localhost:5173 |
   | Documentación de la API (Swagger) | http://localhost:3000/api/docs |
   | Consola de RustFS (archivos) | http://localhost:9101 (usuario y clave: `rustfsadmin`) |
   | Salud del sistema | http://localhost:3000/api/salud |

   Si algún puerto está ocupado en esa computadora, cambiarlo en el `.env` (`FRONTEND_PORT`, `PORT`, `DB_PORT`, `S3_PORT`, `S3_CONSOLE_PORT`).
4. Usuarios de demostración. **Todos usan la clave `DemoUTN2026`.** Son solo para la demo (el sistema es local).

   | Usuario | Rol | Persona / alcance | Qué ve en el menú |
   | --- | --- | --- | --- |
   | `demo.autoridad` | Autoridad | Toda la facultad | Tablero de riesgo, Estructura, Personas, Catálogo, Activos, Criticidad, Sucesión, Acciones, Detección |
   | `demo.rrhh` | Recursos Humanos | Toda la facultad; ve el documento de las personas | Igual que la autoridad |
   | `demo.jefatura` | Jefatura de Departamento | Andrea Gómez, jefa del Departamento de Sistemas | Estructura y puestos, Personas, Catálogo, Mis conocimientos, Por acreditar, Activos, Criticidad, Sucesión, Acciones, Detección, Mi brecha (sin Tablero ni Administración) |
   | `demo.jefecatedra` | Jefe de cátedra | Laura Benítez; solo la cátedra de Bases de Datos | Igual que la jefatura, con los datos limitados a su cátedra |
   | `demo.analista` | Analista de puestos | Toda la facultad | Estructura y puestos, Personas, Catálogo, Activos |
   | `demo.docente` | Docente | Diego Paz (Algoritmos) | Estructura y puestos, Mi ficha, Mis conocimientos, Activos de conocimiento, Mi sucesión, Acciones, Mi brecha |
   | `demo.admin` | Administrador | Toda la facultad | Estructura y puestos, Personas, Catálogo, Activos, Administración |

5. **Volver al estado inicial entre ensayos:** `docker compose down -v && docker compose up --build`. Borra todos los datos y archivos y recarga la demo. (Atención: borra también cualquier dato propio que hubiera en esos volúmenes.)

## La historia, en una mirada

Datos de partida (el tablero lo muestra en el caso 8):

- **Jerarquía de puestos:** cada jefe de cátedra depende del puesto de jefatura del departamento (Andrea Gómez), y cada JTP o auxiliar, del jefe de su cátedra. Esa jerarquía decide quién acredita a quién (caso 4).

- **Laura Benítez**, jefa de Bases de Datos, es la única que domina SQL avanzado y se retira en 10 meses.
- **Ricardo Molina**, jefe de Ingeniería de Software, es el único con Arquitectura de software, pero se retira en 40 meses (fuera del horizonte de 24).
- **Redes de Datos** la sostiene una sola persona (Hernán Quiroga) y su jefatura no tiene plan de sucesión.
- **Sistemas Operativos** es el contraste: dos personas con Linux avanzado y un plan aprobado cuyo candidato cubre los requisitos.
- El plan de sucesión de Laura espera aprobación. Su candidato, **Martín Acosta**, declara SQL avanzado pero está acreditado como intermedio.

Orden del recorrido: **1** ingreso y permisos → **8-A** el tablero muestra el riesgo → **2** puestos → **3** personas → **4** conocimiento → **5** activos → **6** criticidad → **7** sucesión y acciones → **8-B** vuelta al tablero: el riesgo bajó.

---

## Caso 1. Ingreso y permisos por rol (RF22, RF24) · ~5 min

**Objetivo:** mostrar que cada actor ve y puede hacer solo lo que le corresponde.

| Paso | Dónde | Acción y datos | Resultado esperado |
| --- | --- | --- | --- |
| 1.1 | `/login` | Usuario `demo.autoridad`, clave `DemoUTN2026`, botón **Ingresar** | Entra al **Tablero de riesgo**. En el encabezado figura `demo.autoridad` y el botón **Cerrar sesión** |
| 1.2 | Login | Probar con `demo.autoridad` y la clave `incorrecta` | Mensaje «Usuario o clave incorrectos» |
| 1.3 | Menú lateral | Observar las secciones con `demo.autoridad` | Ve Tablero de riesgo, Estructura y puestos, Personas, Catálogo, Activos, Criticidad, Sucesión, Acciones y Detección. **No** ve Administración |
| 1.4 | Cerrar sesión; entrar como `demo.docente` | Observar el menú | Solo Estructura y puestos, Mi ficha, Mis conocimientos, Activos de conocimiento, Mi sucesión, Acciones y Mi brecha. **No** hay Tablero, Personas ni Criticidad |
| 1.5 | Con `demo.docente`, escribir en la barra de direcciones `/criticidad` | Navegar | Aviso «No tenés permiso para ver esta sección.» |
| 1.6 | Entrar como `demo.rrhh`, **Personas**, elegir a *Benítez, Laura* | Mirar la ficha | Se ven **Documento** y **Fecha de nacimiento** |
| 1.7 | Entrar como `demo.jefecatedra`, **Personas**, elegir a la misma persona | Mirar la ficha | El documento y la fecha de nacimiento **no** se muestran: la API no los entrega a este rol (confidencialidad, Ley 25.326) |
| 1.8 | Como `demo.jefecatedra`: **Criticidad**, **Sucesión**, **Detección** | Comparar con `demo.rrhh` | La jefa de cátedra ve solo lo de Bases de Datos (5 pares de criticidad, un punto único de falla —SQL— y un solo plan). Recursos Humanos ve 16 pares, 3 puntos únicos y 3 planes |
| 1.9 | Como `demo.admin`: **Administración** | Pestañas **Usuarios**, **Tablas de referencia**, **Matriz de criticidad** | Lista los 8 usuarios (los 7 de demo y `admin`, el del `.env`) con su rol y las unidades a cargo |

Con la API (opcional, Swagger): `demo.docente` pidiendo `/api/deteccion/tablero` recibe 403.

---

## Caso 8-A. El tablero muestra el riesgo (RF16 a RF21) · ~8 min

**Objetivo:** ver qué conocimiento y qué puestos están en riesgo antes de actuar. **Usuario:** `demo.autoridad` (o `demo.rrhh`).

| Paso | Dónde | Acción y datos | Resultado esperado |
| --- | --- | --- | --- |
| 8A.1 | **Tablero de riesgo** | Dejar «Cátedra / unidad» en «Todo el departamento» y «Horizonte (meses)» en 24 | Cinco indicadores. **Anotar los valores iniciales:** Puntos únicos de falla **3**; Cátedras vulnerables **1**; Puestos sin sucesor **3** (1 sin plan, 2 con plan en elaboración); Candidatos con brecha **0**; Horizonte de retiros **2** conocimientos |
| 8A.2 | Indicador Puntos únicos de falla, **Ver listado detallado** | Pestaña «Puntos únicos de falla» | Tres conocimientos con un único poseedor: *SQL y modelado relacional* (Benítez), *Arquitectura de software* (Molina) y *Redes TCP/IP* (Quiroga). *Administración de Linux* **no** aparece: tiene dos poseedores |
| 8A.3 | Pestaña **Cátedras (1 persona)** | Mirar | *Redes de Datos*, sostenida por Hernán Quiroga |
| 8A.4 | Pestaña **Puestos sin sucesor** | Mirar | *Jefe de cátedra de Ingeniería de Software* (plan en elaboración), *Jefe de cátedra de Bases de Datos* (plan en elaboración) y *Jefe de cátedra de Redes de Datos* (sin plan). Sistemas Operativos no figura: su sucesor está preparado |
| 8A.5 | Pestaña **Horizonte de retiros** | Plazo 24 meses; después 6 | Con 24 meses aparecen *SQL* y *Optimización de consultas*, por el retiro de Laura Benítez (en 10 meses). Con 6 meses no aparece ninguno. *Arquitectura de software* (Ricardo Molina, retiro en 40 meses) aparece recién al subir el plazo a 60 meses |
| 8A.6 | Pestaña **Brecha de perfil** | Contexto «Ocupantes y candidatos» | Martín Acosta, candidato a Jefe de cátedra de Bases de Datos, tiene un escalón de brecha en SQL (requerido Avanzado, acreditado Intermedio). Diego Paz, ocupante de un puesto de auxiliar, tiene una brecha en Algoritmos |
| 8A.7 | **Exportar CSV** en cualquier listado | Botón | Descarga el listado en CSV |

---

## Caso 2. Puestos y requisitos de conocimiento (RF02, RF09) · ~5 min

**Usuario:** `demo.analista`. **Objetivo:** dar de alta un puesto y definir qué conocimiento exige.

| Paso | Dónde | Acción y datos | Resultado esperado |
| --- | --- | --- | --- |
| 2.1 | **Estructura y puestos** | En el árbol de la izquierda, elegir la cátedra **Redes de Datos** | La tabla muestra un único puesto: *Jefe de cátedra de Redes de Datos* |
| 2.2 | Botón **Nuevo puesto** | Denominación `Auxiliar docente de Redes de Datos`; Nivel jerárquico `Operativo docente`; Dotación prevista `1`; **Puesto superior** `Jefe de cátedra de Redes de Datos`; Propósito `Dictar las prácticas del laboratorio de redes.` Guardar | El puesto aparece en la tabla con un código generado (`P-0001`) y estado **Activo** |
| 2.3 | En la fila del puesto nuevo, **Requisitos** | Se abre «Requisitos de…» | Todavía no tiene requisitos |
| 2.4 | **Agregar un requisito** | Conocimiento `Redes TCP/IP`; Nivel `Intermedio`; marcar **Excluyente** | El requisito queda en la lista |
| 2.5 | Repetir | Conocimiento `Administración de Linux`; Nivel `Básico`; sin marcar Excluyente | Queda como deseable |
| 2.6 | Cerrar. Entrar a la fila del jefe de cátedra de Bases de Datos (cátedra **Bases de Datos**), **Requisitos** | Mirar | Ya tiene: SQL (Avanzado, excluyente), Optimización de consultas (Intermedio, excluyente) y Didáctica universitaria (Intermedio, deseable) |
| 2.7 | Fila del puesto, **Ocupantes** | Mirar el puesto de Redes que se acaba de crear | «Hoy nadie ocupa este puesto.» (se completa en el caso 3) |
| 2.8 | Como `demo.rrhh`, **Estructura y puestos** | Mirar | RR. HH. ve la tabla con **Ocupantes** y **Requisitos** (el diálogo de requisitos es solo de lectura), pero **no** tiene Nuevo puesto, Editar ni Dar de baja: solo el analista edita |

---

## Caso 3. Personas, ocupaciones e importación CSV (RF06, RF07) · ~7 min

**Usuario:** `demo.rrhh`. **Objetivo:** cargar personas, asignarles puestos y mostrar la importación masiva con validación previa.

| Paso | Dónde | Acción y datos | Resultado esperado |
| --- | --- | --- | --- |
| 3.1 | **Personas** | Mirar la lista y elegir a *Acosta, Martín* | La ficha muestra **dos ocupaciones vigentes** (Jefe de trabajos prácticos de Bases de Datos y Auxiliar de Algoritmos) |
| 3.2 | Elegir a *Luna, Pablo* | Mirar **Ocupaciones** | Una ocupación vigente y una de **Historial** (JTP de Bases de Datos, cerrada). Se conserva el historial |
| 3.3 | **Nueva persona** | Legajo `L-2001`; Apellido `Fernández`; Nombre `Paula`; Documento `36000001`; Fecha de nacimiento `10/05/1994`; Fecha de ingreso `01/03/2025`; Situación de revista `Contratado`. Guardar | Paula aparece en la lista |
| 3.4 | En su ficha, **Nueva ocupación** | Puesto `Auxiliar docente de Redes de Datos`; Desde `01/03/2025`; Carácter `Interino`; Dedicación `Simple`. Guardar | La ocupación queda como **Vigente** |
| 3.5 | **Importar CSV** (en Personas) | Elegir `docs/demo/archivos/personas-importacion.csv` con **Elegir archivo CSV** | Vista previa **sin escribir nada**: indica 1 error en 5 filas. La tabla «Errores de la importación» muestra fila 6, columna `dedicacion`: `"Dedicación total" no es una dedicación válido (opciones: Simple, Semiexclusiva, Exclusiva)`. (Hay un enlace «Descargar la plantilla» con el formato esperado) |
| 3.6 | Mismo lugar | Mirar el botón **Importar** | Está **deshabilitado** mientras haya errores: la importación es todo o nada |
| 3.7 | Elegir `docs/demo/archivos/personas-importacion-corregido.csv` (la misma planilla, con la dedicación corregida) | Mirar la vista previa y pulsar **Importar** | «5 filas leídas, sin errores»: se crearían 5 personas y 4 ocupaciones. Al pulsar Importar se cargan y aparecen en la lista (`IMP-01` a `IMP-05`) |
| 3.8 | Como `demo.jefecatedra`, **Personas** | Elegir a Paula | No se ve su documento ni su fecha de nacimiento (ver caso 1) |

**Efecto en el riesgo:** Redes de Datos ya no la sostiene una sola persona (Hernán y Paula). En el tablero, «Cátedras vulnerables» pasa de **1 a 0**.

---

## Caso 4. Declaración y acreditación de conocimiento (RF10, RF24) · ~8 min

**Objetivo:** que el docente declare lo que sabe y lo acredite, con evidencia, quien ocupa un puesto **por encima del suyo** en la jerarquía de puestos. Nadie acredita a un par, a su jefe ni a alguien de otra cátedra.

| Paso | Usuario / dónde | Acción y datos | Resultado esperado |
| --- | --- | --- | --- |
| 4.1 | `demo.docente`, **Mis conocimientos** | Mirar la lista | *Java* (declarado y acreditado Avanzado), *Algoritmos y estructuras de datos* (declarado Intermedio, acreditado **Básico**) y dos **Pendiente de acreditar**: *Docker y contenedores* y *Testing automatizado*. Debajo de cada fila, «Se pide: …» si su puesto lo exige |
| 4.2 | Misma pantalla | En *Algoritmos y estructuras de datos*, cambiar **Mi nivel** a `Avanzado` | Aparece «Cambiaste tu nivel, esperando nueva acreditación» (ya tenía una acreditación). En *Testing automatizado* la marca es «Declarado, esperando acreditación». No hace falta capacitación previa |
| 4.3 | **Sumar otro conocimiento del catálogo** | Elegir `Redes TCP/IP` y nivel `Básico` | Se suma como declarado, pendiente de acreditar |
| 4.4 | `demo.jefecatedra`, **Por acreditar** | Mirar la bandeja | Solo quien ocupa un puesto por debajo del de Laura (jefa de Bases de Datos): *Acosta, Martín*, su JTP, en *SQL y modelado relacional* (declaró Avanzado; acreditado hasta ahora Intermedio) y en *Docker y contenedores* (declaró Básico). **No** aparece Diego: su puesto depende de la jefa de Algoritmos, no de Laura |
| 4.5 | En la fila de Martín / SQL, **Acreditar** | Nivel acreditado `Avanzado`; Fecha de evaluación: hoy; Tipo de evidencia `Certificado`; Observaciones `Aprobó el curso y resolvió el caso de optimización frente a la cátedra.`; en **Evidencia (opcional)**, elegir `docs/demo/archivos/certificado-sql-avanzado.txt`. Guardar | La fila sale de la bandeja. El certificado queda guardado en RustFS junto con la acreditación |
| 4.6 | Como `demo.jefecatedra`, **Personas**, ficha de Martín, **Historial** del conocimiento SQL | Mirar y pulsar **Descargar evidencia** en la fila nueva | Dos acreditaciones: la anterior (Intermedio, sin archivo) y la nueva (Avanzado, vigente). La descarga trae el certificado. El historial no se pisa y la evidencia no se puede cambiar: un error se corrige con otra acreditación |
| 4.7 | Como `demo.jefecatedra`, **Personas**, ficha de Laura (su propia persona) | Buscar el botón **Acreditar** | No se ofrece: nadie acredita sus propios conocimientos |
| 4.8 | Como `demo.jefecatedra`, en Swagger, `POST /api/personas/{id de Diego}/conocimientos/{id de Docker}/acreditaciones` | Intentar acreditar a Diego | 403 «Solo podés acreditar a quien ocupa hoy un puesto por debajo del tuyo». La autoridad sale de la jerarquía de puestos, no del rol ni de la cátedra asignada al usuario |
| 4.9 | `demo.jefatura` (Andrea Gómez), **Por acreditar** | Mirar la bandeja | Lo pendiente de todas las cátedras, porque su puesto está arriba de los jefes de cátedra y, bajando, de todos los docentes: *Acosta* (Docker), *Paz* (Algoritmos, Docker, Redes TCP/IP y Testing) y *Ríos* (Java) |
| 4.10 | Misma bandeja, fila de *Paz, Diego* / *Docker y contenedores*, **Acreditar** | Nivel `Intermedio`; Fecha: hoy; Tipo de evidencia `Entrevista`. Guardar | La fila sale de la bandeja. Andrea puede acreditar a Diego aunque no sea su jefa directa: la autoridad baja por toda la cadena |

**Efecto en el riesgo:** *SQL y modelado relacional* ahora tiene **dos** poseedores (Laura y Martín): «Puntos únicos de falla» pasa de **3 a 2**.

---

## Caso 5. Activos de conocimiento con archivo (RF11) · ~4 min

**Usuario:** `demo.analista`. **Objetivo:** documentar el conocimiento y guardar el archivo en el almacenamiento de objetos (RustFS).

| Paso | Dónde | Acción y datos | Resultado esperado |
| --- | --- | --- | --- |
| 5.1 | **Activos de conocimiento** | Mirar la lista | Dos activos de tipo **Enlace** precargados: documentación de PostgreSQL 16 (Bases de Datos) y guía de administración de Linux (Sistemas Operativos) |
| 5.2 | **Nuevo activo** | Título `Procedimiento de respaldo y restauración de PostgreSQL`; Tipo de documento `Procedimiento`; Unidad que lo mantiene `Bases de Datos`; Conocimientos que documenta `SQL y modelado relacional`; Origen `Subir archivo`; archivo `docs/demo/archivos/procedimiento-respaldo-postgresql.txt`. Guardar | Aparece con origen **Archivo** |
| 5.3 | **Descargar** en esa fila | Descargar | Se obtiene el mismo texto |
| 5.4 | (Opcional) Consola de RustFS, http://localhost:9101 | Bucket `activos-conocimiento` | El objeto está ahí; en PostgreSQL solo quedan los metadatos |
| 5.5 | **Nuevo activo** otra vez, con el mismo archivo | Subir el mismo archivo con otro título | Rechazado: el sistema detecta el archivo duplicado (por su huella, no por el nombre) |
| 5.6 | **Catálogo de conocimientos**, fila de *SQL y modelado relacional* | Botón **Documentación** | Abre el listado de activos que documentan ese conocimiento (con **Agregar activo**), incluido el que se acaba de subir |

---

## Caso 6. Evaluación de criticidad (RF12) · ~4 min

**Usuario:** `demo.jefecatedra`. **Objetivo:** valorar qué tan crítico es cada conocimiento de un puesto; el nivel lo calcula la matriz, no la persona.

| Paso | Dónde | Acción y datos | Resultado esperado |
| --- | --- | --- | --- |
| 6.1 | **Criticidad** | Mirar «Avance de la evaluación» | **2 de 5** pares evaluados (solo los de su cátedra) |
| 6.2 | Filtro «Estado» = **Pendientes** | Mirar | Tres pares sin evaluar: *Jefe de cátedra de BD / Didáctica universitaria*, *JTP de BD / SQL* y *JTP de BD / Optimización* |
| 6.3 | Fila *Jefe de trabajos prácticos de Bases de Datos / SQL y modelado relacional*, **Evaluar** | Impacto de pérdida `Medio`; Dificultad de reemplazo `Moderada`; Observaciones `El JTP puede apoyarse en el jefe de cátedra.` | En el diálogo, «Criticidad resultante: **Media**» (vista previa de la matriz). Las observaciones no cambian el nivel |
| 6.4 | Guardar | — | El avance pasa a **3 de 5** y el par queda evaluado |
| 6.5 | **Historial** del par | Mirar | La evaluación, con quién la hizo y cuándo; las evaluaciones nunca se sobrescriben |
| 6.6 | Como `demo.admin`, **Administración → Matriz de criticidad** | Mirar | Alto + Moderada = Alta; Medio + Moderada = Media. La criticidad sale de esta matriz |
| 6.7 | Como `demo.rrhh`, **Criticidad** | Mirar | Ve los pares de toda la facultad (18: los 16 iniciales más los 2 requisitos del puesto que se creó en el caso 2), no solo los 5 de la jefa de cátedra |

---

## Caso 7. Sucesión, candidatos y acciones de transferencia (RF13 a RF15) · ~10 min

**Objetivo:** convertir el riesgo detectado en un plan con responsables y fechas.

| Paso | Usuario / dónde | Acción y datos | Resultado esperado |
| --- | --- | --- | --- |
| 7.1 | `demo.autoridad`, **Sucesión** | Mirar | Tres planes: *Jefe de cátedra de Ingeniería de Software* (Borrador), *…de Bases de Datos* (Pendiente de aprobación) y *…de Sistemas Operativos* (Aprobado). Debajo, «Cobertura de planes de sucesión» con los puestos críticos sin plan |
| 7.2 | Abrir el plan de **Bases de Datos** | Mirar candidatos | Martín Acosta, prioridad 1, preparación «Listo a mediano plazo». Como ya está acreditado en SQL avanzado, cubre todos los excluyentes. Acciones del plan: mentoría de SQL (en curso) y documentación de Optimización de consultas (pendiente) |
| 7.3 | Comprobar permiso | Entrar como `demo.jefatura` y abrir el plan de Bases de Datos (estado Pendiente de aprobación) | Ve el plan pero **no** tiene los botones Aprobar ni Rechazar; la API responde 403 |
| 7.4 | `demo.autoridad`, en el mismo plan, botón **Aprobar** | Aprobar el plan; motivo opcional | Estado **Aprobado**. Solo la autoridad aprueba (RF24) |
| 7.5 | `demo.jefatura`, **Sucesión**, en «Cobertura de planes de sucesión», en el puesto sin plan *Jefe de cátedra de Redes de Datos*, **Crear plan** | Puesto `Jefe de cátedra de Redes de Datos`; Responsable del plan `Quiroga, Hernán`; Observaciones `Redes depende hoy de una sola persona.` | Plan en **Borrador**. Solo la jefatura crea planes (y solo la autoridad los aprueba): Recursos Humanos no puede crear planes |
| 7.6 | En ese plan, **Agregar candidato** | Persona `Fernández, Paula`; Prioridad `1`; Estado de preparación `En desarrollo`; Fecha estimada `01/03/2027` | La tabla de candidatos lo marca como que todavía no cubre el requisito excluyente (no acredita Redes TCP/IP) |
| 7.6b | En el mismo plan (Borrador), bloque **Documento del plan** | **Elegir archivo** `docs/demo/archivos/plan-sucesion-redes.txt` y **Subir documento** | «Documento guardado.» y el nombre del archivo con **Descargar**. Mientras el plan esté en borrador se puede reemplazar; el cambio queda en la auditoría |
| 7.7 | `demo.jefatura`, en el plan de Redes, **Presentar para aprobación** | — | Estado **Pendiente de aprobación**. El bloque del documento ya no ofrece subir: lo que se aprueba no cambia |
| 7.8 | `demo.autoridad`, abrir el plan de Redes, **Descargar** el documento y después **Aprobar** | — | La descarga trae el plan. Estado **Aprobado** |
| 7.9 | `demo.docente`, **Mi sucesión** | Mirar | Aviso «No figurás como candidato en ningún plan de sucesión.» |
| 7.10 | `demo.docente`, **Acciones** | Mirar | Una acción asignada: «Escribir la guía de Java para las prácticas de Algoritmos» (Pendiente) |
| 7.11 | Fila de la acción, **Avanzar** | Nuevo estado `En curso`; Nota de avance `Armé el índice y los primeros ejemplos.` | La acción queda **En curso**. El docente solo ve sus acciones y no tiene el botón **Nueva acción** |
| 7.12 | `demo.rrhh`, **Acciones**, **Nueva acción** | Tipo `Mentoría`; Conocimiento `Arquitectura de software`; Plan `Jefe de cátedra de Ingeniería de Software`; Responsable `Molina, Ricardo`; Destinatario `Ríos, Valeria`; Descripción `Mentoría de arquitectura para la sucesión en Ingeniería de Software.`; Fecha prevista: dentro de 90 días | La acción aparece en la lista y en el plan de Ingeniería de Software |

**Efecto en el riesgo:** «Puestos sin sucesor» pasa de **3 a 2** (Bases de Datos ya tiene sucesor preparado). Redes pasa de «sin plan» a «ningún candidato cubre los excluyentes», y aparece un candidato con brecha: Paula.

---

## Caso 8-B. Vuelta al tablero: el riesgo bajó (RF21) · ~3 min

**Usuario:** `demo.autoridad`. Con los mismos filtros que en 8-A (todo el departamento, 24 meses):

| Indicador | Al empezar | Ahora | Por qué |
| --- | --- | --- | --- |
| Puntos únicos de falla | 3 | **2** | Martín, acreditado en SQL avanzado, comparte el conocimiento con Laura (caso 4) |
| Cátedras vulnerables | 1 | **0** | Paula se suma a Redes de Datos (caso 3) |
| Puestos sin sucesor | 3 (1 sin plan, 2 en elaboración) | **2** (1 en elaboración, 1 «ningún candidato cubre») | Plan de Bases de Datos aprobado con candidato que cubre (caso 7). Redes ahora tiene plan, pero su candidata aún no acredita el conocimiento |
| Candidatos con brecha | 0 | **1** | Paula, candidata a Redes, aún no acredita Redes TCP/IP |
| Horizonte de retiros (24 meses) | 2 | **2** | El retiro de Laura sigue previsto, pero *SQL* ahora «queda» con 1 poseedor (Martín) en lugar de ninguno |

Cierre sugerido: lo que queda (Arquitectura de software depende de Ricardo, Redes depende de Hernán, Paula necesita acreditar) es el próximo ciclo de acciones de transferencia: el sistema no solo detecta, también ordena qué hacer.

---

## Contingencia: si algo falla en vivo

| Problema | Qué hacer |
| --- | --- |
| La pantalla de login no carga | `docker compose ps`: los cuatro servicios deben estar «running». Mirar `docker compose logs backend`. Salud: http://localhost:3000/api/salud |
| No hay datos de demo (listas vacías, los usuarios `demo.*` no entran) | Mirar en el log del backend la línea «Datos de demostración». Verificar `CARGAR_DATOS_DEMO=true` en el `.env` y reiniciar con `docker compose down -v && docker compose up --build` |
| Un paso dejó el estado distinto del esperado (por ejemplo ya se aprobó un plan) | Reiniciar el estado: `docker compose down -v && docker compose up --build` (unos minutos). Si no hay tiempo, saltear el caso afectado: los casos 2, 5 y 6 no dependen de los demás |
| Falla la subida del activo (caso 5) | Revisar http://localhost:9101 y el log del backend. El tablero y el resto del recorrido no dependen del archivo |
| Un puerto está ocupado | Cambiarlo en el `.env` y volver a levantar |
| Falla algo que no se resuelve | Mostrar el Swagger (http://localhost:3000/api/docs) y los datos que ya existen; el tablero (caso 8-A) alcanza para explicar el sistema |

## Tiempos

| Caso | Minutos |
| --- | --- |
| 1. Ingreso y permisos | 5 |
| 8-A. El tablero muestra el riesgo | 8 |
| 2. Puestos y requisitos | 5 |
| 3. Personas e importación CSV | 7 |
| 4. Declaración y acreditación | 8 |
| 5. Activos de conocimiento | 4 |
| 6. Criticidad | 4 |
| 7. Sucesión y acciones | 10 |
| 8-B. Vuelta al tablero | 3 |
| **Total** | **54** |

Verificado el 16/11/2026 sobre la rama `feat/demo-datos-y-guion` (último commit de código: `1199a06`): se levantó el sistema con volúmenes vacíos y se ejecutaron todos los casos en este orden por la API, con **69 comprobaciones** de los resultados esperados (cantidades, estados, permisos y valores del tablero) sin ninguna falla. Lo que **no** se comprobó en el navegador son los textos exactos de pantallas y botones, que se tomaron del código del frontend.

Actualizado el 17/11/2026 con la acreditación por jerarquía de puestos: el caso 4 (pasos 4.2 a 4.10) se ejecutó por la API sobre una base recién creada y el tablero quedó como indica el guion (puntos únicos de falla de 3 a 2; el resto sin cambios).

Actualizado el 17/11/2026 con los archivos adjuntos: la evidencia del paso 4.5 y el documento del plan de los pasos 7.6b a 7.8 se probaron por la API contra RustFS y en el navegador (subida, reemplazo, descarga y rechazo fuera de borrador).
