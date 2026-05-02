-- Data Contable now stores accounting line items, not monthly aggregates.
-- Idempotence is handled by replacing the loaded periods before insert.
DROP INDEX IF EXISTS "RegistroContable_unique_with_unit";
DROP INDEX IF EXISTS "RegistroContable_unique_no_unit";
