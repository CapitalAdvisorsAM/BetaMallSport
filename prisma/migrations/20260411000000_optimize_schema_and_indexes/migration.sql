-- ============================================================
-- Migration: optimize_schema_and_indexes
-- Fixes 5 issues in the two-source-of-truth architecture:
--   1. Period format inconsistency: VentaLocal.periodo & IngresoEnergia.periodo String → Date
--   2. Nullable unitId unique constraint on RegistroContable → partial unique indexes
--   3. Missing index on IngresoEnergia.localId
--   4. Missing index on RegistroContable.grupo3 for line-level EE.RR. queries
--   5. Missing temporal index on CargaDatos for upload history queries
-- ============================================================

-- ============================================================
-- PASO 1: VentaLocal — periodo String → DATE
-- Note: VentaLocal_localId_periodo_key is a UNIQUE INDEX, not a constraint.
--       Use DROP INDEX (not DROP CONSTRAINT) to remove it.
-- ============================================================

-- 1a. Add new Date column alongside existing String column.
ALTER TABLE "VentaLocal" ADD COLUMN "periodo_date" DATE;

-- 1b. Backfill: parse the YYYY-MM string into first day of that month.
UPDATE "VentaLocal"
SET "periodo_date" = TO_DATE("periodo" || '-01', 'YYYY-MM-DD');

-- 1c. Drop the existing unique index on the String column.
DROP INDEX IF EXISTS "VentaLocal_localId_periodo_key";

-- 1d. Make the new column NOT NULL.
ALTER TABLE "VentaLocal" ALTER COLUMN "periodo_date" SET NOT NULL;

-- 1e. Rename: old String column kept as safety net, new Date column becomes canonical.
ALTER TABLE "VentaLocal" RENAME COLUMN "periodo" TO "periodo_old";
ALTER TABLE "VentaLocal" RENAME COLUMN "periodo_date" TO "periodo";

-- 1f. Re-create unique index on the Date column.
CREATE UNIQUE INDEX "VentaLocal_localId_periodo_key" ON "VentaLocal" ("localId", "periodo");

-- 1g. Rebuild the project+period index on the new column type.
DROP INDEX IF EXISTS "VentaLocal_proyectoId_periodo_idx";
CREATE INDEX "VentaLocal_proyectoId_periodo_idx" ON "VentaLocal" ("proyectoId", "periodo");

-- NOTE: periodo_old is retained for one release cycle as a safety net.
-- Run cleanup after confirming production is stable:
--   ALTER TABLE "VentaLocal" DROP COLUMN "periodo_old";

-- ============================================================
-- PASO 2: IngresoEnergia — periodo String → DATE
-- Note: IngresoEnergia_localId_periodo_key is also a UNIQUE INDEX.
-- ============================================================

-- 2a. Add new Date column.
ALTER TABLE "IngresoEnergia" ADD COLUMN "periodo_date" DATE;

-- 2b. Backfill.
UPDATE "IngresoEnergia"
SET "periodo_date" = TO_DATE("periodo" || '-01', 'YYYY-MM-DD');

-- 2c. Drop the existing unique index on the String column.
DROP INDEX IF EXISTS "IngresoEnergia_localId_periodo_key";

-- 2d. Make NOT NULL.
ALTER TABLE "IngresoEnergia" ALTER COLUMN "periodo_date" SET NOT NULL;

-- 2e. Rename columns.
ALTER TABLE "IngresoEnergia" RENAME COLUMN "periodo" TO "periodo_old";
ALTER TABLE "IngresoEnergia" RENAME COLUMN "periodo_date" TO "periodo";

-- 2f. Re-create unique index on the Date column.
CREATE UNIQUE INDEX "IngresoEnergia_localId_periodo_key" ON "IngresoEnergia" ("localId", "periodo");

-- 2g. Rebuild existing project+period index.
DROP INDEX IF EXISTS "IngresoEnergia_proyectoId_periodo_idx";
CREATE INDEX "IngresoEnergia_proyectoId_periodo_idx"
  ON "IngresoEnergia" ("proyectoId", "periodo");

-- 2h. Add missing unit-level index (Issue 3).
CREATE INDEX "IngresoEnergia_localId_periodo_idx"
  ON "IngresoEnergia" ("localId", "periodo");

-- NOTE: periodo_old is retained for one release cycle.
-- Cleanup: ALTER TABLE "IngresoEnergia" DROP COLUMN "periodo_old";

-- ============================================================
-- PASO 3: RegistroContable — fix nullable unitId unique constraint (Issue 2)
-- ============================================================

-- 3a. Drop the existing Prisma-managed unique index.
--     Name is truncated by PostgreSQL to 63 chars.
DROP INDEX IF EXISTS "RegistroContable_proyectoId_localId_periodo_grupo1_grupo3_den_key";

-- 3b. Two partial unique indexes replace the single broken constraint.

-- For rows WITH a mapped unit (vast majority of rows).
CREATE UNIQUE INDEX "RegistroContable_unique_with_unit"
  ON "RegistroContable" ("proyectoId", "localId", "periodo", "grupo1", "grupo3", "denominacion")
  WHERE "localId" IS NOT NULL;

-- For property-level rows WITHOUT a mapped unit.
CREATE UNIQUE INDEX "RegistroContable_unique_no_unit"
  ON "RegistroContable" ("proyectoId", "periodo", "grupo1", "grupo3", "denominacion")
  WHERE "localId" IS NULL;

-- ============================================================
-- PASO 4: Add missing indexes (Issues 4 & 5)
-- ============================================================

-- 4a. RegistroContable — group3 line-level query index (Issue 4).
--     Supports: WHERE proyectoId = X AND grupo3 = Y AND periodo BETWEEN a AND b
CREATE INDEX "RegistroContable_proyectoId_grupo3_periodo_idx"
  ON "RegistroContable" ("proyectoId", "grupo3", "periodo");

-- 4b. CargaDatos — temporal upload history index (Issue 5).
--     Supports: WHERE proyectoId = X AND tipo = Y ORDER BY createdAt DESC
CREATE INDEX "CargaDatos_proyectoId_tipo_createdAt_idx"
  ON "CargaDatos" ("proyectoId", "tipo", "createdAt" DESC);

-- ============================================================
-- Verification queries (run manually after migration)
-- ============================================================
-- SELECT COUNT(*) FROM "VentaLocal"
--   WHERE "periodo_old" IS NOT NULL
--     AND TO_DATE("periodo_old" || '-01', 'YYYY-MM-DD') <> "periodo";
-- → Must return 0.

-- SELECT COUNT(*) FROM "IngresoEnergia"
--   WHERE "periodo_old" IS NOT NULL
--     AND TO_DATE("periodo_old" || '-01', 'YYYY-MM-DD') <> "periodo";
-- → Must return 0.
