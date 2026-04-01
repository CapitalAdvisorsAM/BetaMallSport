-- AlterTable: add new columns to RegistroContable
ALTER TABLE "RegistroContable"
  ADD COLUMN "arrendatarioId" UUID,
  ADD COLUMN "categoriaTamano" TEXT,
  ADD COLUMN "categoriaTipo" TEXT,
  ADD COLUMN "piso" TEXT;

-- CreateIndex for arrendatarioId
CREATE INDEX "RegistroContable_arrendatarioId_periodo_idx" ON "RegistroContable"("arrendatarioId", "periodo");

-- AddForeignKey for arrendatarioId
ALTER TABLE "RegistroContable" ADD CONSTRAINT "RegistroContable_arrendatarioId_fkey"
  FOREIGN KEY ("arrendatarioId") REFERENCES "Arrendatario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: MapeoVentasLocal
CREATE TABLE "MapeoVentasLocal" (
    "id" UUID NOT NULL,
    "proyectoId" UUID NOT NULL,
    "idCa" INTEGER NOT NULL,
    "tiendaNombre" TEXT NOT NULL,
    "localId" UUID NOT NULL,
    "creadoPor" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MapeoVentasLocal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MapeoVentasLocal_proyectoId_idCa_key" ON "MapeoVentasLocal"("proyectoId", "idCa");

-- CreateIndex
CREATE INDEX "MapeoVentasLocal_proyectoId_idx" ON "MapeoVentasLocal"("proyectoId");

-- CreateIndex
CREATE INDEX "MapeoVentasLocal_localId_idx" ON "MapeoVentasLocal"("localId");

-- AddForeignKey
ALTER TABLE "MapeoVentasLocal" ADD CONSTRAINT "MapeoVentasLocal_proyectoId_fkey"
  FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapeoVentasLocal" ADD CONSTRAINT "MapeoVentasLocal_localId_fkey"
  FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE CASCADE ON UPDATE CASCADE;
