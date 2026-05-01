DROP INDEX IF EXISTS "MapeoVentasArrendatario_proyectoId_idCa_key";
CREATE UNIQUE INDEX IF NOT EXISTS "MapeoVentasArrendatario_proyectoId_idCa_tiendaNombre_key"
  ON "MapeoVentasArrendatario"("proyectoId", "idCa", "tiendaNombre");

DROP INDEX IF EXISTS "VentaArrendatarioDiaria_proyectoId_idCa_fecha_key";
CREATE UNIQUE INDEX IF NOT EXISTS "VentaArrendatarioDiaria_proyectoId_idCa_tiendaNombre_fecha_key"
  ON "VentaArrendatarioDiaria"("proyectoId", "idCa", "tiendaNombre", "fecha");
