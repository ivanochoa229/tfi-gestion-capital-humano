-- 05 · Lo que cada persona declara y lo que le acreditan.
--   Paredes  SQL experto acreditado           -> único poseedor (RF16)
--   Aranda   Ing. de requisitos avanzado       -> único poseedor y se retira (RF16, RF20)
--   Herrera  Java avanzado acreditado          -> con Troglio, 2 poseedores de Java (no es punto único)
--   Troglio  Java avanzado acreditado          -> sucesora lista de Herrera
--   Quito    Java básico acreditado; declaró intermedio después -> "pendiente de acreditar" (RF10) y brecha (RF19)
-- Evaluador de todas las acreditaciones: Sosa (jefatura). Sosa declara su conocimiento sin acreditar, a propósito:
-- queda como caso de prueba para acreditarla con otro evaluador (ver la guía).
INSERT INTO conocimiento_persona (id_persona, id_conocimiento, id_nivel_declarado, fecha_declaracion,
                                  id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador)
SELECT p.id_persona, k.id_conocimiento, nd.id_nivel_dominio, CURRENT_DATE - v.dias_decl,
       na.id_nivel_dominio, CASE WHEN na.id_nivel_dominio IS NULL THEN NULL ELSE CURRENT_DATE - v.dias_eval END,
       te.id_tipo_evidencia, ev.id_persona
FROM (VALUES
  ('LEG-004','SQL avanzado',             'experto',    60, 'experto',    50, 'titulo'),
  ('LEG-005','Ingeniería de requisitos', 'avanzado',   60, 'avanzado',   50, 'certificado'),
  ('LEG-001','Programación en Java',     'avanzado',   60, 'avanzado',   50, 'titulo'),
  ('LEG-002','Programación en Java',     'avanzado',   60, 'avanzado',   50, 'certificado'),
  ('LEG-003','Programación en Java',     'intermedio',  5, 'basico',     40, 'entrevista'),
  ('LEG-007','Gestión de una cátedra',   'avanzado',   30, NULL,         NULL, NULL)
) AS v(legajo, conocimiento, declarado, dias_decl, acreditado, dias_eval, evidencia)
JOIN persona p ON p.legajo = v.legajo
JOIN conocimiento k ON k.denominacion = v.conocimiento
JOIN nivel_dominio nd ON nd.codigo = v.declarado
LEFT JOIN nivel_dominio na ON na.codigo = v.acreditado
LEFT JOIN tipo_evidencia te ON te.codigo = v.evidencia
LEFT JOIN persona ev ON ev.legajo = 'LEG-007' AND na.id_nivel_dominio IS NOT NULL;

-- Historial de acreditaciones (una por cada acreditación vigente de arriba)
INSERT INTO acreditacion (id_persona, id_conocimiento, id_nivel_acreditado, id_tipo_evidencia,
                          fecha_evaluacion, id_evaluador)
SELECT cp.id_persona, cp.id_conocimiento, cp.id_nivel_acreditado, cp.id_tipo_evidencia,
       cp.fecha_evaluacion, cp.id_evaluador
FROM conocimiento_persona cp
WHERE cp.id_nivel_acreditado IS NOT NULL;
