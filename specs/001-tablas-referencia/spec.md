# Feature Specification: Tablas de referencia

**Feature Branch**: `001-tablas-referencia` (sin rama dedicada; se trabaja sobre `main`)

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "Tablas de referencia (RF23). El administrador del sistema mantiene los dominios cerrados del modelo: nivel de dominio (escala ordinal de 4 niveles, común a nivel requerido y acreditado), nivel de criticidad, tipo de conocimiento, tipo de responsabilidad, tipo de riesgo, carácter de ocupación, estado de preparación, tipo y estado de acción de transferencia, y estado de plan. Cada valor tiene código, denominación y orden cuando es ordinal; no se borran valores en uso, se desactivan. Los valores iniciales se cargan por migración."

**Requerimientos cubiertos**: RF23, RNF03 (dominios cerrados resueltos por tabla de referencia), RNF01 y RF24 (acceso restringido por rol).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar los dominios cerrados con sus valores iniciales (Priority: P1)

Desde el primer arranque del sistema, cada dominio cerrado del modelo ya contiene sus valores iniciales. El administrador (y, para elegir valores en formularios, cualquier usuario autenticado) puede consultar la lista de valores de cada dominio.

**Why this priority**: Los demás módulos (puestos, requisitos, evaluaciones, planes, acciones) dependen de estos valores para existir. Sin ellos no se puede cargar ningún dato del modelo.

**Independent Test**: Con una base recién creada, consultar cada uno de los diez dominios y verificar que devuelve sus valores iniciales, con código, denominación y, en los ordinales, orden.

**Acceptance Scenarios**:

1. **Given** una instalación nueva, **When** se consulta el dominio "nivel de dominio", **Then** se obtienen cuatro valores ordenados de menor a mayor.
2. **Given** una instalación nueva, **When** se consulta cualquiera de los diez dominios, **Then** se obtiene al menos un valor activo con código único y denominación.
3. **Given** un usuario autenticado sin rol de administrador, **When** consulta un dominio, **Then** ve los valores activos para poder elegirlos.
4. **Given** una solicitud sin autenticar, **When** intenta consultar un dominio, **Then** se rechaza.

---

### User Story 2 - Agregar y modificar valores de un dominio (Priority: P2)

El administrador agrega nuevos valores a un dominio (por ejemplo, un nuevo tipo de acción de transferencia) y corrige la denominación de los existentes, sin intervención del equipo técnico.

**Why this priority**: Es el objetivo central de RF23: que los dominios evolucionen como datos y no como cambios de código.

**Independent Test**: Como administrador, agregar un valor a un dominio, verificar que aparece en la consulta, modificar su denominación y verificar el cambio.

**Acceptance Scenarios**:

1. **Given** un administrador, **When** agrega un valor con código y denominación válidos, **Then** el valor queda activo y disponible para elegir.
2. **Given** un dominio ordinal, **When** el administrador agrega un valor sin indicar orden, **Then** se rechaza con un mensaje que lo indica.
3. **Given** un código ya existente en el mismo dominio, **When** el administrador intenta agregar otro valor con ese código, **Then** se rechaza con un mensaje claro.
4. **Given** un administrador, **When** modifica la denominación de un valor, **Then** los registros que ya lo usan muestran la nueva denominación.
5. **Given** un usuario que no es administrador, **When** intenta agregar o modificar un valor, **Then** se rechaza.

---

### User Story 3 - Desactivar valores en lugar de borrarlos (Priority: P2)

El administrador retira un valor que ya no debe usarse. Si el valor está en uso, no se elimina: se desactiva, de modo que deja de ofrecerse en nuevas cargas pero los datos históricos lo conservan.

**Why this priority**: Protege la integridad de los datos existentes (RNF03) y el historial.

**Independent Test**: Desactivar un valor usado por un registro; verificar que no se ofrece para nuevas cargas, que el registro existente sigue mostrándolo y que el borrado se rechaza.

**Acceptance Scenarios**:

1. **Given** un valor en uso, **When** el administrador intenta borrarlo, **Then** se rechaza e indica que puede desactivarlo.
2. **Given** un valor sin uso, **When** el administrador lo borra, **Then** desaparece del dominio.
3. **Given** un valor activo, **When** el administrador lo desactiva, **Then** deja de aparecer entre los valores elegibles pero sigue visible en los registros que ya lo tienen.
4. **Given** un valor desactivado, **When** el administrador lo reactiva, **Then** vuelve a estar disponible.
5. **Given** un valor desactivado, **When** se intenta asignarlo a un registro nuevo, **Then** se rechaza.

---

### User Story 4 - Reordenar los valores de un dominio ordinal (Priority: P3)

En los dominios ordinales (niveles), el administrador ajusta el orden de los valores, que define cuál es mayor o menor.

**Why this priority**: El orden alimenta comparaciones (por ejemplo, nivel acreditado frente a nivel requerido), pero los valores iniciales ya traen un orden correcto.

**Independent Test**: Cambiar el orden de un valor y verificar que la consulta devuelve la secuencia actualizada, sin órdenes repetidos.

**Acceptance Scenarios**:

