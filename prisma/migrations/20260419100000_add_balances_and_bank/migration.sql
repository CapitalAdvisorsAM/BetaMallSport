-- AlterEnum: add BALANCES value to TipoCargaDatos
ALTER TYPE "TipoCargaDatos" ADD VALUE IF NOT EXISTS 'BALANCES';

-- CreateTable: RegistroBalance
CREATE TABLE "RegistroBalance" (
    "id" UUID NOT NULL,
    "proyectoId" UUID NOT NULL,
    "periodo" DATE NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombre2" TEXT,
    "debitosClp" DECIMAL(18,2) NOT NULL,
    "creditosClp" DECIMAL(18,2) NOT NULL,
    "deudorClp" DECIMAL(18,2) NOT NULL,
    "acreedorClp" DECIMAL(18,2) NOT NULL,
    "activoClp" DECIMAL(18,2) NOT NULL,
    "pasivoClp" DECIMAL(18,2) NOT NULL,
    "perdidasClp" DECIMAL(18,2) NOT NULL,
    "gananciasClp" DECIMAL(18,2) NOT NULL,
    "diferenciaClp" DECIMAL(18,2) NOT NULL,
    "categoria" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "valorUf" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RegistroBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistroBalance_proyectoId_periodo_codigo_key"
ON "RegistroBalance"("proyectoId", "periodo", "codigo");

CREATE INDEX "RegistroBalance_proyectoId_periodo_idx"
ON "RegistroBalance"("proyectoId", "periodo");

CREATE INDEX "RegistroBalance_proyectoId_grupo_periodo_idx"
ON "RegistroBalance"("proyectoId", "grupo", "periodo");

CREATE INDEX "RegistroBalance_proyectoId_categoria_periodo_idx"
ON "RegistroBalance"("proyectoId", "categoria", "periodo");

ALTER TABLE "RegistroBalance"
ADD CONSTRAINT "RegistroBalance_proyectoId_fkey"
FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: MovimientoBanco
CREATE TABLE "MovimientoBanco" (
    "id" UUID NOT NULL,
    "proyectoId" UUID NOT NULL,
    "periodo" DATE NOT NULL,
    "fechaContable" DATE NOT NULL,
    "cc" TEXT NOT NULL,
    "movimiento" TEXT NOT NULL,
    "numeroOperacion" TEXT,
    "montoClp" DECIMAL(18,2) NOT NULL,
    "rutOrigen" TEXT,
    "nombreOrigen" TEXT,
    "comentarioTransferencia" TEXT,
    "banco" TEXT NOT NULL,
    "clasificacion" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MovimientoBanco_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MovimientoBanco_proyectoId_fechaContable_cc_numeroOperacion_montoClp_key"
ON "MovimientoBanco"("proyectoId", "fechaContable", "cc", "numeroOperacion", "montoClp");

CREATE INDEX "MovimientoBanco_proyectoId_periodo_idx"
ON "MovimientoBanco"("proyectoId", "periodo");

CREATE INDEX "MovimientoBanco_proyectoId_fechaContable_idx"
ON "MovimientoBanco"("proyectoId", "fechaContable");

CREATE INDEX "MovimientoBanco_proyectoId_clasificacion_periodo_idx"
ON "MovimientoBanco"("proyectoId", "clasificacion", "periodo");

ALTER TABLE "MovimientoBanco"
ADD CONSTRAINT "MovimientoBanco_proyectoId_fkey"
FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
