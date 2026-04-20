SELECT
  migration_name,
  started_at,
  finished_at,
  rolled_back_at
FROM "_prisma_migrations"
ORDER BY started_at ASC;
