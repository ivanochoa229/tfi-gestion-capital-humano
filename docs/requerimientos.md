# Requerimientos del sistema de gestión del conocimiento crítico

## 1. Introducción

El sistema debe cumplir 24 requerimientos funcionales y 9 no funcionales, derivados del primer avance del Trabajo Final Integrador de Gestión de Capital Humano (ver `docs/primer-avance.md`). Cada requerimiento funcional indica el actor que lo ejecuta y su origen: un objetivo específico (OE1 a OE9) o una sección del primer avance (§).

El alcance es gestión del conocimiento crítico y planificación de la sucesión en el Departamento de Sistemas. Quedan fuera la liquidación de haberes, el control de asistencia y la evaluación de desempeño.

## 2. Requerimientos funcionales

### 2.1 Estructura y descripción de puestos

| ID | Requerimiento | Actor | Origen |
| --- | --- | --- | --- |
| RF01 | Gestionar unidades organizativas (departamento y cátedras) con su jerarquía | Analista de puestos | OE1 |
| RF02 | Alta, modificación y baja de puestos con sus datos de identificación y superior inmediato | Analista de puestos | OE1 |
| RF03 | Registrar la descripción del puesto: funciones, tareas, responsabilidades, estándares de desempeño, riesgos y relaciones de trabajo | Analista de puestos | OE2 |
| RF04 | Exigir fuente de datos, método, analista y fecha de relevamiento al cargar cada descripción | Analista de puestos | OE9 |
| RF05 | Permitir que la jefatura o el jefe de cátedra valide las descripciones de los puestos a su cargo | Jefatura de Departamento, Jefe de cátedra | §5 |

### 2.2 Personas y conocimiento

| ID | Requerimiento | Actor | Origen |
| --- | --- | --- | --- |
| RF06 | Alta, modificación y baja de personas, incluida la fecha prevista de retiro | Recursos Humanos | OE4 |
| RF07 | Registrar ocupaciones con vigencia, carácter y dedicación, admitiendo varias simultáneas por persona y conservando el historial | Recursos Humanos | OE4 |
| RF08 | Mantener un catálogo único de conocimientos, con control de duplicados | Analista de puestos | OE3 |
| RF09 | Definir los requisitos de cada puesto: conocimiento, nivel requerido y carácter excluyente o deseable | Analista de puestos | OE3 |
| RF10 | Permitir al docente declarar sus conocimientos y al evaluador registrar nivel acreditado, fecha de evaluación y tipo de evidencia | Docente, Jefe de cátedra | OE4 |
| RF11 | Registrar activos de conocimiento (manuales, instructivos, procedimientos) vinculados a los conocimientos que documentan y a la unidad que los mantiene | Analista de puestos | §7.2 |

### 2.3 Criticidad y sucesión

| ID | Requerimiento | Actor | Origen |
| --- | --- | --- | --- |
| RF12 | Registrar la evaluación de criticidad por par conocimiento-puesto (impacto de pérdida y dificultad de reemplazo) y calcular el nivel resultante | Jefatura de Departamento, Jefe de cátedra, Recursos Humanos | OE5 |
| RF13 | Crear planes de sucesión por puesto, con estado y responsable, y someterlos a aprobación | Jefatura de Departamento, Autoridades | OE7 |
| RF14 | Proponer candidatos a sucesión con estado de preparación, prioridad y plazo estimado de disponibilidad | Jefatura de Departamento | OE7 |
| RF15 | Registrar acciones de transferencia (tipo, responsable, fecha prevista, estado) y permitir al responsable actualizar su avance | Recursos Humanos, Docente | OE8 |

### 2.4 Consultas e indicadores

| ID | Requerimiento | Actor | Origen |
| --- | --- | --- | --- |
| RF16 | Listar los conocimientos críticos con un único poseedor (punto único de falla) | Recursos Humanos, Autoridades | OE6 |
| RF17 | Listar las cátedras sostenidas por una sola persona | Recursos Humanos, Autoridades | §8.4 |
| RF18 | Listar los puestos críticos sin sucesor preparado | Recursos Humanos, Autoridades | OE6 |
| RF19 | Mostrar la brecha de perfil por docente y por candidato a sucesión | Docente, Candidato, Jefatura de Departamento | OE6 |
| RF20 | Listar los conocimientos críticos cuyos poseedores se retiran dentro de un plazo configurable (horizonte de riesgo) | Recursos Humanos, Autoridades | §8.4 |
| RF21 | Presentar un tablero de riesgo que consolide RF16 a RF20 | Autoridades | §5 |

