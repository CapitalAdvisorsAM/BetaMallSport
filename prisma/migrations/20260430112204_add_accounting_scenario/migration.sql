-- CreateEnum
CREATE TYPE "AccountingScenario" AS ENUM ('REAL', 'PPTO');

-- AlterTable
ALTER TABLE "RegistroContable"
  ADD COLUMN "escenario" "AccountingScenario" NOT NULL DEFAULT 'REAL';

-- CreateIndex
CREATE INDEX "RegistroContable_proyectoId_escenario_periodo_idx"
  ON "RegistroContable"("proyectoId", "escenario", "periodo");

-- CreateIndex
CREATE INDEX "RegistroContable_proyectoId_escenario_grupo3_periodo_idx"
  ON "RegistroContable"("proyectoId", "escenario", "grupo3", "periodo");
