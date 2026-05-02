#!/usr/bin/env node

require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");
const {
  PrismaClient,
  Prisma,
  ContractRateType,
  ContractStatus,
  MasterStatus,
  UnitType
} = require("@prisma/client");

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

const MONTH_MAP = {
  enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3,
  abril: 4, abr: 4, mayo: 5, may: 5, junio: 6, jun: 6,
  julio: 7, jul: 7, agosto: 8, ago: 8,
  septiembre: 9, sept: 9, sep: 9,
  octubre: 10, oct: 10, noviembre: 11, nov: 11, diciembre: 12, dic: 12
};

function parseArgs(argv) {
  const args = {
    file: process.env.XLSX_PATH || "",
    project: "mall-sport",
    apply: false,
    includeExpired: true,
    reportPath: null,
    rows: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--apply") {
      args.apply = true;
      continue;
    }
    if (token === "--no-expired") {
      args.includeExpired = false;
      continue;
    }
    if (token === "--file") {
      args.file = argv[index + 1] || args.file;
      index += 1;
      continue;
    }
    if (token === "--project") {
      args.project = argv[index + 1] || args.project;
      index += 1;
      continue;
    }
    if (token === "--report") {
      args.reportPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (token === "--rows") {
      const rows = String(argv[index + 1] || "")
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0);
      args.rows = new Set(rows);
      index += 1;
      continue;
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

function normalizeRef(value) {
  const normalized = normalizeLabel(value);
  if (!normalized || normalized === "-") return "";
  return normalized.replace(/^C-/, "").replace(/^0+(?=\d)/, "");
}

function isEquivalentRef(left, right) {
  const a = normalizeRef(left);
  const b = normalizeRef(right);
  return Boolean(a && b && a === b);
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let normalized = asString(value);
  if (!normalized || normalized === "-") return null;
  if (/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(normalized)) return null;
  normalized = normalized.replace(/[^0-9,.\-]/g, "");
  if (!normalized || normalized === "-" || normalized === "." || normalized === ",") return null;
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercent(value) {
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
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

function toDecimal(value) {
  if (value === null || value === undefined || value === "") return null;
  return new Prisma.Decimal(String(value));
}

function dateToIso(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeDateFromDb(value) {
  return value instanceof Date ? dateToIso(value) : asString(value).slice(0, 10);
}

function inferStatus(fechaInicio, fechaTermino, today = new Date()) {
  const start = toDate(fechaInicio);
  const end = toDate(fechaTermino);
  const current = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (current < start) return ContractStatus.NO_INICIADO;
  if (current > end) return ContractStatus.TERMINADO;
  return ContractStatus.VIGENTE;
}

function mapUnitType(value) {
  const normalized = normalizeLabel(value);
  if (normalized === "LOCAL COMERCIAL") return UnitType.LOCAL_COMERCIAL;
  if (normalized === "MODULO COMERCIAL") return UnitType.MODULO;
  if (normalized === "BODEGA") return UnitType.BODEGA;
  if (normalized === "MAQUINA EXPENDEDORA") return UnitType.MAQUINA_EXPENDEDORA;
  if (normalized === "OLA") return UnitType.OLA;
  return UnitType.OTRO;
}

function deterministicRut(projectId, tenantName) {
  const hash = crypto
    .createHash("sha1")
    .update(`${projectId}|${normalizeTenantName(tenantName)}`)
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();
  return `SIN-RUT-${hash}`;
}

function deterministicContractNumber(row) {
  const source = `${row.local}|${row.tenant}|${row.fechaInicio}|${row.fechaTermino}|${row.rowNumber}`;
  const hash = crypto.createHash("sha1").update(source).digest("hex").slice(0, 8).toUpperCase();
  return `EXCEL-${hash}`;
}

function appendNote(existingNotes, note) {
  const current = asString(existingNotes);
  if (!current) return note;
  if (current.includes(note)) return current;
  return `${current} | ${note}`;
}

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function addOneDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return dateToIso(d);
}

function parseUntilDate(untilStr, fechaTermino) {
  const s = untilStr.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/^(el\s+)?termino$/.test(s)) return fechaTermino;
  const dmyMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (dmyMatch) {
    let y = parseInt(dmyMatch[3]);
    if (y < 100) y += 2000;
    return `${y}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`;
  }
  const dmonMatch = /^(\d{1,2})\s+([a-z]+)\s+(\d{2,4})$/.exec(s);
  if (dmonMatch) {
    const day = parseInt(dmonMatch[1]);
    const mon = MONTH_MAP[dmonMatch[2]];
    let y = parseInt(dmonMatch[3]);
    if (!mon) return null;
    if (y < 100) y += 2000;
    return `${y}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const monYearMatch = /^([a-z]+)\s+(\d{4})$/.exec(s);
  if (monYearMatch) {
    const mon = MONTH_MAP[monYearMatch[1]];
    const y = parseInt(monYearMatch[2]);
    if (!mon) return null;
    const lastDay = lastDayOfMonth(y, mon);
    return `${y}-${String(mon).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }
  return null;
}

// Parsea col 18 (Comentario Renta Fija) en tramos de tarifa escalonada.
// Retorna [{valor, vigenciaDesde, vigenciaHasta}, ...] o null si no es parseable.
function parseRentFijaSteps(commentStr, fechaInicio, fechaTermino) {
  if (!commentStr || !fechaInicio || !fechaTermino) return null;
  const text = asString(commentStr)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text === "-") return null;

  // Split on "/" that is outside parentheses (avoids splitting dates like 31/01/2026)
  const segments = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") depth -= 1;
    else if (text[i] === "/" && depth === 0) {
      const seg = text.slice(start, i).trim();
      if (seg) segments.push(seg);
      start = i + 1;
    }
  }
  const last = text.slice(start).trim();
  if (last) segments.push(last);
  if (segments.length < 2) return null;

  const rawSteps = [];
  for (const seg of segments) {
    const s = seg.trim();
    let valor = null;
    let untilDate = null;
    const parenMatch = /^([\d,.]+)\s*\((?:hasta\s+(?:el\s+)?)?([^)]+)\)/.exec(s);
    if (parenMatch) {
      valor = parseNumber(parenMatch[1]);
      untilDate = parseUntilDate(parenMatch[2], fechaTermino);
    } else {
      const noParenMatch = /^([\d,.]+)\s+(?:hasta\s+(?:el\s+)?)?(.+)$/.exec(s);
      if (noParenMatch) {
        valor = parseNumber(noParenMatch[1]);
        untilDate = parseUntilDate(noParenMatch[2], fechaTermino);
      }
    }
    if (valor === null || !untilDate) return null;
    rawSteps.push({ valor, until: untilDate });
  }

  if (rawSteps.length < 2) return null;

  const result = [];
  for (let i = 0; i < rawSteps.length; i += 1) {
    const desde = i === 0 ? fechaInicio : addOneDay(result[i - 1].vigenciaHasta);
    const hasta = i === rawSteps.length - 1 ? fechaTermino : rawSteps[i].until;
    if (desde > hasta) return null;
    result.push({ valor: rawSteps[i].valor, vigenciaDesde: desde, vigenciaHasta: hasta });
  }
  return result;
}

function buildReportPath(explicitPath) {
  if (explicitPath) return explicitPath;
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
  return path.join(process.cwd(), "reports", `rent-roll-excel-sync-${stamp}.json`);
}

function parseRentRoll(filePath, includeExpired) {
  const workbook = XLSX.readFile(filePath, { cellDates: true, raw: true, sheets: ["Rent Roll"] });
  const sheet = workbook.Sheets["Rent Roll"];
  if (!sheet) throw new Error("No se encontro la hoja 'Rent Roll'.");

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false
  });

  const headerIndex = rows.findIndex((row) => {
    const joined = row.map(normalizeLabel).join("|");
    return joined.includes("ID LOCAL") && joined.includes("ARRENDATARIO") && joined.includes("INICIO");
  });
  if (headerIndex < 0) throw new Error("No se encontro la fila de encabezados del Rent Roll.");

  const vencidosIndex = rows.findIndex((row) => normalizeLabel(row[1]) === "VENCIDOS");
  const otrosIndex = rows.findIndex((row) => normalizeLabel(row[1]) === "OTROS");
  const activeEnd = vencidosIndex > headerIndex ? vencidosIndex : rows.length;
  const expiredEnd = otrosIndex > activeEnd ? otrosIndex : rows.length;

  const parsedRows = [];
  const ranges = [{ section: "actual", start: headerIndex + 1, end: activeEnd }];
  if (includeExpired && vencidosIndex > headerIndex) {
    ranges.push({ section: "vencidos", start: vencidosIndex + 1, end: expiredEnd });
  }

  for (const range of ranges) {
    for (let index = range.start; index < range.end; index += 1) {
      const row = rows[index];
      if (!Array.isArray(row) || !row.some((cell) => cell !== null && cell !== "")) continue;

      const local = asString(row[1]);
      const typeLabel = normalizeLabel(row[3]);
      const tenant = asString(row[4]);
      const localKey = normalizeLocalCode(local);
      const isVacant = normalizeLabel(tenant).includes("VACANTE");
      const isSkipped =
        !localKey ||
        SKIPPED_LOCAL_CODES.has(localKey) ||
        (typeLabel && !SUPPORTED_TYPES.has(typeLabel));

      parsedRows.push({
        rowNumber: index + 1,
        section: range.section,
        local,
        localKey,
        ref: asString(row[2]),
        refKey: normalizeRef(row[2]),
        tipo: asString(row[3]),
        typeLabel,
        tenant,
        tenantKey: normalizeTenantName(tenant),
        gla: parseNumber(row[5]),
        fechaInicio: parseDate(row[6]),
        fechaTermino: parseDate(row[7]),
        ggccBaseUfM2: parseNumber(row[10]),
        ggccAdminPct: parsePercent(row[9]),
        ggccReajustePct: parsePercent(row[11]),
        ggccMesesReajuste: parseNumber(row[12]),
        variablePct: parsePercent(row[15]),
        fixedUfM2: parseNumber(row[17]),
        rentaFijaComment: asString(row[18]),
        diciembre: parseNumber(row[19]),
        fondoPct: parsePercent(row[21]),
        sizeCategory: asString(row[23]),
        typeCategory: asString(row[24]),
        glaAplica: asString(row[26]),
        piso: asString(row[27]),
        idData: asString(row[28]),
        isVacant,
        isSkipped
      });
    }
  }

  return { rows: parsedRows, headerRow: headerIndex + 1 };
}

