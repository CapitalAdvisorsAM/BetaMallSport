-- Script para producción: ejecutar directamente en la BD, NO vía prisma migrate
-- Uso: psql $DATABASE_URL -f prisma/scripts/create_indexes_concurrently.sql
-- CONCURRENTLY construye el índice sin bloquear escrituras en producción.

SET lock_timeout = '5s';

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Contrato_numeroContrato_trgm_idx"
  ON "Contrato" USING GIN ("numeroContrato" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Local_codigo_trgm_idx"
  ON "Local" USING GIN ("codigo" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Local_nombre_trgm_idx"
  ON "Local" USING GIN ("nombre" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Arrendatario_nombreComercial_trgm_idx"
  ON "Arrendatario" USING GIN ("nombreComercial" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Arrendatario_rut_trgm_idx"
  ON "Arrendatario" USING GIN ("rut" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ContratoTarifa_contratoId_tipo_vigencia_idx"
  ON "ContratoTarifa" ("contratoId", "tipo", "vigenciaDesde" DESC)
  INCLUDE ("valor", "vigenciaHasta");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ContratoGGCC_contratoId_vigenciaDesde_idx"
  ON "ContratoGGCC" ("contratoId", "vigenciaDesde" DESC)
  INCLUDE ("tarifaBaseUfM2", "pctAdministracion", "vigenciaHasta");
