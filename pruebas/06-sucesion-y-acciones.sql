-- 06 · Planes de sucesión en cada estado y acciones de transferencia.
--   AED-JC  aprobado, con Troglio (cubre Java avanzado)          -> tiene sucesor preparado
--   BD-JC   pendiente de aprobación, con Ochoa (sin SQL)         -> la autoridad puede aprobar o rechazar
--   AED-JTP rechazado con motivo                                  -> historial
--   IS-JC   borrador sin candidatos                               -> puesto crítico sin sucesor (RF18)
INSERT INTO plan_sucesion (id_puesto, id_responsable, id_estado_plan, fecha_elaboracion, observaciones)
SELECT pu.id_puesto, pe.id_persona, e.id_estado_plan, CURRENT_DATE - v.dias, v.obs
FROM (VALUES
  ('AED-JC',  'LEG-007', 'aprobado',             20, 'Plan vigente de la cátedra'),
  ('BD-JC',   'LEG-007', 'pendiente_aprobacion',  7, 'A la espera de la autoridad'),
  ('IS-JC',   'LEG-007', 'borrador',              2, NULL)
) AS v(puesto, responsable, estado, dias, obs)
JOIN puesto pu ON pu.codigo = v.puesto
JOIN persona pe ON pe.legajo = v.responsable
JOIN estado_plan e ON e.codigo = v.estado;

-- Plan rechazado (resuelto por la autoridad)
INSERT INTO plan_sucesion (id_puesto, id_responsable, id_estado_plan, fecha_elaboracion,
                           id_usuario_resolucion, fecha_resolucion, motivo_resolucion)
SELECT pu.id_puesto, pe.id_persona, e.id_estado_plan, CURRENT_DATE - 45, u.id_usuario, CURRENT_DATE - 40,
       'El candidato no cubre el requisito excluyente'
FROM puesto pu, persona pe, estado_plan e, usuario u
WHERE pu.codigo = 'AED-JTP' AND pe.legajo = 'LEG-007' AND e.codigo = 'rechazado'
  AND u.nombre_usuario = 'prueba.autoridad';

-- Candidatos: plan por puesto, legajo, estado de preparación, prioridad
INSERT INTO candidato_sucesion (id_plan, id_persona, id_estado_preparacion, prioridad, fecha_disponibilidad_estimada)
SELECT pl.id_plan, pe.id_persona, ep.id_estado_preparacion, v.prioridad, CURRENT_DATE + v.dias
FROM (VALUES
  ('AED-JC', 'aprobado',             'LEG-002', 'listo_ahora',   1, 0),
  ('BD-JC',  'pendiente_aprobacion', 'LEG-006', 'en_desarrollo', 1, 365)
) AS v(puesto, estado, legajo, preparacion, prioridad, dias)
JOIN puesto pu ON pu.codigo = v.puesto
JOIN estado_plan e ON e.codigo = v.estado
JOIN plan_sucesion pl ON pl.id_puesto = pu.id_puesto AND pl.id_estado_plan = e.id_estado_plan
JOIN persona pe ON pe.legajo = v.legajo
JOIN estado_preparacion ep ON ep.codigo = v.preparacion;

-- Acciones de transferencia (RF15): una en curso, una pendiente y una completada
INSERT INTO accion_transferencia (id_tipo_accion, id_conocimiento, id_plan, id_responsable, id_destinatario,
                                  descripcion, fecha_prevista, fecha_cumplimiento, id_estado_accion)
SELECT ta.id_tipo_accion_transferencia, k.id_conocimiento, pl.id_plan, r.id_persona, d.id_persona,
       v.descripcion, CURRENT_DATE + v.dias, v.cumplida, ea.id_estado_accion_transferencia
FROM (VALUES
  ('mentoria',      'Programación en Java', 'AED-JC', 'LEG-001', 'LEG-002', 'Mentoría semanal sobre el dictado',   60, NULL::date,        'en_curso'),
  ('capacitacion',  'SQL avanzado',         'BD-JC',  'LEG-004', 'LEG-006', 'Curso de SQL avanzado para Ochoa',    120, NULL,              'pendiente'),
  ('documentacion', 'SQL avanzado',         'BD-JC',  'LEG-004', NULL,      'Documentar los procedimientos',        -5, CURRENT_DATE - 1, 'completada')
) AS v(tipo, conocimiento, puesto, responsable, destinatario, descripcion, dias, cumplida, estado)
JOIN tipo_accion_transferencia ta ON ta.codigo = v.tipo
JOIN conocimiento k ON k.denominacion = v.conocimiento
JOIN puesto pu ON pu.codigo = v.puesto
JOIN plan_sucesion pl ON pl.id_puesto = pu.id_puesto AND pl.id_estado_plan IN (SELECT id_estado_plan FROM estado_plan WHERE codigo IN ('aprobado','pendiente_aprobacion'))
JOIN persona r ON r.legajo = v.responsable
LEFT JOIN persona d ON d.legajo = v.destinatario
JOIN estado_accion_transferencia ea ON ea.codigo = v.estado;