function makeContractInput(row, sourceRefCounts) {
  const issues = [];
  if (row.isSkipped) issues.push("fila omitida por tipo/local no soportado");
  if (row.isVacant) issues.push("fila VACANTE no crea contrato");
  if (!row.localKey) issues.push("sin local");
  if (!row.tenantKey) issues.push("sin arrendatario");
  if (!row.fechaInicio) issues.push("sin fecha inicio");
  if (!row.fechaTermino) issues.push("sin fecha termino");
  if (row.fechaInicio && row.fechaTermino && row.fechaInicio > row.fechaTermino) {
    issues.push("fecha inicio posterior a termino");
  }

  if (issues.length > 0) {
    return { issues, input: null };
  }

  const refIsUniqueInExcel = row.refKey && (sourceRefCounts.get(row.refKey) || 0) === 1;
  return {
    issues,
    input: {
      rowNumber: row.rowNumber,
      sourceSection: row.section,
      sourceRef: row.refKey || null,
      numeroContrato: refIsUniqueInExcel ? row.refKey : deterministicContractNumber(row),
      localCodigo: row.localKey,
      localNombre: row.local || row.localKey,
      localTipo: mapUnitType(row.tipo),
      localGla: row.gla ?? 0,
      localPiso: row.piso || "",
      localEsGla: normalizeLabel(row.glaAplica) === "GLA",
      tenantName: row.tenant,
      fechaInicio: row.fechaInicio,
      fechaTermino: row.fechaTermino,
      fixedUfM2: row.fixedUfM2,
      rentaFijaSteps: parseRentFijaSteps(row.rentaFijaComment, row.fechaInicio, row.fechaTermino) || null,
      variablePct: row.variablePct,
      ggccBaseUfM2: row.ggccBaseUfM2,
      ggccAdminPct: row.ggccAdminPct,
      ggccReajustePct: row.ggccReajustePct,
      ggccMesesReajuste: row.ggccMesesReajuste,
      diciembre: row.diciembre,
      fondoPct: row.fondoPct,
      notas: `Origen Excel Rent Roll fila ${row.rowNumber}${row.refKey ? ` REF CA ${row.refKey}` : ""}`
    }
  };
}

