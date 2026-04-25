-- Anti-overlap GIST constraint on ContratoTarifa (active rows only).
--
-- Prevents two ACTIVE rows (supersededAt IS NULL) within the same logical group
--   (contratoId, tipo, esDiciembre, COALESCE(umbralVentasUf, 0))
-- from having overlapping validity intervals.
--
-- The interval is daterange(vigenciaDesde, COALESCE(vigenciaHasta, 'infinity'::date), '[]')
-- — inclusive on both ends, with NULL vigenciaHasta treated as +infinity.
--
-- Grouping mirrors the Zod-level overlap detection in src/lib/contracts/schema.ts:
--   - Fixed rates separate by (tipo, esDiciembre).
--   - Variable rates (PORCENTAJE) separate by umbralVentasUf tier.
-- Superseded rows are excluded via the WHERE clause so historical/corrected
-- rows can coexist with the active replacement that occupies the same range.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "ContratoTarifa"
  ADD CONSTRAINT "ContratoTarifa_no_active_overlap"
  EXCLUDE USING gist (
    "contratoId" WITH =,
    "tipo" WITH =,
    "esDiciembre" WITH =,
    COALESCE("umbralVentasUf", 0) WITH =,
    daterange("vigenciaDesde", COALESCE("vigenciaHasta", DATE 'infinity'), '[]') WITH &&
  )
  WHERE ("supersededAt" IS NULL);