### 2.5 Administración y acceso

| ID | Requerimiento | Actor | Origen |
| --- | --- | --- | --- |
| RF22 | Gestionar usuarios, roles y permisos | Administrador del sistema | §5 |
| RF23 | Mantener las tablas de referencia (niveles de dominio, tipos y estados) | Administrador del sistema | §8.5 |
| RF24 | Restringir la evaluación de criticidad y los planes de sucesión a Recursos Humanos, las autoridades y la jefatura involucrada; el docente solo accede a su perfil y a sus acciones asignadas | Todos | §5 |

## 3. Requerimientos no funcionales

| ID | Atributo | Requerimiento |
| --- | --- | --- |
| RNF01 | Seguridad | Autenticación obligatoria y autorización por rol para toda operación |
| RNF02 | Confidencialidad | Tratamiento de los datos personales conforme a la Ley 25.326 de Protección de los Datos Personales |
| RNF03 | Integridad | Atributos de dominio cerrado resueltos por tabla de referencia; sin ocupaciones solapadas de la misma persona en el mismo puesto |
| RNF04 | Consistencia | Los indicadores se calculan por consulta sobre los datos vigentes y no se almacenan |
| RNF05 | Auditoría | Registro de usuario y fecha en cada alta o modificación de evaluaciones de criticidad y planes de sucesión |
| RNF06 | Usabilidad | Un docente debe poder declarar sus conocimientos sin capacitación previa |
| RNF07 | Portabilidad | Aplicación web sobre un motor de base de datos relacional estándar |
| RNF08 | Almacenamiento | Los archivos de los activos de conocimiento se guardan en un almacenamiento de objetos compatible con S3 (RustFS); PostgreSQL guarda solo sus metadatos |
| RNF09 | Despliegue | Ejecución local con Docker Compose (PostgreSQL y RustFS en contenedores, con volúmenes persistentes y versiones de imagen fijas), reproducible por todo el grupo con un solo comando |

## 4. Decisión de almacenamiento

Los documentos se guardan en RustFS y sus metadatos en PostgreSQL, ambos en contenedores locales. El sistema no se despliega en producción.

| Componente | Qué guarda |
| --- | --- |
| PostgreSQL | Las diecinueve tablas del modelo, incluidos los metadatos de cada activo de conocimiento |
| RustFS | Los archivos (manuales, instructivos, procedimientos) en el bucket `activos-conocimiento` |
| Aplicación | Sube el archivo a RustFS mediante un SDK de S3 y registra sus metadatos en PostgreSQL |

La decisión modifica la tabla `activo_conocimiento`:

| Atributo | Cambio |
| --- | --- |
| ubicacion | Pasa a guardar la clave del objeto en el bucket |
| tipo_mime | Nuevo: formato del archivo (por ejemplo, application/pdf) |
| tamanio | Nuevo: tamaño en bytes |
| hash | Nuevo: huella del contenido, para detectar archivos duplicados |

## 5. Stack tecnológico

| Capa | Tecnología | Requerimientos que cubre |
| --- | --- | --- |
| Base de datos | PostgreSQL | Modelo relacional de diecinueve tablas (RNF07) |
| Almacenamiento de archivos | RustFS | Activos de conocimiento (RF11, RNF08) |
| Backend | NestJS (TypeScript) | API para todos los requerimientos funcionales |
| ORM y migraciones | TypeORM, con migraciones versionadas y `synchronize` desactivado | Esquema y datos de prueba iguales para todo el grupo |
| Consultas de detección | Vistas de PostgreSQL creadas por migración | RF16 a RF20, calculadas y no almacenadas (RNF04) |
| Validación | class-validator y class-transformer | Datos de entrada y dominios cerrados (RNF03) |
| Autenticación y roles | Passport con sesión y guards de NestJS por rol | RF22, RF24, RNF01 |
| Auditoría | Subscribers de TypeORM que registran usuario y fecha | RNF05 |
| Carga de archivos | Multer y @aws-sdk/client-s3 apuntando a RustFS | RF11, RNF08 |
| Documentación de la API | @nestjs/swagger | Contrato entre backend y frontend |
| Frontend | React, TypeScript y Vite | Formularios de ABM y consultas |
| Componentes y gráficos | MUI y Recharts | Tablero de riesgo (RF21), usabilidad (RNF06) |
| Entorno | Docker Compose con base, almacenamiento, backend y frontend | RNF09 |