async function loadProject(projectSlug) {
  const project = await prisma.project.findFirst({
    where: { slug: projectSlug },
    select: { id: true, nombre: true, slug: true }
  });
  if (!project) throw new Error(`No existe el proyecto '${projectSlug}'.`);
  return project;
}

async function loadExisting(projectId) {
  const [units, tenants, contracts] = await Promise.all([
    prisma.unit.findMany({
      where: { projectId },
      select: { id: true, codigo: true, nombre: true, glam2: true, tipo: true, piso: true, esGLA: true }
    }),
    prisma.tenant.findMany({
      where: { projectId },
      select: { id: true, rut: true, razonSocial: true, nombreComercial: true }
    }),
    prisma.contract.findMany({
      where: { projectId },
      include: {
        local: { select: { id: true, codigo: true } },
        arrendatario: { select: { id: true, nombreComercial: true } },
        tarifas: true,
        ggcc: true
      }
    })
  ]);

  const unitsByCode = new Map(units.map((unit) => [normalizeLocalCode(unit.codigo), unit]));
  const tenantsByName = new Map();
  for (const tenant of tenants) {
    const key = normalizeTenantName(tenant.nombreComercial);
    if (!key) continue;
    const list = tenantsByName.get(key) || [];
    list.push(tenant);
    tenantsByName.set(key, list);
  }

  return { units, tenants, contracts, unitsByCode, tenantsByName };
}

