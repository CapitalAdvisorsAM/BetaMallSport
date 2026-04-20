SELECT
  table_schema AS schema_name,
  table_name,
  has_table_privilege(current_user, format('%I.%I', table_schema, table_name), 'SELECT') AS can_select,
  has_table_privilege(current_user, format('%I.%I', table_schema, table_name), 'INSERT') AS can_insert,
  has_table_privilege(current_user, format('%I.%I', table_schema, table_name), 'UPDATE') AS can_update,
  has_table_privilege(current_user, format('%I.%I', table_schema, table_name), 'DELETE') AS can_delete,
  has_table_privilege(current_user, format('%I.%I', table_schema, table_name), 'TRUNCATE') AS can_truncate
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
