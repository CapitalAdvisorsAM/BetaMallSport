-- Migration: covering + partial indexes for rent roll metrics performance
-- Note: CONCURRENTLY removed so this runs inside Prisma's transaction block.
-- The indexes are identical in structure — only creation mode differs.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Partial index: only VIGENTE contracts (covers 90%+ of metrics queries)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contrato_vigente_partial
  ON "Contrato"("proyectoId", "localId", "arrendatarioId", "fechaTermino")
  WHERE estado = 'VIGENTE';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Partial index: only ACTIVO + esGLA locales (used in GLA total calculation)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_local_activo_gla_partial
  ON "Local"("proyectoId", "glam2")
  WHERE estado = 'ACTIVO' AND "esGLA" = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Covering index: ContratoTarifa for metrics endpoint
--    Avoids heap lookup when reading valor for FIJO_UF_M2 tariff
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contrato_tarifa_covering
  ON "ContratoTarifa"("contratoId", tipo, "vigenciaDesde")
  INCLUDE (valor, "vigenciaHasta");

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Covering index: ContratoGGCC for metrics endpoint
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contrato_ggcc_covering
  ON "ContratoGGCC"("contratoId", "vigenciaDesde")
  INCLUDE ("tarifaBaseUfM2", "pctAdministracion", "vigenciaHasta");

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Partial index: VentaLocal by proyecto+periodo (already has unique index on
--    localId+periodo, but proyecto lookups are separate)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_venta_local_proyecto_periodo
  ON "VentaLocal"("proyectoId", periodo)
  INCLUDE ("localId", "ventasUf");
