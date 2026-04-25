-- Bitemporal supersession on ContratoGGCC (parallel to the ContratoTarifa migration).
--
-- Background: persistGGCC currently does deleteMany + createMany on every contract save,
-- which destroys historical GGCC rates. With these columns it can switch to
-- supersession (logical delete) and preserve history.

ALTER TABLE "ContratoGGCC"
  ADD COLUMN "supersededAt"    TIMESTAMPTZ(3),
  ADD COLUMN "supersededBy"    UUID,
  ADD COLUMN "supersedeReason" TEXT,
  ADD COLUMN "amendmentId"     UUID;

ALTER TABLE "ContratoGGCC"
  ADD CONSTRAINT "ContratoGGCC_amendmentId_fkey"
  FOREIGN KEY ("amendmentId") REFERENCES "ContratoAnexo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for the dominant access pattern: WHERE supersededAt IS NULL.
CREATE INDEX "ContratoGGCC_contratoId_supersededAt_idx"
  ON "ContratoGGCC"("contratoId", "supersededAt");
