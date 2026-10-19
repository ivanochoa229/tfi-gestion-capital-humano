-- 02 · Personas y ocupaciones. Cada persona existe para provocar un caso de detección:
--   Paredes  sostiene sola la cátedra Bases de Datos            (RF17)
--   Aranda   se retira dentro de 6 meses                        (RF20)
--   Vargas   no tiene ocupación vigente                         (candidato no válido)
--   Montiel  dada de baja                                       (no admite ocupaciones)
INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso,
                     id_situacion_revista, fecha_prevista_retiro, activo)
SELECT v.legajo, v.apellido, v.nombre, v.documento, v.nac::date, v.ing::date, s.id_situacion_revista,
       v.retiro, v.activo
FROM (VALUES
  ('LEG-001','Herrera','María',     '20111001','1972-04-12','2000-03-01', NULL::date,               true),
  ('LEG-002','Troglio','Ana',       '22383083','1980-09-30','2006-03-01', NULL,                     true),
  ('LEG-003','Quito',  'Esteban',   '34391676','1990-01-15','2016-08-01', NULL,                     true),
  ('LEG-004','Paredes','Erika',     '24050431','1976-06-02','2002-03-01', NULL,                     true),
  ('LEG-005','Aranda', 'Camila',    '25200461','1966-11-21','1995-03-01', CURRENT_DATE + 180,       true),
  ('LEG-006','Ochoa',  'Alejandro', '30677732','1985-02-08','2010-03-01', NULL,                     true),
  ('LEG-007','Sosa',   'Laura',     '16123456','1970-03-10','1998-03-01', NULL,                     true),
  ('LEG-008','Vargas', 'Rafael',    '32631898','1987-07-19','2012-03-01', NULL,                     true),
  ('LEG-009','Montiel','Jimena',    '36413050','1992-12-05','2018-03-01', NULL,                     false)
) AS v(legajo, apellido, nombre, documento, nac, ing, retiro, activo)
JOIN situacion_revista s ON s.codigo = 'planta_permanente';

-- Ocupaciones: legajo, puesto, desde, hasta, carácter, dedicación
INSERT INTO ocupacion (id_persona, id_puesto, fecha_desde, fecha_hasta, id_caracter_ocupacion, id_dedicacion)
SELECT pe.id_persona, pu.id_puesto, v.desde::date, v.hasta::date, c.id_caracter_ocupacion, d.id_dedicacion
FROM (VALUES
  ('LEG-007','DIR-SIS','2022-03-01', NULL,         'titular',  'exclusiva'),
  ('LEG-001','AED-JC',  '2015-03-01', NULL,         'titular',  'exclusiva'),
  ('LEG-002','AED-JTP', '2018-03-01', NULL,         'titular',  'semiexclusiva'),
  ('LEG-003','AED-AY',  '2019-03-01', NULL,         'interino', 'simple'),
  ('LEG-004','BD-JC',   '2016-03-01', NULL,         'titular',  'exclusiva'),
  ('LEG-004','BD-JTP',  '2016-03-01', NULL,         'titular',  'simple'),
  ('LEG-005','IS-JC',   '2010-03-01', NULL,         'titular',  'exclusiva'),
  ('LEG-006','IS-JTP',  '2017-03-01', NULL,         'interino', 'semiexclusiva'),
  ('LEG-008','AED-JTP', '2014-03-01', '2018-02-28', 'interino', 'simple'),
  ('LEG-009','AED-AY',  '2018-03-01', '2019-02-28', 'suplente', 'simple')
) AS v(legajo, puesto, desde, hasta, caracter, dedicacion)
JOIN persona pe ON pe.legajo = v.legajo
JOIN puesto pu ON pu.codigo = v.puesto
JOIN caracter_ocupacion c ON c.codigo = v.caracter
JOIN dedicacion d ON d.codigo = v.dedicacion;