function findContract(input, existing, sourceRefCounts) {
  const local = existing.unitsByCode.get(input.localCodigo);
  const tenantMatches = existing.tenantsByName.get(normalizeTenantName(input.tenantName)) || [];
  const tenantIds = new Set(tenantMatches.map((tenant) => tenant.id));
  const excelRefIsDuplicated = input.sourceRef && (sourceRefCounts.get(input.sourceRef) || 0) > 1;

  if (local && tenantIds.size > 0) {
    const natural = existing.contracts.find(
      (contract) =>
        contract.localId === local.id &&
        tenantIds.has(contract.arrendatarioId) &&
        dateToIso(contract.fechaInicio) === input.fechaInicio &&
        dateToIso(contract.fechaTermino) === input.fechaTermino
    );
    if (natural) return { contract: natural, matchType: "natural" };
  }

  if (input.sourceRef && !excelRefIsDuplicated) {
    const byRefSameLocal = existing.contracts.find(
      (contract) =>
        isEquivalentRef(contract.numeroContrato, input.sourceRef) &&
        (!local || contract.localId === local.id)
    );
    if (byRefSameLocal) return { contract: byRefSameLocal, matchType: "ref_local" };
  }

  if (local && tenantIds.size > 0) {
    const byLocalTenant = existing.contracts.find(
      (contract) => contract.localId === local.id && tenantIds.has(contract.arrendatarioId)
    );
    if (byLocalTenant) return { contract: byLocalTenant, matchType: "local_tenant" };
  }

  return { contract: null, matchType: null };
}

async function ensureUnit(tx, projectId, input, existing, report) {
  const current = existing.unitsByCode.get(input.localCodigo);
  if (current) return current;

  const created = await tx.unit.create({
    data: {
      projectId,
      codigo: input.localCodigo,
      nombre: input.localNombre || input.localCodigo,
      glam2: new Prisma.Decimal(input.localGla || 0),
      piso: input.localPiso || "",
      tipo: input.localTipo,
      esGLA: input.localEsGla,
      estado: MasterStatus.ACTIVO
    }
  });
  existing.unitsByCode.set(input.localCodigo, created);
  existing.units.push(created);
  report.createdUnits.push({ codigo: created.codigo, nombre: created.nombre, rowNumber: input.rowNumber });
  return created;
}

