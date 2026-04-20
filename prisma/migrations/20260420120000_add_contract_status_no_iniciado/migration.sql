-- Adds NO_INICIADO to the EstadoContrato enum.
-- Postgres requires ALTER TYPE ... ADD VALUE to run in its own transaction
-- before the value can be used, so the backfill lives in a separate migration.
ALTER TYPE "EstadoContrato" ADD VALUE IF NOT EXISTS 'NO_INICIADO';
