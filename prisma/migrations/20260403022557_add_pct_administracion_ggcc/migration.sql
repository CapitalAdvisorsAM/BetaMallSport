-- AlterTable
ALTER TABLE "Contrato" ADD COLUMN     "pctAdministracionGgcc" DECIMAL(6,3);

-- Backfill: collapse historical GGCC % (por vigencia) into a single contract-level value
-- using the earliest vigenciaDesde.
UPDATE "Contrato" c
SET "pctAdministracionGgcc" = t."pctAdministracion"
FROM (
  SELECT DISTINCT ON ("contratoId")
    "contratoId",
    "pctAdministracion"
  FROM "ContratoGGCC"
  WHERE "pctAdministracion" IS NOT NULL
  ORDER BY "contratoId", "vigenciaDesde" ASC
) t
WHERE c."id" = t."contratoId";

-- After backfill, remove the column that is no longer used.
ALTER TABLE "ContratoGGCC" DROP COLUMN "pctAdministracion";
