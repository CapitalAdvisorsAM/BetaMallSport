-- Reclassify contracts previously stored as GRACIA whose start date is still
-- in the future: those represent "not yet started" contracts, not true grace.
UPDATE "Contrato"
SET "estado" = 'NO_INICIADO'
WHERE "estado" = 'GRACIA'
  AND "fechaInicio" > CURRENT_DATE;
