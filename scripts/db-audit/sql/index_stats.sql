SELECT
  t.relname AS table_name,
  i.relname AS index_name,
  s.idx_scan,
  s.idx_tup_read,
  s.idx_tup_fetch,
  pg_relation_size(i.oid) AS index_bytes
FROM pg_stat_user_indexes s
JOIN pg_class t ON t.oid = s.relid
JOIN pg_class i ON i.oid = s.indexrelid
ORDER BY pg_relation_size(i.oid) DESC, s.idx_scan ASC;
