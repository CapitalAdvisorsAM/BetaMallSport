-- AlterTable
ALTER TABLE "RegistroContable"
  ADD COLUMN "editadoManualmente" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "valorUfOriginal"    DECIMAL(14,4);

-- CreateIndex
CREATE INDEX "RegistroContable_proyectoId_editadoManualmente_idx"
  ON "RegistroContable"("proyectoId", "editadoManualmente");