async function ensureTenant(tx, projectId, input, existing, report) {
  const key = normalizeTenantName(input.tenantName);
  const current = existing.tenantsByName.get(key) || [];
  if (current.length === 1) return current[0];
  if (current.length > 1) {
    report.blockedRows.push({
      rowNumber: input.rowNumber,
      local: input.localCodigo,
      tenant: input.tenantName,
      reason: "arrendatario ambiguo en base de datos"
    });
    return null;
  }

  const created = await tx.tenant.create({
    data: {
      projectId,
      rut: deterministicRut(projectId, input.tenantName),
      razonSocial: input.tenantName,
      nombreComercial: input.tenantName,
      vigente: true
    }
  });
  existing.tenantsByName.set(key, [created]);
  existing.tenants.push(created);
  report.createdTenants.push({ nombreComercial: created.nombreComercial, rut: created.rut, rowNumber: input.rowNumber });
  return created;
}

async function uniqueContractNumber(tx, projectId, requested, existingContractId) {
  let base = normalizeLabel(requested).replace(/^C-/, "");
  if (!base || base === "-") base = crypto.randomUUID().slice(0, 8).toUpperCase();

  const candidates = [base, `C-${base}`];
  for (const candidate of candidates) {
    const found = await tx.contract.findUnique({
      where: { projectId_numeroContrato: { projectId, numeroContrato: candidate } },
      select: { id: true }
    });
    if (!found || found.id === existingContractId) return candidate;
  }

  for (let attempt = 1; attempt < 100; attempt += 1) {
    const candidate = `${base}-${attempt}`;
    const found = await tx.contract.findUnique({
      where: { projectId_numeroContrato: { projectId, numeroContrato: candidate } },
      select: { id: true }
    });
    if (!found || found.id === existingContractId) return candidate;
  }

  return crypto.randomUUID().slice(0, 8).toUpperCase();
}

function fitsDecimal(value, integerDigits, scale) {
  void scale;
  if (value === null || value === undefined || value === "") return true;
  const number = Number(value);
  if (!Number.isFinite(number)) return false;
  return Math.abs(number) < 10 ** integerDigits;
}

async function syncRate(tx, contratoId, tipo, valor, desde, hasta, extra = {}) {
  const { report, source, ...rateExtra } = extra;
  if (valor === null || valor === undefined || !desde) return null;
  if (!fitsDecimal(valor, 6, 4)) {
    if (report) {
      report.skippedRates.push({
        ...(source || {}),
        tipo,
        valor,
        reason: "valor fuera de rango para ContractRate.valor decimal(10,4)"
      });
    }
    return null;
  }

  // Only consider ACTIVE rows. Bitemporal supersession: when values change we
  // mark the existing active row as superseded and insert a fresh one. Without
  // this, the GIST anti-overlap constraint on ContratoTarifa rejects re-runs
  // of the sync that try to in-place UPDATE rows whose range conflicts with
  // another active row in the same logical group.
  // Existing PORCENTAJE rates may have umbralVentasUf=NULL while the sync passes
  // Decimal(0). The DB exclusion constraint uses COALESCE(umbralVentasUf,0) so
  // both are equivalent. We must match either NULL or 0 to find and supersede
  // the old row before inserting the new one.
  const umbralDecimal = rateExtra.umbralVentasUf === undefined ? undefined : toDecimal(rateExtra.umbralVentasUf);
  const umbralWhere =
    umbralDecimal === undefined
      ? {}
      : umbralDecimal === null || umbralDecimal.isZero()
        ? { OR: [{ umbralVentasUf: null }, { umbralVentasUf: new Prisma.Decimal(0) }] }
        : { umbralVentasUf: umbralDecimal };

  const existing = await tx.contractRate.findFirst({
    where: {
      contratoId,
      supersededAt: null,
      tipo,
      vigenciaDesde: toDate(desde),
      ...umbralWhere
    }
  });

  const data = {
    tipo,
    valor: toDecimal(valor),
    vigenciaDesde: toDate(desde),
    vigenciaHasta: hasta ? toDate(hasta) : null,
    esDiciembre: false,
    ...rateExtra
  };

  if (existing) {
    const sameValor = existing.valor.equals(data.valor);
    const sameHasta =
      (existing.vigenciaHasta === null && data.vigenciaHasta === null) ||
      (existing.vigenciaHasta !== null &&
        data.vigenciaHasta !== null &&
        existing.vigenciaHasta.toISOString().slice(0, 10) === data.vigenciaHasta.toISOString().slice(0, 10));
    if (sameValor && sameHasta) {
      return existing;
    }
    await tx.contractRate.update({
      where: { id: existing.id },
      data: {
        supersededAt: new Date(),
        supersedeReason: "rent-roll excel sync"
      }
    });
  }

  return tx.contractRate.create({ data: { contratoId, ...data } });
}

