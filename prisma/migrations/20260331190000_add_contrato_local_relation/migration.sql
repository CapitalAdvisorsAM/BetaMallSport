CREATE TABLE "ContratoLocal" (
  "id" TEXT NOT NULL,
  "contratoId" TEXT NOT NULL,
  "localId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ContratoLocal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContratoLocal_contratoId_localId_key" ON "ContratoLocal"("contratoId", "localId");
CREATE INDEX "ContratoLocal_contratoId_idx" ON "ContratoLocal"("contratoId");
CREATE INDEX "ContratoLocal_localId_idx" ON "ContratoLocal"("localId");

ALTER TABLE "ContratoLocal"
  ADD CONSTRAINT "ContratoLocal_contratoId_fkey"
  FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContratoLocal"
  ADD CONSTRAINT "ContratoLocal_localId_fkey"
  FOREIGN KEY ("localId") REFERENCES "Local"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing contrato keeps its current local as associated local.
INSERT INTO "ContratoLocal" ("id", "contratoId", "localId", "createdAt")
SELECT
  CONCAT('cl-', c."id", '-', c."localId") AS "id",
  c."id" AS "contratoId",
  c."localId" AS "localId",
  NOW() AS "createdAt"
FROM "Contrato" c
ON CONFLICT ("contratoId", "localId") DO NOTHING;
