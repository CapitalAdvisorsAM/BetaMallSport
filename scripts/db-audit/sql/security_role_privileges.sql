SELECT
  current_user AS role_name,
  has_database_privilege(current_user, current_database(), 'CONNECT') AS can_connect,
  has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_database_objects,
  has_database_privilege(current_user, current_database(), 'TEMP') AS can_create_temp_tables,
  has_schema_privilege(current_user, 'public', 'USAGE') AS can_use_public_schema,
  has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_in_public_schema;
