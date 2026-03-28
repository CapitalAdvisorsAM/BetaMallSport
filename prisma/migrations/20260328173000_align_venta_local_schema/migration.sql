-- Drop legacy non-unique index if it exists
DROP INDEX IF EXISTS "VentaLocal_localId_periodo_idx";

-- Align VentaLocal precision and updatedAt column
ALTER TABLE "VentaLocal"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ(3);

UPDATE "VentaLocal"
SET "updatedAt" = COALESCE("updatedAt", "createdAt")
WHERE "updatedAt" IS NULL;

ALTER TABLE "VentaLocal"
  ALTER COLUMN "updatedAt" SET NOT NULL,
  ALTER COLUMN "ventasUf" TYPE DECIMAL(14,4);

-- Ensure unique key used by upsert(localId_periodo)
CREATE UNIQUE INDEX IF NOT EXISTS "VentaLocal_localId_periodo_key"
ON "VentaLocal"("localId", "periodo");
