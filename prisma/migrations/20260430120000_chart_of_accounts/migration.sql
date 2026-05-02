-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('INGRESO', 'COSTO', 'INVERSION', 'OTRO');

-- CreateTable: PlanDeCuentas (ChartOfAccount) — natural key on (proyectoId, grupo0, grupo1, grupo2, grupo3)
CREATE TABLE "PlanDeCuentas" (
    "id" UUID NOT NULL,
    "proyectoId" UUID NOT NULL,
    "grupo0" TEXT NOT NULL DEFAULT '',
    "grupo1" TEXT NOT NULL,
    "grupo2" TEXT NOT NULL DEFAULT '',
    "grupo3" TEXT NOT NULL,
    "tipo" "AccountType",
    "alias" TEXT,
    "orden" INTEGER,
    "notas" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PlanDeCuentas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanDeCuentas_proyectoId_grupo0_grupo1_grupo2_grupo3_key" ON "PlanDeCuentas"("proyectoId", "grupo0", "grupo1", "grupo2", "grupo3");
CREATE INDEX "PlanDeCuentas_proyectoId_idx" ON "PlanDeCuentas"("proyectoId");
CREATE INDEX "PlanDeCuentas_proyectoId_grupo1_idx" ON "PlanDeCuentas"("proyectoId", "grupo1");
CREATE INDEX "PlanDeCuentas_proyectoId_tipo_idx" ON "PlanDeCuentas"("proyectoId", "tipo");

-- AddForeignKey
ALTER TABLE "PlanDeCuentas" ADD CONSTRAINT "PlanDeCuentas_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add planDeCuentasId FK column to RegistroContable
ALTER TABLE "RegistroContable" ADD COLUMN "planDeCuentasId" UUID;

-- CreateIndex
CREATE INDEX "RegistroContable_planDeCuentasId_periodo_idx" ON "RegistroContable"("planDeCuentasId", "periodo");

-- AddForeignKey
ALTER TABLE "RegistroContable" ADD CONSTRAINT "RegistroContable_planDeCuentasId_fkey" FOREIGN KEY ("planDeCuentasId") REFERENCES "PlanDeCuentas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: insert one PlanDeCuentas row per distinct (proyectoId, group0, group1, group2, group3) tuple
INSERT INTO "PlanDeCuentas" ("id", "proyectoId", "grupo0", "grupo1", "grupo2", "grupo3", "createdAt", "updatedAt")
SELECT DISTINCT
    gen_random_uuid(),
    "proyectoId",
    COALESCE("grupo0", ''),
    "grupo1",
    COALESCE("grupo2", ''),
    "grupo3",
    NOW(),
    NOW()
FROM "RegistroContable"
WHERE "grupo1" IS NOT NULL AND "grupo3" IS NOT NULL
ON CONFLICT ("proyectoId", "grupo0", "grupo1", "grupo2", "grupo3") DO NOTHING;

-- Backfill: link each RegistroContable to its PlanDeCuentas
UPDATE "RegistroContable" r
SET "planDeCuentasId" = pdc."id"
FROM "PlanDeCuentas" pdc
WHERE r."proyectoId" = pdc."proyectoId"
  AND COALESCE(r."grupo0", '') = pdc."grupo0"
  AND r."grupo1" = pdc."grupo1"
  AND COALESCE(r."grupo2", '') = pdc."grupo2"
  AND r."grupo3" = pdc."grupo3"
  AND r."planDeCuentasId" IS NULL;
