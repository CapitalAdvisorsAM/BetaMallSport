-- DropIndex
DROP INDEX "CargaDatos_proyectoId_tipo_createdAt_idx";

-- DropIndex
DROP INDEX "RegistroContable_localId_periodo_grupo1_grupo3_denominacion_key";

-- AlterTable
ALTER TABLE "AlertaFacturacion" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CustomWidget" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DashboardConfig" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "IngresoEnergia" DROP COLUMN IF EXISTS "periodo_old";

-- AlterTable
ALTER TABLE "VentaLocal" DROP COLUMN IF EXISTS "periodo_old";

-- CreateTable: ZonaLocal
CREATE TABLE "ZonaLocal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proyectoId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZonaLocal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZonaLocal_proyectoId_idx" ON "ZonaLocal"("proyectoId");

-- CreateIndex
CREATE UNIQUE INDEX "ZonaLocal_proyectoId_nombre_key" ON "ZonaLocal"("proyectoId", "nombre");

-- AddForeignKey
ALTER TABLE "ZonaLocal" ADD CONSTRAINT "ZonaLocal_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: create ZonaLocal rows from distinct existing zona strings
INSERT INTO "ZonaLocal" ("id", "proyectoId", "nombre")
SELECT gen_random_uuid(), "proyectoId", TRIM("zona")
FROM "Local"
WHERE "zona" IS NOT NULL AND TRIM("zona") <> ''
GROUP BY "proyectoId", TRIM("zona");

-- AlterTable: add zonaId column
ALTER TABLE "Local" ADD COLUMN "zonaId" UUID;

-- Backfill: link units to their zone
UPDATE "Local" l
SET "zonaId" = z."id"
FROM "ZonaLocal" z
WHERE l."proyectoId" = z."proyectoId"
  AND TRIM(l."zona") = z."nombre";

-- AlterTable: drop old zona column
ALTER TABLE "Local" DROP COLUMN "zona";

-- CreateIndex
CREATE INDEX "Local_zonaId_idx" ON "Local"("zonaId");

-- CreateIndex
CREATE INDEX "CargaDatos_proyectoId_tipo_createdAt_idx" ON "CargaDatos"("proyectoId", "tipo", "createdAt");

-- AddForeignKey
ALTER TABLE "Local" ADD CONSTRAINT "Local_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "ZonaLocal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
