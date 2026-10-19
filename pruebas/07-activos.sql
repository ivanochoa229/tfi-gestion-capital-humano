-- 07 · Activos de conocimiento (RF11): un enlace y un procedimiento, vinculados al conocimiento que documentan.
INSERT INTO activo_conocimiento (titulo, id_tipo_documento, id_unidad, origen, ubicacion, fecha_vigencia)
SELECT v.titulo, t.id_tipo_documento, u.id_unidad, 'enlace', v.url, CURRENT_DATE + v.dias
FROM (VALUES
  ('Guía de trabajos prácticos de Java', 'manual',        'Algoritmos y Estructuras de Datos', 'https://ejemplo.utn.edu.ar/aed/guia-java', 365),
  ('Backup y restauración de la base',   'procedimiento', 'Bases de Datos',                    'https://ejemplo.utn.edu.ar/bd/backup',     30)
) AS v(titulo, tipo, unidad, url, dias)
JOIN tipo_documento t ON t.codigo = v.tipo
JOIN unidad_organizativa u ON u.denominacion = v.unidad;

INSERT INTO activo_conocimiento_conocimiento (id_activo, id_conocimiento)
SELECT a.id_activo, k.id_conocimiento
FROM (VALUES ('Guía de trabajos prácticos de Java','Programación en Java'),
             ('Backup y restauración de la base','SQL avanzado')) AS v(titulo, conocimiento)
JOIN activo_conocimiento a ON a.titulo = v.titulo
JOIN conocimiento k ON k.denominacion = v.conocimiento;
