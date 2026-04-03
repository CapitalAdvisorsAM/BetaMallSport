/*
  Add pctAdministracion to ContratoGGCC with data migration from Contrato table
*/

-- First add the column as nullable
ALTER TABLE "ContratoGGCC" ADD COLUMN "pctAdministracion" DECIMAL(6,3);

-- Copy data from Contrato table (via the relationship)
UPDATE "ContratoGGCC" AS ggcc
SET "pctAdministracion" = c."pctAdministracionGgcc"
FROM "Contrato" AS c
WHERE ggcc."contratoId" = c.id
AND c."pctAdministracionGgcc" IS NOT NULL;

-- Set default value for any remaining NULLs (if no matching Contrato or null pctAdministracionGgcc)
UPDATE "ContratoGGCC"
SET "pctAdministracion" = 0
WHERE "pctAdministracion" IS NULL;

-- Now make the column NOT NULL
ALTER TABLE "ContratoGGCC" ALTER COLUMN "pctAdministracion" SET NOT NULL;
