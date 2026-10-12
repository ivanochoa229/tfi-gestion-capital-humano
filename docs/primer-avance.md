# Primer avance: modelo del dominio

Extracto del primer avance del TFI de Gestión de Capital Humano (UTN-FRT) con lo necesario para especificar e implementar el sistema: alcance, actores, modelo de datos y supuestos. Los requerimientos derivados están en `docs/requerimientos.md`.

## Alcance

El trabajo se acota al Departamento de Sistemas:

- **Jefatura de Departamento**, a cargo de una sola persona.
- **Cátedras**, en cantidad a confirmar, cada una asociada a una asignatura.
- **Cargos dentro de cada cátedra**: jefe de cátedra, profesor auxiliar, jefe de trabajos prácticos y auxiliar de trabajos prácticos.

La dotación real varía entre cátedras: en algunas una sola persona concentra varios cargos. Eso implica que:

- **El puesto se separa de su ocupación.** Si una persona ocupa tres cargos a la vez, el vínculo persona-puesto es de muchos a muchos.
- **La acumulación de cargos es un indicador de riesgo.** Una cátedra sostenida por una sola persona es un punto único de falla; se detecta contando ocupaciones vigentes por cátedra.
- **El puesto es específico de cada cátedra.** El jefe de cátedra de una asignatura y el de otra son puestos distintos, porque sus perfiles exigen conocimientos distintos.

El sistema detecta tres situaciones:

- **Punto único de falla:** un conocimiento crítico que una sola persona posee.
- **Puesto sin sucesor preparado:** un puesto crítico sin ningún candidato cuyo nivel acreditado alcance el nivel que el perfil exige.
- **Brecha de perfil:** la diferencia entre lo que el puesto requiere y lo que la persona acredita.

## Objetivos específicos

1. **OE1 – Relevar la estructura y el inventario de puestos:** jefatura, todas las cátedras y todos sus cargos, con denominación, código, unidad, superior inmediato, puestos que supervisa, dotación, nivel jerárquico y condiciones de trabajo.
2. **OE2 – Documentar la descripción de los puestos:** las nueve secciones del esquema para los cuatro cargos tipo y la jefatura, con al menos tres funciones y dos responsabilidades por puesto.
3. **OE3 – Normalizar el perfil requerido:** convertir educación formal, competencias genéricas, competencias técnicas y experiencia en requisitos de conocimiento con nivel requerido y carácter excluyente o deseable, sobre un catálogo único sin duplicados.
4. **OE4 – Registrar personas, ocupaciones y conocimientos acreditados:** todos los docentes con ocupación vigente, incluidas las ocupaciones simultáneas, y el nivel acreditado en al menos el 80 % de los conocimientos que su puesto exige, con fecha y tipo de evidencia.
5. **OE5 – Evaluar la criticidad del conocimiento:** impacto de pérdida y dificultad de reemplazo para todos los conocimientos de los puestos relevados.
6. **OE6 – Implementar las consultas de detección:** conocimientos críticos con un único poseedor, cátedras sin candidato que alcance el nivel requerido y brecha de perfil por docente.
7. **OE7 – Gestionar los planes de sucesión:** un plan con al menos un candidato y su estado de preparación para cada puesto de criticidad alta.
8. **OE8 – Registrar las acciones de transferencia:** al menos una acción con tipo, responsable, fecha prevista y estado por cada punto único de falla.
9. **OE9 – Asegurar la trazabilidad del relevamiento:** fuente de datos, método, analista y fecha en cada descripción de puesto.

## Actores

| Actor | Rol en el sistema |
| --- | --- |
| Analista de puestos | Releva y mantiene las descripciones de puesto, las funciones, los perfiles y los estándares de desempeño |
| Recursos Humanos | Administra personas y ocupaciones, consolida la evaluación de criticidad y publica los indicadores |
| Autoridades de la facultad | Consultan el tablero de riesgo y aprueban los planes de sucesión |
| Jefatura de Departamento | Valida las descripciones de los puestos a su cargo, evalúa la criticidad del conocimiento y propone candidatos |
| Jefe de cátedra | Valida las funciones y responsabilidades de su cátedra y evalúa el conocimiento de su equipo |
| Docente ocupante del puesto | Declara los conocimientos que acredita y ejecuta las acciones de transferencia asignadas |
| Candidato a sucesión | Consulta su brecha de perfil respecto del puesto para el que fue propuesto y el avance de su plan |
| Administrador del sistema | Gestiona usuarios, permisos y tablas de referencia |

