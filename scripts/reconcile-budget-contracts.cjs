#!/usr/bin/env node

require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { PrismaClient, ContractStatus } = require("@prisma/client");

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

function parseArgs(argv) {
  const args = {
    file: DEFAULT_FILE,
    project: "mall-sport",
    period: "2026-04",
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
    if (token === "--period") {
      args.period = argv[index + 1] ?? args.period;
      index += 1;
      continue;
    }
    if (token === "--report") {
      args.reportPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
  }

  return args;
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

function normalizeTenantBase(value) {
  return normalizeTenantName(value).replace(/^bodega\s+/, "");
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

function normalizeDecimal(value) {
  const normalized = asString(value);
  if (!normalized || normalized === "-") {
    return null;
  }
  const parsed = Number(normalized.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Number(parsed.toFixed(6));
}

function monthBounds(period) {
  const [year, month] = period.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}

function previousDay(date) {
  return new Date(date.getTime() - 24 * 60 * 60 * 1000);
}

function monthActive(fechaInicio, fechaTermino, period) {
  const { start, end } = monthBounds(period);
  return new Date(fechaInicio) <= end && new Date(fechaTermino) >= start;
}

function normalizeContractNumber(numeroContrato) {
  return asString(numeroContrato).toUpperCase();
}

function sameContractNumber(left, right) {
  const normalizedLeft = normalizeContractNumber(left);
  const normalizedRight = normalizeContractNumber(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft === `C-${normalizedRight}` ||
    `C-${normalizedLeft}` === normalizedRight
  );
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
  return path.join(process.cwd(), "reports", `budget-contract-reconcile-${stamp}.json`);
}

function parseWorkbookState(filePath, period) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets["Rent Roll"];
  if (!sheet) {
    throw new Error("No se encontro la hoja 'Rent Roll' en el archivo.");
  }

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    range: RENT_ROLL_HEADER_ROW_INDEX
  });

  const states = new Map();

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!Array.isArray(row) || !row.some((cell) => cell !== null && cell !== "")) {
      continue;
    }

    const rowNumber = RENT_ROLL_DATA_ROW_INDEX + index + 1;
    const localCodigo = asString(row[1]).toUpperCase();
    const tipo = normalizeLabel(row[3]);
    const arrendatarioNombre = asString(row[4]);
    const fechaInicio = parseDate(row[6]);
    const fechaTermino = parseDate(row[7]);
    const numeroContrato = asString(row[2]);
    const isVacancy = normalizeLabel(arrendatarioNombre).includes("VACANTE");
    const isSkipped =
      !localCodigo ||
      SKIPPED_LOCAL_CODES.has(normalizeLabel(localCodigo)) ||
      !SUPPORTED_TYPES.has(tipo);

    if (isSkipped) {
      continue;
    }

    const previous = states.get(localCodigo) ?? {
      localCodigo,
      activeRow: null,
      vacancyRows: [],
      inactiveRows: [],
      invalidRows: []
    };

    const rowData = {
      rowNumber,
      localCodigo,
      arrendatarioNombre,
      numeroContrato,
      fechaInicio,
      fechaTermino
    };

    if (isVacancy) {
      previous.vacancyRows.push(rowData);
      states.set(localCodigo, previous);
      continue;
    }

    if (!fechaInicio || !fechaTermino) {
      previous.invalidRows.push(rowData);
      states.set(localCodigo, previous);
      continue;
    }

    if (monthActive(fechaInicio, fechaTermino, period)) {
      previous.activeRow = rowData;
      states.set(localCodigo, previous);
      continue;
    }

    previous.inactiveRows.push(rowData);
    states.set(localCodigo, previous);
  }

  return states;
}

