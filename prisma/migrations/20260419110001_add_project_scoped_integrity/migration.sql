-- Quick win: enforce project-scoped integrity on high-value relations.
-- This migration assumes the preflight script has already returned zero violations.

-- Step 1: parent-side composite uniqueness for project-scoped references.
CREATE UNIQUE INDEX IF NOT EXISTS "Local_id_proyectoId_key"
  ON "Local" ("id", "proyectoId");

CREATE UNIQUE INDEX IF NOT EXISTS "Arrendatario_id_proyectoId_key"
  ON "Arrendatario" ("id", "proyectoId");

CREATE UNIQUE INDEX IF NOT EXISTS "Contrato_id_proyectoId_key"
  ON "Contrato" ("id", "proyectoId");

-- Step 2: replace single-column FKs with composite project-aware FKs.
ALTER TABLE "Contrato" DROP CONSTRAINT IF EXISTS "Contrato_localId_fkey";
ALTER TABLE "Contrato" DROP CONSTRAINT IF EXISTS "Contrato_arrendatarioId_fkey";
ALTER TABLE "IngresoEnergia" DROP CONSTRAINT IF EXISTS "IngresoEnergia_localId_fkey";
ALTER TABLE "VentaArrendatario" DROP CONSTRAINT IF EXISTS "VentaArrendatario_arrendatarioId_fkey";
ALTER TABLE "VentaPresupuestadaArrendatario" DROP CONSTRAINT IF EXISTS "VentaPresupuestadaArrendatario_arrendatarioId_fkey";
ALTER TABLE "AlertaFacturacion" DROP CONSTRAINT IF EXISTS "AlertaFacturacion_arrendatarioId_fkey";
ALTER TABLE "MapeoVentasArrendatario" DROP CONSTRAINT IF EXISTS "MapeoVentasArrendatario_arrendatarioId_fkey";

ALTER TABLE "Contrato" DROP CONSTRAINT IF EXISTS "Contrato_localId_proyectoId_fkey";
ALTER TABLE "Contrato" DROP CONSTRAINT IF EXISTS "Contrato_arrendatarioId_proyectoId_fkey";
ALTER TABLE "IngresoEnergia" DROP CONSTRAINT IF EXISTS "IngresoEnergia_localId_proyectoId_fkey";
ALTER TABLE "VentaArrendatario" DROP CONSTRAINT IF EXISTS "VentaArrendatario_arrendatarioId_proyectoId_fkey";
ALTER TABLE "VentaPresupuestadaArrendatario" DROP CONSTRAINT IF EXISTS "VentaPresupuestadaArrendatario_arrendatarioId_proyectoId_fkey";
ALTER TABLE "AlertaFacturacion" DROP CONSTRAINT IF EXISTS "AlertaFacturacion_arrendatarioId_proyectoId_fkey";
ALTER TABLE "MapeoVentasArrendatario" DROP CONSTRAINT IF EXISTS "MapeoVentasArrendatario_arrendatarioId_proyectoId_fkey";

ALTER TABLE "Contrato"
  ADD CONSTRAINT "Contrato_localId_proyectoId_fkey"
  FOREIGN KEY ("localId", "proyectoId")
  REFERENCES "Local" ("id", "proyectoId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "Contrato"
  ADD CONSTRAINT "Contrato_arrendatarioId_proyectoId_fkey"
  FOREIGN KEY ("arrendatarioId", "proyectoId")
  REFERENCES "Arrendatario" ("id", "proyectoId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "IngresoEnergia"
  ADD CONSTRAINT "IngresoEnergia_localId_proyectoId_fkey"
  FOREIGN KEY ("localId", "proyectoId")
  REFERENCES "Local" ("id", "proyectoId")
  ON DELETE CASCADE
  ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "VentaArrendatario"
  ADD CONSTRAINT "VentaArrendatario_arrendatarioId_proyectoId_fkey"
  FOREIGN KEY ("arrendatarioId", "proyectoId")
  REFERENCES "Arrendatario" ("id", "proyectoId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "VentaPresupuestadaArrendatario"
  ADD CONSTRAINT "VentaPresupuestadaArrendatario_arrendatarioId_proyectoId_fkey"
  FOREIGN KEY ("arrendatarioId", "proyectoId")
  REFERENCES "Arrendatario" ("id", "proyectoId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "AlertaFacturacion"
  ADD CONSTRAINT "AlertaFacturacion_arrendatarioId_proyectoId_fkey"
  FOREIGN KEY ("arrendatarioId", "proyectoId")
  REFERENCES "Arrendatario" ("id", "proyectoId")
  ON DELETE CASCADE
  ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "MapeoVentasArrendatario"
  ADD CONSTRAINT "MapeoVentasArrendatario_arrendatarioId_proyectoId_fkey"
  FOREIGN KEY ("arrendatarioId", "proyectoId")
  REFERENCES "Arrendatario" ("id", "proyectoId")
  ON DELETE CASCADE
  ON UPDATE CASCADE
  NOT VALID;

-- Step 3: validate after the catalog update has succeeded.
ALTER TABLE "Contrato" VALIDATE CONSTRAINT "Contrato_localId_proyectoId_fkey";
ALTER TABLE "Contrato" VALIDATE CONSTRAINT "Contrato_arrendatarioId_proyectoId_fkey";
ALTER TABLE "IngresoEnergia" VALIDATE CONSTRAINT "IngresoEnergia_localId_proyectoId_fkey";
ALTER TABLE "VentaArrendatario" VALIDATE CONSTRAINT "VentaArrendatario_arrendatarioId_proyectoId_fkey";
ALTER TABLE "VentaPresupuestadaArrendatario" VALIDATE CONSTRAINT "VentaPresupuestadaArrendatario_arrendatarioId_proyectoId_fkey";
ALTER TABLE "AlertaFacturacion" VALIDATE CONSTRAINT "AlertaFacturacion_arrendatarioId_proyectoId_fkey";
ALTER TABLE "MapeoVentasArrendatario" VALIDATE CONSTRAINT "MapeoVentasArrendatario_arrendatarioId_proyectoId_fkey";
