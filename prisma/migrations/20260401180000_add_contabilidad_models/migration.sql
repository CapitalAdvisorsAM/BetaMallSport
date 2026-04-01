-- CreateTable
CREATE TABLE "MapeoLocalContable" (
    "id" UUID NOT NULL,
    "proyectoId" UUID NOT NULL,
    "localExterno" TEXT NOT NULL,
    "localId" UUID NOT NULL,
    "creadoPor" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MapeoLocalContable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroContable" (
    "id" UUID NOT NULL,
    "proyectoId" UUID NOT NULL,
    "localId" UUID NOT NULL,
    "periodo" DATE NOT NULL,
    "grupo1" TEXT NOT NULL,
    "grupo3" TEXT NOT NULL,
    "denominacion" TEXT NOT NULL,
    "valorUf" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroContable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MapeoLocalContable_proyectoId_localExterno_key" ON "MapeoLocalContable"("proyectoId", "localExterno");

-- CreateIndex
CREATE INDEX "MapeoLocalContable_proyectoId_idx" ON "MapeoLocalContable"("proyectoId");

-- CreateIndex
CREATE INDEX "MapeoLocalContable_localId_idx" ON "MapeoLocalContable"("localId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroContable_localId_periodo_grupo1_grupo3_denominacion_key" ON "RegistroContable"("localId", "periodo", "grupo1", "grupo3", "denominacion");

-- CreateIndex
CREATE INDEX "RegistroContable_proyectoId_periodo_idx" ON "RegistroContable"("proyectoId", "periodo");

-- CreateIndex
CREATE INDEX "RegistroContable_localId_periodo_idx" ON "RegistroContable"("localId", "periodo");

-- CreateIndex
CREATE INDEX "RegistroContable_proyectoId_grupo1_periodo_idx" ON "RegistroContable"("proyectoId", "grupo1", "periodo");

-- AddForeignKey
ALTER TABLE "MapeoLocalContable" ADD CONSTRAINT "MapeoLocalContable_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapeoLocalContable" ADD CONSTRAINT "MapeoLocalContable_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroContable" ADD CONSTRAINT "RegistroContable_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroContable" ADD CONSTRAINT "RegistroContable_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE CASCADE ON UPDATE CASCADE;
