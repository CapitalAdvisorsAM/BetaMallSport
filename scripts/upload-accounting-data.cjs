const path = require("node:path");
const XLSX = require("xlsx");
const { DataUploadType, PrismaClient, Prisma } = require("@prisma/client");

const DEFAULT_FILE =
  "G:\\Unidades compartidas\\CA\\FI CA Rentas Comerciales\\13. Mall Sport\\03. CDG\\03. Gestión\\202604028 CDG MallSport Final v51.xlsx";
const PROJECT_NAME = "Mall Sport";
const APPLY = process.argv.includes("--apply");
const FILE_ARG = process.argv.find((arg) => arg.startsWith("--file="));
const FILE_PATH = FILE_ARG ? FILE_ARG.slice("--file=".length) : DEFAULT_FILE;
const prisma = new PrismaClient();

function str(value) {
  return value == null ? "" : String(value).trim();
}

function num(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = str(value);
  if (!raw) return 0;
  const negative = raw.startsWith("(") && raw.endsWith(")");
  const cleaned = raw.replace(/[()]/g, "").replace(/\s/g, "");
  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : 0;
}

function serialToMonthStart(value) {
  if (typeof value === "number") {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function parseGlaFlag(value) {
  const normalized = str(value).toUpperCase();
  if (normalized === "GLA") return true;
  if (normalized === "NO GLA") return false;
  return null;
}

function normalizeKey(value) {
  return str(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function tenantKeys(value) {
  const raw = str(value);
  const variants = new Set([raw]);
  variants.add(raw.replace(/\([^)]*\)/g, "").trim());
  for (const separator of ["-->", "->"]) {
    if (raw.includes(separator)) {
      for (const part of raw.split(separator)) variants.add(part.trim());
    }
  }
  return [...variants].map(normalizeKey).filter(Boolean);
}

function normalizeExternalUnit(value) {
  const raw = str(value);
  if (!raw) return "";
  const bracket = /\[L([^\]]+)\]/i.exec(raw);
  const candidate = bracket ? bracket[1] : raw;
  return candidate.replace(/^L(?=\d)/i, "").trim();
}

function unitKeys(value) {
  const normalized = normalizeExternalUnit(value);
  const compact = normalizeKey(normalized).replace(/^L(?=\d)/, "");
  const variants = new Set([compact]);
  variants.add(compact.replace(/Y/g, ""));
  return [...variants].filter(Boolean);
}

function chartKey(row) {
  return [row.group0, row.group1, row.group2, row.group3].join("\u0001");
}

function findHeaderIndex(rows) {
  return rows.findIndex((row) => {
    const cells = row.map(str);
    return cells.includes("Mes") && cells.includes("Ce.coste") && cells.includes("GRUPO 1");
  });
}

function indexHeaders(headerRow) {
  const headers = new Map();
  headerRow.forEach((value, index) => {
    const header = str(value);
    if (header && !headers.has(header)) headers.set(header, index);
  });
  return headers;
}

function get(row, headers, names) {
  for (const name of names) {
    if (headers.has(name)) return row[headers.get(name)];
  }
  return null;
}

function parseRows(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, sheets: "Data Contable" });
  const sheet = workbook.Sheets["Data Contable"];
  if (!sheet) throw new Error('No se encontró la hoja "Data Contable".');

  if (sheet["!ref"]) {
    const ref = XLSX.utils.decode_range(sheet["!ref"]);
    ref.s.c = 0;
    ref.e.c = Math.min(ref.e.c, 19);
    sheet["!ref"] = XLSX.utils.encode_range(ref);
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headerIndex = findHeaderIndex(rows);
  if (headerIndex < 0) throw new Error("No se encontró la fila de encabezados de Data Contable.");
  const headers = indexHeaders(rows[headerIndex]);

  const parsed = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    const ceCoste = str(get(row, headers, ["Ce.coste"]));
    if (ceCoste && ceCoste.toLowerCase() !== "real") continue;

    const period = serialToMonthStart(get(row, headers, ["Mes"]));
    const group1 = str(get(row, headers, ["GRUPO 1"]));
    const group3 = str(get(row, headers, ["GRUPO 3"]));
    if (!period || !group1) continue;

    const externalUnit = normalizeExternalUnit(get(row, headers, ["Local", "Denominación objeto"]));
    parsed.push({
      sourceRow: i + 1,
      period,
      externalUnit,
      tenantName: str(get(row, headers, ["Arrendatario"])),
      group0: str(get(row, headers, ["GRUPO 0"])),
      group1,
      group2: str(get(row, headers, ["GRUPO 2"])),
      group3,
      denomination:
        str(get(row, headers, ["Denominación objeto", "Denominacion objeto"])) ||
        str(get(row, headers, ["Local"])) ||
        group3,
      costCenterCode: str(get(row, headers, ["Cl.coste", "Cl coste"])),
      costCenterDescription: str(
        get(row, headers, ["Descrip.clases coste", "Descripcion clases coste", "Descrip clases coste"])
      ),
      valueClp: num(get(row, headers, ["Valor/mon.inf.", "Valor/mon.inf. (CLP)", "Valor (CLP)"])),
      valueUf: num(get(row, headers, ["Valor UF"])),
      sizeCategory: str(get(row, headers, ["Categoría (Tamaño)", "Categoria (Tamano)"])),
      typeCategory: str(get(row, headers, ["Categoría (Tipo)", "Categoria (Tipo)"])),
      floor: str(get(row, headers, ["Piso"])),
      documentRef: str(get(row, headers, ["Documento"])),
      documentHeader: str(get(row, headers, ["Texto cab.documento", "Texto cab documento"])),
      glaFlag: parseGlaFlag(get(row, headers, ["GLA / NO GLA", "GLA/NO GLA", "GLA"]))
    });
  }

  return { rows: parsed, headerRow: headerIndex + 1 };
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

function pickUser(users) {
  return (
    users.find((user) => user.role === "ADMIN") ??
    users.find((user) => user.role === "CONTABILIDAD") ??
    users[0]
  );
}

async function main() {
  const parsed = parseRows(FILE_PATH);
  const project = await prisma.project.findFirst({
    where: { nombre: { contains: PROJECT_NAME } },
    select: { id: true, nombre: true }
  });
  if (!project) throw new Error(`No se encontró el proyecto ${PROJECT_NAME}.`);

  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
  const user = pickUser(users);
  if (!user) throw new Error("No hay usuarios para registrar la carga.");

  const [units, unitMappings, tenants, tenantMappings] = await Promise.all([
    prisma.unit.findMany({ where: { projectId: project.id }, select: { id: true, codigo: true } }),
    prisma.accountingUnitMapping.findMany({
      where: { projectId: project.id },
      select: { externalUnit: true, unitId: true }
    }),
    prisma.tenant.findMany({
      where: { projectId: project.id },
      select: { id: true, nombreComercial: true, razonSocial: true }
    }),
    prisma.accountingTenantMapping.findMany({
      where: { projectId: project.id },
      select: { externalTenant: true, tenantId: true }
    })
  ]);

  const unitByExternal = new Map();
  for (const mapping of unitMappings) {
    for (const key of unitKeys(mapping.externalUnit)) unitByExternal.set(key, mapping.unitId);
  }
  for (const unit of units) {
    for (const key of unitKeys(unit.codigo)) unitByExternal.set(key, unit.id);
  }
  const unitByCode = new Map(units.map((unit) => [unit.codigo, unit.id]));
  const unitAliases = {
    "1S25Y1S26": "1S25/1S26",
    "1S251S26": "1S25/1S26",
    "218": "218/219B"
  };
  for (const [external, code] of Object.entries(unitAliases)) {
    const unitId = unitByCode.get(code);
    if (unitId) unitByExternal.set(external, unitId);
  }

  const tenantByExternal = new Map();
  for (const mapping of tenantMappings) {
    for (const key of tenantKeys(mapping.externalTenant)) tenantByExternal.set(key, mapping.tenantId);
  }
  for (const tenant of tenants) {
    for (const key of tenantKeys(tenant.nombreComercial)) tenantByExternal.set(key, tenant.id);
    for (const key of tenantKeys(tenant.razonSocial)) tenantByExternal.set(key, tenant.id);
  }

  const periods = [...new Set(parsed.rows.map((row) => row.period.toISOString().slice(0, 7)))].sort();
  const uniqueAccounts = new Map();
  for (const row of parsed.rows) {
    uniqueAccounts.set(chartKey(row), row);
  }

  const unitUnmapped = new Map();
  const tenantUnmapped = new Map();
  const matchedUnitMappings = new Map();
  const matchedTenantMappings = new Map();
  let rowsWithUnit = 0;
  let rowsWithTenant = 0;
  let globalRows = 0;
  for (const row of parsed.rows) {
    const hasLikelyUnit = Boolean(row.externalUnit) && Boolean(row.tenantName || row.sizeCategory || row.typeCategory || row.floor || row.glaFlag !== null);
    const unitId = row.externalUnit
      ? unitKeys(row.externalUnit).map((key) => unitByExternal.get(key)).find(Boolean) ?? null
      : null;
    if (unitId) {
      rowsWithUnit += 1;
      matchedUnitMappings.set(row.externalUnit, unitId);
    }
    else if (hasLikelyUnit) unitUnmapped.set(row.externalUnit, (unitUnmapped.get(row.externalUnit) ?? 0) + 1);
    else globalRows += 1;

    if (row.tenantName) {
      const tenantId = tenantKeys(row.tenantName).map((key) => tenantByExternal.get(key)).find(Boolean);
      if (tenantId) {
        rowsWithTenant += 1;
        matchedTenantMappings.set(row.tenantName, tenantId);
      }
      else tenantUnmapped.set(row.tenantName, (tenantUnmapped.get(row.tenantName) ?? 0) + 1);
    }
  }

  const summary = {
    file: path.basename(FILE_PATH),
    project: project.nombre,
    apply: APPLY,
    headerRow: parsed.headerRow,
    rows: parsed.rows.length,
    periods,
    uniqueAccounts: uniqueAccounts.size,
    rowsWithUnit,
    rowsWithTenant,
    globalRows,
    matchedUnitMappings: matchedUnitMappings.size,
    matchedTenantMappings: matchedTenantMappings.size,
    unmappedUnitCount: unitUnmapped.size,
    unmappedTenantCount: tenantUnmapped.size,
    topUnmappedUnits: [...unitUnmapped]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([externalUnit, count]) => ({ externalUnit, count })),
    topUnmappedTenants: [...tenantUnmapped]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tenantName, count]) => ({ tenantName, count }))
  };

  if (!APPLY) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const existingAccounts = await prisma.chartOfAccount.findMany({
    where: { projectId: project.id },
    select: { id: true, group0: true, group1: true, group2: true, group3: true }
  });
  const chartIdByKey = new Map(
    existingAccounts.map((account) => [
      [account.group0, account.group1, account.group2, account.group3].join("\u0001"),
      account.id
    ])
  );

  const newAccounts = [];
  for (const [key, row] of uniqueAccounts) {
    if (chartIdByKey.has(key)) continue;
    newAccounts.push({
      projectId: project.id,
      group0: row.group0,
      group1: row.group1,
      group2: row.group2,
      group3: row.group3
    });
  }
  for (const accountChunk of chunk(newAccounts, 500)) {
    await prisma.chartOfAccount.createMany({ data: accountChunk, skipDuplicates: true });
  }
  if (newAccounts.length > 0) {
    const refreshed = await prisma.chartOfAccount.findMany({
      where: { projectId: project.id },
      select: { id: true, group0: true, group1: true, group2: true, group3: true }
    });
    chartIdByKey.clear();
    for (const account of refreshed) {
      chartIdByKey.set([account.group0, account.group1, account.group2, account.group3].join("\u0001"), account.id);
    }
  }

  const periodDates = periods.map((period) => new Date(`${period}-01T00:00:00.000Z`));
  const records = parsed.rows.map((row) => {
    const unitId = row.externalUnit
      ? unitKeys(row.externalUnit).map((key) => unitByExternal.get(key)).find(Boolean) ?? null
      : null;
    const tenantId = row.tenantName
      ? tenantKeys(row.tenantName).map((key) => tenantByExternal.get(key)).find(Boolean) ?? null
      : null;
    return {
      projectId: project.id,
      unitId,
      tenantId,
      chartOfAccountId: chartIdByKey.get(chartKey(row)) ?? null,
      externalUnit: row.externalUnit || null,
      externalTenant: row.tenantName || null,
      period: row.period,
      group0: row.group0 || null,
      group1: row.group1,
      group2: row.group2 || null,
      group3: row.group3,
      denomination: row.denomination,
      costCenterCode: row.costCenterCode || null,
      costCenterDescription: row.costCenterDescription || null,
      valueUf: new Prisma.Decimal(row.valueUf),
      valueClp: row.valueClp ? new Prisma.Decimal(row.valueClp) : null,
      sizeCategory: row.sizeCategory || null,
      typeCategory: row.typeCategory || null,
      floor: row.floor || null,
      documentRef: row.documentRef || null,
      documentHeader: row.documentHeader || null,
      glaFlag: row.glaFlag
    };
  });

  await prisma.$transaction(
    async (tx) => {
      await tx.accountingRecord.deleteMany({
        where: { projectId: project.id, period: { in: periodDates } }
      });
      for (const recordChunk of chunk(records, 1000)) {
        await tx.accountingRecord.createMany({ data: recordChunk });
      }
      await tx.accountingUnitMapping.createMany({
        data: [...matchedUnitMappings].map(([externalUnit, unitId]) => ({
          projectId: project.id,
          externalUnit,
          unitId,
          createdBy: user.id
        })),
        skipDuplicates: true
      });
      await tx.accountingTenantMapping.createMany({
        data: [...matchedTenantMappings].map(([externalTenant, tenantId]) => ({
          projectId: project.id,
          externalTenant,
          tenantId,
          createdBy: user.id
        })),
        skipDuplicates: true
      });
      await tx.dataUpload.create({
        data: {
          projectId: project.id,
          type: DataUploadType.ACCOUNTING,
          userId: user.id,
          fileName: path.basename(FILE_PATH),
          fileUrl: FILE_PATH,
          recordsLoaded: records.length,
          status: "OK",
          errorDetail: {
            source: "scripts/upload-accounting-data.cjs",
            periods,
            rowsWithUnit,
            rowsWithTenant,
            globalRows,
            unmappedUnitCount: unitUnmapped.size,
            unmappedTenantCount: tenantUnmapped.size,
            topUnmappedUnits: summary.topUnmappedUnits,
            topUnmappedTenants: summary.topUnmappedTenants
          }
        }
      });
    },
    { timeout: 120000 }
  );

  const verify = await prisma.accountingRecord.groupBy({
    by: ["period"],
    where: { projectId: project.id, period: { in: periodDates } },
    _count: { _all: true },
    _sum: { valueUf: true, valueClp: true },
    orderBy: { period: "asc" }
  });

  console.log(
    JSON.stringify(
      {
        ...summary,
        inserted: records.length,
        newAccounts: newAccounts.length,
        verify: verify.map((period) => ({
          period: period.period.toISOString().slice(0, 7),
          count: period._count._all,
          valueUf: period._sum.valueUf?.toString() ?? null,
          valueClp: period._sum.valueClp?.toString() ?? null
        }))
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
