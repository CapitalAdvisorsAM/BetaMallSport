import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { loadEnvFile } from "./load-env.mjs";
import { QUERY_MANIFEST } from "./query-manifest.mjs";
import { parseManualIndexes, parsePrismaSchema } from "./schema-parser.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const sqlDir = path.join(__dirname, "sql");
const auditTimezone = process.env.AUDIT_TIMEZONE || "America/Santiago";
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: auditTimezone
}).format(new Date());
const args = new Set(process.argv.slice(2));
const target = args.has("--target") ? process.argv[process.argv.indexOf("--target") + 1] : "production";

loadEnvFile(path.join(repoRoot, ".env"));

const prisma = new PrismaClient({
  log: ["error"]
});

function toPlainValue(value) {
  if (typeof value === "bigint") {
    return Number(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(toPlainValue);
  }

  if (value && typeof value === "object") {
    if (typeof value.toJSON === "function") {
      return value.toJSON();
    }

    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, toPlainValue(nested)]));
  }

  return value;
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-CL").format(Number(value) || 0);
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) {
    return `${value} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let unitIndex = -1;
  let size = value;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|");
}

function markdownTable(columns, rows) {
  const header = `| ${columns.map((column) => escapeCell(column.label)).join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${columns.map((column) => escapeCell(column.render(row))).join(" | ")} |`);
  return [header, separator, ...body].join("\n");
}

function formatQuerySources(queryFiles) {
  return queryFiles.map((file) => `\`scripts/db-audit/sql/${file}\``).join(", ");
}

function listMigrationDirectories() {
  const migrationsDir = path.join(repoRoot, "prisma", "migrations");
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function readSql(name) {
  return readFileSync(path.join(sqlDir, name), "utf8");
}

function getStaticHotspots() {
  return [
    {
      area: "Dashboard y métricas",
      source: "src/app/api/dashboard/metricas/route.ts",
      rationale: "Concentra agregaciones de rent roll y combina contratos, tarifas, GGCC y ocupación."
    },
    {
      area: "Contratos y anexos",
      source: "src/app/api/contracts/[id]/route.ts",
      rationale: "Lee y persiste múltiples relaciones por contrato; alto riesgo de integridad temporal."
    },
    {
      area: "Rent roll timeline",
      source: "src/lib/rent-roll/timeline.ts",
      rationale: "Depende de ContratoDia y fechas efectivas; sensible a inconsistencias y rendimiento."
    },
    {
      area: "Finanzas y conciliación",
      source: "src/app/api/finance/reconciliation/route.ts",
      rationale: "Cruza ventas, registros contables, mappings y contratos; propenso a drift funcional."
    },
    {
      area: "Exportaciones masivas",
      source: "src/app/api/export/excel/route.ts",
      rationale: "Superficie de lectura intensiva y potencial exposición amplia de datos."
    }
  ];
}

async function queryReadOnly(sql) {
  const rows = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '30000'");
      return tx.$queryRawUnsafe(sql);
    },
    {
      timeout: 60000,
      maxWait: 10000
    }
  );

  return toPlainValue(rows);
}

