SELECT
  'Contrato.proyectoId <> Local.proyectoId' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "Contrato" c
JOIN "Local" l ON l.id = c."localId"
WHERE c."proyectoId" <> l."proyectoId"

UNION ALL

SELECT
  'Contrato.proyectoId <> Arrendatario.proyectoId' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "Contrato" c
JOIN "Arrendatario" a ON a.id = c."arrendatarioId"
WHERE c."proyectoId" <> a."proyectoId"

UNION ALL

SELECT
  'ContratoDia.proyectoId <> Local.proyectoId' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "ContratoDia" cd
JOIN "Local" l ON l.id = cd."localId"
WHERE cd."proyectoId" <> l."proyectoId"

UNION ALL

SELECT
  'ContratoDia.proyectoId <> Contrato.proyectoId' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "ContratoDia" cd
JOIN "Contrato" c ON c.id = cd."contratoId"
WHERE cd."contratoId" IS NOT NULL
  AND cd."proyectoId" <> c."proyectoId"

UNION ALL

SELECT
  'VentaArrendatario.projectId <> Arrendatario.proyectoId' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "VentaArrendatario" s
JOIN "Arrendatario" a ON a.id = s."arrendatarioId"
WHERE s."proyectoId" <> a."proyectoId"

UNION ALL

SELECT
  'VentaPresupuestadaArrendatario.projectId <> Arrendatario.proyectoId' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "VentaPresupuestadaArrendatario" s
JOIN "Arrendatario" a ON a.id = s."arrendatarioId"
WHERE s."proyectoId" <> a."proyectoId"

UNION ALL

SELECT
  'RegistroContable.projectId <> Local.proyectoId' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "RegistroContable" r
JOIN "Local" l ON l.id = r."localId"
WHERE r."localId" IS NOT NULL
  AND r."proyectoId" <> l."proyectoId"

UNION ALL

SELECT
  'RegistroContable.projectId <> Arrendatario.proyectoId' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "RegistroContable" r
JOIN "Arrendatario" a ON a.id = r."arrendatarioId"
WHERE r."arrendatarioId" IS NOT NULL
  AND r."proyectoId" <> a."proyectoId"

UNION ALL

SELECT
  'MapeoLocalContable.projectId <> Local.proyectoId' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "MapeoLocalContable" m
JOIN "Local" l ON l.id = m."localId"
WHERE m."proyectoId" <> l."proyectoId"

UNION ALL

SELECT
  'MapeoVentasArrendatario.projectId <> Arrendatario.proyectoId' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "MapeoVentasArrendatario" m
JOIN "Arrendatario" a ON a.id = m."arrendatarioId"
WHERE m."proyectoId" <> a."proyectoId"
ORDER BY affected_rows DESC, check_name;
