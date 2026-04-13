-- AddColumn: diasGracia to Contrato
-- Using IF NOT EXISTS for idempotency (file was missing from this migration directory)
ALTER TABLE "Contrato" ADD COLUMN IF NOT EXISTS "diasGracia" INTEGER NOT NULL DEFAULT 0;
