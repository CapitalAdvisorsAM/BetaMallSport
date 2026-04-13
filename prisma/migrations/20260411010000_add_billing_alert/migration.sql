-- CreateEnum
CREATE TYPE "SeveridadAlertaFacturacion" AS ENUM ('WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "AlertaFacturacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proyectoId" UUID NOT NULL,
    "arrendatarioId" UUID NOT NULL,
    "severity" "SeveridadAlertaFacturacion" NOT NULL,
    "mesesConsecutivos" INTEGER NOT NULL,
    "brechaPromedioPct" DECIMAL(8,2) NOT NULL,
    "ultimoPeriodo" TEXT NOT NULL,
    "resueltaEn" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AlertaFacturacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertaFacturacion_proyectoId_arrendatarioId_key" ON "AlertaFacturacion"("proyectoId", "arrendatarioId");

-- CreateIndex
CREATE INDEX "AlertaFacturacion_proyectoId_idx" ON "AlertaFacturacion"("proyectoId");

-- CreateIndex
CREATE INDEX "AlertaFacturacion_arrendatarioId_idx" ON "AlertaFacturacion"("arrendatarioId");

-- CreateIndex
CREATE INDEX "AlertaFacturacion_proyectoId_severity_resueltaEn_idx" ON "AlertaFacturacion"("proyectoId", "severity", "resueltaEn");

-- AddForeignKey
ALTER TABLE "AlertaFacturacion" ADD CONSTRAINT "AlertaFacturacion_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaFacturacion" ADD CONSTRAINT "AlertaFacturacion_arrendatarioId_fkey" FOREIGN KEY ("arrendatarioId") REFERENCES "Arrendatario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
