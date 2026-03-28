-- Alter audit timestamps to timestamptz(3)
ALTER TABLE "Proyecto"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3);

ALTER TABLE "Local"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3);

ALTER TABLE "Arrendatario"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3);

ALTER TABLE "Contrato"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3),
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3);

ALTER TABLE "ContratoTarifa"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3);

ALTER TABLE "ContratoAnexo"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3);

ALTER TABLE "ContratoGGCC"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3);

ALTER TABLE "ContratoDia"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3);

ALTER TABLE "CargaDatos"
  ALTER COLUMN "errorDetalle" TYPE JSONB USING CASE
    WHEN "errorDetalle" IS NULL THEN NULL
    ELSE to_jsonb("errorDetalle")
  END,
  ALTER COLUMN "registrosCargados" SET DEFAULT 0,
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3);

ALTER TABLE "User"
  ALTER COLUMN "emailVerified" TYPE TIMESTAMPTZ(3);

ALTER TABLE "Session"
  ALTER COLUMN "expires" TYPE TIMESTAMPTZ(3);

-- New indexes
CREATE INDEX IF NOT EXISTS "Contrato_proyectoId_estado_idx"
  ON "Contrato" ("proyectoId", "estado");

CREATE INDEX IF NOT EXISTS "Contrato_proyectoId_updatedAt_idx"
  ON "Contrato" ("proyectoId", "updatedAt");

CREATE INDEX IF NOT EXISTS "ContratoDia_proyectoId_fecha_idx"
  ON "ContratoDia" ("proyectoId", "fecha");

CREATE INDEX IF NOT EXISTS "ContratoAnexo_contratoId_fecha_idx"
  ON "ContratoAnexo" ("contratoId", "fecha");

CREATE INDEX IF NOT EXISTS "Proyecto_nombre_idx"
  ON "Proyecto" ("nombre");

CREATE INDEX IF NOT EXISTS "CargaDatos_proyectoId_tipo_idx"
  ON "CargaDatos" ("proyectoId", "tipo");
