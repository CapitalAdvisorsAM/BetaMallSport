-- Preflight checks for project-scoped composite foreign keys.
-- Every query must return 0 before applying the migration.

SELECT 'Contrato -> Local' AS check_name, COUNT(*) AS violating_rows
FROM "Contrato" c
LEFT JOIN "Local" l ON l."id" = c."localId"
WHERE l."id" IS NULL OR l."proyectoId" <> c."proyectoId";

SELECT 'Contrato -> Arrendatario' AS check_name, COUNT(*) AS violating_rows
FROM "Contrato" c
LEFT JOIN "Arrendatario" t ON t."id" = c."arrendatarioId"
WHERE t."id" IS NULL OR t."proyectoId" <> c."proyectoId";

SELECT 'IngresoEnergia -> Local' AS check_name, COUNT(*) AS violating_rows
FROM "IngresoEnergia" ie
LEFT JOIN "Local" l ON l."id" = ie."localId"
WHERE l."id" IS NULL OR l."proyectoId" <> ie."proyectoId";

SELECT 'VentaArrendatario -> Arrendatario' AS check_name, COUNT(*) AS violating_rows
FROM "VentaArrendatario" vs
LEFT JOIN "Arrendatario" t ON t."id" = vs."arrendatarioId"
WHERE t."id" IS NULL OR t."proyectoId" <> vs."proyectoId";

SELECT 'VentaPresupuestadaArrendatario -> Arrendatario' AS check_name, COUNT(*) AS violating_rows
FROM "VentaPresupuestadaArrendatario" vps
LEFT JOIN "Arrendatario" t ON t."id" = vps."arrendatarioId"
WHERE t."id" IS NULL OR t."proyectoId" <> vps."proyectoId";

SELECT 'AlertaFacturacion -> Arrendatario' AS check_name, COUNT(*) AS violating_rows
FROM "AlertaFacturacion" ba
LEFT JOIN "Arrendatario" t ON t."id" = ba."arrendatarioId"
WHERE t."id" IS NULL OR t."proyectoId" <> ba."proyectoId";

SELECT 'MapeoVentasArrendatario -> Arrendatario' AS check_name, COUNT(*) AS violating_rows
FROM "MapeoVentasArrendatario" stm
LEFT JOIN "Arrendatario" t ON t."id" = stm."arrendatarioId"
WHERE t."id" IS NULL OR t."proyectoId" <> stm."proyectoId";
