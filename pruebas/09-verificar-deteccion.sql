-- 09 · Qué deben mostrar las vistas de detección con los datos 01 a 07.
SELECT 'puntos únicos de falla' AS vista, k.denominacion AS conocimiento, d.cantidad_poseedores AS poseedores,
       p.apellido AS unico_poseedor
FROM deteccion_punto_unico_falla d
JOIN conocimiento k USING (id_conocimiento)
LEFT JOIN persona p ON p.id_persona = d.id_persona_unica
ORDER BY 2;

SELECT 'cátedras sostenidas por una persona' AS vista, u.denominacion, c.cantidad_personas AS personas, p.apellido
FROM deteccion_catedra_una_persona c
JOIN unidad_organizativa u USING (id_unidad)
LEFT JOIN persona p ON p.id_persona = c.id_persona_unica
ORDER BY 2;

SELECT 'retiros de poseedores' AS vista, k.denominacion, p.apellido, r.fecha_prevista_retiro
FROM deteccion_retiro_poseedor r
JOIN conocimiento k USING (id_conocimiento)
JOIN persona p USING (id_persona);

SELECT 'puestos críticos sin sucesor' AS vista, pu.codigo, s.*
FROM deteccion_puesto_sin_sucesor s
JOIN puesto pu USING (id_puesto);

SELECT 'brecha de perfil' AS vista, p.apellido, pu.codigo, k.denominacion, b.*
FROM deteccion_brecha_perfil b
JOIN persona p USING (id_persona)
JOIN puesto pu USING (id_puesto)
JOIN conocimiento k USING (id_conocimiento);
