-- Juego de datos de prueba para la detección y el tablero de riesgo (RF16–RF21).
-- NO es una migración: carga datos para integración y demostración.
-- Advertencia: Corre UNA SOLA VEZ; un segundo intento falla por legajos y códigos duplicados.
-- Uso con psql:
--   docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backend/scripts/datos-prueba-deteccion.sql

-- 1. Unidades organizativas (cátedras bajo el Departamento de Sistemas)
INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior, activo)
SELECT c.denominacion, tu.id_tipo_unidad, d.id_unidad, c.activo
FROM (VALUES
  ('Cátedra 1', true),
  ('Cátedra 2', true),
  ('Cátedra 3', true),
  ('Cátedra 4', true),
  ('Cátedra 5', true),
  ('Cátedra Inactiva', false)
) AS c(denominacion, activo)
CROSS JOIN tipo_unidad tu
CROSS JOIN unidad_organizativa d
WHERE tu.codigo = 'catedra'
  AND d.id_unidad_superior IS NULL
  AND d.id_tipo_unidad = (SELECT id_tipo_unidad FROM tipo_unidad WHERE codigo = 'departamento' LIMIT 1);

-- 2. Puestos
INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico, dotacion_prevista, activo)
SELECT p.codigo, p.denominacion, u.id_unidad, nj.id_nivel_jerarquico, 1, true
FROM (VALUES
  ('P-C1-JEF', 'C1.jefe', 'Cátedra 1', 'conduccion_catedra'),
  ('P-C1-JTP', 'C1.JTP',  'Cátedra 1', 'coordinacion_docente'),
  ('P-C2-JEF', 'C2.jefe', 'Cátedra 2', 'conduccion_catedra'),
  ('P-C2-AUX', 'C2.aux',  'Cátedra 2', 'operativo_docente'),
  ('P-C3-JEF', 'C3.jefe', 'Cátedra 3', 'conduccion_catedra'),
  ('P-C4-JEF', 'C4.jefe', 'Cátedra 4', 'conduccion_catedra'),
  ('P-C4-AUX', 'C4.aux',  'Cátedra 4', 'operativo_docente')
) AS p(codigo, denominacion, catedra, jerarquia)
JOIN unidad_organizativa u ON u.denominacion = p.catedra
JOIN nivel_jerarquico nj ON nj.codigo = p.jerarquia;

-- 3. Catálogo de conocimientos K1 a K8
INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica, activo)
SELECT k.denominacion, lower(k.denominacion), tc.id_tipo_conocimiento, a.id_area_tematica, true
FROM (VALUES
  ('Conocimiento K1'),
  ('Conocimiento K2'),
  ('Conocimiento K3'),
  ('Conocimiento K4'),
  ('Conocimiento K5'),
  ('Conocimiento K6'),
  ('Conocimiento K7'),
  ('Conocimiento K8')
) AS k(denominacion)
CROSS JOIN (SELECT id_tipo_conocimiento FROM tipo_conocimiento WHERE codigo = 'competencia_tecnica' LIMIT 1) tc
CROSS JOIN (SELECT id_area_tematica FROM area_tematica WHERE codigo = 'ingenieria_de_software' LIMIT 1) a;

-- 4. Requisitos de puesto
INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente)
SELECT pu.id_puesto, k.id_conocimiento, nd.id_nivel_dominio, r.es_excluyente
FROM (VALUES
  ('C1.jefe', 'Conocimiento K2', 'avanzado',    true),
  ('C1.jefe', 'Conocimiento K6', 'avanzado',    true),
  ('C1.JTP',  'Conocimiento K2', 'intermedio',  true),
  ('C2.jefe', 'Conocimiento K1', 'avanzado',    true),
  ('C2.jefe', 'Conocimiento K4', 'intermedio',  true),
  ('C2.aux',  'Conocimiento K7', 'intermedio',  false),
  ('C3.jefe', 'Conocimiento K3', 'intermedio',  true),
  ('C4.jefe', 'Conocimiento K3', 'intermedio',  true),
  ('C4.jefe', 'Conocimiento K8', 'basico',      true),
  ('C4.aux',  'Conocimiento K1', 'intermedio',  false),
  ('C4.aux',  'Conocimiento K5', 'intermedio',  true)
) AS r(puesto, conocimiento, nivel, es_excluyente)
JOIN puesto pu ON pu.denominacion = r.puesto
JOIN conocimiento k ON k.denominacion = r.conocimiento
JOIN nivel_dominio nd ON nd.codigo = r.nivel;

-- 5. Usuario auxiliar para evaluaciones y resoluciones
INSERT INTO usuario (nombre_usuario, clave_hash, id_rol, activo)
SELECT 'det-evaluador', '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdef', r.id_rol, true
FROM rol r
WHERE r.codigo = 'recursos_humanos';

