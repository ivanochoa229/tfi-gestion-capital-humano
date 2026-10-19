-- 08 · Casos que la base DEBE rechazar. Corré 01 a 07 antes.
-- Cada bloque imprime "OK" si la restricción rechazó el dato y falla si lo aceptó.
-- Los datos de cada caso se deshacen solos (subtransacción del bloque).
CREATE TEMP TABLE IF NOT EXISTS resultado_negativos (caso text, resultado text, detalle text);
TRUNCATE resultado_negativos;

CREATE OR REPLACE FUNCTION pg_temp.debe_fallar(caso text, sentencia text) RETURNS void AS $f$
BEGIN
  BEGIN
    EXECUTE sentencia;
    INSERT INTO resultado_negativos VALUES (caso, 'FALLA: la base lo aceptó', NULL);
    RAISE EXCEPTION 'rollback del caso' USING ERRCODE = 'P0001';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'rollback del caso' THEN RETURN; END IF;
    INSERT INTO resultado_negativos VALUES (caso, 'OK', left(SQLERRM, 90));
  END;
END $f$ LANGUAGE plpgsql;

DO $do$
BEGIN
PERFORM pg_temp.debe_fallar('N01 documento con letras',
  $q$INSERT INTO persona (legajo,apellido,nombre,documento,fecha_nacimiento,fecha_ingreso,id_situacion_revista)
    VALUES ('X1','A','B','12ab5678','1990-01-01','2015-01-01',1)$q$);
PERFORM pg_temp.debe_fallar('N02 documento repetido',
  $q$INSERT INTO persona (legajo,apellido,nombre,documento,fecha_nacimiento,fecha_ingreso,id_situacion_revista)
    VALUES ('X2','A','B','22383083','1990-01-01','2015-01-01',1)$q$);
PERFORM pg_temp.debe_fallar('N03 legajo repetido',
  $q$INSERT INTO persona (legajo,apellido,nombre,documento,fecha_nacimiento,fecha_ingreso,id_situacion_revista)
    VALUES ('LEG-001','A','B','11111111','1990-01-01','2015-01-01',1)$q$);
PERFORM pg_temp.debe_fallar('N04 ingreso anterior al nacimiento',
  $q$INSERT INTO persona (legajo,apellido,nombre,documento,fecha_nacimiento,fecha_ingreso,id_situacion_revista)
    VALUES ('X4','A','B','11111112','2000-01-01','1999-01-01',1)$q$);
PERFORM pg_temp.debe_fallar('N05 retiro anterior al ingreso',
  $q$INSERT INTO persona (legajo,apellido,nombre,documento,fecha_nacimiento,fecha_ingreso,id_situacion_revista,fecha_prevista_retiro)
    VALUES ('X5','A','B','11111113','1980-01-01','2005-01-01',1,'2001-01-01')$q$);
PERFORM pg_temp.debe_fallar('N06 ocupación solapada de la misma persona en el mismo puesto',
  $q$INSERT INTO ocupacion (id_persona,id_puesto,fecha_desde,id_caracter_ocupacion,id_dedicacion)
    SELECT p.id_persona, pu.id_puesto, '2020-01-01', 1, 1 FROM persona p, puesto pu
    WHERE p.legajo='LEG-001' AND pu.codigo='AED-JC'$q$);
PERFORM pg_temp.debe_fallar('N07 ocupación que termina antes de empezar',
  $q$INSERT INTO ocupacion (id_persona,id_puesto,fecha_desde,fecha_hasta,id_caracter_ocupacion,id_dedicacion)
    SELECT p.id_persona, pu.id_puesto, '2020-05-01','2020-01-01', 1, 1 FROM persona p, puesto pu
    WHERE p.legajo='LEG-006' AND pu.codigo='SO-JC'$q$);
PERFORM pg_temp.debe_fallar('N08 cátedra sin departamento superior',
  $q$INSERT INTO unidad_organizativa (denominacion,id_tipo_unidad)
    SELECT 'Cátedra huérfana', id_tipo_unidad FROM tipo_unidad WHERE codigo='catedra'$q$);
PERFORM pg_temp.debe_fallar('N09 dos departamentos raíz con el mismo nombre',
  $q$INSERT INTO unidad_organizativa (denominacion,id_tipo_unidad)
    SELECT 'departamento de sistemas', id_tipo_unidad FROM tipo_unidad WHERE codigo='departamento'$q$);
PERFORM pg_temp.debe_fallar('N10 puesto que es su propio superior',
  $q$UPDATE puesto SET id_puesto_superior = id_puesto WHERE codigo='AED-JC'$q$);
PERFORM pg_temp.debe_fallar('N11 dotación prevista menor a 1',
  $q$UPDATE puesto SET dotacion_prevista = 0 WHERE codigo='AED-JC'$q$);
PERFORM pg_temp.debe_fallar('N12 código de puesto repetido',
  $q$INSERT INTO puesto (codigo,denominacion,id_unidad,id_nivel_jerarquico)
    SELECT 'AED-JC','Otro',id_unidad,1 FROM unidad_organizativa LIMIT 1$q$);
PERFORM pg_temp.debe_fallar('N13 conocimiento repetido (mismo tipo y nombre)',
  $q$INSERT INTO conocimiento (denominacion,denominacion_normalizada,id_tipo_conocimiento,id_area_tematica)
    SELECT 'PROGRAMACIÓN EN JAVA','programación en java',id_tipo_conocimiento,1 FROM tipo_conocimiento WHERE codigo='competencia_tecnica'$q$);
