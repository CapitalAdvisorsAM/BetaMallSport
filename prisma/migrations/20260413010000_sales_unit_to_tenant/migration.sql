-- Refactor: Sales data associated with Tenant instead of Unit
-- VentaLocal → VentaArrendatario (localId → arrendatarioId)
-- MapeoVentasLocal → MapeoVentasArrendatario (localId → arrendatarioId)

-- Step 1: Create new tables with tenant FK

CREATE TABLE "VentaArrendatario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proyectoId" UUID NOT NULL,
    "arrendatarioId" UUID NOT NULL,
    "periodo" DATE NOT NULL,
    "ventasUf" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VentaArrendatario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MapeoVentasArrendatario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proyectoId" UUID NOT NULL,
    "idCa" INTEGER NOT NULL,
    "tiendaNombre" TEXT NOT NULL,
    "arrendatarioId" UUID NOT NULL,
    "creadoPor" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MapeoVentasArrendatario_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create indexes and constraints

CREATE UNIQUE INDEX "VentaArrendatario_arrendatarioId_periodo_key" ON "VentaArrendatario"("arrendatarioId", "periodo");
CREATE INDEX "VentaArrendatario_proyectoId_periodo_idx" ON "VentaArrendatario"("proyectoId", "periodo");

CREATE UNIQUE INDEX "MapeoVentasArrendatario_proyectoId_idCa_key" ON "MapeoVentasArrendatario"("proyectoId", "idCa");
CREATE INDEX "MapeoVentasArrendatario_proyectoId_idx" ON "MapeoVentasArrendatario"("proyectoId");
CREATE INDEX "MapeoVentasArrendatario_arrendatarioId_idx" ON "MapeoVentasArrendatario"("arrendatarioId");

-- Step 3: Add foreign keys

ALTER TABLE "VentaArrendatario" ADD CONSTRAINT "VentaArrendatario_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VentaArrendatario" ADD CONSTRAINT "VentaArrendatario_arrendatarioId_fkey" FOREIGN KEY ("arrendatarioId") REFERENCES "Arrendatario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MapeoVentasArrendatario" ADD CONSTRAINT "MapeoVentasArrendatario_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MapeoVentasArrendatario" ADD CONSTRAINT "MapeoVentasArrendatario_arrendatarioId_fkey" FOREIGN KEY ("arrendatarioId") REFERENCES "Arrendatario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: Drop old tables

DROP TABLE IF EXISTS "VentaLocal" CASCADE;
DROP TABLE IF EXISTS "MapeoVentasLocal" CASCADE;