async function syncGgcc(tx, contratoId, input) {
  if (input.ggccBaseUfM2 === null || input.ggccBaseUfM2 === undefined) return null;
  const admin = input.ggccAdminPct ?? 0;
  // Only consider ACTIVE rows; same supersession pattern as syncRate.
  const existing = await tx.contractCommonExpense.findFirst({
    where: { contratoId, supersededAt: null }
  });
  const data = {
    tarifaBaseUfM2: toDecimal(input.ggccBaseUfM2),
    pctAdministracion: toDecimal(admin),
    pctReajuste: toDecimal(input.ggccReajustePct),
    vigenciaDesde: toDate(input.fechaInicio),
    vigenciaHasta: toDate(input.fechaTermino),
    proximoReajuste: null,
    mesesReajuste:
      input.ggccMesesReajuste !== null && input.ggccMesesReajuste !== undefined
        ? Math.trunc(input.ggccMesesReajuste)
        : null
  };

  if (existing) {
    const decEq = (a, b) => (a === null && b === null) || (a !== null && b !== null && a.equals(b));
    const dateEq = (a, b) =>
      (a === null && b === null) ||
      (a !== null && b !== null && a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10));
    const matches =
      existing.tarifaBaseUfM2.equals(data.tarifaBaseUfM2) &&
      existing.pctAdministracion.equals(data.pctAdministracion) &&
      decEq(existing.pctReajuste, data.pctReajuste) &&
      dateEq(existing.vigenciaDesde, data.vigenciaDesde) &&
      dateEq(existing.vigenciaHasta, data.vigenciaHasta) &&
      (existing.mesesReajuste ?? null) === (data.mesesReajuste ?? null);
    if (matches) {
      return existing;
    }
    await tx.contractCommonExpense.update({
      where: { id: existing.id },
      data: {
        supersededAt: new Date(),
        supersedeReason: "rent-roll excel sync"
      }
    });
  }

  return tx.contractCommonExpense.create({ data: { contratoId, ...data } });
}

async function syncAllRates(tx, contratoId, tipo, steps, input, report) {
  const newDates = new Set(steps.map((s) => toDate(s.vigenciaDesde).toISOString()));

  // Supersede orphaned active rates BEFORE inserting new steps.
  // Pre-existing rates with vigenciaDesde values not in the new schedule would
  // otherwise overlap with the new inserts and trigger the exclusion constraint.
  const allActive = await tx.contractRate.findMany({
    where: { contratoId, tipo, supersededAt: null }
  });
  for (const orphan of allActive) {
    if (!newDates.has(orphan.vigenciaDesde.toISOString())) {
      await tx.contractRate.update({
        where: { id: orphan.id },
        data: { supersededAt: new Date(), supersedeReason: "rent-roll excel sync - orphaned step" }
      });
    }
  }

  for (const step of steps) {
    await syncRate(tx, contratoId, tipo, step.valor, step.vigenciaDesde, step.vigenciaHasta, {
      report,
      source: { rowNumber: input.rowNumber, local: input.localCodigo, tenant: input.tenantName }
    });
  }
}

