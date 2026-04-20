#!/usr/bin/env node

require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const { createHash } = require("crypto");
const XLSX = require("xlsx");
const {
  PrismaClient,
  Prisma,
  ContractStatus,
  ContractRateType,
  MasterStatus,
  TenantCategory,
  UnitType
} = require("@prisma/client");

const prisma = new PrismaClient();

const DEFAULT_FILE = String.raw`G:\Unidades compartidas\CA\FI CA Rentas Comerciales\13. Mall Sport\03. CDG\04. Presupuesto\2026\20260415 Presupuesto v24.xlsb.xlsx`;
const RENT_ROLL_HEADER_ROW_INDEX = 4;
const RENT_ROLL_DATA_ROW_INDEX = 5;

const SUPPORTED_TYPES = new Set([
  "LOCAL COMERCIAL",
  "MODULO COMERCIAL",
  "BODEGA",
  "MAQUINA EXPENDEDORA",
  "OLA",
  "OTROS"
]);
const SKIPPED_LOCAL_CODES = new Set(["-", "GESTION COMERCIAL - NUEVOS LOCALES"]);

const UNIT_TYPE_BY_LABEL = new Map([
  ["LOCAL COMERCIAL", UnitType.LOCAL_COMERCIAL],
  ["MODULO COMERCIAL", UnitType.MODULO],
  ["BODEGA", UnitType.BODEGA],
  ["MAQUINA EXPENDEDORA", UnitType.MAQUINA_EXPENDEDORA],
  ["OLA", UnitType.OLA],
  ["OTROS", UnitType.OTRO]
]);

const TENANT_CATEGORY_BY_LABEL = new Map([
  ["ENTRETENCION", TenantCategory.ENTERTAINMENT],
  ["ENTRETENCION Y DEPORTE", TenantCategory.ENTERTAINMENT],
  ["LIFESTYLE", TenantCategory.LIFESTYLE],
  ["SERVICIOS", TenantCategory.SERVICES],
  ["SERVICIOS Y OTROS", TenantCategory.SERVICES],
  ["POWERSPORTS", TenantCategory.POWERSPORTS],
  ["OUTDOOR", TenantCategory.OUTDOOR],
  ["ACCESORIOS", TenantCategory.ACCESSORIES],
  ["MULTIDEPORTE", TenantCategory.MULTISPORT],
  ["MULTISPORT", TenantCategory.MULTISPORT],
  ["BICICLETAS", TenantCategory.BICYCLES],
  ["BICYCLES", TenantCategory.BICYCLES],
  ["GIMNASIO", TenantCategory.GYM],
  ["GYM", TenantCategory.GYM]
]);