async function loadProjectContracts(projectSlug, period) {
  const project = await prisma.project.findFirst({
    where: { slug: projectSlug },
    select: { id: true, nombre: true, slug: true }
  });
  if (!project) {
    throw new Error(`No existe el proyecto '${projectSlug}'.`);
  }

  const { start } = monthBounds(period);
  const activeContracts = await prisma.contract.findMany({
    where: {
      proyectoId: project.id,
      fechaInicio: { lte: start },
      fechaTermino: { gte: start },
      estado: { in: [ContractStatus.VIGENTE, ContractStatus.GRACIA] }
    },
    include: {
      local: { select: { codigo: true } },
      arrendatario: { select: { nombreComercial: true, rut: true } },
      tarifas: {
        orderBy: [{ tipo: "asc" }, { vigenciaDesde: "asc" }],
        select: {
          id: true,
          tipo: true,
          valor: true,
          vigenciaDesde: true,
          vigenciaHasta: true
        }
      },
      ggcc: {
        orderBy: { vigenciaDesde: "asc" },
        select: {
          id: true,
          vigenciaDesde: true,
          vigenciaHasta: true
        }
      }
    },
    orderBy: [{ localId: "asc" }, { updatedAt: "desc" }]
  });

  return { project, activeContracts };
}

function scoreContractAgainstBudget(contract, budgetRow) {
  if (!budgetRow) {
    return 0;
  }

  let score = 0;
  if (normalizeTenantName(contract.arrendatario.nombreComercial) === normalizeTenantName(budgetRow.arrendatarioNombre)) {
    score += 100;
  } else if (normalizeTenantBase(contract.arrendatario.nombreComercial) === normalizeTenantBase(budgetRow.arrendatarioNombre)) {
    score += 35;
  }
  if (sameContractNumber(contract.numeroContrato, budgetRow.numeroContrato)) {
    score += 45;
  }
  if (contract.fechaInicio.toISOString().slice(0, 10) === budgetRow.fechaInicio) {
    score += 30;
  }
  if (contract.fechaTermino.toISOString().slice(0, 10) === budgetRow.fechaTermino) {
    score += 30;
  }
  return score;
}

function chooseKeeper(contracts, budgetState) {
  if (contracts.length === 1) {
    return { keeper: contracts[0], ranking: [{ contractId: contracts[0].id, score: 0 }] };
  }

  const ranking = contracts
    .map((contract) => ({
      contract,
      score: scoreContractAgainstBudget(contract, budgetState?.activeRow),
      updatedAt: contract.updatedAt.getTime()
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.updatedAt !== left.updatedAt) return right.updatedAt - left.updatedAt;
      return right.contract.fechaTermino.getTime() - left.contract.fechaTermino.getTime();
    });

  return {
    keeper: ranking[0]?.contract ?? null,
    ranking: ranking.map((entry) => ({
      contractId: entry.contract.id,
      numeroContrato: entry.contract.numeroContrato,
      tenant: entry.contract.arrendatario.nombreComercial,
      score: entry.score
    }))
  };
}

