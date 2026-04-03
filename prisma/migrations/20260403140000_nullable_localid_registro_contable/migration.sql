-- Make localId nullable in RegistroContable to support property-level cost rows
-- (GG.CC, marketing, admin costs that are not tied to a specific local/tenant)

ALTER TABLE "RegistroContable" ALTER COLUMN "localId" DROP NOT NULL;

-- Drop old unique constraint (was based only on localId which is now nullable)
ALTER TABLE "RegistroContable" DROP CONSTRAINT IF EXISTS "RegistroContable_localId_periodo_grupo1_grupo3_denominacion_key";

-- Add new unique constraint that includes proyectoId and handles nullable localId
CREATE UNIQUE INDEX "RegistroContable_proyectoId_localId_periodo_grupo1_grupo3_den_key"
  ON "RegistroContable"("proyectoId", "localId", "periodo", "grupo1", "grupo3", "denominacion")
  WHERE "localId" IS NOT NULL;

-- Unique index for property-level rows (localId IS NULL)
CREATE UNIQUE INDEX "RegistroContable_property_level_key"
  ON "RegistroContable"("proyectoId", "periodo", "grupo1", "grupo3", "denominacion")
  WHERE "localId" IS NULL;