function parseArgs(argv) {
  const args = {
    file: DEFAULT_FILE,
    project: "mall-sport",
    apply: false,
    reportPath: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--apply") {
      args.apply = true;
      continue;
    }
    if (token === "--file") {
      args.file = argv[index + 1] ?? args.file;
      index += 1;
      continue;
    }
    if (token === "--project") {
      args.project = argv[index + 1] ?? args.project;
      index += 1;
      continue;
    }
    if (token === "--report") {
      args.reportPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Uso:
  node scripts/sync-budget-contracts.cjs [--file <ruta>] [--project <slug>] [--apply] [--report <ruta>]

Por defecto corre en dry-run contra el presupuesto de Mall Sport.
Agrega --apply para escribir en la base de datos.`);
}

function asString(value) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
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

function normalizeTenantName(value) {
  return asString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s*->.*$/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNullable(value) {
  const normalized = asString(value);
  return normalized || null;
}

function normalizeDecimal(value) {
  const normalized = normalizeNullable(value);
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return String(Number(parsed.toFixed(6)));
}

function normalizePercent(value) {
  const normalized = normalizeDecimal(value);
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const scaled = parsed !== 0 && Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
  return String(Number(scaled.toFixed(6)));
}

function integerOrNull(value) {
  const normalized = normalizeNullable(value);
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

function parseDate(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) {
      return null;
    }
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString().slice(0, 10);
  }
  const normalized = asString(value);
  if (!normalized || normalized === "-") {
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function buildContractLookupKey(input) {
  const numeroContrato = asString(input.numeroContrato).toUpperCase();
  if (numeroContrato) {
    return `numero:${numeroContrato}`;
  }

  return [
    "natural",
    asString(input.localCodigo).toUpperCase(),
    normalizeTenantName(input.arrendatarioNombre),
    input.fechaInicio ?? "",
    input.fechaTermino ?? ""
  ].join("|");
}

function decimalEquals(left, right) {
  return normalizeDecimal(left) === normalizeDecimal(right);
}

function fitsDecimalRange(value, integerDigits, scale) {
  const normalized = normalizeDecimal(value);
  if (normalized === null) {
    return true;
  }
  const limit = 10 ** integerDigits;
  return Math.abs(Number(normalized)) < limit;
}

function buildNotes(row) {
  const parts = [];
  const candidates = [
    ["GGCC reajuste", row[14]],
    ["Renta variable", row[16]],
    ["Renta fija", row[18]],
    ["Diciembre", row[20]],
    ["Fondo promocion", row[22]]
  ];
  for (const [label, value] of candidates) {
    const normalized = asString(value);
    if (!normalized || normalized === "-") {
      continue;
    }
    parts.push(`${label}: ${normalized}`);
  }
  return parts.length > 0 ? parts.join(" | ") : null;
}

function mergeNotes(...parts) {
  const unique = [];
  for (const part of parts) {
    const normalized = normalizeNullable(part);
    if (!normalized || unique.includes(normalized)) {
      continue;
    }
    unique.push(normalized);
  }
  return unique.length > 0 ? unique.join(" | ") : null;
}

function cleanUnitName(rawName, localCodigo) {
  const source = normalizeNullable(rawName) ?? localCodigo;
  return source.replace(/^\[[^\]]+\]\s*/, "").trim() || localCodigo;
}

function buildRutFallback(razonSocial, nombreComercial) {
  const seed = `${razonSocial.trim().toUpperCase()}|${nombreComercial.trim().toUpperCase()}`;
  const hash = createHash("sha1").update(seed).digest("hex").slice(0, 16).toUpperCase();
  return `NO-RUT-${hash}`;
}

function resolveTenantRut(rut, razonSocial, nombreComercial) {
  const normalized = asString(rut).replace(/\./g, "").replace(/\s+/g, "").toUpperCase();
  return normalized || buildRutFallback(razonSocial, nombreComercial);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function computeEstadoContrato(fechaInicio, fechaTermino, diasGracia, estadoManual, today) {
  if (estadoManual === ContractStatus.TERMINADO_ANTICIPADO) {
    return ContractStatus.TERMINADO_ANTICIPADO;
  }
  if (today > fechaTermino) {
    return ContractStatus.TERMINADO;
  }
  const finGracia = addDays(fechaInicio, diasGracia);
  if (today < finGracia) {
    return ContractStatus.GRACIA;
  }
  return ContractStatus.VIGENTE;
}

function buildReportPath(explicitReportPath) {
  if (explicitReportPath) {
    return explicitReportPath;
  }
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");
  return path.join(process.cwd(), "reports", `budget-contract-sync-${stamp}.json`);
}

function mapTenantCategory(label) {
  return TENANT_CATEGORY_BY_LABEL.get(normalizeLabel(label)) ?? null;
}

function parseBudgetWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets["Rent Roll"];

  if (!sheet) {
    throw new Error("No se encontro la hoja 'Rent Roll' en el presupuesto.");
  }

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    range: RENT_ROLL_HEADER_ROW_INDEX
  });
  const dataRows = rows
    .slice(1)
    .filter((row) => Array.isArray(row) && row.some((cell) => cell !== null && cell !== ""));

  return dataRows.map((row, index) => {
    const rowNumber = RENT_ROLL_DATA_ROW_INDEX + index + 1;
    const localCodigo = asString(row[1]).toUpperCase();
    const numeroContrato = asString(row[2]);
    const tipoLabel = normalizeLabel(row[3]);
    const arrendatarioNombre = asString(row[4]);
    const fechaInicio = parseDate(row[6]);
    const fechaTermino = parseDate(row[7]);
    const ggccPctAdministracion = normalizePercent(row[9]);
    const ggccValor = normalizeDecimal(row[10]);
    const ggccPctReajuste = normalizePercent(row[11]);
    const ggccMesesReajuste = integerOrNull(row[12]);
    const rentaVariablePct = normalizePercent(row[15]);
    const rentaFijaUfM2 = normalizeDecimal(row[17]);
    const multiplicadorDiciembre = normalizeDecimal(row[19]);
    const pctFondoPromocion = normalizePercent(row[21]);
    const isVacancy = normalizeLabel(arrendatarioNombre).includes("VACANTE");
    const isSkipped =
      !localCodigo ||
      SKIPPED_LOCAL_CODES.has(normalizeLabel(localCodigo)) ||
      !SUPPORTED_TYPES.has(tipoLabel);
    const tarifaTipo =
      rentaFijaUfM2 !== null
        ? ContractRateType.FIJO_UF_M2
        : rentaVariablePct
          ? ContractRateType.PORCENTAJE
          : null;
    const tarifaValor = rentaFijaUfM2 ?? rentaVariablePct;
    const unitType = UNIT_TYPE_BY_LABEL.get(tipoLabel) ?? UnitType.OTRO;
    const unitName = cleanUnitName(row[27], localCodigo);
    const esGLA = normalizeLabel(row[25]) === "GLA";
    const piso = asString(row[26]) || "0";
    const glam2 = normalizeDecimal(row[5]) ?? "0";
    const tenantCategory = mapTenantCategory(row[24]);
    const notes = buildNotes(row);

    return {
      rowNumber,
      numeroContrato,
      localCodigo,
      arrendatarioNombre,
      fechaInicio,
      fechaTermino,
      tipoLabel,
      unitType,
      unitName,
      esGLA,
      piso,
      glam2,
      tenantCategory,
      tarifaTipo,
      tarifaValor,
      tarifaVigenciaDesde: fechaInicio,
      tarifaVigenciaHasta: tarifaTipo === ContractRateType.FIJO_UF_M2 ? fechaTermino : null,
      rentaVariablePct: tarifaTipo === ContractRateType.FIJO_UF_M2 ? rentaVariablePct : null,
      ggccTipo: ggccValor ? "FIJO_UF_M2" : null,
      ggccValor,
      ggccPctAdministracion,
      ggccPctReajuste,
      ggccMesesReajuste,
      multiplicadorDiciembre,
      pctFondoPromocion,
      notes,
      isVacancy,
      isSkipped
    };
  });
}

function buildDesiredRateRows(row) {
  const rates = [];
  if (row.tarifaTipo && row.tarifaValor && row.tarifaVigenciaDesde) {
    rates.push({
      tipo: row.tarifaTipo,
      valor: row.tarifaValor,
      vigenciaDesde: row.tarifaVigenciaDesde,
      vigenciaHasta:
        row.tarifaTipo === ContractRateType.PORCENTAJE ? row.fechaTermino : row.tarifaVigenciaHasta
    });
  }
  if (row.rentaVariablePct && row.fechaInicio && row.fechaTermino) {
    rates.push({
      tipo: ContractRateType.PORCENTAJE,
      valor: row.rentaVariablePct,
      vigenciaDesde: row.fechaInicio,
      vigenciaHasta: row.fechaTermino
    });
  }
  return rates;
}

function compareContractWithBudgetRow(existing, row) {
  if (!existing) {
    return { status: "NEW", changedFields: [] };
  }

  const changedFields = [];
  if (asString(existing.localCodigo).toUpperCase() !== row.localCodigo) {
    changedFields.push("localCodigo");
  }
  if (normalizeTenantName(existing.arrendatarioNombre) !== normalizeTenantName(row.arrendatarioNombre)) {
    changedFields.push("arrendatarioNombre");
  }
  if (existing.fechaInicio !== row.fechaInicio) {
    changedFields.push("fechaInicio");
  }
  if (existing.fechaTermino !== row.fechaTermino) {
    changedFields.push("fechaTermino");
  }
  if (!decimalEquals(existing.pctFondoPromocion, row.pctFondoPromocion)) {
    changedFields.push("pctFondoPromocion");
  }
  if (!decimalEquals(existing.multiplicadorDiciembre, row.multiplicadorDiciembre)) {
    changedFields.push("multiplicadorDiciembre");
  }
  if ((existing.notas ?? null) !== (row.notes ?? null)) {
    changedFields.push("notas");
  }

  const desiredRates = buildDesiredRateRows(row);
  for (const desiredRate of desiredRates) {
    const existingRate = existing.tarifas.find(
      (item) =>
        item.tipo === desiredRate.tipo &&
        item.vigenciaDesde === desiredRate.vigenciaDesde
    );
    if (!existingRate) {
      changedFields.push("tarifas");
      break;
    }
    if (!decimalEquals(existingRate.valor, desiredRate.valor)) {
      changedFields.push("tarifas");
      break;
    }
    if ((existingRate.vigenciaHasta ?? null) !== (desiredRate.vigenciaHasta ?? null)) {
      changedFields.push("tarifas");
      break;
    }
  }

  if (row.ggccTipo && row.ggccValor && row.ggccPctAdministracion) {
    const existingGgcc = existing.ggcc[0];
    if (!existingGgcc) {
      changedFields.push("ggcc");
    } else if (
      !decimalEquals(existingGgcc.tarifaBaseUfM2, row.ggccValor) ||
      !decimalEquals(existingGgcc.pctAdministracion, row.ggccPctAdministracion) ||
      !decimalEquals(existingGgcc.pctReajuste, row.ggccPctReajuste) ||
      (existingGgcc.mesesReajuste ?? null) !== (row.ggccMesesReajuste ?? null)
    ) {
      changedFields.push("ggcc");
    }
  }

  return {
    status: changedFields.length > 0 ? "UPDATED" : "UNCHANGED",
    changedFields: Array.from(new Set(changedFields))
  };
}

function toDateOrNull(value) {
  if (!value) {
    return null;
  }
  return new Date(value);
}

function toDecimalOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return new Prisma.Decimal(String(value).replace(",", "."));
}

function buildExistingContractSnapshot(contract) {
  return {
    id: contract.id,
    numeroContrato: contract.numeroContrato,
    localCodigo: contract.local.codigo.toUpperCase(),
    arrendatarioNombre: contract.arrendatario.nombreComercial,
    fechaInicio: contract.fechaInicio.toISOString().slice(0, 10),
    fechaTermino: contract.fechaTermino.toISOString().slice(0, 10),
    pctFondoPromocion: contract.pctFondoPromocion?.toString() ?? null,
    multiplicadorDiciembre: contract.multiplicadorDiciembre?.toString() ?? null,
    notas: contract.notas,
    tarifas: contract.tarifas.map((item) => ({
      id: item.id,
      tipo: item.tipo,
      valor: item.valor.toString(),
      vigenciaDesde: item.vigenciaDesde.toISOString().slice(0, 10),
      vigenciaHasta: item.vigenciaHasta ? item.vigenciaHasta.toISOString().slice(0, 10) : null
    })),
    ggcc: contract.ggcc.map((item) => ({
      id: item.id,
      tarifaBaseUfM2: item.tarifaBaseUfM2.toString(),
      pctAdministracion: item.pctAdministracion.toString(),
      pctReajuste: item.pctReajuste?.toString() ?? null,
      mesesReajuste: item.mesesReajuste ?? null
    }))
  };
}

function buildStateMaps(state) {
  const unitByCode = new Map();
  for (const unit of state.units) {
    unitByCode.set(unit.codigo.toUpperCase(), unit);
  }

  const tenantByNormalizedName = new Map();
  for (const tenant of state.tenants) {
    const key = normalizeTenantName(tenant.nombreComercial);
    if (!key) {
      continue;
    }
    const matches = tenantByNormalizedName.get(key) ?? [];
    matches.push(tenant);
    tenantByNormalizedName.set(key, matches);
  }

  const contractByLookupKey = new Map();
  for (const contract of state.contracts) {
    const snapshot = buildExistingContractSnapshot(contract);
    contractByLookupKey.set(buildContractLookupKey(snapshot), snapshot);
    contractByLookupKey.set(
      buildContractLookupKey({
        ...snapshot,
        numeroContrato: ""
      }),
      snapshot
    );
  }

  return {
    unitByCode,
    tenantByNormalizedName,
    contractByLookupKey
  };
}

async function loadProjectState(projectSlug) {
  const project = await prisma.project.findFirst({
    where: { slug: projectSlug },
    select: { id: true, slug: true, nombre: true }
  });

  if (!project) {
    throw new Error(`No existe el proyecto '${projectSlug}'.`);
  }

  const [units, tenants, contracts] = await Promise.all([
    prisma.unit.findMany({
      where: { proyectoId: project.id },
      select: {
        id: true,
        codigo: true,
        glam2: true,
        nombre: true,
        piso: true,
        tipo: true,
        esGLA: true,
        estado: true
      }
    }),
    prisma.tenant.findMany({
      where: { proyectoId: project.id },
      select: {
        id: true,
        rut: true,
        razonSocial: true,
        nombreComercial: true,
        vigente: true,
        category: true
      }
    }),
    prisma.contract.findMany({
      where: { proyectoId: project.id },
      include: {
        local: { select: { codigo: true } },
        arrendatario: { select: { nombreComercial: true } },
        tarifas: true,
        ggcc: true
      }
    })
  ]);

  return { project, units, tenants, contracts };
}

function buildExecutionPlan(projectState, budgetRows) {
  const maps = buildStateMaps(projectState);
  const invalidRows = [];
  const skippedRows = [];
  const vacancyRows = [];
  const missingUnits = new Map();
  const missingTenants = new Map();
  const contractRows = [];
  let unchangedContracts = 0;
  let updatedContracts = 0;
  let newContracts = 0;
  let refCaMismatches = 0;

  for (const row of budgetRows) {
    if (row.isSkipped) {
      skippedRows.push({
        rowNumber: row.rowNumber,
        localCodigo: row.localCodigo,
        arrendatarioNombre: row.arrendatarioNombre,
        reason: "skipped_row"
      });
      continue;
    }

    if (row.isVacancy) {
      vacancyRows.push({
        rowNumber: row.rowNumber,
        localCodigo: row.localCodigo,
        arrendatarioNombre: row.arrendatarioNombre
      });
      continue;
    }

    if (!row.fechaInicio || !row.fechaTermino || !row.tarifaTipo || !row.tarifaValor) {
      invalidRows.push({
        rowNumber: row.rowNumber,
        localCodigo: row.localCodigo,
        arrendatarioNombre: row.arrendatarioNombre,
        numeroContrato: row.numeroContrato,
        reason: "invalid_core_fields"
      });
      continue;
    }

    const outOfRangeFields = [];
    if (!fitsDecimalRange(row.tarifaValor, 6, 4)) {
      outOfRangeFields.push("tarifaValor");
    }
    if (!fitsDecimalRange(row.rentaVariablePct, 6, 4)) {
      outOfRangeFields.push("rentaVariablePct");
    }
    if (!fitsDecimalRange(row.ggccValor, 6, 4)) {
      outOfRangeFields.push("ggccValor");
    }
    if (!fitsDecimalRange(row.ggccPctAdministracion, 3, 3)) {
      outOfRangeFields.push("ggccPctAdministracion");
    }
    if (!fitsDecimalRange(row.ggccPctReajuste, 3, 3)) {
      outOfRangeFields.push("ggccPctReajuste");
    }
    if (!fitsDecimalRange(row.multiplicadorDiciembre, 3, 3)) {
      outOfRangeFields.push("multiplicadorDiciembre");
    }
    if (!fitsDecimalRange(row.pctFondoPromocion, 3, 3)) {
      outOfRangeFields.push("pctFondoPromocion");
    }
    if (outOfRangeFields.length > 0) {
      invalidRows.push({
        rowNumber: row.rowNumber,
        localCodigo: row.localCodigo,
        arrendatarioNombre: row.arrendatarioNombre,
        numeroContrato: row.numeroContrato,
        reason: `decimal_out_of_range:${outOfRangeFields.join(",")}`
      });
      continue;
    }

    let unit = maps.unitByCode.get(row.localCodigo);
    if (!unit) {
      const unitPayload = {
        codigo: row.localCodigo,
        nombre: row.unitName,
        glam2: row.glam2,
        piso: row.piso,
        tipo: row.unitType,
        esGLA: row.esGLA,
        estado: MasterStatus.ACTIVO
      };
      missingUnits.set(row.localCodigo, unitPayload);
      unit = unitPayload;
      maps.unitByCode.set(row.localCodigo, unitPayload);
    }

    const normalizedTenantName = normalizeTenantName(row.arrendatarioNombre);
    let tenantMatches = maps.tenantByNormalizedName.get(normalizedTenantName);
    if (!tenantMatches || tenantMatches.length === 0) {
      const tenantPayload = {
        rut: resolveTenantRut("", row.arrendatarioNombre, row.arrendatarioNombre),
        razonSocial: row.arrendatarioNombre,
        nombreComercial: row.arrendatarioNombre,
        vigente: true,
        category: row.tenantCategory
      };
      missingTenants.set(normalizedTenantName, tenantPayload);
      tenantMatches = [tenantPayload];
      maps.tenantByNormalizedName.set(normalizedTenantName, tenantMatches);
    }

    if (tenantMatches.length > 1) {
      invalidRows.push({
        rowNumber: row.rowNumber,
        localCodigo: row.localCodigo,
        arrendatarioNombre: row.arrendatarioNombre,
        numeroContrato: row.numeroContrato,
        reason: "ambiguous_tenant"
      });
      continue;
    }

    const existingByNatural = maps.contractByLookupKey.get(
      buildContractLookupKey({
        numeroContrato: "",
        localCodigo: row.localCodigo,
        arrendatarioNombre: row.arrendatarioNombre,
        fechaInicio: row.fechaInicio,
        fechaTermino: row.fechaTermino
      })
    );
    const existingByNumber = row.numeroContrato
      ? maps.contractByLookupKey.get(
          buildContractLookupKey({
            numeroContrato: row.numeroContrato
          })
        )
      : null;
    const existing = existingByNatural ?? existingByNumber ?? null;
    const comparison = compareContractWithBudgetRow(existing, row);

    if (existingByNatural && row.numeroContrato) {
      const existingNum = asString(existingByNatural.numeroContrato).toUpperCase();
      const incomingNum = asString(row.numeroContrato).toUpperCase();
      if (
        existingNum &&
        incomingNum &&
        existingNum !== incomingNum &&
        existingNum !== `C-${incomingNum}` &&
        `C-${existingNum}` !== incomingNum
      ) {
        refCaMismatches += 1;
      }
    }

    if (comparison.status === "NEW") {
      newContracts += 1;
    } else if (comparison.status === "UPDATED") {
      updatedContracts += 1;
    } else {
      unchangedContracts += 1;
    }

    contractRows.push({
      row,
      existing,
      comparison
    });
  }

  return {
    missingUnits: Array.from(missingUnits.values()),
    missingTenants: Array.from(missingTenants.values()),
    contractRows,
    summary: {
      totalBudgetRows: budgetRows.length,
      skippedRows: skippedRows.length,
      vacancyRows: vacancyRows.length,
      invalidRows: invalidRows.length,
      unitsToCreate: missingUnits.size,
      tenantsToCreate: missingTenants.size,
      newContracts,
      updatedContracts,
      unchangedContracts,
      refCaMismatches
    },
    samples: {
      invalidRows: invalidRows.slice(0, 20),
      skippedRows: skippedRows.slice(0, 10),
      vacancyRows: vacancyRows.slice(0, 10),
      unitsToCreate: Array.from(missingUnits.values()).slice(0, 10),
      tenantsToCreate: Array.from(missingTenants.values()).slice(0, 20),
      newContracts: contractRows
        .filter((item) => item.comparison.status === "NEW")
        .slice(0, 20)
        .map((item) => ({
          rowNumber: item.row.rowNumber,
          localCodigo: item.row.localCodigo,
          arrendatarioNombre: item.row.arrendatarioNombre,
          numeroContrato: item.row.numeroContrato
        })),
      updatedContracts: contractRows
        .filter((item) => item.comparison.status === "UPDATED")
        .slice(0, 20)
        .map((item) => ({
          rowNumber: item.row.rowNumber,
          localCodigo: item.row.localCodigo,
          arrendatarioNombre: item.row.arrendatarioNombre,
          numeroContrato: item.row.numeroContrato,
          changedFields: item.comparison.changedFields
        }))
    }
  };
}

async function generateNumeroContrato(tx, proyectoId) {
  while (true) {
    const numeroContrato = crypto.randomUUID().slice(0, 8).toUpperCase();
    const existing = await tx.contract.findUnique({
      where: {
        proyectoId_numeroContrato: {
          proyectoId,
          numeroContrato
        }
      },
      select: { id: true }
    });
    if (!existing) {
      return numeroContrato;
    }
  }
}

async function resolveNumeroContratoForCreate(tx, projectId, requestedNumeroContrato) {
  const normalized = asString(requestedNumeroContrato).toUpperCase();
  if (!normalized) {
    return {
      numeroContrato: await generateNumeroContrato(tx, projectId),
      collisionResolved: false,
      collisionNote: null
    };
  }

  const existing = await tx.contract.findUnique({
    where: {
      proyectoId_numeroContrato: {
        proyectoId: projectId,
        numeroContrato: normalized
      }
    },
    select: { id: true }
  });

  if (!existing) {
    return {
      numeroContrato: normalized,
      collisionResolved: false,
      collisionNote: null
    };
  }

  return {
    numeroContrato: await generateNumeroContrato(tx, projectId),
    collisionResolved: true,
    collisionNote: `REF CA presupuesto: ${normalized}`
  };
}

async function upsertRate(tx, contractId, rate) {
  const existing = await tx.contractRate.findFirst({
    where: {
      contratoId: contractId,
      tipo: rate.tipo,
      vigenciaDesde: new Date(rate.vigenciaDesde)
    },
    select: { id: true }
  });

  const data = {
    valor: new Prisma.Decimal(rate.valor),
    vigenciaHasta: toDateOrNull(rate.vigenciaHasta),
    esDiciembre: false
  };

  if (existing) {
    await tx.contractRate.update({
      where: { id: existing.id },
      data
    });
    return;
  }

  await tx.contractRate.create({
    data: {
      contratoId: contractId,
      tipo: rate.tipo,
      vigenciaDesde: new Date(rate.vigenciaDesde),
      ...data
    }
  });
}

async function upsertGgcc(tx, contractId, row) {
  if (!row.ggccTipo || !row.ggccValor || !row.ggccPctAdministracion) {
    return;
  }

  const existing = await tx.contractCommonExpense.findFirst({
    where: { contratoId: contractId },
    select: { id: true }
  });

  const data = {
    tarifaBaseUfM2: new Prisma.Decimal(row.ggccValor),
    pctAdministracion: new Prisma.Decimal(row.ggccPctAdministracion),
    pctReajuste: toDecimalOrNull(row.ggccPctReajuste),
    vigenciaDesde: new Date(row.fechaInicio),
    vigenciaHasta: toDateOrNull(row.fechaTermino),
    proximoReajuste: null,
    mesesReajuste: row.ggccMesesReajuste ?? null
  };

  if (existing) {
    await tx.contractCommonExpense.update({
      where: { id: existing.id },
      data
    });
    return;
  }

  await tx.contractCommonExpense.create({
    data: {
      contratoId: contractId,
      ...data
    }
  });
}

async function applyPlan(projectState, executionPlan) {
  const projectId = projectState.project.id;
  const now = startOfDay(new Date());
  const result = {
    unitsCreated: 0,
    unitsUpdated: 0,
    tenantsCreated: 0,
    tenantsUpdated: 0,
    contractsCreated: 0,
    contractsUpdated: 0,
    contractsUnchanged: 0,
    contractNumberCollisionsResolved: 0,
    invalidRowsSkipped: executionPlan.summary.invalidRows
  };

  await prisma.$transaction(async (tx) => {
    const unitIdByCode = new Map();
    const tenantIdByNormalizedName = new Map();

    for (const unit of projectState.units) {
      unitIdByCode.set(unit.codigo.toUpperCase(), unit.id);
    }
    for (const tenant of projectState.tenants) {
      tenantIdByNormalizedName.set(normalizeTenantName(tenant.nombreComercial), tenant.id);
    }

    for (const unit of executionPlan.missingUnits) {
      const saved = await tx.unit.upsert({
        where: {
          proyectoId_codigo: {
            proyectoId: projectId,
            codigo: unit.codigo
          }
        },
        create: {
          proyectoId: projectId,
          codigo: unit.codigo,
          nombre: unit.nombre,
          glam2: new Prisma.Decimal(unit.glam2),
          piso: unit.piso,
          tipo: unit.tipo,
          esGLA: unit.esGLA,
          estado: unit.estado
        },
        update: {
          nombre: unit.nombre,
          glam2: new Prisma.Decimal(unit.glam2),
          piso: unit.piso,
          tipo: unit.tipo,
          esGLA: unit.esGLA,
          estado: unit.estado
        },
        select: { id: true, codigo: true }
      });
      unitIdByCode.set(saved.codigo.toUpperCase(), saved.id);
      result.unitsCreated += 1;
    }

    for (const tenant of executionPlan.missingTenants) {
      const existing = await tx.tenant.findUnique({
        where: {
          proyectoId_rut: {
            proyectoId: projectId,
            rut: tenant.rut
          }
        },
        select: { id: true }
      });

      const saved = await tx.tenant.upsert({
        where: {
          proyectoId_rut: {
            proyectoId: projectId,
            rut: tenant.rut
          }
        },
        create: {
          proyectoId: projectId,
          rut: tenant.rut,
          razonSocial: tenant.razonSocial,
          nombreComercial: tenant.nombreComercial,
          vigente: true,
          category: tenant.category
        },
        update: {
          razonSocial: tenant.razonSocial,
          nombreComercial: tenant.nombreComercial,
          vigente: true,
          category: tenant.category
        },
        select: { id: true, nombreComercial: true }
      });

      tenantIdByNormalizedName.set(normalizeTenantName(saved.nombreComercial), saved.id);
      if (existing) {
        result.tenantsUpdated += 1;
      } else {
        result.tenantsCreated += 1;
      }
    }

    for (const item of executionPlan.contractRows) {
      const { row, existing, comparison } = item;
      if (comparison.status === "UNCHANGED") {
        result.contractsUnchanged += 1;
        continue;
      }

      const localId = unitIdByCode.get(row.localCodigo);
      const tenantId = tenantIdByNormalizedName.get(normalizeTenantName(row.arrendatarioNombre));
      if (!localId || !tenantId) {
        continue;
      }

      const numeroContratoResolution = existing
        ? {
            numeroContrato: existing.numeroContrato,
            collisionResolved: false,
            collisionNote: null
          }
        : await resolveNumeroContratoForCreate(tx, projectId, row.numeroContrato);
      const data = {
        localId,
        arrendatarioId: tenantId,
        numeroContrato: numeroContratoResolution.numeroContrato,
        fechaInicio: new Date(row.fechaInicio),
        fechaTermino: new Date(row.fechaTermino),
        estado: computeEstadoContrato(
          new Date(row.fechaInicio),
          new Date(row.fechaTermino),
          0,
          ContractStatus.VIGENTE,
          now
        ),
        pctFondoPromocion: toDecimalOrNull(row.pctFondoPromocion),
        multiplicadorDiciembre: toDecimalOrNull(row.multiplicadorDiciembre),
        multiplicadorJunio: null,
        multiplicadorJulio: null,
        multiplicadorAgosto: null,
        codigoCC: null,
        notas: mergeNotes(row.notes, numeroContratoResolution.collisionNote)
      };

      let savedContractId = existing?.id ?? null;
      if (existing) {
        const saved = await tx.contract.update({
          where: { id: existing.id },
          data,
          select: { id: true }
        });
        savedContractId = saved.id;
        result.contractsUpdated += 1;
      } else {
        const saved = await tx.contract.create({
          data: {
            proyectoId: projectId,
            ...data
          },
          select: { id: true }
        });
        savedContractId = saved.id;
        result.contractsCreated += 1;
        if (numeroContratoResolution.collisionResolved) {
          result.contractNumberCollisionsResolved += 1;
        }
      }

      for (const rate of buildDesiredRateRows(row)) {
        await upsertRate(tx, savedContractId, rate);
      }
      await upsertGgcc(tx, savedContractId, row);
    }
  }, { timeout: 120000, maxWait: 10000 });

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const reportPath = buildReportPath(args.reportPath);
  const budgetRows = parseBudgetWorkbook(args.file);
  const projectState = await loadProjectState(args.project);
  const executionPlan = buildExecutionPlan(projectState, budgetRows);
  const report = {
    mode: args.apply ? "apply" : "dry-run",
    file: args.file,
    project: projectState.project,
    summary: executionPlan.summary,
    samples: executionPlan.samples,
    applied: null
  };

  if (args.apply) {
    report.applied = await applyPlan(projectState, executionPlan);
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({
    reportPath,
    mode: report.mode,
    summary: report.summary,
    applied: report.applied
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
