#!/usr/bin/env node

require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { PrismaClient, ContractStatus } = require("@prisma/client");

const prisma = new PrismaClient();

const SUPPORTED_TYPES = new Set([
  "LOCAL COMERCIAL",
  "MODULO COMERCIAL",
  "BODEGA",
  "MAQUINA EXPENDEDORA",
  "OLA",
  "OTROS"
]);
const SKIPPED_LOCAL_CODES = new Set(["-", "GESTION COMERCIAL - NUEVOS LOCALES"]);

function parseArgs(argv) {
  const args = {
    file: process.env.XLSX_PATH || "",
    project: "mall-sport",
    date: "",
    reportPath: path.join(process.cwd(), "reports", "rent-roll-vacancy-vs-excel.json")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--file") {
      args.file = argv[index + 1] || args.file;
      index += 1;
    } else if (token === "--project") {
      args.project = argv[index + 1] || args.project;
      index += 1;
    } else if (token === "--date") {
      args.date = argv[index + 1] || args.date;
      index += 1;
    } else if (token === "--report") {
      args.reportPath = argv[index + 1] || args.reportPath;
      index += 1;
    }
  }

  return args;
}

function asString(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return "";
}

function normalizeLabel(value) {
  return asString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLocalCode(value) {
  return normalizeLabel(value)
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*-\s*/g, "-");
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let normalized = asString(value);
  if (!normalized || normalized === "-") return 0;
  if (/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(normalized)) return 0;
  normalized = normalized.replace(/[^0-9,.\-]/g, "");
  if (!normalized || normalized === "-" || normalized === "." || normalized === ",") return 0;
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const normalized = asString(value);
  if (!normalized || normalized === "-") return null;
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(normalized);
  if (slashMatch) {
    let year = slashMatch[3];
    if (year.length === 2) year = Number(year) > 50 ? `19${year}` : `20${year}`;
    return `${year}-${slashMatch[1].padStart(2, "0")}-${slashMatch[2].padStart(2, "0")}`;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toDate(dateText) {
  return new Date(`${dateText}T00:00:00.000Z`);
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function summarize(rows, occupiedCodes) {
  const glaRows = rows.filter((row) => row.esGla);
  const glaTotal = glaRows.reduce((sum, row) => sum + row.gla, 0);
  const occupiedSet = new Set(occupiedCodes);
  const occupiedRows = glaRows.filter((row) => occupiedSet.has(row.localKey));
  const vacantRows = glaRows.filter((row) => !occupiedSet.has(row.localKey));
  const glaOcupada = occupiedRows.reduce((sum, row) => sum + row.gla, 0);
  const glaVacante = Math.max(glaTotal - glaOcupada, 0);

  return {
    localCount: glaRows.length,
    occupiedCount: occupiedRows.length,
    vacantCount: vacantRows.length,
    glaTotal: round(glaTotal, 2),
    glaOcupada: round(glaOcupada, 2),
    glaVacante: round(glaVacante, 2),
    pctVacancia: glaTotal > 0 ? round((glaVacante / glaTotal) * 100, 4) : 0,
    vacantLocals: vacantRows.map((row) => ({
      local: row.local,
      tenant: row.tenant,
      gla: row.gla,
      rowNumber: row.rowNumber
    }))
  };
}

function readExcel(file, explicitDate) {
  const workbook = XLSX.readFile(file, { cellDates: true });
  const rentRoll = workbook.Sheets["Rent Roll"];
  if (!rentRoll) throw new Error("No existe la hoja Rent Roll.");

  const rows = XLSX.utils.sheet_to_json(rentRoll, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false
  });

  const headerIndex = rows.findIndex((row) => {
    const joined = row.map(normalizeLabel).join("|");
    return joined.includes("ID LOCAL") && joined.includes("ARRENDATARIO") && joined.includes("INICIO");
  });
  if (headerIndex < 0) throw new Error("No se encontro la fila de encabezados del Rent Roll.");

  const vencidosIndex = rows.findIndex((row) => normalizeLabel(row[1]) === "VENCIDOS");
  const activeEnd = vencidosIndex > headerIndex ? vencidosIndex : rows.length;

  const activeRows = [];
  for (let index = headerIndex + 1; index < activeEnd; index += 1) {
    const row = rows[index];
    if (!Array.isArray(row) || !row.some((cell) => cell !== null && cell !== "")) continue;

    const local = asString(row[1]);
    const localKey = normalizeLocalCode(local);
    const typeLabel = normalizeLabel(row[3]);
    const tenant = asString(row[4]);
    const esGla = normalizeLabel(row[26]) === "GLA";
    const isSkipped =
      !localKey ||
      SKIPPED_LOCAL_CODES.has(localKey) ||
      (typeLabel && !SUPPORTED_TYPES.has(typeLabel));
    if (isSkipped) continue;

    activeRows.push({
      rowNumber: index + 1,
      local,
      localKey,
      tenant,
      isVacant: normalizeLabel(tenant).includes("VACANTE"),
      esGla,
      gla: parseNumber(row[5]),
      fechaInicio: parseDate(row[6]),
      fechaTermino: parseDate(row[7])
    });
  }

  const inputsSheet = workbook.Sheets.Inputs;
  const workbookDate =
    explicitDate || (inputsSheet ? parseDate(inputsSheet["C7"]?.v ?? inputsSheet["C7"]?.w) : null);
  const reportDate = workbookDate || "2026-03-31";

  const occupiedByLabel = activeRows
    .filter((row) => row.esGla && !row.isVacant)
    .map((row) => row.localKey);
  const occupiedByDate = activeRows
    .filter(
      (row) =>
        row.esGla &&
        !row.isVacant &&
        row.fechaInicio &&
        row.fechaTermino &&
        row.fechaInicio <= reportDate &&
        row.fechaTermino >= reportDate
    )
    .map((row) => row.localKey);

  return {
    reportDate,
    activeRows,
    byLabel: summarize(activeRows, occupiedByLabel),
    byDate: summarize(activeRows, occupiedByDate)
  };
}

async function readDb(projectSlug, reportDate) {
  const project = await prisma.project.findFirst({
    where: { slug: projectSlug },
    select: { id: true, nombre: true, slug: true }
  });
  if (!project) throw new Error(`No existe proyecto '${projectSlug}'.`);

  const snapshotDate = toDate(reportDate);
  const [units, contracts] = await Promise.all([
    prisma.unit.findMany({
      where: { projectId: project.id, estado: "ACTIVO" },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        glam2: true,
        esGLA: true
      },
      orderBy: { codigo: "asc" }
    }),
    prisma.contract.findMany({
      where: {
        projectId: project.id,
        estado: { in: [ContractStatus.VIGENTE, ContractStatus.GRACIA] },
        fechaInicio: { lte: snapshotDate },
        fechaTermino: { gte: snapshotDate }
      },
      select: {
        id: true,
        numeroContrato: true,
        localId: true,
        fechaInicio: true,
        fechaTermino: true,
        cuentaParaVacancia: true,
        local: { select: { codigo: true, nombre: true, glam2: true, esGLA: true } },
        arrendatario: { select: { nombreComercial: true } }
      }
    })
  ]);

  const dbRows = units.map((unit) => ({
    local: unit.codigo,
    localKey: normalizeLocalCode(unit.codigo),
    tenant: "",
    rowNumber: null,
    esGla: unit.esGLA,
    gla: Number(unit.glam2)
  }));
  const occupiedCodes = contracts
    .filter((contract) => contract.cuentaParaVacancia)
    .map((contract) => normalizeLocalCode(contract.local.codigo));
  const summary = summarize(dbRows, occupiedCodes);

  const contractsByLocal = new Map();
  for (const contract of contracts) {
    const key = normalizeLocalCode(contract.local.codigo);
    const list = contractsByLocal.get(key) || [];
    list.push({
      numeroContrato: contract.numeroContrato,
      tenant: contract.arrendatario.nombreComercial,
      cuentaParaVacancia: contract.cuentaParaVacancia,
      fechaInicio: contract.fechaInicio.toISOString().slice(0, 10),
      fechaTermino: contract.fechaTermino.toISOString().slice(0, 10)
    });
    contractsByLocal.set(key, list);
  }

  return {
    project,
    units,
    contracts,
    summary,
    contractsByLocal
  };
}

function compare(excel, db) {
  const excelGlaRowsByCode = new Map(
    excel.activeRows.filter((row) => row.esGla).map((row) => [row.localKey, row])
  );
  const dbGlaRowsByCode = new Map(
    db.units
      .filter((unit) => unit.esGLA)
      .map((unit) => [normalizeLocalCode(unit.codigo), unit])
  );
  const dbVacantCodes = new Set(db.summary.vacantLocals.map((row) => normalizeLocalCode(row.local)));
  const dbOccupiedCodes = new Set(
    db.contracts
      .filter((contract) => contract.cuentaParaVacancia && contract.local.esGLA)
      .map((contract) => normalizeLocalCode(contract.local.codigo))
  );

  const excelVacantLabelCodes = new Set(
    excel.activeRows.filter((row) => row.esGla && row.isVacant).map((row) => row.localKey)
  );
  const excelOccupiedLabelCodes = new Set(
    excel.activeRows.filter((row) => row.esGla && !row.isVacant).map((row) => row.localKey)
  );

  return {
    excelVacantButDbOccupied: [...excelVacantLabelCodes]
      .filter((code) => dbOccupiedCodes.has(code))
      .map((code) => ({
        local: excelGlaRowsByCode.get(code)?.local || code,
        excel: excelGlaRowsByCode.get(code),
        dbContracts: db.contractsByLocal.get(code) || []
      })),
    excelOccupiedButDbVacant: [...excelOccupiedLabelCodes]
      .filter((code) => dbVacantCodes.has(code))
      .map((code) => ({
        local: excelGlaRowsByCode.get(code)?.local || code,
        excel: excelGlaRowsByCode.get(code),
        dbContracts: db.contractsByLocal.get(code) || []
      })),
    inDbGlaNotInExcelCurrent: [...dbGlaRowsByCode.keys()]
      .filter((code) => !excelGlaRowsByCode.has(code))
      .map((code) => {
        const unit = dbGlaRowsByCode.get(code);
        return { local: unit.codigo, nombre: unit.nombre, gla: Number(unit.glam2) };
      }),
    inExcelCurrentGlaNotInDb: [...excelGlaRowsByCode.keys()]
      .filter((code) => !dbGlaRowsByCode.has(code))
      .map((code) => excelGlaRowsByCode.get(code))
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) throw new Error("Debes indicar --file o XLSX_PATH.");

  const excel = readExcel(args.file, args.date);
  const db = await readDb(args.project, excel.reportDate);
  const comparison = compare(excel, db);

  const report = {
    file: args.file,
    project: db.project,
    reportDate: excel.reportDate,
    formulas: {
      excelByLabel: "Filas actuales GLA: ocupado si Arrendatario no contiene VACANTE.",
      excelByDate: "Filas actuales GLA: ocupado si no es VACANTE y fechaInicio <= reportDate <= fechaTermino.",
      dbPage: "Locales ACTIVO + esGLA: ocupado si hay contrato VIGENTE/GRACIA vigente en reportDate con cuentaParaVacancia=true."
    },
    excel: {
      activeRows: excel.activeRows.length,
      byLabel: excel.byLabel,
      byDate: excel.byDate
    },
    db: {
      contractCountAtDate: db.contracts.length,
      summary: db.summary
    },
    deltas: {
      dbMinusExcelByLabel: {
        localCount: db.summary.localCount - excel.byLabel.localCount,
        vacantCount: db.summary.vacantCount - excel.byLabel.vacantCount,
        glaTotal: round(db.summary.glaTotal - excel.byLabel.glaTotal, 2),
        glaVacante: round(db.summary.glaVacante - excel.byLabel.glaVacante, 2),
        pctVacancia: round(db.summary.pctVacancia - excel.byLabel.pctVacancia, 4)
      },
      dbMinusExcelByDate: {
        localCount: db.summary.localCount - excel.byDate.localCount,
        vacantCount: db.summary.vacantCount - excel.byDate.vacantCount,
        glaTotal: round(db.summary.glaTotal - excel.byDate.glaTotal, 2),
        glaVacante: round(db.summary.glaVacante - excel.byDate.glaVacante, 2),
        pctVacancia: round(db.summary.pctVacancia - excel.byDate.pctVacancia, 4)
      }
    },
    comparison
  };

  fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
  fs.writeFileSync(args.reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath: args.reportPath, reportDate: report.reportDate, excel: report.excel, db: report.db.summary, deltas: report.deltas }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
