DO $$
DECLARE
  current_column RECORD;
BEGIN
  FOR current_column IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND lower(table_name) IN ('local', 'locales')
      AND lower(column_name) = 'contratoes'
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_column.table_schema
        AND table_name = current_column.table_name
        AND lower(column_name) = 'contratos'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I.%I RENAME COLUMN %I TO %I',
        current_column.table_schema,
        current_column.table_name,
        current_column.column_name,
        'contratos'
      );
    END IF;
  END LOOP;
END $$;
