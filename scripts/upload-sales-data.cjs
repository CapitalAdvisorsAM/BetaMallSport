const path = require("node:path");
const XLSX = require("xlsx");
const { DataUploadType, PrismaClient } = require("@prisma/client");

const DEFAULT_FILE =
  "G:\\Unidades compartidas\\CA\\FI CA Rentas Comerciales\\13. Mall Sport\\03. CDG\\03. Gestión\\202604028 CDG MallSport Final v51.xlsx";
const PROJECT_NAME = "Mall Sport";
const APPLY = process.argv.includes("--apply");
const ALL_PERIODS = process.argv.includes("--all-periods");
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

function normalize(value) {
  return str(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function mappingKey(salesAccountId, storeName) {
  return `${salesAccountId}__${normalize(storeName)}`;
}

function similarity(a, b) {
  const A = normalize(a);
  const B = normalize(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  if (A.length < 2 || B.length < 2) return 0;
  const bigrams = (value) => {
    const set = new Set();
    for (let i = 0; i < value.length - 1; i += 1) set.add(value.slice(i, i + 2));
    return set;
  };
  const ba = bigrams(A);
  const bb = bigrams(B);
  let inter = 0;
  for (const item of ba) if (bb.has(item)) inter += 1;
  return (2 * inter) / (ba.size + bb.size);
}

const MONTHS = new Map(
  [
    ["enero", 0],
    ["febrero", 1],
    ["marzo", 2],
    ["abril", 3],
    ["mayo", 4],
    ["junio", 5],
    ["julio", 6],
    ["agosto", 7],
    ["septiembre", 8],
    ["setiembre", 8],
    ["octubre", 9],
    ["noviembre", 10],
    ["diciembre", 11],
  ].map(([name, value]) => [normalize(name), value])
);

function excelSerialToDate(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  if (typeof value === "number") return excelSerialToDate(value);
  const raw = str(value);
  if (!raw || raw.startsWith("00-00-00")) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function ymd(year, month, day) {
  const date = new Date(Date.UTC(year, month, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function findHeaderIndex(rows) {
  return rows.findIndex((row) => {
    const cells = row.map(normalize);
    return cells.includes("TIENDA") && cells.includes("DIA") && cells.includes("IDCA");
  });
}

function indexHeaders(headerRow) {
  const headers = new Map();
  headerRow.forEach((value, index) => {
    const key = normalize(value);
    if (key && !headers.has(key)) headers.set(key, index);
  });
  return headers;
}

function monthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function readSalesFilterMonth(workbook) {
  const sheet = workbook.Sheets.Inputs;
  if (!sheet) return null;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  for (const row of rows) {
    const index = row.findIndex((cell) => normalize(cell) === "FILTROVENTAS");
    if (index < 0) continue;
    const date = parseDate(row[index + 1]);
    return date ? monthStart(date) : null;
  }
  return null;
}

function get(row, headers, names) {
  for (const name of names) {
    const key = normalize(name);
    if (headers.has(key)) return row[headers.get(key)];
  }
  return null;
}

function parseRows(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true, sheets: ["Data Ventas", "Inputs"] });
  const sheet = workbook.Sheets["Data Ventas"];
  if (!sheet) throw new Error('No se encontró la hoja "Data Ventas".');
  const maxRealPeriod = ALL_PERIODS ? null : readSalesFilterMonth(workbook);

  if (sheet["!ref"]) {
    const ref = XLSX.utils.decode_range(sheet["!ref"]);
    ref.s.c = 0;
    ref.e.c = Math.min(ref.e.c, 18);
    sheet["!ref"] = XLSX.utils.encode_range(ref);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headerIndex = findHeaderIndex(rows);
  if (headerIndex < 0) throw new Error("No se encontró la fila de encabezados de Data Ventas.");
  const headers = indexHeaders(rows[headerIndex]);
  const byKey = new Map();
  const invalidRows = [];

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    const storeName = str(get(row, headers, ["Tienda"]));
    const salesAccountId = str(get(row, headers, ["ID CA"]));
    if (!storeName || !salesAccountId) continue;

    const day = parseInt(str(get(row, headers, ["Día", "Dia"])), 10);
    const year = parseInt(str(get(row, headers, ["Año", "Ano"])), 10);
    const month = MONTHS.get(normalize(get(row, headers, ["Mes"])));
    const date = Number.isInteger(day) && Number.isInteger(year) && month != null ? ymd(year, month, day) : null;
    if (!date) {
      invalidRows.push(i + 1);
      continue;
    }

    const period = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    if (maxRealPeriod && period.getTime() > maxRealPeriod.getTime()) continue;

    const key = `${salesAccountId}__${normalize(storeName)}__${date.toISOString().slice(0, 10)}`;
    const current =
      byKey.get(key) ?? {
        salesAccountId,
        storeName,
        date,
        period,
        day,
        totalReceipts: 0,
        totalExemptReceipts: 0,
        totalInvoices: 0,
        totalCreditNotes: 0,
        salesPesos: 0,
        registrationDate: parseDate(get(row, headers, ["Fecha Registro"])),
        sizeCategory: str(get(row, headers, ["Categoría (Tamaño)", "Categoria (Tamano)"])) || null,
        typeCategory: str(get(row, headers, ["Categoría (Tipo)", "Categoria (Tipo)"])) || null,
        floor: str(get(row, headers, ["Piso"])) || null,
        glaType: str(get(row, headers, ["GLA / NO GLA", "GLA/NO GLA"])) || null,
      };

    current.totalReceipts += num(get(row, headers, ["Total Boletas"]));
    current.totalExemptReceipts += num(get(row, headers, ["Total Boletas Exentas"]));
    current.totalInvoices += num(get(row, headers, ["Total Facturas"]));
    current.totalCreditNotes += num(get(row, headers, ["Total Notas Crédito", "Total Notas Credito"]));
    current.salesPesos += num(get(row, headers, ["Total B+F+BE-NC"]));
    byKey.set(key, current);
  }

  return { rows: [...byKey.values()], headerRow: headerIndex + 1, invalidRows, maxRealPeriod };
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

function pickUser(users) {
  return users.find((user) => user.role === "ADMIN") ?? users.find((user) => user.role === "CONTABILIDAD") ?? users[0];
}

function sumBy(rows, keyFn, valueFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    map.set(key, (map.get(key) ?? 0) + valueFn(row));
  }
  return map;
}

async function main() {
  const parsed = parseRows(FILE_PATH);
  const project = await prisma.project.findFirst({
    where: { nombre: { contains: PROJECT_NAME } },
    select: { id: true, nombre: true },
  });
  if (!project) throw new Error(`No se encontró el proyecto ${PROJECT_NAME}.`);

  const [users, tenants, existingMappings] = await Promise.all([
    prisma.user.findMany({ select: { id: true, email: true, role: true } }),
    prisma.tenant.findMany({
      where: { projectId: project.id },
      select: { id: true, rut: true, nombreComercial: true, razonSocial: true },
    }),
    prisma.salesTenantMapping.findMany({
      where: { projectId: project.id },
      select: { salesAccountId: true, storeName: true, tenantId: true },
    }),
  ]);

  const user = pickUser(users);
  if (!user) throw new Error("No hay usuarios para registrar la carga.");

  const tenantBySalesStore = new Map(
    existingMappings.map((mapping) => [mappingKey(mapping.salesAccountId, mapping.storeName), mapping.tenantId])
  );
  const storeByKey = new Map();
  for (const row of parsed.rows) {
    const key = mappingKey(row.salesAccountId, row.storeName);
    if (!storeByKey.has(key)) {
      storeByKey.set(key, { salesAccountId: row.salesAccountId, storeName: row.storeName });
    }
  }

  const newMappings = [];
  const unmapped = [];
  for (const [key, { salesAccountId, storeName }] of storeByKey.entries()) {
    if (tenantBySalesStore.has(key)) continue;
    const scored = tenants
      .map((tenant) => ({
        ...tenant,
        score: Math.max(similarity(storeName, tenant.nombreComercial), similarity(storeName, tenant.razonSocial)),
      }))
      .sort((a, b) => b.score - a.score);

    if (scored[0] && scored[0].score >= 0.7) {
      tenantBySalesStore.set(key, scored[0].id);
      newMappings.push({
        projectId: project.id,
        salesAccountId,
        storeName,
        tenantId: scored[0].id,
        createdBy: user.id,
      });
    } else {
      unmapped.push({
        salesAccountId,
        storeName,
        suggestions: scored.slice(0, 3).map((tenant) => ({
          tenant: tenant.nombreComercial,
          rut: tenant.rut,
          score: Number(tenant.score.toFixed(3)),
        })),
      });
    }
  }

  const dailyRows = parsed.rows.map((row) => ({
    ...row,
    projectId: project.id,
    tenantId: tenantBySalesStore.get(mappingKey(row.salesAccountId, row.storeName)) ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const mappedRows = dailyRows.filter((row) => row.tenantId);
  const monthlyMap = sumBy(
    mappedRows,
    (row) => `${row.tenantId}__${row.period.toISOString().slice(0, 7)}`,
    (row) => row.salesPesos
  );
  const monthlyRows = [...monthlyMap.entries()].map(([key, salesPesos]) => {
    const [tenantId, periodKey] = key.split("__");
    return {
      projectId: project.id,
      tenantId,
      period: new Date(`${periodKey}-01T00:00:00.000Z`),
      salesPesos,
    };
  });

  const dates = dailyRows.map((row) => row.date).sort((a, b) => a.getTime() - b.getTime());
  const periods = [...new Set(dailyRows.map((row) => row.period.toISOString().slice(0, 7)))].sort();
  const totalSales = dailyRows.reduce((sum, row) => sum + row.salesPesos, 0);
  const mappedSales = mappedRows.reduce((sum, row) => sum + row.salesPesos, 0);
  const totalsByPeriod = [...sumBy(dailyRows, (row) => row.period.toISOString().slice(0, 7), (row) => row.salesPesos)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, total]) => ({ period, total }));

  const result = {
    file: path.basename(FILE_PATH),
    project: project.nombre,
    headerRow: parsed.headerRow,
    maxRealPeriod: parsed.maxRealPeriod?.toISOString().slice(0, 7) ?? null,
    dailyRows: dailyRows.length,
    uniqueStores: storeByKey.size,
    mappedStores: storeByKey.size - unmapped.length,
    unmappedStores: unmapped.length,
    newMappings: newMappings.length,
    monthlyRows: monthlyRows.length,
    dateFrom: dates[0]?.toISOString().slice(0, 10) ?? null,
    dateTo: dates.at(-1)?.toISOString().slice(0, 10) ?? null,
    periods: periods.length,
    totalSales,
    mappedSales,
    invalidRows: parsed.invalidRows.length,
    totalsByPeriod,
    unmapped: unmapped.slice(0, 30),
  };

  if (!APPLY) {
    console.log(JSON.stringify({ dryRun: true, ...result }, null, 2));
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (newMappings.length > 0) {
      await tx.salesTenantMapping.createMany({ data: newMappings, skipDuplicates: true });
    }

    if (dates.length > 0) {
      await tx.tenantSaleDaily.deleteMany({
        where: { projectId: project.id, date: { gte: dates[0], lte: dates.at(-1) } },
      });
    }

    for (const batch of chunk(dailyRows, 1000)) {
      await tx.tenantSaleDaily.createMany({ data: batch });
    }

    await tx.tenantSale.deleteMany({
      where: {
        projectId: project.id,
        period: { in: periods.map((period) => new Date(`${period}-01T00:00:00.000Z`)) },
      },
    });

    for (const batch of chunk(monthlyRows, 1000)) {
      await tx.tenantSale.createMany({ data: batch });
    }

    await tx.dataUpload.create({
      data: {
        projectId: project.id,
        type: DataUploadType.SALES_DAILY,
        userId: user.id,
        fileName: path.basename(FILE_PATH),
        fileUrl: "",
        recordsLoaded: dailyRows.length,
        status: "OK",
        errorDetail:
          unmapped.length > 0 || parsed.invalidRows.length > 0
            ? { sinMapeo: unmapped, filasInvalidas: parsed.invalidRows.slice(0, 100) }
            : undefined,
      },
    });
  }, { timeout: 120000 });

  console.log(JSON.stringify({ applied: true, ...result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