function buildActions(activeContracts, workbookStates, period) {
  const byLocal = new Map();
  for (const contract of activeContracts) {
    const key = contract.local.codigo.toUpperCase();
    const list = byLocal.get(key) ?? [];
    list.push(contract);
    byLocal.set(key, list);
  }

  const { start } = monthBounds(period);
  const cutoffDate = previousDay(start);
  const actions = [];

  for (const [localCodigo, contracts] of byLocal.entries()) {
    const budgetState = workbookStates.get(localCodigo) ?? {
      localCodigo,
      activeRow: null,
      vacancyRows: [],
      inactiveRows: [],
      invalidRows: []
    };

    if (budgetState.activeRow) {
      const { keeper, ranking } = chooseKeeper(contracts, budgetState);
      if (!keeper) {
        continue;
      }

      for (const contract of contracts) {
        if (contract.id === keeper.id) {
          actions.push({
            type: "KEEP",
            localCodigo,
            contractId: contract.id,
            numeroContrato: contract.numeroContrato,
            tenant: contract.arrendatario.nombreComercial,
            reason: "matches_budget_active",
            ranking
          });
          continue;
        }

        const sameTenant =
          normalizeTenantBase(contract.arrendatario.nombreComercial) ===
          normalizeTenantBase(keeper.arrendatario.nombreComercial);
        const sameStart =
          contract.fechaInicio.toISOString().slice(0, 10) === keeper.fechaInicio.toISOString().slice(0, 10);

        actions.push({
          type: sameTenant && sameStart ? "DELETE" : "TERMINATE",
          localCodigo,
          contractId: contract.id,
          numeroContrato: contract.numeroContrato,
          tenant: contract.arrendatario.nombreComercial,
          keeperContractId: keeper.id,
          keeperNumeroContrato: keeper.numeroContrato,
          keeperTenant: keeper.arrendatario.nombreComercial,
          cutoffDate: cutoffDate.toISOString().slice(0, 10),
          reason: sameTenant && sameStart ? "duplicate_active_same_origin" : "active_conflict_budget_prefers_other",
          ranking
        });
      }
      continue;
    }

    if (budgetState.vacancyRows.length > 0 || budgetState.inactiveRows.length > 0 || budgetState.invalidRows.length > 0) {
      for (const contract of contracts) {
        actions.push({
          type: "TERMINATE",
          localCodigo,
          contractId: contract.id,
          numeroContrato: contract.numeroContrato,
          tenant: contract.arrendatario.nombreComercial,
          cutoffDate: cutoffDate.toISOString().slice(0, 10),
          reason:
            budgetState.vacancyRows.length > 0
              ? "budget_marks_vacant"
              : budgetState.invalidRows.length > 0
                ? "budget_has_no_valid_active_row"
                : "budget_has_only_inactive_rows"
        });
      }
    }
  }

  return actions;
}

async function applyActions(projectId, actions) {
  const result = {
    deletedContracts: 0,
    terminatedContracts: 0
  };

  await prisma.$transaction(async (tx) => {
    for (const action of actions) {
      if (action.type === "KEEP") {
        continue;
      }

      if (action.type === "DELETE") {
        await tx.contract.delete({
          where: { id: action.contractId }
        });
        result.deletedContracts += 1;
        continue;
      }

      const cutoffDate = new Date(`${action.cutoffDate}T00:00:00.000Z`);
      await tx.contract.update({
        where: { id: action.contractId },
        data: {
          fechaTermino: cutoffDate,
          estado: ContractStatus.TERMINADO,
          notas: [
            action.reason === "budget_marks_vacant"
              ? `Ajustado por conciliacion con presupuesto ${action.cutoffDate}: local vacante`
              : `Ajustado por conciliacion con presupuesto ${action.cutoffDate}`
          ]
            .concat([])
            .join(" | ")
        }
      });

      await tx.contractRate.updateMany({
        where: {
          contratoId: action.contractId,
          OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gt: cutoffDate } }]
        },
        data: {
          vigenciaHasta: cutoffDate
        }
      });

      await tx.contractCommonExpense.updateMany({
        where: {
          contratoId: action.contractId,
          OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gt: cutoffDate } }]
        },
        data: {
          vigenciaHasta: cutoffDate
        }
      });

      result.terminatedContracts += 1;
    }
  }, { timeout: 120000, maxWait: 10000 });

  void projectId;
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const reportPath = buildReportPath(args.reportPath);
  const workbookStates = parseWorkbookState(args.file, args.period);
  const { project, activeContracts } = await loadProjectContracts(args.project, args.period);
  const actions = buildActions(activeContracts, workbookStates, args.period);

  const summary = actions.reduce(
    (acc, action) => {
      acc.total += 1;
      if (action.type === "KEEP") acc.keep += 1;
      if (action.type === "DELETE") acc.delete += 1;
      if (action.type === "TERMINATE") acc.terminate += 1;
      return acc;
    },
    { total: 0, keep: 0, delete: 0, terminate: 0 }
  );

  const report = {
    mode: args.apply ? "apply" : "dry-run",
    project,
    period: args.period,
    file: args.file,
    summary,
    actions,
    applied: null
  };

  if (args.apply) {
    report.applied = await applyActions(project.id, actions);
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(
    JSON.stringify(
      {
        reportPath,
        mode: report.mode,
        summary: report.summary,
        applied: report.applied
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
