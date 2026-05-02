ALTER TYPE "TipoCargaDatos" ADD VALUE IF NOT EXISTS 'VENTAS_DIARIAS';

CREATE TABLE IF NOT EXISTS "VentaArrendatarioDiaria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proyectoId" UUID NOT NULL,
    "arrendatarioId" UUID,
    "idCa" INTEGER NOT NULL,
    "tiendaNombre" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "periodo" DATE NOT NULL,
    "dia" INTEGER NOT NULL,
    "totalBoletas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalBoletasExentas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalFacturas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalNotasCredito" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ventasPesos" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fechaRegistro" DATE,
    "categoriaTamano" TEXT,
    "categoriaTipo" TEXT,
    "piso" TEXT,
    "glaTipo" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentaArrendatarioDiaria_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "VentaArrendatarioDiaria" ALTER COLUMN "arrendatarioId" DROP NOT NULL;
ALTER TABLE "VentaArrendatarioDiaria" ADD COLUMN IF NOT EXISTS "idCa" INTEGER;
ALTER TABLE "VentaArrendatarioDiaria" ADD COLUMN IF NOT EXISTS "tiendaNombre" TEXT;
ALTER TABLE "VentaArrendatarioDiaria" ADD COLUMN IF NOT EXISTS "periodo" DATE;
ALTER TABLE "VentaArrendatarioDiaria" ADD COLUMN IF NOT EXISTS "dia" INTEGER;
ALTER TABLE "VentaArrendatarioDiaria" ADD COLUMN IF NOT EXISTS "totalBoletas" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "VentaArrendatarioDiaria" ADD COLUMN IF NOT EXISTS "totalBoletasExentas" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "VentaArrendatarioDiaria" ADD COLUMN IF NOT EXISTS "totalFacturas" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "VentaArrendatarioDiaria" ADD COLUMN IF NOT EXISTS "totalNotasCredito" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "VentaArrendatarioDiaria" ADD COLUMN IF NOT EXISTS "fechaRegistro" DATE;
ALTER TABLE "VentaArrendatarioDiaria" ADD COLUMN IF NOT EXISTS "categoriaTamano" TEXT;
ALTER TABLE "VentaArrendatarioDiaria" ADD COLUMN IF NOT EXISTS "categoriaTipo" TEXT;
ALTER TABLE "VentaArrendatarioDiaria" ADD COLUMN IF NOT EXISTS "piso" TEXT;
ALTER TABLE "VentaArrendatarioDiaria" ADD COLUMN IF NOT EXISTS "glaTipo" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'VentaArrendatarioDiaria_proyectoId_fkey'
  ) THEN
    ALTER TABLE "VentaArrendatarioDiaria"
      ADD CONSTRAINT "VentaArrendatarioDiaria_proyectoId_fkey"
      FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'VentaArrendatarioDiaria_arrendatarioId_proyectoId_fkey'
  ) THEN
    ALTER TABLE "VentaArrendatarioDiaria"
      ADD CONSTRAINT "VentaArrendatarioDiaria_arrendatarioId_proyectoId_fkey"
      FOREIGN KEY ("arrendatarioId", "proyectoId") REFERENCES "Arrendatario"("id", "proyectoId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "VentaArrendatarioDiaria_proyectoId_idCa_fecha_key" ON "VentaArrendatarioDiaria"("proyectoId", "idCa", "fecha");
CREATE INDEX IF NOT EXISTS "VentaArrendatarioDiaria_proyectoId_fecha_idx" ON "VentaArrendatarioDiaria"("proyectoId", "fecha");
CREATE INDEX IF NOT EXISTS "VentaArrendatarioDiaria_proyectoId_periodo_idx" ON "VentaArrendatarioDiaria"("proyectoId", "periodo");
CREATE INDEX IF NOT EXISTS "VentaArrendatarioDiaria_arrendatarioId_fecha_idx" ON "VentaArrendatarioDiaria"("arrendatarioId", "fecha");
