-- 11 · Diagnóstico: puestos con más ocupantes vigentes que su dotación prevista.
-- Es la consulta que detecta los «varios jefes de cátedra» (caso OC10). Solo lee.
SELECT un.denominacion AS unidad, pu.codigo, pu.denominacion AS puesto,
       pu.dotacion_prevista AS dotacion, count(*) AS ocupantes,
       string_agg(pe.apellido || ', ' || pe.nombre, '; ' ORDER BY pe.apellido) AS personas
FROM ocupacion o
JOIN puesto pu ON pu.id_puesto = o.id_puesto
JOIN unidad_organizativa un ON un.id_unidad = pu.id_unidad
JOIN persona pe ON pe.id_persona = o.id_persona
WHERE o.fecha_desde <= CURRENT_DATE AND (o.fecha_hasta IS NULL OR o.fecha_hasta >= CURRENT_DATE)
GROUP BY un.denominacion, pu.id_puesto, pu.codigo, pu.denominacion, pu.dotacion_prevista
HAVING count(*) > pu.dotacion_prevista
ORDER BY un.denominacion, pu.codigo;
