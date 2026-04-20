SELECT
  current_database() AS database_name,
  current_user AS current_user,
  current_schema() AS current_schema,
  version() AS postgres_version,
  current_setting('server_version_num') AS server_version_num,
  current_setting('TimeZone') AS timezone,
  current_setting('transaction_read_only', true) AS transaction_read_only,
  EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_trgm'
  ) AS has_pg_trgm,
  EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_stat_statements'
  ) AS has_pg_stat_statements,
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = '_prisma_migrations'
  ) AS has_prisma_migrations_table;
