-- Extensión trigram para búsqueda ILIKE eficiente
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índices GIN trigram para búsqueda de texto en rent roll
CREATE INDEX IF NOT EXISTS "Contrato_numeroContrato_trgm_idx"
  ON "Contrato" USING GIN ("numeroContrato" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Local_codigo_trgm_idx"
  ON "Local" USING GIN ("codigo" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Local_nombre_trgm_idx"
  ON "Local" USING GIN ("nombre" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Arrendatario_nombreComercial_trgm_idx"
  ON "Arrendatario" USING GIN ("nombreComercial" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Arrendatario_rut_trgm_idx"
  ON "Arrendatario" USING GIN ("rut" gin_trgm_ops);

-- Índice cubriente para tarifa vigente (query más frecuente del sistema)
CREATE INDEX IF NOT EXISTS "ContratoTarifa_contratoId_tipo_vigencia_idx"
  ON "ContratoTarifa" ("contratoId", "tipo", "vigenciaDesde" DESC)
  INCLUDE ("valor", "vigenciaHasta");

-- Índice cubriente para GGCC vigente
CREATE INDEX IF NOT EXISTS "ContratoGGCC_contratoId_vigenciaDesde_idx"
  ON "ContratoGGCC" ("contratoId", "vigenciaDesde" DESC)
  INCLUDE ("tarifaBaseUfM2", "pctAdministracion", "vigenciaHasta");

-- CHECK constraint para color hexadecimal (NOT VALID = no bloquea la tabla)
ALTER TABLE "Proyecto"
  ADD CONSTRAINT "Proyecto_color_hex_check"
  CHECK ("color" ~ '^#[0-9a-fA-F]{6}$')
  NOT VALID;
