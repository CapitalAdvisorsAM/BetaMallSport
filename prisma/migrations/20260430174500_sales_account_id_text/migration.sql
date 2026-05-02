DROP INDEX IF EXISTS "MapeoVentasArrendatario_proyectoId_idCa_key";
DROP INDEX IF EXISTS "MapeoVentasArrendatario_proyectoId_idCa_tiendaNombre_key";
DROP INDEX IF EXISTS "VentaArrendatarioDiaria_proyectoId_idCa_fecha_key";
DROP INDEX IF EXISTS "VentaArrendatarioDiaria_proyectoId_idCa_tiendaNombre_fecha_key";

ALTER TABLE "MapeoVentasArrendatario"
  ALTER COLUMN "idCa" TYPE TEXT USING "idCa"::TEXT;

ALTER TABLE "VentaArrendatarioDiaria"
  ALTER COLUMN "idCa" TYPE TEXT USING "idCa"::TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MapeoVentasArrendatario_proyectoId_idCa_tiendaNombre_key"
  ON "MapeoVentasArrendatario"("proyectoId", "idCa", "tiendaNombre");

CREATE UNIQUE INDEX IF NOT EXISTS "VentaArrendatarioDiaria_proyectoId_idCa_tiendaNombre_fecha_key"
  ON "VentaArrendatarioDiaria"("proyectoId", "idCa", "tiendaNombre", "fecha");