-- 6. Evaluaciones de criticidad
INSERT INTO evaluacion_criticidad (id_puesto, id_conocimiento, id_nivel_impacto, id_nivel_dificultad, id_nivel_criticidad, fecha_evaluacion, id_usuario)
SELECT pu.id_puesto, k.id_conocimiento, ni.id_nivel_impacto, nd.id_nivel_dificultad, nc.id_nivel_criticidad, CURRENT_DATE, u.id_usuario
FROM (VALUES
  ('C1.jefe', 'Conocimiento K2', 'alto',  'moderada', 'alta'),
  ('C1.jefe', 'Conocimiento K6', 'alto',  'moderada', 'alta'),
  ('C1.JTP',  'Conocimiento K2', 'alto',  'moderada', 'alta'),
  ('C2.jefe', 'Conocimiento K1', 'alto',  'moderada', 'alta'),
  ('C2.jefe', 'Conocimiento K4', 'alto',  'moderada', 'alta'),
  ('C2.aux',  'Conocimiento K7', 'medio', 'moderada', 'media'),
  ('C3.jefe', 'Conocimiento K3', 'alto',  'moderada', 'alta'),
  ('C4.jefe', 'Conocimiento K3', 'alto',  'moderada', 'alta'),
  ('C4.jefe', 'Conocimiento K8', 'bajo',  'facil',    'baja'),
  ('C4.aux',  'Conocimiento K1', 'alto',  'moderada', 'alta'),
  ('C4.aux',  'Conocimiento K5', 'alto',  'moderada', 'alta')
) AS ev(puesto, conocimiento, impacto, dificultad, criticidad)
JOIN puesto pu ON pu.denominacion = ev.puesto
JOIN conocimiento k ON k.denominacion = ev.conocimiento
JOIN nivel_impacto ni ON ni.codigo = ev.impacto
JOIN nivel_dificultad nd ON nd.codigo = ev.dificultad
JOIN nivel_criticidad nc ON nc.codigo = ev.criticidad
CROSS JOIN (SELECT id_usuario FROM usuario WHERE nombre_usuario = 'det-evaluador' LIMIT 1) u;

-- 7. Personas
INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista, fecha_prevista_retiro, activo)
SELECT p.legajo, p.apellido, p.nombre, p.documento,
       CURRENT_DATE - INTERVAL '40 years',
       CURRENT_DATE - INTERVAL '10 years',
       sr.id_situacion_revista,
       p.retiro,
       p.activo
FROM (VALUES
  ('DET-ANA',   'Pérez',     'Ana',      '80000001', NULL::date,                                    true),
  ('DET-BETO',  'García',    'Beto',     '80000002', (CURRENT_DATE + INTERVAL '10 months')::date,   true),
  ('DET-CARLA', 'Rodríguez', 'Carla',    '80000003', NULL::date,                                    true),
  ('DET-DIEGO', 'López',     'Diego',    '80000004', (CURRENT_DATE + INTERVAL '30 months')::date,   true),
  ('DET-EVA',   'Martínez',  'Eva',      '80000005', NULL::date,                                    true),
  ('DET-FEDE',  'Sánchez',   'Federico', '80000006', NULL::date,                                    true),
  ('DET-GUS',   'Fernández', 'Gustavo',  '80000007', (CURRENT_DATE - INTERVAL '1 day')::date,       true),
  ('DET-HUGO',  'Díaz',      'Hugo',     '80000008', NULL::date,                                    false)
) AS p(legajo, apellido, nombre, documento, retiro, activo)
CROSS JOIN (SELECT id_situacion_revista FROM situacion_revista WHERE codigo = 'planta_permanente' LIMIT 1) sr;

-- 8. Ocupaciones
INSERT INTO ocupacion (id_persona, id_puesto, fecha_desde, fecha_hasta, id_caracter_ocupacion, id_dedicacion)
SELECT per.id_persona, pu.id_puesto, oc.desde, oc.hasta, co.id_caracter_ocupacion, ded.id_dedicacion
FROM (VALUES
  ('DET-ANA',   'C1.jefe', CURRENT_DATE - INTERVAL '5 years', NULL::date),
  ('DET-ANA',   'C1.JTP',  CURRENT_DATE - INTERVAL '3 years', NULL::date),
  ('DET-BETO',  'C2.jefe', CURRENT_DATE - INTERVAL '5 years', NULL::date),
  ('DET-CARLA', 'C2.aux',  CURRENT_DATE - INTERVAL '2 years', NULL::date),
  ('DET-DIEGO', 'C4.jefe', CURRENT_DATE - INTERVAL '4 years', NULL::date),
  ('DET-EVA',   'C4.aux',  CURRENT_DATE - INTERVAL '2 years', NULL::date),
  ('DET-FEDE',  'C3.jefe', CURRENT_DATE - INTERVAL '2 years', (CURRENT_DATE - INTERVAL '1 month')::date),
  ('DET-GUS',   'C3.jefe', CURRENT_DATE - INTERVAL '5 years', NULL::date)
) AS oc(legajo, puesto, desde, hasta)
JOIN persona per ON per.legajo = oc.legajo
JOIN puesto pu ON pu.denominacion = oc.puesto
CROSS JOIN (SELECT id_caracter_ocupacion FROM caracter_ocupacion WHERE codigo = 'titular' LIMIT 1) co
CROSS JOIN (SELECT id_dedicacion FROM dedicacion WHERE codigo = 'simple' LIMIT 1) ded;