PERFORM pg_temp.debe_fallar('N14 evaluación de criticidad con fecha futura',
  $q$INSERT INTO evaluacion_criticidad (id_puesto,id_conocimiento,id_nivel_impacto,id_nivel_dificultad,id_nivel_criticidad,fecha_evaluacion,id_usuario)
    SELECT 1,1,1,1,1,CURRENT_DATE+1,id_usuario FROM usuario LIMIT 1$q$);
PERFORM pg_temp.debe_fallar('N15 acreditación con fecha futura',
  $q$INSERT INTO acreditacion (id_persona,id_conocimiento,id_nivel_acreditado,id_tipo_evidencia,fecha_evaluacion,id_evaluador)
    SELECT cp.id_persona,cp.id_conocimiento,1,1,CURRENT_DATE+1,cp.id_persona FROM conocimiento_persona cp LIMIT 1$q$);
PERFORM pg_temp.debe_fallar('N16 acreditar algo que la persona no declaró',
  $q$INSERT INTO acreditacion (id_persona,id_conocimiento,id_nivel_acreditado,id_tipo_evidencia,fecha_evaluacion,id_evaluador)
    SELECT p.id_persona,k.id_conocimiento,1,1,CURRENT_DATE,p.id_persona FROM persona p, conocimiento k
    WHERE p.legajo='LEG-006' AND k.denominacion='Administración de Linux'$q$);
PERFORM pg_temp.debe_fallar('N17 dos planes en elaboración para el mismo puesto',
  $q$INSERT INTO plan_sucesion (id_puesto,id_responsable,id_estado_plan)
    SELECT pu.id_puesto, pe.id_persona, e.id_estado_plan FROM puesto pu, persona pe, estado_plan e
    WHERE pu.codigo='IS-JC' AND pe.legajo='LEG-007' AND e.codigo='borrador'$q$);
PERFORM pg_temp.debe_fallar('N18 dos planes aprobados para el mismo puesto',
  $q$INSERT INTO plan_sucesion (id_puesto,id_responsable,id_estado_plan)
    SELECT pu.id_puesto, pe.id_persona, e.id_estado_plan FROM puesto pu, persona pe, estado_plan e
    WHERE pu.codigo='AED-JC' AND pe.legajo='LEG-007' AND e.codigo='aprobado'$q$);
PERFORM pg_temp.debe_fallar('N19 plan resuelto sin fecha de resolución',
  $q$UPDATE plan_sucesion SET id_usuario_resolucion = (SELECT id_usuario FROM usuario LIMIT 1), fecha_resolucion = NULL
    WHERE id_puesto = (SELECT id_puesto FROM puesto WHERE codigo='BD-JC')$q$);
PERFORM pg_temp.debe_fallar('N20 candidato repetido en el mismo plan',
  $q$INSERT INTO candidato_sucesion (id_plan,id_persona,id_estado_preparacion,prioridad)
    SELECT id_plan,id_persona,1,2 FROM candidato_sucesion LIMIT 1$q$);
PERFORM pg_temp.debe_fallar('N21 prioridad menor a 1',
  $q$UPDATE candidato_sucesion SET prioridad = 0$q$);
PERFORM pg_temp.debe_fallar('N22 acción completada sin fecha de cumplimiento',
  $q$UPDATE accion_transferencia SET id_estado_accion = (SELECT id_estado_accion_transferencia FROM estado_accion_transferencia WHERE codigo='completada')
    WHERE descripcion LIKE 'Mentoría%'$q$);
PERFORM pg_temp.debe_fallar('N23 acción donde el destinatario es el responsable',
  $q$UPDATE accion_transferencia SET id_destinatario = id_responsable WHERE descripcion LIKE 'Mentoría%'$q$);
PERFORM pg_temp.debe_fallar('N24 acción con cumplimiento futuro',
  $q$UPDATE accion_transferencia SET fecha_cumplimiento = CURRENT_DATE+3 WHERE descripcion LIKE 'Documentar%'$q$);
PERFORM pg_temp.debe_fallar('N25 activo de archivo sin hash',
  $q$INSERT INTO activo_conocimiento (titulo,id_tipo_documento,id_unidad,origen,ubicacion)
    SELECT 'Sin hash',1,id_unidad,'archivo','clave/x' FROM unidad_organizativa LIMIT 1$q$);
PERFORM pg_temp.debe_fallar('N26 nombre de usuario repetido',
  $q$INSERT INTO usuario (nombre_usuario,clave_hash,id_rol) VALUES ('prueba.rrhh','x',1)$q$);
PERFORM pg_temp.debe_fallar('N27 dos usuarios para la misma persona',
  $q$INSERT INTO usuario (nombre_usuario,clave_hash,id_rol,id_persona)
    SELECT 'otro.usuario','x',1,id_persona FROM persona WHERE legajo='LEG-001'$q$);
PERFORM pg_temp.debe_fallar('N28 borrar una persona con ocupaciones',
  $q$DELETE FROM persona WHERE legajo='LEG-001'$q$);
PERFORM pg_temp.debe_fallar('N29 borrar un puesto con ocupaciones',
  $q$DELETE FROM puesto WHERE codigo='AED-JC'$q$);
END $do$;

SELECT caso, resultado, detalle FROM resultado_negativos ORDER BY caso;
