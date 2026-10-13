-- Cátedras de ejemplo para el entorno local. NO es una migración: en el uso real
-- las cátedras las carga el DBA. Se puede correr más de una vez.
-- Uso (desde la raíz del repositorio):
--   docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backend/scripts/catedras-ejemplo.sql
INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
SELECT c.denominacion, t.id_tipo_unidad, d.id_unidad
FROM (VALUES
  ('Algoritmos y Estructuras de Datos'),
  ('Bases de Datos'),
  ('Ingeniería de Software')
) AS c(denominacion)
CROSS JOIN tipo_unidad t
CROSS JOIN unidad_organizativa d
WHERE t.codigo = 'catedra'
  AND d.denominacion = 'Departamento de Sistemas'
  AND d.id_unidad_superior IS NULL
ON CONFLICT DO NOTHING;
