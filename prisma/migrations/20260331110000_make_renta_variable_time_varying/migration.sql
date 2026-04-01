-- Backfill scalar pctRentaVariable into time-varying ContratoTarifa(PORCENTAJE).
-- Strategy: only backfill contracts that do not already have PORCENTAJE rows.
INSERT INTO "ContratoTarifa" (
  "id",
  "contratoId",
  "tipo",
  "valor",
  "vigenciaDesde",
  "vigenciaHasta",
  "esDiciembre",
  "createdAt"
)
SELECT
  CONCAT('rv-migr-', c."id") AS "id",
  c."id" AS "contratoId",
  'PORCENTAJE'::"TipoTarifaContrato" AS "tipo",
  c."pctRentaVariable"::DECIMAL(10,4) AS "valor",
  c."fechaInicio" AS "vigenciaDesde",
  NULL AS "vigenciaHasta",
  FALSE AS "esDiciembre",
  NOW() AS "createdAt"
FROM "Contrato" c
WHERE c."pctRentaVariable" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "ContratoTarifa" t
    WHERE t."contratoId" = c."id"
      AND t."tipo" = 'PORCENTAJE'::"TipoTarifaContrato"
  );

ALTER TABLE "Contrato" DROP COLUMN "pctRentaVariable";