1. **Given** un dominio ordinal, **When** el administrador cambia el orden de un valor a uno libre, **Then** la consulta refleja la nueva secuencia.
2. **Given** un dominio ordinal, **When** el administrador asigna un orden ya usado por otro valor, **Then** se rechaza.

---

### Edge Cases

- Desactivar el último valor activo de un dominio que tiene registros en uso: se permite, pero el sistema advierte que no quedarán valores elegibles.
- Código con espacios, mayúsculas o caracteres especiales: se rechaza o se normaliza según una regla única y documentada.
- Dos administradores modifican el mismo valor a la vez: prevalece el último cambio guardado sin dejar datos inconsistentes.
- Un valor desactivado que ya está en un registro: el registro sigue siendo válido y editable en otros campos.
- Se intenta modificar el código de un valor en uso: se rechaza (el código es identificador estable).
- Dominio inexistente en la consulta o la edición: se rechaza con mensaje claro.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mantener diez dominios cerrados: nivel de dominio, nivel de criticidad, tipo de conocimiento, tipo de responsabilidad, tipo de riesgo, carácter de ocupación, estado de preparación, tipo de acción de transferencia, estado de acción de transferencia y estado de plan.
- **FR-002**: Cada valor MUST tener un código único dentro de su dominio, una denominación y un indicador de activo o inactivo.
- **FR-003**: Los dominios ordinales (nivel de dominio, nivel de criticidad y estado de preparación) MUST registrar además un orden numérico, único dentro del dominio.
- **FR-004**: El nivel de dominio MUST ser una única escala ordinal de cuatro niveles, compartida por el nivel requerido de los puestos y el nivel acreditado de las personas.
- **FR-005**: El sistema MUST cargar los valores iniciales de los diez dominios como parte de la instalación, de modo que todas las instalaciones queden con los mismos datos de partida.
- **FR-006**: El administrador del sistema MUST poder agregar valores a cualquier dominio.
- **FR-007**: El administrador MUST poder modificar la denominación y, en los ordinales, el orden de un valor.
- **FR-008**: El sistema MUST impedir el borrado de un valor que esté en uso y ofrecer su desactivación.
- **FR-009**: El sistema MUST permitir el borrado de un valor que no esté en uso.
- **FR-010**: El administrador MUST poder desactivar y reactivar un valor.
- **FR-011**: Un valor desactivado MUST NOT poder asignarse a registros nuevos ni modificados para usarlo, pero MUST seguir mostrándose en los registros que ya lo tienen.
- **FR-012**: El sistema MUST impedir la modificación del código de un valor en uso.
- **FR-013**: Solo el administrador del sistema MUST poder crear, modificar, desactivar o borrar valores; los demás usuarios autenticados solo pueden consultar los valores activos.
- **FR-014**: El sistema MUST rechazar toda consulta o modificación de usuarios no autenticados.
- **FR-015**: El sistema MUST validar los datos de entrada y devolver mensajes claros en español ante códigos duplicados, órdenes repetidos, campos obligatorios vacíos o dominios inexistentes.
- **FR-016**: Los demás módulos del modelo MUST referenciar los valores de estos dominios en lugar de usar texto libre (RNF03).

### Key Entities

- **Dominio de referencia**: cada uno de los diez conjuntos cerrados de valores; indica si es ordinal.
- **Valor de referencia**: elemento de un dominio, con código, denominación, orden (solo ordinales) y estado activo/inactivo.
- **Uso de un valor**: relación entre un valor y los registros del modelo que lo emplean; determina si puede borrarse.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En una instalación nueva, el 100 % de los diez dominios tienen sus valores iniciales sin ninguna carga manual.
- **SC-002**: Un administrador agrega un valor nuevo a un dominio en menos de 1 minuto y sin ayuda técnica.
- **SC-003**: El 100 % de los intentos de borrar un valor en uso son rechazados y no se pierde ningún dato.
- **SC-004**: El 100 % de los intentos de modificar valores por parte de usuarios sin rol de administrador son rechazados.
- **SC-005**: Dos instalaciones nuevas distintas tienen exactamente los mismos valores iniciales.
- **SC-006**: Tras desactivar un valor, ningún formulario lo ofrece para nuevas cargas y el 100 % de los registros previos siguen mostrándolo.

## Assumptions

- Los diez dominios son los de la descripción; el carácter excluyente/deseable de los requisitos no se incluye y queda fuera de alcance.
- Son ordinales el nivel de dominio, el nivel de criticidad y el estado de preparación; el resto no tiene orden y se lista por denominación.
- Valores iniciales tomados de los documentos: carácter de ocupación (titular, interino, suplente) y tipo de acción de transferencia (documentación, capacitación, mentoría, rotación). Los de los demás dominios se definen al planificar, con denominaciones razonables en español.
- El nivel de dominio tiene cuatro niveles (por ejemplo: básico, intermedio, avanzado, experto; denominaciones a confirmar).
- La regla que combina impacto de pérdida y dificultad de reemplazo en un nivel de criticidad queda fuera de este alcance (punto abierto de RF12).
- La autenticación y el rol de administrador provienen del bloque de usuarios y roles.
- Cambiar el código de un valor en uso no está permitido; solo se cambia la denominación.
- Los dominios en sí no se crean ni eliminan desde el sistema: son los diez fijos del modelo.
