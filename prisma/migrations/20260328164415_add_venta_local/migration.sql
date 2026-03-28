-- CreateTable
CREATE TABLE "VentaLocal" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "ventasUf" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VentaLocal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VentaLocal_proyectoId_periodo_idx" ON "VentaLocal"("proyectoId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "VentaLocal_localId_periodo_key" ON "VentaLocal"("localId", "periodo");

-- AddForeignKey
ALTER TABLE "VentaLocal" ADD CONSTRAINT "VentaLocal_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaLocal" ADD CONSTRAINT "VentaLocal_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
