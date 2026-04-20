SELECT
  'ContratoDia VACANTE con contratoId informado' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "ContratoDia"
WHERE "contratoId" IS NOT NULL
  AND "estadoDia" = 'VACANTE'

UNION ALL

SELECT
  'ContratoDia OCUPADO/GRACIA sin contratoId' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "ContratoDia"
WHERE "contratoId" IS NULL
  AND "estadoDia" IN ('OCUPADO', 'GRACIA')

UNION ALL

SELECT
  'ContratoDia.tarifaDia negativa' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "ContratoDia"
WHERE "tarifaDia" < 0
ORDER BY affected_rows DESC, check_name;
