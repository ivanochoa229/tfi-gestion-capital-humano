-- 03 · Un usuario por rol. Clave de todos: Prueba2026!  (hash argon2id)
-- Si querés otra clave, usá "Restablecer clave" como admin.
INSERT INTO usuario (nombre_usuario, clave_hash, id_rol, id_persona)
SELECT v.usuario,
       '$argon2id$v=19$m=65536,p=4,t=3$tFnPa6yMG7YpiXkYdu8vUA$WTQ6N84b7OlWxfHx3jY6kRmJtSp7+QoNAo3QkRozEFk',
       r.id_rol, p.id_persona
FROM (VALUES
  ('prueba.analista',   'analista_puestos',      NULL),
  ('prueba.rrhh',       'recursos_humanos',      NULL),
  ('prueba.autoridad',  'autoridad',             NULL),
  ('prueba.jefatura',   'jefatura_departamento', 'LEG-007'),
  ('prueba.jefe_aed',   'jefe_catedra',          'LEG-001'),
  ('prueba.jefe_bd',    'jefe_catedra',          'LEG-004'),
  ('prueba.docente',    'docente',               'LEG-002'),
  ('prueba.docente2',   'docente',               'LEG-003')
) AS v(usuario, rol, legajo)
JOIN rol r ON r.codigo = v.rol
LEFT JOIN persona p ON p.legajo = v.legajo;

-- Unidades a cargo (solo jefatura y jefes de cátedra)
INSERT INTO usuario_unidad (id_usuario, id_unidad)
SELECT u.id_usuario, un.id_unidad
FROM (VALUES
  ('prueba.jefatura', 'Departamento de Sistemas'),
  ('prueba.jefe_aed', 'Algoritmos y Estructuras de Datos'),
  ('prueba.jefe_bd',  'Bases de Datos')
) AS v(usuario, unidad)
JOIN usuario u ON u.nombre_usuario = v.usuario
JOIN unidad_organizativa un ON un.denominacion = v.unidad;
