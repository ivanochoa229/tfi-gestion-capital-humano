-- 04 · Catálogo, requisitos de puesto y evaluaciones de criticidad (las carga prueba.rrhh).
INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
SELECT v.nombre, lower(v.nombre), t.id_tipo_conocimiento, a.id_area_tematica
FROM (VALUES
  ('Programación en Java',        'competencia_tecnica',  'programacion'),
  ('SQL avanzado',                'competencia_tecnica',  'bases_de_datos'),
  ('Ingeniería de requisitos',    'competencia_tecnica',  'ingenieria_de_software'),
  ('Administración de Linux',     'competencia_tecnica',  'sistemas_operativos'),
  ('Gestión de una cátedra',      'competencia_generica', 'gestion_y_organizacion')
) AS v(nombre, tipo, area)
JOIN tipo_conocimiento t ON t.codigo = v.tipo
JOIN area_tematica a ON a.codigo = v.area;

-- Requisitos: puesto, conocimiento, nivel requerido, ¿excluyente?
INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente)
SELECT p.id_puesto, k.id_conocimiento, n.id_nivel_dominio, v.excluyente
FROM (VALUES
  ('AED-JC',  'Programación en Java',     'avanzado',   true),
  ('AED-JC',  'Gestión de una cátedra',   'intermedio', false),
  ('AED-JTP', 'Programación en Java',     'avanzado',   true),
  ('AED-AY',  'Programación en Java',     'intermedio', true),
  ('BD-JC',   'SQL avanzado',             'experto',    true),
  ('BD-JTP',  'SQL avanzado',             'avanzado',   true),
  ('IS-JC',   'Ingeniería de requisitos', 'avanzado',   true),
  ('IS-JTP',  'Ingeniería de requisitos', 'intermedio', false),
  ('SO-JC',   'Administración de Linux',  'avanzado',   true),
  ('DIR-SIS', 'Gestión de una cátedra',   'avanzado',   true)
) AS v(puesto, conocimiento, nivel, excluyente)
JOIN puesto p ON p.codigo = v.puesto
JOIN conocimiento k ON k.denominacion = v.conocimiento
JOIN nivel_dominio n ON n.codigo = v.nivel;

-- Criticidad: impacto x dificultad -> nivel (la matriz se lee de matriz_criticidad)
INSERT INTO evaluacion_criticidad (id_puesto, id_conocimiento, id_nivel_impacto, id_nivel_dificultad,
                                   id_nivel_criticidad, fecha_evaluacion, id_usuario, observaciones)
SELECT p.id_puesto, k.id_conocimiento, i.id_nivel_impacto, d.id_nivel_dificultad,
       m.id_nivel_criticidad, CURRENT_DATE - v.dias, u.id_usuario, v.obs
FROM (VALUES
  ('AED-JC',  'Programación en Java',     'alto',  'moderada', 30, 'Sin Java no se dicta la materia'),
  ('AED-JTP', 'Programación en Java',     'medio', 'moderada', 30, NULL),
  ('BD-JC',   'SQL avanzado',             'alto',  'dificil',  30, 'Un solo poseedor en el departamento'),
  ('BD-JTP',  'SQL avanzado',             'medio', 'facil',    30, NULL),
  ('IS-JC',   'Ingeniería de requisitos', 'alto',  'dificil',  30, 'Se retira la titular'),
  ('SO-JC',   'Administración de Linux',  'bajo',  'facil',    30, NULL)
) AS v(puesto, conocimiento, impacto, dificultad, dias, obs)
JOIN puesto p ON p.codigo = v.puesto
JOIN conocimiento k ON k.denominacion = v.conocimiento
JOIN nivel_impacto i ON i.codigo = v.impacto
JOIN nivel_dificultad d ON d.codigo = v.dificultad
JOIN matriz_criticidad m ON m.id_nivel_impacto = i.id_nivel_impacto AND m.id_nivel_dificultad = d.id_nivel_dificultad
JOIN usuario u ON u.nombre_usuario = 'prueba.rrhh';
