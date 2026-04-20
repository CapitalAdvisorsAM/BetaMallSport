export const QUERY_MANIFEST = [
  { id: "baseline_metadata", file: "baseline_metadata.sql", mode: "one" },
  { id: "extensions", file: "extensions.sql", mode: "many" },
  { id: "table_inventory", file: "table_inventory.sql", mode: "many" },
  { id: "enum_inventory", file: "enum_inventory.sql", mode: "many" },
  { id: "column_inventory", file: "column_inventory.sql", mode: "many" },
  { id: "index_inventory", file: "index_inventory.sql", mode: "many" },
  { id: "table_stats", file: "table_stats.sql", mode: "many" },
  { id: "index_stats", file: "index_stats.sql", mode: "many" },
  { id: "migrations_applied", file: "migrations_applied.sql", mode: "many", optional: true },
  { id: "security_role_privileges", file: "security_role_privileges.sql", mode: "one" },
  { id: "security_table_privileges", file: "security_table_privileges.sql", mode: "many" },
  { id: "integrity_contract_overlap", file: "integrity_contract_overlap.sql", mode: "many" },
  { id: "integrity_project_mismatches", file: "integrity_project_mismatches.sql", mode: "many" },
  { id: "integrity_invalid_ranges", file: "integrity_invalid_ranges.sql", mode: "many" },
  { id: "integrity_value_ranges", file: "integrity_value_ranges.sql", mode: "many" },
  { id: "integrity_contract_day_status", file: "integrity_contract_day_status.sql", mode: "many" },
  { id: "performance_top_statements", file: "performance_top_statements.sql", mode: "many", optional: true }
];
