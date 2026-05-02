ALTER TABLE "RegistroContable"
  ADD COLUMN "localExterno" TEXT,
  ADD COLUMN "arrendatarioExterno" TEXT;

CREATE INDEX "RegistroContable_proyectoId_localExterno_periodo_idx"
  ON "RegistroContable"("proyectoId", "localExterno", "periodo");

CREATE INDEX "RegistroContable_proyectoId_arrendatarioExterno_periodo_idx"
  ON "RegistroContable"("proyectoId", "arrendatarioExterno", "periodo");
