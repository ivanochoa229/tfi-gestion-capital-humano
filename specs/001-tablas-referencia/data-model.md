# Data Model: Tablas de referencia

## Estructura común

Todas las tablas tienen:

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id_<tabla>` | entero, clave primaria generada | |
| `codigo` | texto (≤40) | obligatorio, único, formato `^[a-z][a-z0-9_]{1,39}$` |
| `denominacion` | texto (≤100) | obligatoria, única entre valores del dominio |
| `activo` | booleano | por defecto `true` |
| `orden` | entero ≥ 1 | **solo ordinales**; obligatorio y único |

## Tablas

| Dominio (slug de la API) | Tabla | Ordinal |
| --- | --- | --- |
| `nivel-dominio` | `nivel_dominio` | sí |
| `nivel-criticidad` | `nivel_criticidad` | sí |
| `estado-preparacion` | `estado_preparacion` | sí |
| `tipo-conocimiento` | `tipo_conocimiento` | no |
| `tipo-responsabilidad` | `tipo_responsabilidad` | no |
| `tipo-riesgo` | `tipo_riesgo` | no |
| `caracter-ocupacion` | `caracter_ocupacion` | no |
| `tipo-accion-transferencia` | `tipo_accion_transferencia` | no |
| `estado-accion-transferencia` | `estado_accion_transferencia` | no |
| `estado-plan` | `estado_plan` | no |

## Valores iniciales (código → denominación)

Los marcados † provienen de `docs/primer-avance.md`; el resto son propuestas a validar.

- **nivel_dominio** (orden): 1 `basico` Básico, 2 `intermedio` Intermedio, 3 `avanzado` Avanzado, 4 `experto` Experto
- **nivel_criticidad** (orden): 1 `baja` Baja, 2 `media` Media, 3 `alta` Alta
- **estado_preparacion** (orden): 1 `en_desarrollo` En desarrollo, 2 `mediano_plazo` Listo a mediano plazo, 3 `listo_ahora` Listo ahora
- **tipo_conocimiento**: `formacion` Formación formal, `competencia_generica` Competencia genérica, `competencia_tecnica` Competencia técnica, `experiencia` Experiencia †
- **tipo_responsabilidad**: `supervision` Por supervisión, `informacion` Por información, `bienes` Por bienes y equipos, `resultados` Por resultados
- **tipo_riesgo**: `fisico` Físico, `ergonomico` Ergonómico, `psicosocial` Psicosocial, `informatico` Informático
- **caracter_ocupacion**: `titular` Titular †, `interino` Interino †, `suplente` Suplente †
- **tipo_accion_transferencia**: `documentacion` Documentación †, `capacitacion` Capacitación †, `mentoria` Mentoría †, `rotacion` Rotación †
- **estado_accion_transferencia**: `pendiente` Pendiente, `en_curso` En curso, `completada` Completada, `cancelada` Cancelada
- **estado_plan**: `borrador` Borrador, `pendiente_aprobacion` Pendiente de aprobación, `aprobado` Aprobado, `rechazado` Rechazado

## Relaciones

Esta feature no define claves foráneas hacia otras tablas. Las tablas consumidoras
(`requisito_puesto`, `conocimiento_persona`, `evaluacion_criticidad`, `ocupacion`,
`candidato_sucesion`, `accion_transferencia`, `plan_sucesion`, etc.) las declararán en sus
propias migraciones; el módulo detecta ese uso dinámicamente (research R2).

## Reglas de validación y transiciones

- Alta: código válido y único; denominación única; `orden` obligatorio y libre en ordinales,
  prohibido en no ordinales.
- Modificación: se puede cambiar denominación, `orden` y `activo`; el código solo si no está en uso.
- Borrado: solo si no está en uso; si lo está, 409 con sugerencia de desactivar.
- Estado: `activo` ⇄ `inactivo` en ambos sentidos; un valor inactivo sigue legible en los
  registros existentes y no puede asignarse a nuevos.
