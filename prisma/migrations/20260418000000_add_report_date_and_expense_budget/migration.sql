-- AlterEnum: add EXPENSE_BUDGET value to TipoCargaDatos
ALTER TYPE "TipoCargaDatos" ADD VALUE 'PPTO_GASTOS';

-- AlterTable: Project.reportDate
ALTER TABLE "Proyecto"
ADD COLUMN "fechaReporte" DATE;

-- CreateTable: PresupuestoGasto (ExpenseBudget)
CREATE TABLE "PresupuestoGasto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proyectoId" UUID NOT NULL,
    "periodo" DATE NOT NULL,
    "grupo1" TEXT NOT NULL,
    "grupo3" TEXT NOT NULL,
    "valorUf" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PresupuestoGasto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PresupuestoGasto_proyectoId_periodo_grupo1_grupo3_key"
ON "PresupuestoGasto"("proyectoId", "periodo", "grupo1", "grupo3");

CREATE INDEX "PresupuestoGasto_proyectoId_periodo_idx"
ON "PresupuestoGasto"("proyectoId", "periodo");

CREATE INDEX "PresupuestoGasto_proyectoId_grupo1_periodo_idx"
ON "PresupuestoGasto"("proyectoId", "grupo1", "periodo");

-- AddForeignKey
ALTER TABLE "PresupuestoGasto"
ADD CONSTRAINT "PresupuestoGasto_proyectoId_fkey"
FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
