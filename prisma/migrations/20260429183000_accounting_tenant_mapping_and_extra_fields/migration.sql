-- AlterTable: extend RegistroContable with new fields from Excel "Data Contable"
ALTER TABLE "RegistroContable"
  ADD COLUMN "grupo0" TEXT,
  ADD COLUMN "grupo2" TEXT,
  ADD COLUMN "clCoste" TEXT,
  ADD COLUMN "descripcionClCoste" TEXT,
  ADD COLUMN "valorClp" DECIMAL(18,2),
  ADD COLUMN "documento" TEXT,
  ADD COLUMN "textoCabDocumento" TEXT,
  ADD COLUMN "esGla" BOOLEAN;

-- CreateIndex
CREATE INDEX "RegistroContable_proyectoId_grupo0_periodo_idx" ON "RegistroContable"("proyectoId", "grupo0", "periodo");
CREATE INDEX "RegistroContable_proyectoId_grupo2_periodo_idx" ON "RegistroContable"("proyectoId", "grupo2", "periodo");

-- CreateTable: tenant-name mapping for accounting upload
CREATE TABLE "MapeoArrendatarioContable" (
    "id" UUID NOT NULL,
    "proyectoId" UUID NOT NULL,
    "arrendatarioExterno" TEXT NOT NULL,
    "arrendatarioId" UUID NOT NULL,
    "creadoPor" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MapeoArrendatarioContable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MapeoArrendatarioContable_proyectoId_arrendatarioExterno_key" ON "MapeoArrendatarioContable"("proyectoId", "arrendatarioExterno");
CREATE INDEX "MapeoArrendatarioContable_proyectoId_idx" ON "MapeoArrendatarioContable"("proyectoId");
CREATE INDEX "MapeoArrendatarioContable_arrendatarioId_idx" ON "MapeoArrendatarioContable"("arrendatarioId");

-- AddForeignKey
ALTER TABLE "MapeoArrendatarioContable" ADD CONSTRAINT "MapeoArrendatarioContable_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MapeoArrendatarioContable" ADD CONSTRAINT "MapeoArrendatarioContable_arrendatarioId_proyectoId_fkey" FOREIGN KEY ("arrendatarioId", "proyectoId") REFERENCES "Arrendatario"("id", "proyectoId") ON DELETE CASCADE ON UPDATE CASCADE;