async function runManifestQueries() {
  const results = {};
  const failures = [];

  for (const query of QUERY_MANIFEST) {
    if (query.id === "migrations_applied" && results.baseline_metadata?.has_prisma_migrations_table === false) {
      continue;
    }

    if (query.id === "performance_top_statements" && results.baseline_metadata?.has_pg_stat_statements !== true) {
      continue;
    }

    try {
      const rows = await queryReadOnly(readSql(query.file));
      results[query.id] = query.mode === "one" ? rows[0] ?? null : rows;
    } catch (error) {
      if (!query.optional) {
        throw error;
      }

      failures.push({
        queryId: query.id,
        file: query.file,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { results, failures };
}

function groupEnumLabels(enumRows) {
  const grouped = new Map();
  for (const row of enumRows) {
    const labels = grouped.get(row.enum_name) ?? [];
    labels.push(row.enum_label);
    grouped.set(row.enum_name, labels);
  }

  return grouped;
}

function buildSchemaAssessment(repoMetadata, queryResults) {
  const actualTables = new Set(queryResults.table_inventory.map((row) => row.table_name));
  const actualEnums = new Set(queryResults.enum_inventory.map((row) => row.enum_name));
  const actualIndexes = new Set(queryResults.index_inventory.map((row) => row.index_name));
  const actualColumns = new Set(
    queryResults.column_inventory.map((row) => `${row.table_name}.${row.column_name}`)
  );
  const appliedMigrations = new Set((queryResults.migrations_applied ?? []).map((row) => row.migration_name));

  const matrix = [];
  for (const model of repoMetadata.schema.models) {
    matrix.push({
      objectType: "table",
      objectName: model.tableName,
      status: actualTables.has(model.tableName) ? "alineado" : "drift",
      detail: actualTables.has(model.tableName) ? "Tabla presente en PostgreSQL." : "Tabla esperada no encontrada."
    });
  }

  for (const dbEnum of repoMetadata.schema.enums) {
    matrix.push({
      objectType: "enum",
      objectName: dbEnum.dbName,
      status: actualEnums.has(dbEnum.dbName) ? "alineado" : "drift",
      detail: actualEnums.has(dbEnum.dbName) ? "Enum presente en PostgreSQL." : "Enum esperado no encontrado."
    });
  }

  for (const indexName of repoMetadata.manualIndexes) {
    matrix.push({
      objectType: "manual-index",
      objectName: indexName,
      status: actualIndexes.has(indexName) ? "manual-no-versionado" : "drift",
      detail: actualIndexes.has(indexName)
        ? "Índice detectado y mantenido fuera de migraciones Prisma."
        : "Índice esperado por script manual no encontrado."
    });
  }

  for (const deprecatedField of repoMetadata.schema.deprecatedFields) {
    const objectName = `${deprecatedField.tableName}.${deprecatedField.columnName}`;
    matrix.push({
      objectType: "deprecated-column",
      objectName,
      status: actualColumns.has(objectName) ? "obsoleto" : "alineado",
      detail: actualColumns.has(objectName)
        ? "Columna deprecated aún presente; revisar retiro controlado."
        : "Columna deprecated ya no aparece en la BD."
    });
  }

  for (const directoryName of repoMetadata.migrationDirectories) {
    matrix.push({
      objectType: "migration",
      objectName: directoryName,
      status: appliedMigrations.has(directoryName) ? "alineado" : "drift",
      detail: appliedMigrations.has(directoryName)
        ? "Migración registrada en _prisma_migrations."
        : "Migración del repo no registrada en _prisma_migrations."
    });
  }

  for (const appliedMigration of appliedMigrations) {
    if (!repoMetadata.migrationDirectories.includes(appliedMigration)) {
      matrix.push({
        objectType: "migration",
        objectName: appliedMigration,
        status: "drift",
        detail: "Migración registrada en la BD pero ausente en el repo local."
      });
    }
  }

  let overallStatus = "alineado";
  if (matrix.some((item) => item.status === "drift")) {
    overallStatus = "drift detectado";
  }

  return {
    overallStatus,
    matrix
  };
}

function computeWriteAccessSummary(rolePrivileges, tablePrivileges) {
  const writableTables = tablePrivileges.filter(
    (row) => row.can_insert || row.can_update || row.can_delete || row.can_truncate
  );

  return {
    canCreateInDatabase: Boolean(rolePrivileges?.can_create_database_objects),
    canCreateTempTables: Boolean(rolePrivileges?.can_create_temp_tables),
    canCreateInSchema: Boolean(rolePrivileges?.can_create_in_public_schema),
    writableTables
  };
}

function buildFindings(context) {
  const findings = [];
  const {
    queryResults,
    schemaAssessment,
    writeAccessSummary
  } = context;

  const overlapCount = queryResults.integrity_contract_overlap.length;
  if (overlapCount > 0) {
    findings.push({
      severity: "critical",
      title: "Contratos superpuestos sobre un mismo local",
      evidence: `${formatNumber(overlapCount)} pares de contratos activos/gracia se superponen en el mismo local.`,
      impact: "Riesgo de duplicar ocupación, renta esperada y métricas de vencimiento.",
      recommendation: "Corregir datos y agregar una validación persistente previa a altas/ediciones masivas.",
      queryFiles: ["integrity_contract_overlap.sql"]
    });
  }

  if (
    writeAccessSummary.canCreateInDatabase ||
    writeAccessSummary.canCreateTempTables ||
    writeAccessSummary.canCreateInSchema ||
    writeAccessSummary.writableTables.length > 0
  ) {
    findings.push({
      severity: "critical",
      title: "La credencial auditada no opera con privilegios read-only mínimos",
      evidence: [
        writeAccessSummary.canCreateInDatabase ? "CREATE en base" : null,
        writeAccessSummary.canCreateTempTables ? "TEMP en base" : null,
        writeAccessSummary.canCreateInSchema ? "CREATE en esquema public" : null,
        writeAccessSummary.writableTables.length > 0
          ? `${formatNumber(writeAccessSummary.writableTables.length)} tablas con INSERT/UPDATE/DELETE/TRUNCATE`
          : null
      ]
        .filter(Boolean)
        .join("; "),
      impact: "La auditoría se ejecuta segura por transacción read-only, pero la credencial subyacente sigue sobredimensionada para producción.",
      recommendation: "Crear un rol dedicado de auditoría/lectura y rotar DATABASE_URL productivo a privilegios mínimos.",
      queryFiles: ["security_role_privileges.sql", "security_table_privileges.sql"]
    });
  }

  const projectMismatchRows = queryResults.integrity_project_mismatches.filter((row) => Number(row.affected_rows) > 0);
  if (projectMismatchRows.length > 0) {
    const affected = projectMismatchRows.reduce((sum, row) => sum + Number(row.affected_rows), 0);
    findings.push({
      severity: "high",
      title: "Existen relaciones cruzadas entre proyectos",
      evidence: `${formatNumber(affected)} filas afectadas en ${projectMismatchRows.length} chequeos de coherencia inter-tabla.`,
      impact: "Puede mezclar ingresos, contratos o mappings entre malls distintos y contaminar reportes.",
      recommendation: "Corregir filas inconsistentes y reforzar validaciones de projectId en servicios y cargas masivas.",
      queryFiles: ["integrity_project_mismatches.sql"]
    });
  }

  const invalidRangeRows = queryResults.integrity_invalid_ranges.filter((row) => Number(row.affected_rows) > 0);
  if (invalidRangeRows.length > 0) {
    const affected = invalidRangeRows.reduce((sum, row) => sum + Number(row.affected_rows), 0);
    findings.push({
      severity: "high",
      title: "Se detectaron rangos temporales inválidos o estados incoherentes",
      evidence: `${formatNumber(affected)} filas afectadas en ${invalidRangeRows.length} chequeos temporales.`,
      impact: "Afecta el cálculo de vigencias, días de gracia, timeline y rent roll diario.",
      recommendation: "Normalizar fechas inválidas y reconciliar estados calculados versus persistidos.",
      queryFiles: ["integrity_invalid_ranges.sql"]
    });
  }

  if (schemaAssessment.overallStatus !== "alineado") {
    const driftItems = schemaAssessment.matrix.filter((item) => item.status === "drift");
    findings.push({
      severity: "high",
      title: "Schema/migraciones con drift respecto del repo",
      evidence: `${formatNumber(driftItems.length)} objetos en estado drift entre Prisma, migraciones y PostgreSQL.`,
      impact: "Eleva el riesgo de despliegues inconsistentes, regresiones silenciosas y pérdida de trazabilidad.",
      recommendation: "Resolver diferencias antes de nuevas migraciones y formalizar índices/manuales pendientes.",
      queryFiles: ["migrations_applied.sql", "table_inventory.sql", "index_inventory.sql"]
    });
  }

  const sensitiveTables = new Set(["Account", "Session", "VerificationToken", "User", "Arrendatario"]);
  const readableSensitiveTables = queryResults.security_table_privileges.filter(
    (row) => sensitiveTables.has(row.table_name) && row.can_select
  );
  const sensitiveColumns = queryResults.column_inventory.filter((row) =>
    [
      "Account.access_token",
      "Account.refresh_token",
      "Account.id_token",
      "Session.sessionToken",
      "VerificationToken.token",
      "User.email",
      "Arrendatario.email",
      "Arrendatario.telefono"
    ].includes(`${row.table_name}.${row.column_name}`)
  );

  if (readableSensitiveTables.length > 0 && sensitiveColumns.length > 0) {
    findings.push({
      severity: "high",
      title: "La credencial puede leer PII y tokens de autenticación",
      evidence: `${formatNumber(readableSensitiveTables.length)} tablas sensibles legibles y ${formatNumber(sensitiveColumns.length)} columnas sensibles inventariadas.`,
      impact: "Un uso impropio de la credencial permitiría exfiltración de sesiones, tokens OAuth o datos personales básicos.",
      recommendation: "Segregar credenciales por uso, limitar SELECT sobre tablas auth y revisar necesidad de retener tokens en claro.",
      queryFiles: ["security_table_privileges.sql", "column_inventory.sql"]
    });
  }

  const valueRangeRows = queryResults.integrity_value_ranges.filter((row) => Number(row.affected_rows) > 0);
  if (valueRangeRows.length > 0) {
    const affected = valueRangeRows.reduce((sum, row) => sum + Number(row.affected_rows), 0);
    findings.push({
      severity: "medium",
      title: "Hay valores financieros u operativos fuera de rango esperado",
      evidence: `${formatNumber(affected)} filas anómalas en ${valueRangeRows.length} chequeos de rango.`,
      impact: "Puede distorsionar KPIs, presupuesto versus real y simulaciones de renta/GGCC.",
      recommendation: "Revisar cargas históricas y agregar validaciones explícitas de rango en formularios y ETL.",
      queryFiles: ["integrity_value_ranges.sql"]
    });
  }

  const contractDayRows = queryResults.integrity_contract_day_status.filter((row) => Number(row.affected_rows) > 0);
  if (contractDayRows.length > 0) {
    const affected = contractDayRows.reduce((sum, row) => sum + Number(row.affected_rows), 0);
    findings.push({
      severity: "medium",
      title: "ContratoDia contiene estados incompatibles con su referencia",
      evidence: `${formatNumber(affected)} filas afectadas en la tabla diaria de ocupación.`,
      impact: "Impacta ocupación, timeline y reporting diario del rent roll.",
      recommendation: "Recalcular snapshots diarios afectados y blindar el proceso de generación.",
      queryFiles: ["integrity_contract_day_status.sql"]
    });
  }

  const tableInventoryByName = new Map(queryResults.table_inventory.map((row) => [row.table_name, row]));
  const largeSeqScanTables = queryResults.table_stats.filter((row) => {
    const tableMeta = tableInventoryByName.get(row.table_name);
    return tableMeta && Number(tableMeta.total_bytes) >= 50 * 1024 * 1024 && Number(row.seq_scan) > Number(row.idx_scan);
  });
  if (largeSeqScanTables.length > 0) {
    findings.push({
      severity: "medium",
      title: "Existen tablas grandes con predominio de lecturas secuenciales",
      evidence: `${formatNumber(largeSeqScanTables.length)} tablas > 50 MB con más seq_scan que idx_scan.`,
      impact: "Aumenta latencia y costo en dashboards, conciliaciones y exportaciones.",
      recommendation: "Cruzar estas tablas con rutas hotspot y revisar planes/índices antes de ampliar carga.",
      queryFiles: ["table_inventory.sql", "table_stats.sql"]
    });
  }

  const unusedLargeIndexes = queryResults.index_stats.filter(
    (row) => Number(row.idx_scan) === 0 && Number(row.index_bytes) >= 5 * 1024 * 1024
  );
  if (unusedLargeIndexes.length > 0) {
    findings.push({
      severity: "low",
      title: "Hay índices grandes sin uso registrado",
      evidence: `${formatNumber(unusedLargeIndexes.length)} índices >= 5 MB con idx_scan = 0.`,
      impact: "Consumen almacenamiento y mantenimiento sin evidencia de beneficio en este periodo.",
      recommendation: "Validar ventana de observación antes de eliminarlos o consolidarlos.",
      queryFiles: ["index_stats.sql"]
    });
  }

  if (queryResults.performance_top_statements === undefined) {
    findings.push({
      severity: "low",
      title: "Observabilidad de queries incompleta",
      evidence: "No se pudo consultar pg_stat_statements en esta ejecución.",
      impact: "La priorización de performance depende más de estadísticas de tabla/índice que de latencia por query real.",
      recommendation: "Habilitar o exponer pg_stat_statements al rol de auditoría.",
      queryFiles: ["performance_top_statements.sql"]
    });
  }

  return findings;
}

function buildBacklog(findings, schemaAssessment) {
  const items = [];

  if (findings.some((item) => item.severity === "critical")) {
    items.push({
      wave: 1,
      title: "Riesgos críticos de integridad y seguridad",
      tasks: [
        "Crear un rol read-only real para auditoría/analítica productiva.",
        "Corregir contratos superpuestos y bloquear nuevas superposiciones.",
        "Corregir incoherencias de projectId entre tablas relacionadas."
      ]
    });
  }

  if (schemaAssessment.overallStatus !== "alineado") {
    items.push({
      wave: 2,
      title: "Drift y deuda de migraciones",
      tasks: [
        "Conciliar _prisma_migrations con carpetas del repo.",
        "Versionar o documentar formalmente índices/manuales fuera de Prisma.",
        "Planificar retiro seguro de columnas deprecated y restos de migraciones transicionales."
      ]
    });
  }

  items.push({
    wave: 3,
    title: "Performance y costo",
    tasks: [
      "Analizar tablas grandes con seq_scan dominante contra rutas hotspot.",
      "Revisar índices grandes sin uso y confirmar si son deuda o cobertura estacional.",
      "Habilitar métricas de query-level con pg_stat_statements para siguiente iteración."
    ]
  });

  items.push({
    wave: 4,
    title: "Limpieza de modelo y observabilidad",
    tasks: [
      "Reducir superficie de lectura sensible en tablas auth y PII.",
      "Automatizar esta auditoría read-only en ambientes controlados.",
      "Agregar chequeos recurrentes de integridad sobre fechas, rangos y snapshots diarios."
    ]
  });

  return items;
}

function buildExecutiveSummary(context) {
  const { baseline, schemaAssessment, findings, hotspots, failures } = context;
  const critical = findings.filter((item) => item.severity === "critical");
  const high = findings.filter((item) => item.severity === "high");

  return `# Auditoría de Base de Datos - ${target}

## Resumen ejecutivo

- Fecha de ejecución: ${today}
- Zona horaria de reporte: **${auditTimezone}**
- Estado esquema/migraciones: **${schemaAssessment.overallStatus}**
- Motor observado: **${baseline.postgres_version}**
- Usuario auditado: **${baseline.current_user}**
- Transacción de auditoría: **READ ONLY = ${baseline.transaction_read_only}**
- Extensiones clave: **pg_trgm = ${baseline.has_pg_trgm ? "sí" : "no"}**, **pg_stat_statements = ${baseline.has_pg_stat_statements ? "sí" : "no"}**

## Riesgos prioritarios

${findings
  .slice(0, 6)
  .map(
    (finding) => `### [${finding.severity.toUpperCase()}] ${finding.title}

- Evidencia: ${finding.evidence}
- Impacto: ${finding.impact}
- Recomendación: ${finding.recommendation}
- Evidencia reproducible: ${formatQuerySources(finding.queryFiles)}
`
  )
  .join("\n\n")}

## Lectura ejecutiva

- Hallazgos críticos: **${critical.length}**
- Hallazgos altos: **${high.length}**
- El mayor riesgo operativo es ${critical[0]?.title?.toLowerCase() ?? "la posible deriva entre esquema, seguridad y datos"}.
- El mayor riesgo de gobierno de datos es ${
    findings.find((item) => item.title.includes("PII"))?.title.toLowerCase() ??
    "la necesidad de reducir privilegios y visibilidad sobre tablas sensibles"
  }.

## Áreas que más conviene revisar primero

${hotspots.map((item) => `- ${item.area}: \`${item.source}\` - ${item.rationale}`).join("\n")}

## Bloqueos y lagunas

${failures.length > 0 ? failures.map((item) => `- ${item.queryId}: ${item.message}`).join("\n") : "- No hubo bloqueos de consulta durante esta ejecución."}
`;
}

function buildTechnicalAnnex(context) {
  const {
    baseline,
    queryResults,
    schemaAssessment,
    findings,
    backlog,
    repoMetadata,
    failures
  } = context;

  const topTables = queryResults.table_inventory.slice(0, 10);
  const topIndexes = queryResults.index_stats.slice(0, 10);
  const driftMatrix = schemaAssessment.matrix
    .filter((item) => item.status !== "alineado")
    .slice(0, 30);
  const privilegeSummary = queryResults.security_table_privileges.filter(
    (row) => row.can_insert || row.can_update || row.can_delete || row.can_truncate
  );
  const mismatchRows = queryResults.integrity_project_mismatches.filter((row) => Number(row.affected_rows) > 0);
  const invalidRangeRows = queryResults.integrity_invalid_ranges.filter((row) => Number(row.affected_rows) > 0);
  const valueRangeRows = queryResults.integrity_value_ranges.filter((row) => Number(row.affected_rows) > 0);
  const contractDayRows = queryResults.integrity_contract_day_status.filter((row) => Number(row.affected_rows) > 0);

  return `# Anexo técnico - Auditoría de Base de Datos (${target})

## Baseline operativo

- Base: **${baseline.database_name}**
- Schema activo: **${baseline.current_schema}**
- Usuario: **${baseline.current_user}**
- Timezone servidor: **${baseline.timezone}**
- \`_prisma_migrations\`: **${baseline.has_prisma_migrations_table ? "disponible" : "no disponible"}**
- Migraciones en repo: **${repoMetadata.migrationDirectories.length}**
- Migraciones registradas en DB: **${queryResults.migrations_applied?.length ?? 0}**

## Tamaño por tabla

${markdownTable(
  [
    { label: "Tabla", render: (row) => row.table_name },
    { label: "Filas est.", render: (row) => formatNumber(row.estimated_rows) },
    { label: "Total", render: (row) => formatBytes(row.total_bytes) },
    { label: "Tabla", render: (row) => formatBytes(row.table_bytes) },
    { label: "Índices", render: (row) => formatBytes(row.index_bytes) }
  ],
  topTables
)}

## Índices observados

${markdownTable(
  [
    { label: "Tabla", render: (row) => row.table_name },
    { label: "Índice", render: (row) => row.index_name },
    { label: "Scans", render: (row) => formatNumber(row.idx_scan) },
    { label: "Tamaño", render: (row) => formatBytes(row.index_bytes) }
  ],
  topIndexes
)}

## Matriz de drift / objetos críticos

${driftMatrix.length > 0
    ? markdownTable(
        [
          { label: "Tipo", render: (row) => row.objectType },
          { label: "Objeto", render: (row) => row.objectName },
          { label: "Estado", render: (row) => row.status },
          { label: "Detalle", render: (row) => row.detail }
        ],
        driftMatrix
      )
    : "Sin diferencias relevantes en la matriz de objetos críticos."}

## Integridad y calidad de datos

### Chequeos con diferencias por proyecto

${mismatchRows.length > 0
    ? markdownTable(
        [
          { label: "Chequeo", render: (row) => row.check_name },
          { label: "Filas afectadas", render: (row) => formatNumber(row.affected_rows) }
        ],
        mismatchRows
      )
    : "No se detectaron mismatches de projectId en los chequeos cubiertos."}

### Rangos temporales inválidos

${invalidRangeRows.length > 0
    ? markdownTable(
        [
          { label: "Chequeo", render: (row) => row.check_name },
          { label: "Filas afectadas", render: (row) => formatNumber(row.affected_rows) }
        ],
        invalidRangeRows
      )
    : "No se detectaron rangos temporales inválidos en los chequeos cubiertos."}

### Rangos financieros / operativos

${valueRangeRows.length > 0
    ? markdownTable(
        [
          { label: "Chequeo", render: (row) => row.check_name },
          { label: "Filas afectadas", render: (row) => formatNumber(row.affected_rows) }
        ],
        valueRangeRows
      )
    : "No se detectaron valores fuera de rango en los chequeos cubiertos."}

### ContratoDia

${contractDayRows.length > 0
    ? markdownTable(
        [
          { label: "Chequeo", render: (row) => row.check_name },
          { label: "Filas afectadas", render: (row) => formatNumber(row.affected_rows) }
        ],
        contractDayRows
      )
    : "No se detectaron inconsistencias en ContratoDia en los chequeos cubiertos."}

### Contratos superpuestos

- Pares detectados: **${formatNumber(queryResults.integrity_contract_overlap.length)}**
- Query reproducible: \`scripts/db-audit/sql/integrity_contract_overlap.sql\`

## Seguridad y acceso

### Privilegios con capacidad de escritura

${privilegeSummary.length > 0
    ? markdownTable(
        [
          { label: "Tabla", render: (row) => row.table_name },
          { label: "INSERT", render: (row) => String(Boolean(row.can_insert)) },
          { label: "UPDATE", render: (row) => String(Boolean(row.can_update)) },
          { label: "DELETE", render: (row) => String(Boolean(row.can_delete)) },
          { label: "TRUNCATE", render: (row) => String(Boolean(row.can_truncate)) }
        ],
        privilegeSummary
      )
    : "No se detectaron privilegios de escritura sobre tablas base."}

### Cobertura de tablas sensibles

- Tablas auth/PII inventariadas: \`Account\`, \`Session\`, \`VerificationToken\`, \`User\`, \`Arrendatario\`
- Columnas sensibles destacadas: \`access_token\`, \`refresh_token\`, \`id_token\`, \`sessionToken\`, \`token\`, \`email\`, \`telefono\`

## Hallazgos priorizados

${findings
  .map(
    (finding, index) => `${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title}
   Evidencia: ${finding.evidence}
   Impacto: ${finding.impact}
   Remediación: ${finding.recommendation}
   Query: ${formatQuerySources(finding.queryFiles)}
`
  )
  .join("\n\n")}

## Backlog por olas

${backlog
  .map(
    (wave) => `### Ola ${wave.wave} - ${wave.title}

${wave.tasks.map((task) => `- ${task}`).join("\n")}`
  )
  .join("\n\n")}

## Queries utilizadas

${QUERY_MANIFEST.map((query) => `- \`scripts/db-audit/sql/${query.file}\``).join("\n")}

## Limitaciones

${failures.length > 0 ? failures.map((item) => `- ${item.queryId}: ${item.message}`).join("\n") : "- Sin limitaciones relevantes en esta ejecución."}
`;
}

async function main() {
  const schemaText = readFileSync(path.join(repoRoot, "prisma", "schema.prisma"), "utf8");
  const manualIndexesSql = readFileSync(
    path.join(repoRoot, "prisma", "scripts", "create_indexes_concurrently.sql"),
    "utf8"
  );

  const repoMetadata = {
    schema: parsePrismaSchema(schemaText),
    manualIndexes: parseManualIndexes(manualIndexesSql),
    migrationDirectories: listMigrationDirectories()
  };

  const { results: queryResults, failures } = await runManifestQueries();
  const schemaAssessment = buildSchemaAssessment(repoMetadata, queryResults);
  const writeAccessSummary = computeWriteAccessSummary(
    queryResults.security_role_privileges,
    queryResults.security_table_privileges
  );
  const findings = buildFindings({
    queryResults,
    schemaAssessment,
    writeAccessSummary
  });
  const backlog = buildBacklog(findings, schemaAssessment);
  const hotspots = getStaticHotspots();

  const context = {
    baseline: queryResults.baseline_metadata,
    queryResults,
    schemaAssessment,
    findings,
    backlog,
    hotspots,
    failures,
    repoMetadata
  };

  const reportDir = path.join(repoRoot, "reports", "database-audit");
  mkdirSync(reportDir, { recursive: true });

  const baseName = `${target}-${today}`;
  const executivePath = path.join(reportDir, `${baseName}-executive-summary.md`);
  const technicalPath = path.join(reportDir, `${baseName}-technical-annex.md`);
  const summaryJsonPath = path.join(reportDir, `${baseName}-summary.json`);

  writeFileSync(executivePath, buildExecutiveSummary(context), "utf8");
  writeFileSync(technicalPath, buildTechnicalAnnex(context), "utf8");
  writeFileSync(
    summaryJsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        target,
        schemaStatus: schemaAssessment.overallStatus,
        findingCounts: {
          critical: findings.filter((item) => item.severity === "critical").length,
          high: findings.filter((item) => item.severity === "high").length,
          medium: findings.filter((item) => item.severity === "medium").length,
          low: findings.filter((item) => item.severity === "low").length
        },
        topRisks: findings.slice(0, 8),
        backlog,
        blockedQueries: failures
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Audit completed for ${target}.`);
  console.log(`Executive summary: ${executivePath}`);
  console.log(`Technical annex: ${technicalPath}`);
  console.log(`Summary JSON: ${summaryJsonPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