La evaluación de criticidad y los planes de sucesión contienen juicios sobre personas concretas: quedan restringidos a Recursos Humanos, las autoridades y la jefatura de la unidad involucrada. El docente accede a su propio perfil y a sus acciones asignadas.

## Conceptos clave

- **Puesto:** conjunto de actividades y deberes relacionados. Independiente de las personas.
- **Posición (ocupación):** vínculo entre una persona y un puesto, con vigencia temporal.
- **Especificación del puesto:** los conocimientos que necesita quien lo ocupa. Es el perfil requerido, separado del conocimiento efectivamente acreditado. La detección de riesgo compara ambos conjuntos.

## Entidades

### Estructura y descripción de puestos

- **UNIDAD_ORGANIZATIVA:** denominación, tipo (departamento o cátedra) y unidad superior. Jerarquía recursiva.
- **PUESTO:** código, denominación, propósito, nivel jerárquico, dotación prevista, condiciones de trabajo, rango retributivo, tipo de relación contractual, unidad y puesto del superior inmediato. Supervisión recursiva.
- **FUNCION:** elemento de competencia, con descripción e indicador de criticidad. Pertenece a un puesto.
- **TAREA:** actividad concreta de una función.
- **RESPONSABILIDAD:** tipo (manejo de personal, equipo de trabajo o manejo de información) y descripción. Pertenece a un puesto.
- **ESTANDAR_DESEMPENO:** estándar esperado. Pertenece a un puesto.
- **RIESGO_PUESTO:** tipo de riesgo, motivo y consecuencia. Pertenece a un puesto.
- **RELACION_TRABAJO:** carácter interno o externo, contraparte y propósito. Vincula dos puestos, o un puesto con una institución externa.
- **RELEVAMIENTO:** fuente de datos, método, analista y fecha de cada descripción.

### Personas y conocimiento

- **PERSONA:** legajo, apellido, nombre, documento, fecha de nacimiento, fecha de ingreso, situación de revista y fecha prevista de retiro.
- **OCUPACION:** persona, puesto, fecha de inicio, fecha de fin, carácter (titular, interino o suplente) y dedicación. Muchos a muchos con historial.
- **CONOCIMIENTO:** denominación, tipo (formación formal, competencia genérica, competencia técnica o experiencia) y área temática.
- **REQUISITO_PUESTO:** puesto, conocimiento, nivel requerido y carácter excluyente o deseable.
- **CONOCIMIENTO_PERSONA:** persona, conocimiento, nivel acreditado, fecha de evaluación, tipo de evidencia y evaluador.
- **ACTIVO_CONOCIMIENTO:** conocimiento documentado (manuales, instructivos, procedimientos), vinculado al conocimiento que documenta y a la unidad que lo mantiene.

### Criticidad y sucesión

- **EVALUACION_CRITICIDAD:** conocimiento en el contexto de un puesto, con impacto de pérdida, dificultad de reemplazo, nivel resultante, fecha y evaluador.
- **PLAN_SUCESION:** puesto, fecha de elaboración, estado y responsable.
- **CANDIDATO_SUCESION:** plan, persona, estado de preparación, prioridad y plazo estimado de disponibilidad.
- **ACCION_TRANSFERENCIA:** tipo (documentación, capacitación, mentoría o rotación), descripción, responsable, fecha prevista, fecha de cumplimiento y estado. Se asocia a un conocimiento y, cuando corresponde, a un plan.

## Modelo relacional (19 tablas)

