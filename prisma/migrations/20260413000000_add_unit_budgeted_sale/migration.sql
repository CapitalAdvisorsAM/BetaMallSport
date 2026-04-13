-- AlterEnum
ALTER TYPE "TipoCargaDatos" ADD VALUE 'VENTAS_PRESUPUESTADAS';

-- CreateTable
CREATE TABLE "VentaPresupuestadaArrendatario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proyectoId" UUID NOT NULL,
    "arrendatarioId" UUID NOT NULL,
    "periodo" DATE NOT NULL,
    "ventasUf" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VentaPresupuestadaArrendatario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VentaPresupuestadaArrendatario_arrendatarioId_periodo_key" ON "VentaPresupuestadaArrendatario"("arrendatarioId", "periodo");

-- CreateIndex
CREATE INDEX "VentaPresupuestadaArrendatario_proyectoId_periodo_idx" ON "VentaPresupuestadaArrendatario"("proyectoId", "periodo");

-- AddForeignKey
ALTER TABLE "VentaPresupuestadaArrendatario" ADD CONSTRAINT "VentaPresupuestadaArrendatario_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaPresupuestadaArrendatario" ADD CONSTRAINT "VentaPresupuestadaArrendatario_arrendatarioId_fkey" FOREIGN KEY ("arrendatarioId") REFERENCES "Arrendatario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
