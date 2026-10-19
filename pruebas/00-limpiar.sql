-- 00 · Limpieza: deja la base como recién migrada. Conserva el administrador inicial,
-- el departamento raíz y todos los valores de referencia (escalas, niveles, roles).
-- Los archivos subidos al almacenamiento (RustFS) no se borran.
BEGIN;
DELETE FROM accion_transferencia;
DELETE FROM candidato_sucesion;
DELETE FROM plan_sucesion;
DELETE FROM evaluacion_criticidad;
DELETE FROM acreditacion;
DELETE FROM conocimiento_persona;
DELETE FROM requisito_puesto;
DELETE FROM activo_conocimiento_conocimiento;
DELETE FROM activo_conocimiento;
DELETE FROM conocimiento;
DELETE FROM ocupacion;
DELETE FROM auditoria WHERE id_usuario IN (SELECT u.id_usuario FROM usuario u JOIN rol r USING (id_rol) WHERE r.codigo <> 'administrador');
DELETE FROM usuario WHERE id_rol NOT IN (SELECT id_rol FROM rol WHERE codigo = 'administrador');
DELETE FROM persona WHERE id_persona NOT IN (SELECT id_persona FROM usuario WHERE id_persona IS NOT NULL);
DELETE FROM puesto;
DELETE FROM unidad_organizativa WHERE id_unidad_superior IS NOT NULL;
COMMIT;