| Tabla | Clave primaria | Atributos | Claves foráneas |
| --- | --- | --- | --- |
| unidad_organizativa | id_unidad | denominacion, tipo | id_unidad_superior → unidad_organizativa |
| puesto | id_puesto | codigo, denominacion, proposito, nivel_jerarquico, dotacion_prevista, condiciones_trabajo, rango_retributivo, tipo_relacion_contractual | id_unidad → unidad_organizativa; id_puesto_superior → puesto |
| funcion | id_funcion | numero, descripcion, es_critica | id_puesto → puesto |
| tarea | id_tarea | descripcion, orden | id_funcion → funcion |
| responsabilidad | id_responsabilidad | tipo, descripcion | id_puesto → puesto |
| estandar_desempeno | id_estandar | descripcion | id_puesto → puesto |
| riesgo_puesto | id_riesgo | tipo_riesgo, motivo, consecuencia | id_puesto → puesto |
| relacion_trabajo | id_relacion | caracter, institucion_externa, proposito | id_puesto_origen → puesto; id_puesto_destino → puesto |
| relevamiento | id_relevamiento | fuente_datos, metodo, fecha | id_puesto → puesto; id_analista → persona |
| persona | id_persona | legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, situacion_revista, fecha_prevista_retiro | — |
| ocupacion | id_persona + id_puesto + fecha_desde | fecha_hasta, caracter, dedicacion | id_persona → persona; id_puesto → puesto |
| conocimiento | id_conocimiento | denominacion, tipo, area_tematica | — |
| requisito_puesto | id_puesto + id_conocimiento | nivel_requerido, caracter | id_puesto → puesto; id_conocimiento → conocimiento |
| conocimiento_persona | id_persona + id_conocimiento | nivel_acreditado, fecha_evaluacion, tipo_evidencia | id_persona → persona; id_conocimiento → conocimiento; id_evaluador → persona |
| activo_conocimiento | id_activo | titulo, tipo_documento, ubicacion, fecha_vigencia (+ tipo_mime, tamanio, hash: ver requerimientos §4) | id_conocimiento → conocimiento; id_unidad → unidad_organizativa |
| evaluacion_criticidad | id_evaluacion | impacto_perdida, dificultad_reemplazo, nivel_criticidad, fecha, observaciones | id_conocimiento → conocimiento; id_puesto → puesto; id_evaluador → persona |
| plan_sucesion | id_plan | fecha_elaboracion, estado | id_puesto → puesto; id_responsable → persona |
| candidato_sucesion | id_plan + id_persona | estado_preparacion, prioridad, plazo_estimado | id_plan → plan_sucesion; id_persona → persona |
| accion_transferencia | id_accion | tipo, descripcion, fecha_prevista, fecha_cumplimiento, estado | id_conocimiento → conocimiento; id_plan → plan_sucesion; id_responsable → persona |

## Resultados por consulta (no se almacenan)

| Resultado | Tablas | Regla |
| --- | --- | --- |
| Punto único de falla | conocimiento, evaluacion_criticidad, conocimiento_persona | Conocimientos de criticidad alta con un solo poseedor que alcance el nivel requerido |
| Cátedra sostenida por una sola persona | unidad_organizativa, puesto, ocupacion | Unidades de tipo cátedra con una única persona entre sus ocupaciones vigentes |
| Puesto sin sucesor preparado | puesto, plan_sucesion, candidato_sucesion, requisito_puesto, conocimiento_persona | Puestos de criticidad alta sin ningún candidato cuyo nivel acreditado cubra los requisitos excluyentes |
| Brecha de perfil por persona | ocupacion, requisito_puesto, conocimiento_persona | Diferencia entre el nivel requerido por el puesto ocupado y el nivel acreditado |
| Horizonte de riesgo | persona, ocupacion, evaluacion_criticidad | Conocimientos críticos cuyos poseedores tienen fecha prevista de retiro próxima |

## Decisiones de normalización

- `ocupacion` es tabla propia: registra la acumulación de cargos y conserva el historial.
- `evaluacion_criticidad` depende del par conocimiento-puesto: un conocimiento puede ser crítico en un puesto y accesorio en otro.
- `funcion` y `tarea` forman dos niveles, como en la descripción de puestos.
- Los atributos de dominio cerrado (tipo de conocimiento, nivel de dominio, tipo de responsabilidad, tipo de riesgo, estado de preparación, tipo de acción) se resuelven con **tablas de referencia**, no con texto libre.

## Supuestos

1. **Transposición del dominio:** se adopta la estructura de descripción de puestos de un manual de organización real, no su contenido; los puestos del departamento deben relevarse.
2. **Estructura organizativa:** `unidad_organizativa` recursiva instanciada en dos niveles (departamento y cátedras); la cátedra no tiene tabla propia.
3. **Acumulación de cargos:** una persona puede tener varias ocupaciones vigentes simultáneas, incluso en la misma cátedra, y cada una se registra por separado.
4. **Escala de niveles de dominio:** escala ordinal de cuatro niveles en una tabla de referencia, común al nivel requerido y al acreditado.
5. **Escala de criticidad:** el nivel resulta de combinar impacto de pérdida y dificultad de reemplazo, ambos ordinales; el criterio de combinación queda por definir.
6. **Fecha prevista de retiro:** se incorpora para estimar el horizonte de riesgo; derivable del régimen jubilatorio.
7. **Normalización del perfil:** cada ítem del perfil se convierte en un conocimiento reutilizable entre puestos; los rasgos de personalidad quedan como competencia genérica.
8. **Carácter excluyente o deseable:** se incorpora para que no toda brecha pese igual.
9. **Asignatura:** no hay tabla de asignaturas en esta etapa.
10. **Alcance funcional:** sin liquidación de haberes, control de asistencia ni evaluación de desempeño; `estandar_desempeno` es parte de la descripción del puesto.
