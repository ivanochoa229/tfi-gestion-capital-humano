-- 01 · Estructura: 4 cátedras bajo el Departamento de Sistemas y sus puestos.
-- Todo se resuelve por denominación o código, no por id.
INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
SELECT c.denominacion, t.id_tipo_unidad,
       (SELECT id_unidad FROM unidad_organizativa WHERE denominacion = 'Departamento de Sistemas')
FROM tipo_unidad t,
     (VALUES ('Algoritmos y Estructuras de Datos'), ('Bases de Datos'),
             ('Ingeniería de Software'), ('Sistemas Operativos')) AS c(denominacion)
WHERE t.codigo = 'catedra';

-- Puestos: código, denominación, unidad, nivel jerárquico, código del superior
INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico, id_tipo_relacion_contractual)
SELECT p.codigo, p.denominacion, u.id_unidad, n.id_nivel_jerarquico, r.id_tipo_relacion_contractual
FROM (VALUES
  ('DIR-SIS', 'Director de departamento',     'Departamento de Sistemas',          'conduccion_departamento'),
  ('AED-JC',  'Jefe de cátedra',              'Algoritmos y Estructuras de Datos', 'conduccion_catedra'),
  ('AED-JTP', 'Jefe de trabajos prácticos',   'Algoritmos y Estructuras de Datos', 'coordinacion_docente'),
  ('AED-AY',  'Ayudante de primera',          'Algoritmos y Estructuras de Datos', 'operativo_docente'),
  ('BD-JC',   'Jefe de cátedra',              'Bases de Datos',                    'conduccion_catedra'),
  ('BD-JTP',  'Jefe de trabajos prácticos',   'Bases de Datos',                    'coordinacion_docente'),
  ('IS-JC',   'Jefe de cátedra',              'Ingeniería de Software',            'conduccion_catedra'),
  ('IS-JTP',  'Jefe de trabajos prácticos',   'Ingeniería de Software',            'coordinacion_docente'),
  ('SO-JC',   'Jefe de cátedra',              'Sistemas Operativos',               'conduccion_catedra')
) AS p(codigo, denominacion, unidad, nivel)
JOIN unidad_organizativa u ON u.denominacion = p.unidad
JOIN nivel_jerarquico n ON n.codigo = p.nivel
JOIN tipo_relacion_contractual r ON r.codigo = 'planta_permanente';

-- Superior inmediato
UPDATE puesto h SET id_puesto_superior = s.id_puesto
FROM (VALUES ('AED-JC','DIR-SIS'),('BD-JC','DIR-SIS'),('IS-JC','DIR-SIS'),('SO-JC','DIR-SIS'),
             ('AED-JTP','AED-JC'),('AED-AY','AED-JTP'),('BD-JTP','BD-JC'),('IS-JTP','IS-JC')) AS v(hijo, padre)
JOIN puesto s ON s.codigo = v.padre
WHERE h.codigo = v.hijo;
