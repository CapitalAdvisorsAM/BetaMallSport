-- Create enum for local types aligned with CDG model
CREATE TYPE "TipoLocal" AS ENUM (
    'LOCAL_COMERCIAL',
    'SIMULADOR',
    'MODULO',
    'ESPACIO',
    'BODEGA',
    'OTRO'
);

-- Migrate existing local type data from LocalTipo to TipoLocal
ALTER TABLE "Local"
ALTER COLUMN "tipo" TYPE "TipoLocal"
USING (
    CASE "tipo"::text
        WHEN 'TIENDA' THEN 'LOCAL_COMERCIAL'::"TipoLocal"
        WHEN 'MODULO' THEN 'MODULO'::"TipoLocal"
        WHEN 'BODEGA' THEN 'BODEGA'::"TipoLocal"
        WHEN 'OTRO' THEN 'OTRO'::"TipoLocal"
        ELSE 'OTRO'::"TipoLocal"
    END
);

DROP TYPE "LocalTipo";

CREATE TABLE "IngresoEnergia" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "valorUf" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IngresoEnergia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IngresoEnergia_localId_periodo_key" ON "IngresoEnergia"("localId", "periodo");
CREATE INDEX "IngresoEnergia_proyectoId_periodo_idx" ON "IngresoEnergia"("proyectoId", "periodo");

ALTER TABLE "IngresoEnergia"
ADD CONSTRAINT "IngresoEnergia_proyectoId_fkey"
FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IngresoEnergia"
ADD CONSTRAINT "IngresoEnergia_localId_fkey"
FOREIGN KEY ("localId") REFERENCES "Local"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
