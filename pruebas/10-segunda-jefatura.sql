-- 10 · (Opcional) Segunda jefatura de departamento, para poder acreditar a Sosa (PF16).
-- Una persona no puede acreditarse a sí misma, así que hace falta otra con el departamento a cargo.
INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
SELECT 'LEG-010', 'Benítez', 'Marcos', '18222333', '1974-08-02', '2003-03-01', id_situacion_revista
FROM situacion_revista WHERE codigo = 'planta_permanente';

INSERT INTO usuario (nombre_usuario, clave_hash, id_rol, id_persona)
SELECT 'prueba.jefatura2',
       '$argon2id$v=19$m=65536,p=4,t=3$tFnPa6yMG7YpiXkYdu8vUA$WTQ6N84b7OlWxfHx3jY6kRmJtSp7+QoNAo3QkRozEFk',
       r.id_rol, p.id_persona
FROM rol r, persona p WHERE r.codigo = 'jefatura_departamento' AND p.legajo = 'LEG-010';

INSERT INTO usuario_unidad (id_usuario, id_unidad)
SELECT u.id_usuario, un.id_unidad
FROM usuario u, unidad_organizativa un
WHERE u.nombre_usuario = 'prueba.jefatura2' AND un.denominacion = 'Departamento de Sistemas';
