SELECT
  n.nspname AS schema_name,
  t.typname AS enum_name,
  e.enumsortorder AS sort_order,
  e.enumlabel AS enum_label
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder;