Cuidados de implementación:

- **Claves compuestas:** `ocupacion`, `requisito_puesto`, `conocimiento_persona` y `candidato_sucesion` se mapean con varias columnas `@PrimaryColumn`.
- **Migraciones revisadas:** las migraciones generadas a partir de las entidades se revisan antes de aplicarlas; las vistas de detección se escriben a mano.
- **Cliente S3 local:** el cliente se configura con `forcePathStyle: true` para trabajar contra RustFS.

## 6. Arquitectura del código

Monorepo con dos aplicaciones organizadas por los mismos dominios que el modelo de datos. Arquitectura en capas; no se usa hexagonal ni DDD.

### Backend

Cada dominio es un módulo de NestJS con tres capas: controller (HTTP y validación de DTO), service (reglas de negocio) y repositorio de TypeORM.

```
backend/src/
├── modules/
│   ├── estructura/     # RF01–RF05
│   ├── personas/       # RF06–RF07
│   ├── conocimiento/   # RF08–RF11
│   ├── criticidad/     # RF12
│   ├── sucesion/       # RF13–RF15
│   ├── deteccion/      # RF16–RF21, solo lectura sobre vistas
│   ├── usuarios/       # RF22, RF24
│   └── referencia/     # RF23
├── infra/              # config, database, storage, auditoria, salud
└── common/             # guards de rol, decoradores, filtros, pipes
```

Cada módulo: `entities/`, `dto/`, `<modulo>.controller.ts`, `<modulo>.service.ts`, `<modulo>.module.ts`.

### Frontend

```
frontend/src/
├── features/       # estructura, personas, conocimiento, criticidad, sucesion, tablero, admin
│   └── <feature>/  pages/, components/, hooks/
├── api/            # cliente y tipos generados desde Swagger
├── auth/           # sesión y rutas protegidas por rol
└── components/     # componentes compartidos
```

### Convenciones

| Tema | Decisión |
| --- | --- |
| Llamadas a la API | TanStack Query |
| Formularios | react-hook-form con zod |
| Rutas | React Router |
| Tipos compartidos | Generados desde Swagger con openapi-typescript |
| Nombres | En español, como el modelo; snake_case en la base y camelCase en el código |
| Configuración | @nestjs/config con archivo `.env` |
| Calidad de código | oxlint y Prettier en ambas aplicaciones |

## 7. Puntos abiertos en el modelo de datos

Deben decidirse antes de implementar el bloque que los usa.

| Tema | Requerimiento afectado | Qué falta definir |
| --- | --- | --- |
| Usuarios y roles | RF22, RF24 | Tablas de usuario, rol y permiso, que no están entre las diecinueve |
| Validación y aprobación | RF05, RF13 | Un estado, quién validó o aprobó y cuándo; `relevamiento` y `plan_sucesion` no lo registran |
| Criticidad del puesto | RF18 | La criticidad se evalúa por par conocimiento-puesto, pero RF18 habla de puestos críticos. Falta la regla, por ejemplo: un puesto es crítico si tiene al menos un conocimiento de criticidad alta |
| Regla de combinación | RF12 | Cómo se combinan impacto de pérdida y dificultad de reemplazo para obtener el nivel de criticidad (supuesto 5 del avance) |
| Historial de evaluaciones | RF10 | La clave de `conocimiento_persona` (persona + conocimiento) admite una sola evaluación por par, sin historial |
| Declarado y acreditado | RF10 | El docente declara y el evaluador acredita, pero la tabla tiene un solo nivel |