async function supersedePriorSteps(tx, contratoId, tipo, keepDesde) {
  const keepIso = toDate(keepDesde).toISOString();
  const active = await tx.contractRate.findMany({ where: { contratoId, tipo, supersededAt: null } });
  for (const r of active) {
    if (r.vigenciaDesde.toISOString() !== keepIso) {
      await tx.contractRate.update({
        where: { id: r.id },
        data: { supersededAt: new Date(), supersedeReason: "rent-roll excel sync - orphaned step" }
      });
    }
  }
}

async function applyInput(tx, projectId, input, existing, sourceRefCounts, report) {
  const unit = await ensureUnit(tx, projectId, input, existing, report);
  const tenant = await ensureTenant(tx, projectId, input, existing, report);
  if (!tenant) return null;

  const found = findContract(input, existing, sourceRefCounts);
  const status = inferStatus(input.fechaInicio, input.fechaTermino);
  const note = input.notas;

  let contract;
  if (found.contract) {
    contract = await tx.contract.update({
      where: { id: found.contract.id },
      data: {
        localId: unit.id,
        arrendatarioId: tenant.id,
        fechaInicio: toDate(input.fechaInicio),
        fechaTermino: toDate(input.fechaTermino),
        estado: status,
        pctFondoPromocion: toDecimal(input.fondoPct),
        multiplicadorDiciembre: toDecimal(input.diciembre),
        notas: appendNote(found.contract.notas, note)
      }
    });
    report.updatedContracts.push({
      rowNumber: input.rowNumber,
      numeroContrato: contract.numeroContrato,
      local: input.localCodigo,
      tenant: input.tenantName,
      matchType: found.matchType
    });
    Object.assign(found.contract, {
      ...contract,
      local: { id: unit.id, codigo: unit.codigo },
      arrendatario: { id: tenant.id, nombreComercial: tenant.nombreComercial }
    });
  } else {
    const numeroContrato = await uniqueContractNumber(tx, projectId, input.numeroContrato, null);
    contract = await tx.contract.create({
      data: {
        projectId,
        localId: unit.id,
        arrendatarioId: tenant.id,
        numeroContrato,
        fechaInicio: toDate(input.fechaInicio),
        fechaTermino: toDate(input.fechaTermino),
        estado: status,
        pctFondoPromocion: toDecimal(input.fondoPct),
        multiplicadorDiciembre: toDecimal(input.diciembre),
        notas: note
      }
    });
    report.createdContracts.push({
      rowNumber: input.rowNumber,
      numeroContrato,
      local: input.localCodigo,
      tenant: input.tenantName,
      status
    });
    existing.contracts.push({
      ...contract,
      local: { id: unit.id, codigo: unit.codigo },
      arrendatario: { id: tenant.id, nombreComercial: tenant.nombreComercial },
      tarifas: [],
      ggcc: []
    });
  }

  if (input.rentaFijaSteps) {
    await syncAllRates(tx, contract.id, ContractRateType.FIJO_UF_M2, input.rentaFijaSteps, input, report);
  } else if (input.fixedUfM2 !== null && input.fixedUfM2 !== undefined) {
    // No escalation schedule: this is a single full-period rate. Supersede any
    // orphaned multi-step rates (different vigenciaDesde) from a previous sync
    // before inserting — otherwise the exclusion constraint fires.
    await supersedePriorSteps(tx, contract.id, ContractRateType.FIJO_UF_M2, input.fechaInicio);
    await syncRate(tx, contract.id, ContractRateType.FIJO_UF_M2, input.fixedUfM2, input.fechaInicio, input.fechaTermino, {
      report,
      source: { rowNumber: input.rowNumber, local: input.localCodigo, tenant: input.tenantName }
    });
  }

  if (input.variablePct !== null && input.variablePct !== undefined) {
    await supersedePriorSteps(tx, contract.id, ContractRateType.PORCENTAJE, input.fechaInicio);
    await syncRate(tx, contract.id, ContractRateType.PORCENTAJE, input.variablePct, input.fechaInicio, input.fechaTermino, {
      umbralVentasUf: new Prisma.Decimal(0),
      report,
      source: { rowNumber: input.rowNumber, local: input.localCodigo, tenant: input.tenantName }
    });
  }

  await syncGgcc(tx, contract.id, input);
  return contract;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) throw new Error("Debes indicar --file o XLSX_PATH.");

  const reportPath = buildReportPath(args.reportPath);
  const parsed = parseRentRoll(args.file, args.includeExpired);
  const sourceRefCounts = new Map();
  for (const row of parsed.rows) {
    if (!row.refKey) continue;
    sourceRefCounts.set(row.refKey, (sourceRefCounts.get(row.refKey) || 0) + 1);
  }

  const project = await loadProject(args.project);
  const existing = await loadExisting(project.id);
  const report = {
    mode: args.apply ? "apply" : "dry-run",
    file: args.file,
    project,
    headerRow: parsed.headerRow,
    includeExpired: args.includeExpired,
    summary: {
      sourceRows: parsed.rows.length,
      candidateContracts: 0,
      vacantRows: 0,
      skippedRows: 0,
      blockedRows: 0,
      wouldCreateContracts: 0,
      wouldUpdateContracts: 0,
      createdContracts: 0,
      updatedContracts: 0,
      createdUnits: 0,
      createdTenants: 0,
      skippedRates: 0,
      applyErrors: 0
    },
    createdUnits: [],
    createdTenants: [],
    createdContracts: [],
    updatedContracts: [],
    wouldCreateContracts: [],
    wouldUpdateContracts: [],
    skippedRates: [],
    applyErrors: [],
    blockedRows: [],
    skippedRows: []
  };

  const inputs = [];
  for (const row of parsed.rows) {
    if (args.rows && !args.rows.has(row.rowNumber)) continue;
    if (row.isVacant) report.summary.vacantRows += 1;
    const normalized = makeContractInput(row, sourceRefCounts);
    if (!normalized.input) {
      const item = {
        rowNumber: row.rowNumber,
        section: row.section,
        local: row.local,
        tenant: row.tenant,
        ref: row.ref,
        reasons: normalized.issues
      };
      if (row.isVacant || row.isSkipped) {
        report.skippedRows.push(item);
        report.summary.skippedRows += 1;
      } else {
        report.blockedRows.push(item);
        report.summary.blockedRows += 1;
      }
      continue;
    }
    report.summary.candidateContracts += 1;
    inputs.push(normalized.input);
  }

  for (const input of inputs) {
    const found = findContract(input, existing, sourceRefCounts);
    const target = {
      rowNumber: input.rowNumber,
      local: input.localCodigo,
      tenant: input.tenantName,
      sourceRef: input.sourceRef,
      numeroContrato: found.contract?.numeroContrato || input.numeroContrato,
      matchType: found.matchType
    };
    if (found.contract) {
      report.wouldUpdateContracts.push(target);
      report.summary.wouldUpdateContracts += 1;
    } else {
      report.wouldCreateContracts.push(target);
      report.summary.wouldCreateContracts += 1;
    }
  }

  if (args.apply) {
    for (const input of inputs) {
      try {
        await prisma.$transaction(
          async (tx) => {
            await applyInput(tx, project.id, input, existing, sourceRefCounts, report);
          },
          { timeout: 30000, maxWait: 10000 }
        );
      } catch (error) {
        report.applyErrors.push({
          rowNumber: input.rowNumber,
          local: input.localCodigo,
          tenant: input.tenantName,
          sourceRef: input.sourceRef,
          message: error.message
        });
      }
    }
    report.summary.createdContracts = report.createdContracts.length;
    report.summary.updatedContracts = report.updatedContracts.length;
    report.summary.createdUnits = report.createdUnits.length;
    report.summary.createdTenants = report.createdTenants.length;
    report.summary.skippedRates = report.skippedRates.length;
    report.summary.applyErrors = report.applyErrors.length;
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        reportPath,
        mode: report.mode,
        summary: report.summary
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
