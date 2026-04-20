SELECT
  queryid::text AS query_id,
  calls,
  ROUND(total_exec_time::numeric, 2) AS total_exec_time_ms,
  ROUND(mean_exec_time::numeric, 2) AS mean_exec_time_ms,
  rows,
  LEFT(REGEXP_REPLACE(query, '\s+', ' ', 'g'), 240) AS sample_query
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_exec_time DESC
LIMIT 20;