-- 9. Acreditaciones y declaraciones de conocimientos
INSERT INTO conocimiento_persona (id_persona, id_conocimiento, id_nivel_declarado, fecha_declaracion, id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador)
SELECT per.id_persona, k.id_conocimiento,
       CASE WHEN cp.declarado IS NOT NULL THEN nd_dec.id_nivel_dominio ELSE NULL END,
       CASE WHEN cp.declarado IS NOT NULL THEN CURRENT_DATE ELSE NULL END,
       CASE WHEN cp.acreditado IS NOT NULL THEN nd_acr.id_nivel_dominio ELSE NULL END,
       CASE WHEN cp.acreditado IS NOT NULL THEN CURRENT_DATE ELSE NULL END,
       CASE WHEN cp.acreditado IS NOT NULL THEN te.id_tipo_evidencia ELSE NULL END,
       CASE WHEN cp.acreditado IS NOT NULL THEN eval.id_persona ELSE NULL END
FROM (VALUES
  ('DET-BETO',  'Conocimiento K1', NULL::text, 'experto'),
  ('DET-CARLA', 'Conocimiento K1', NULL::text, 'avanzado'),
  ('DET-EVA',   'Conocimiento K1', NULL::text, 'intermedio'),
  ('DET-FEDE',  'Conocimiento K1', NULL::text, 'experto'),
  ('DET-GUS',   'Conocimiento K1', NULL::text, 'experto'),
  ('DET-HUGO',  'Conocimiento K1', NULL::text, 'experto'),

  ('DET-ANA',   'Conocimiento K2', NULL::text, 'avanzado'),

  ('DET-DIEGO', 'Conocimiento K3', NULL::text, 'intermedio'),
  ('DET-EVA',   'Conocimiento K3', NULL::text, 'intermedio'),
  ('DET-GUS',   'Conocimiento K3', NULL::text, 'avanzado'),

  ('DET-FEDE',  'Conocimiento K4', 'intermedio', NULL::text),

  ('DET-GUS',   'Conocimiento K5', NULL::text, 'experto'),

  ('DET-ANA',   'Conocimiento K6', NULL::text, 'avanzado'),
  ('DET-BETO',  'Conocimiento K6', NULL::text, 'avanzado'),
  ('DET-CARLA', 'Conocimiento K6', NULL::text, 'avanzado'),

  ('DET-ANA',   'Conocimiento K7', NULL::text, 'experto'),

  ('DET-EVA',   'Conocimiento K8', NULL::text, 'basico')
) AS cp(legajo, conocimiento, declarado, acreditado)
JOIN persona per ON per.legajo = cp.legajo
JOIN conocimiento k ON k.denominacion = cp.conocimiento
LEFT JOIN nivel_dominio nd_dec ON nd_dec.codigo = cp.declarado
LEFT JOIN nivel_dominio nd_acr ON nd_acr.codigo = cp.acreditado
CROSS JOIN (SELECT id_tipo_evidencia FROM tipo_evidencia WHERE codigo = 'certificado' LIMIT 1) te
CROSS JOIN (SELECT id_persona FROM persona WHERE legajo = 'DET-ANA' LIMIT 1) eval;

-- 10. Planes de sucesión y candidatos
-- C2.jefe (aprobado)
WITH p_c2 AS (
  INSERT INTO plan_sucesion (id_puesto, id_responsable, id_estado_plan, id_usuario_resolucion, fecha_resolucion)
  SELECT pu.id_puesto, resp.id_persona, ep.id_estado_plan, u.id_usuario, CURRENT_DATE
  FROM puesto pu
  CROSS JOIN (SELECT id_persona FROM persona WHERE legajo = 'DET-ANA' LIMIT 1) resp
  CROSS JOIN (SELECT id_estado_plan FROM estado_plan WHERE codigo = 'aprobado' LIMIT 1) ep
  CROSS JOIN (SELECT id_usuario FROM usuario WHERE nombre_usuario = 'det-evaluador' LIMIT 1) u
  WHERE pu.denominacion = 'C2.jefe'
  RETURNING id_plan
)
INSERT INTO candidato_sucesion (id_plan, id_persona, id_estado_preparacion, prioridad, fecha_disponibilidad_estimada)
SELECT p_c2.id_plan, per.id_persona, prep.id_estado_preparacion, c.prioridad, CURRENT_DATE + INTERVAL '1 year'
FROM (VALUES
  ('DET-EVA',   1),
  ('DET-CARLA', 2)
) AS c(legajo, prioridad)
CROSS JOIN p_c2
JOIN persona per ON per.legajo = c.legajo
CROSS JOIN (SELECT id_estado_preparacion FROM estado_preparacion WHERE codigo = 'en_desarrollo' LIMIT 1) prep;

-- C3.jefe (aprobado)
WITH p_c3 AS (
  INSERT INTO plan_sucesion (id_puesto, id_responsable, id_estado_plan, id_usuario_resolucion, fecha_resolucion)
  SELECT pu.id_puesto, resp.id_persona, ep.id_estado_plan, u.id_usuario, CURRENT_DATE
  FROM puesto pu
  CROSS JOIN (SELECT id_persona FROM persona WHERE legajo = 'DET-ANA' LIMIT 1) resp
  CROSS JOIN (SELECT id_estado_plan FROM estado_plan WHERE codigo = 'aprobado' LIMIT 1) ep
  CROSS JOIN (SELECT id_usuario FROM usuario WHERE nombre_usuario = 'det-evaluador' LIMIT 1) u
  WHERE pu.denominacion = 'C3.jefe'
  RETURNING id_plan
)
INSERT INTO candidato_sucesion (id_plan, id_persona, id_estado_preparacion, prioridad, fecha_disponibilidad_estimada)
SELECT p_c3.id_plan, per.id_persona, prep.id_estado_preparacion, 1, CURRENT_DATE + INTERVAL '1 year'
FROM p_c3
CROSS JOIN (SELECT id_persona FROM persona WHERE legajo = 'DET-GUS' LIMIT 1) per
CROSS JOIN (SELECT id_estado_preparacion FROM estado_preparacion WHERE codigo = 'en_desarrollo' LIMIT 1) prep;

-- C4.jefe (aprobado)
WITH p_c4_jef AS (
  INSERT INTO plan_sucesion (id_puesto, id_responsable, id_estado_plan, id_usuario_resolucion, fecha_resolucion)
  SELECT pu.id_puesto, resp.id_persona, ep.id_estado_plan, u.id_usuario, CURRENT_DATE
  FROM puesto pu
  CROSS JOIN (SELECT id_persona FROM persona WHERE legajo = 'DET-DIEGO' LIMIT 1) resp
  CROSS JOIN (SELECT id_estado_plan FROM estado_plan WHERE codigo = 'aprobado' LIMIT 1) ep
  CROSS JOIN (SELECT id_usuario FROM usuario WHERE nombre_usuario = 'det-evaluador' LIMIT 1) u
  WHERE pu.denominacion = 'C4.jefe'
  RETURNING id_plan
)
INSERT INTO candidato_sucesion (id_plan, id_persona, id_estado_preparacion, prioridad, fecha_disponibilidad_estimada)
SELECT p_c4_jef.id_plan, per.id_persona, prep.id_estado_preparacion, 1, CURRENT_DATE + INTERVAL '1 year'
FROM p_c4_jef
CROSS JOIN (SELECT id_persona FROM persona WHERE legajo = 'DET-EVA' LIMIT 1) per
CROSS JOIN (SELECT id_estado_preparacion FROM estado_preparacion WHERE codigo = 'en_desarrollo' LIMIT 1) prep;

-- C4.aux (borrador)
WITH p_c4_aux AS (
  INSERT INTO plan_sucesion (id_puesto, id_responsable, id_estado_plan, id_usuario_resolucion, fecha_resolucion)
  SELECT pu.id_puesto, resp.id_persona, ep.id_estado_plan, NULL, NULL
  FROM puesto pu
  CROSS JOIN (SELECT id_persona FROM persona WHERE legajo = 'DET-DIEGO' LIMIT 1) resp
  CROSS JOIN (SELECT id_estado_plan FROM estado_plan WHERE codigo = 'borrador' LIMIT 1) ep
  WHERE pu.denominacion = 'C4.aux'
  RETURNING id_plan
)
INSERT INTO candidato_sucesion (id_plan, id_persona, id_estado_preparacion, prioridad, fecha_disponibilidad_estimada)
SELECT p_c4_aux.id_plan, per.id_persona, prep.id_estado_preparacion, 1, CURRENT_DATE + INTERVAL '1 year'
FROM p_c4_aux
CROSS JOIN (SELECT id_persona FROM persona WHERE legajo = 'DET-CARLA' LIMIT 1) per
CROSS JOIN (SELECT id_estado_preparacion FROM estado_preparacion WHERE codigo = 'en_desarrollo' LIMIT 1) prep;
