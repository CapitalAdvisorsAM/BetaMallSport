export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { buildArrendatariosActiveContractWhere, buildArrendatariosWhere, parseVigenteFilter } from "@/lib/rent-roll/tenants";
import { buildLocalesWhere, parseLocalesEstado } from "@/lib/rent-roll/units";
import { getOptionalBooleanSearchParam } from "@/lib/http/request";
import { getRequestId, logDuration, logError } from "@/lib/observability";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { type ExportDataset, type ExportScope, isExportDataset, isExportScope } from "@/lib/export/shared";
import { buildExcelWorkbookBuffer, createExcelDownloadResponse, type ExportSheet } from "@/lib/export/xlsx";

type ExportResult = {
  fileName: string;
  sheets: ExportSheet[];
};

const EXPORT_MAX_ROWS = 5000;

const GRUPOS_COSTO = new Set([
  "VACANCIA G.C. + CONTRIBUCIONES",
  "GASTOS MARKETING",
  "GASTOS INMOBILIARIA",
  "DEPRECIACION",
  "EDI",
  "IMPUESTOS",
  "RESULTADO NO OPERACIONAL"
]);

function ensureProyectoId(dataset: ExportDataset, rawProyectoId: string | null): string {
  if (dataset === "proyectos") {
    return "";
  }
  const proyectoId = rawProyectoId?.trim() ?? "";
  if (!proyectoId) {
    throw new ApiError(400, "proyectoId es obligatorio para este dataset.");
  }
  return proyectoId;
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

function formatDateIso(value: Date | null): string {
  if (!value) {
    return "";
  }
  return value.toISOString().slice(0, 10);
}

function applyExportRowCap(sheets: ExportSheet[], maxRows: number): ExportSheet[] {
  let truncatedRows = 0;
  const cappedSheets = sheets.map((sheet) => {
    if (sheet.rows.length <= maxRows) {
      return sheet;
    }
    truncatedRows += sheet.rows.length - maxRows;
    return {
      ...sheet,
      rows: sheet.rows.slice(0, maxRows)
    };
  });

  if (truncatedRows === 0) {
    return cappedSheets;
  }

  return [
    ...cappedSheets,
    {
      name: "Meta",
      headers: ["Clave", "Valor"],
      rows: [
        ["RowsCap", maxRows],
        ["RowsTruncated", truncatedRows]
      ]
    }
  ];
}

function asNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "object" && value !== null && "toString" in value) {
    const parsed = Number((value as { toString: () => string }).toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getMonthBounds(date: Date): { start: Date; nextMonthStart: Date } {
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    nextMonthStart: new Date(Date.UTC(year, monthIndex + 1, 1))
  };
}

async function buildProyectosExport(scope: ExportScope): Promise<ExportResult> {
  const projects = await prisma.project.findMany({
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    select: {
      nombre: true,
      slug: true,
      color: true,
      activo: true
    }
  });

  return {
    fileName: `proyectos-${scope}-${dateStamp()}`,
    sheets: [
      {
        name: "Proyectos",
        headers: ["Nombre", "Slug", "Color", "Estado"],
        rows: projects.map((project) => [
          project.nombre,
          project.slug,
          project.color,
          project.activo ? "Activo" : "Inactivo"
        ])
      }
    ]
  };
}

async function buildLocalesExport(
  scope: ExportScope,
  proyectoId: string,
  searchParams: URLSearchParams
): Promise<ExportResult> {
  const q = scope === "filtered" ? (searchParams.get("q")?.trim() ?? "") : "";
  const estado =
    scope === "filtered" ? parseLocalesEstado(searchParams.get("estado") ?? undefined) : undefined;

  const where =
    scope === "filtered"
      ? buildLocalesWhere(proyectoId, { q, estado })
      : ({ proyectoId } satisfies Prisma.UnitWhereInput);

  const locales = await prisma.unit.findMany({
    where,
    orderBy: [{ piso: "asc" }, { codigo: "asc" }],
    select: {
      codigo: true,
      nombre: true,
      tipo: true,
      piso: true,
      zona: { select: { nombre: true } },
      glam2: true,
      esGLA: true,
      estado: true
    }
  });

  return {
    fileName: `locales-${scope}-${dateStamp()}`,
    sheets: [
      {
        name: "Locales",
        headers: ["Codigo", "Nombre", "Tipo", "Piso", "Zona", "GLA m2", "Es GLA", "Estado"],
        rows: locales.map((local) => [
          local.codigo,
          local.nombre,
          local.tipo,
          local.piso,
          local.zona?.nombre ?? "",
          asNumber(local.glam2),
          local.esGLA ? "Si" : "No",
          local.estado
        ])
      }
    ]
  };
}

async function buildArrendatariosExport(
  scope: ExportScope,
  proyectoId: string,
  searchParams: URLSearchParams
): Promise<ExportResult> {
  const { start, nextMonthStart } = getMonthBounds(new Date());
  const activeContractWhere = buildArrendatariosActiveContractWhere({ start, nextMonthStart });

  const where =
    scope === "filtered"
      ? buildArrendatariosWhere(
          proyectoId,
          { start, nextMonthStart },
          {
            q: searchParams.get("q")?.trim() ?? "",
            vigente: parseVigenteFilter(searchParams.get("vigente") ?? undefined)
          }
        )
      : ({
          proyectoId,
          contratos: {
            some: activeContractWhere
          }
        } satisfies Prisma.TenantWhereInput);

  const arrendatarios = await prisma.tenant.findMany({
    where,
    include: {
      _count: { select: { contratos: true } },
      contratos: {
        where: activeContractWhere,
        orderBy: { fechaInicio: "desc" },
        select: { numeroContrato: true }
      }
    },
    orderBy: { nombreComercial: "asc" }
  });

  return {
    fileName: `arrendatarios-${scope}-${dateStamp()}`,
    sheets: [
      {
        name: "Arrendatarios",
        headers: [
          "RUT",
          "Razon social",
          "Nombre comercial",
          "Vigente",
          "Email",
          "Telefono",
          "Contratos asociados",
          "Contratos vigentes (periodo)",
          "N contratos vigentes"
        ],
        rows: arrendatarios.map((item) => [
          item.rut,
          item.razonSocial,
          item.nombreComercial,
          item.vigente ? "Si" : "No",
          item.email ?? "",
          item.telefono ?? "",
          item._count.contratos,
          item.contratos.map((contract) => contract.numeroContrato).join(", "),
          item.contratos.length
        ])
      }
    ]
  };
}

async function buildContratosExport(scope: ExportScope, proyectoId: string): Promise<ExportResult> {
  const contracts = await prisma.contract.findMany({
    where: { proyectoId },
    include: {
      local: { select: { codigo: true, nombre: true } },
      locales: {
        include: { local: { select: { codigo: true, nombre: true } } },
        orderBy: { createdAt: "asc" }
      },
      arrendatario: { select: { nombreComercial: true } },
      tarifas: {
        orderBy: [{ vigenciaDesde: "asc" }, { createdAt: "asc" }]
      },
      ggcc: {
        orderBy: [{ vigenciaDesde: "asc" }, { createdAt: "asc" }]
      }
    },
    orderBy: [{ numeroContrato: "asc" }, { id: "asc" }]
  });

  const summaryRows: Array<Array<string | number | boolean | null>> = [];
  const tarifasRows: Array<Array<string | number | boolean | null>> = [];
  const ggccRows: Array<Array<string | number | boolean | null>> = [];

  for (const contract of contracts) {
    const asociados = (contract.locales.length > 0 ? contract.locales.map((item) => item.local) : [contract.local])
      .map((local) => local.codigo)
      .join(", ");

    summaryRows.push([
      contract.numeroContrato,
      asociados,
      contract.arrendatario.nombreComercial,
      contract.estado,
      formatDateIso(contract.fechaInicio),
      formatDateIso(contract.fechaTermino),
      contract.pdfUrl ? "Disponible" : "Sin PDF"
    ]);

    for (const tarifa of contract.tarifas) {
      tarifasRows.push([
        contract.numeroContrato,
        asociados,
        tarifa.tipo,
        asNumber(tarifa.valor),
        tarifa.umbralVentasUf !== null ? asNumber(tarifa.umbralVentasUf) : "",
        formatDateIso(tarifa.vigenciaDesde),
        formatDateIso(tarifa.vigenciaHasta),
        tarifa.esDiciembre ? "Si" : "No"
      ]);
    }

    for (const ggcc of contract.ggcc) {
      ggccRows.push([
        contract.numeroContrato,
        asociados,
        asNumber(ggcc.tarifaBaseUfM2),
        asNumber(ggcc.pctAdministracion),
        ggcc.pctReajuste === null ? "" : asNumber(ggcc.pctReajuste),
        formatDateIso(ggcc.vigenciaDesde),
        formatDateIso(ggcc.vigenciaHasta),
        formatDateIso(ggcc.proximoReajuste),
        ggcc.mesesReajuste ?? ""
      ]);
    }
  }

  return {
    fileName: `contratos-${scope}-${dateStamp()}`,
    sheets: [
      {
        name: "Resumen",
        headers: ["Numero", "Locales", "Arrendatario", "Estado", "Inicio", "Termino", "PDF"],
        rows: summaryRows
      },
      {
        name: "Tarifas",
        headers: ["Numero", "Locales", "Tipo", "Valor", "Umbral UF", "Vigencia desde", "Vigencia hasta", "Es diciembre"],
        rows: tarifasRows
      },
      {
        name: "GGCC",
        headers: [
          "Numero",
          "Locales",
          "Tarifa base UF/m2",
          "% administracion",
          "% reajuste",
          "Vigencia desde",
          "Vigencia hasta",
          "Proximo reajuste",
          "Meses reajuste"
        ],
        rows: ggccRows
      }
    ]
  };
}

async function buildFinanzasArrendatariosExport(
  scope: ExportScope,
  proyectoId: string,
  searchParams: URLSearchParams
): Promise<ExportResult> {
  const desde = scope === "filtered" ? searchParams.get("desde") : null;
  const hasta = scope === "filtered" ? searchParams.get("hasta") : null;
  const desdeDate = desde ? new Date(`${desde}-01`) : new Date("2024-01-01");
  const hastaDate = hasta ? new Date(`${hasta}-01`) : new Date();

  const arrendatarios = await prisma.tenant.findMany({
    where: { proyectoId, vigente: true },
    select: {
      id: true,
      rut: true,
      razonSocial: true,
      nombreComercial: true,
      contratos: {
        where: { estado: { in: ["VIGENTE", "GRACIA"] } },
        select: {
          localId: true,
          local: { select: { codigo: true, nombre: true } }
        }
      }
    },
    orderBy: { nombreComercial: "asc" }
  });

  const allLocalIds = Array.from(
    new Set(arrendatarios.flatMap((arrendatario) => arrendatario.contratos.map((item) => item.localId)))
  );
  const [registros, ventas] = await Promise.all([
    allLocalIds.length > 0
      ? prisma.accountingRecord.findMany({
          where: {
            projectId: proyectoId,
            unitId: { in: allLocalIds },
            period: { gte: desdeDate, lte: hastaDate },
            group1: "INGRESOS DE EXPLOTACION"
          },
          select: {
            unitId: true,
            period: true,
            valueUf: true
          }
        })
      : Promise.resolve([]),
    arrendatarios.length > 0
      ? prisma.tenantSale.findMany({
          where: {
            projectId: proyectoId,
            tenantId: { in: arrendatarios.map((a) => a.id) },
            period: { gte: desdeDate, lte: hastaDate }
          },
          select: {
            tenantId: true,
            period: true,
            salesUf: true
          }
        })
      : Promise.resolve([])
  ]);

  const facturacionByLocal = new Map<string, Map<string, number>>();
  for (const registro of registros) {
    if (!registro.unitId) continue;
    const periodoKey = registro.period.toISOString().slice(0, 7);
    const byPeriodo = facturacionByLocal.get(registro.unitId) ?? new Map<string, number>();
    byPeriodo.set(periodoKey, (byPeriodo.get(periodoKey) ?? 0) + asNumber(registro.valueUf));
    facturacionByLocal.set(registro.unitId, byPeriodo);
  }
  const ventasByTenant = new Map<string, Map<string, number>>();
  for (const venta of ventas) {
    const periodKey = venta.period.toISOString().slice(0, 7);
    const byPeriodo = ventasByTenant.get(venta.tenantId) ?? new Map<string, number>();
    byPeriodo.set(periodKey, (byPeriodo.get(periodKey) ?? 0) + asNumber(venta.salesUf));
    ventasByTenant.set(venta.tenantId, byPeriodo);
  }

  const rows: Array<Array<string | number | boolean | null>> = [];

  for (const arrendatario of arrendatarios) {
    const localIds = arrendatario.contratos.map((item) => item.localId);
    if (localIds.length === 0) {
      continue;
    }

    const facturacionPorPeriodo: Record<string, number> = {};
    const ventasPorPeriodo: Record<string, number> = {};

    for (const localId of localIds) {
      const facturacionLocal = facturacionByLocal.get(localId);
      if (facturacionLocal) {
        for (const [periodoKey, amount] of facturacionLocal.entries()) {
          facturacionPorPeriodo[periodoKey] = (facturacionPorPeriodo[periodoKey] ?? 0) + amount;
        }
      }
    }
    // Sales are now keyed by tenant ID
    const ventasTenant = ventasByTenant.get(arrendatario.id);
    if (ventasTenant) {
      for (const [periodoKey, amount] of ventasTenant.entries()) {
        ventasPorPeriodo[periodoKey] = (ventasPorPeriodo[periodoKey] ?? 0) + amount;
      }
    }

    const totalFacturado = Object.values(facturacionPorPeriodo).reduce((acc, value) => acc + value, 0);
    const totalVentas = Object.values(ventasPorPeriodo).reduce((acc, value) => acc + value, 0);
    const costoOcupacion = totalVentas > 0 ? (totalFacturado / totalVentas) * 100 : null;

    const periodos = Array.from(
      new Set([...Object.keys(facturacionPorPeriodo), ...Object.keys(ventasPorPeriodo)])
    )
      .sort()
      .join(", ");

    rows.push([
      arrendatario.nombreComercial,
      arrendatario.rut,
      arrendatario.razonSocial,
      arrendatario.contratos.map((item) => item.local.codigo).join(", "),
      periodos,
      totalFacturado,
      totalVentas,
      costoOcupacion === null ? "" : costoOcupacion
    ]);
  }

  return {
    fileName: `finance-tenants-${scope}-${dateStamp()}`,
    sheets: [
      {
        name: "Arrendatarios",
        headers: [
          "Arrendatario",
          "RUT",
          "Razon social",
          "Locales",
          "Periodos",
          "Facturacion total UF",
          "Ventas total UF",
          "Costo ocupacion %"
        ],
        rows
      }
    ]
  };
}

async function buildFinanzasEerrExport(
  scope: ExportScope,
  proyectoId: string,
  searchParams: URLSearchParams
): Promise<ExportResult> {
  const desde = scope === "filtered" ? searchParams.get("desde") : null;
  const hasta = scope === "filtered" ? searchParams.get("hasta") : null;
  const desdeDate = desde ? new Date(`${desde}-01`) : new Date("2024-01-01");
  const hastaDate = hasta ? new Date(`${hasta}-01`) : new Date();

  const registros = await prisma.accountingRecord.findMany({
    where: {
      projectId: proyectoId,
      period: { gte: desdeDate, lte: hastaDate }
    },
    orderBy: { period: "asc" }
  });

  const periodos = Array.from(new Set(registros.map((item) => item.period.toISOString().slice(0, 7)))).sort();

  type Linea = {
    grupo3: string;
    tipo: "ingreso" | "costo";
    porPeriodo: Record<string, number>;
    total: number;
  };

  type Seccion = {
    grupo1: string;
    tipo: "ingreso" | "costo";
    lineas: Linea[];
    porPeriodo: Record<string, number>;
    total: number;
  };

  const seccionMap = new Map<string, Seccion>();

  for (const registro of registros) {
    const tipo: "ingreso" | "costo" = GRUPOS_COSTO.has(registro.group1) ? "costo" : "ingreso";
    const periodoKey = registro.period.toISOString().slice(0, 7);
    const valor = asNumber(registro.valueUf);

    if (!seccionMap.has(registro.group1)) {
      seccionMap.set(registro.group1, {
        grupo1: registro.group1,
        tipo,
        lineas: [],
        porPeriodo: {},
        total: 0
      });
    }
    const seccion = seccionMap.get(registro.group1)!;
    seccion.porPeriodo[periodoKey] = (seccion.porPeriodo[periodoKey] ?? 0) + valor;
    seccion.total += valor;

    let linea = seccion.lineas.find((item) => item.grupo3 === registro.group3);
    if (!linea) {
      linea = {
        grupo3: registro.group3,
        tipo,
        porPeriodo: {},
        total: 0
      };
      seccion.lineas.push(linea);
    }
    linea.porPeriodo[periodoKey] = (linea.porPeriodo[periodoKey] ?? 0) + valor;
    linea.total += valor;
  }

  const ebitdaPorPeriodo: Record<string, number> = {};
  let ebitdaTotal = 0;
  for (const seccion of seccionMap.values()) {
    const signo = seccion.tipo === "ingreso" ? 1 : -1;
    for (const [periodo, value] of Object.entries(seccion.porPeriodo)) {
      ebitdaPorPeriodo[periodo] = (ebitdaPorPeriodo[periodo] ?? 0) + signo * value;
    }
    ebitdaTotal += signo * seccion.total;
  }

  const headers = ["Seccion", "Cuenta", ...periodos, "Total"];
  const rows: Array<Array<string | number | boolean | null>> = [];

  const secciones = Array.from(seccionMap.values()).sort((a, b) => a.grupo1.localeCompare(b.grupo1, "es-CL"));
  for (const seccion of secciones) {
    rows.push([
      seccion.grupo1,
      "TOTAL SECCION",
      ...periodos.map((periodo) => seccion.porPeriodo[periodo] ?? 0),
      seccion.total
    ]);

    const lineas = [...seccion.lineas].sort((a, b) => a.grupo3.localeCompare(b.grupo3, "es-CL"));
    for (const linea of lineas) {
      rows.push([
        "",
        linea.grupo3,
        ...periodos.map((periodo) => linea.porPeriodo[periodo] ?? 0),
        linea.total
      ]);
    }
  }

  rows.push([
    "EBITDA",
    "TOTAL",
    ...periodos.map((periodo) => ebitdaPorPeriodo[periodo] ?? 0),
    ebitdaTotal
  ]);

  return {
    fileName: `finance-eerr-${scope}-${dateStamp()}`,
    sheets: [
      {
        name: "EERR",
        headers,
        rows
      }
    ]
  };
}

async function buildFinanzasMapeosExport(
  scope: ExportScope,
  proyectoId: string,
  searchParams: URLSearchParams
): Promise<ExportResult> {
  const tabRaw = searchParams.get("tab");
  const tab = tabRaw === "sales" || tabRaw === "ventas" ? "sales" : "accounting";
  const includeContable = scope === "all" || tab === "accounting";
  const includeVentas = scope === "all" || tab === "sales";

  const [contableMapeos, ventasMapeos] = await Promise.all([
    includeContable
      ? prisma.accountingUnitMapping.findMany({
          where: { projectId: proyectoId },
          include: { unit: { select: { codigo: true, nombre: true } } },
          orderBy: { externalUnit: "asc" }
        })
      : Promise.resolve([]),
    includeVentas
      ? prisma.salesTenantMapping.findMany({
          where: { projectId: proyectoId },
          include: { tenant: { select: { nombreComercial: true, rut: true } } },
          orderBy: { storeName: "asc" }
        })
      : Promise.resolve([])
  ]);

  const sheets: ExportSheet[] = [];

  if (includeContable) {
    sheets.push({
      name: "Mapeo Contable",
      headers: ["Codigo externo", "Local codigo", "Local nombre"],
      rows: contableMapeos.map((item) => [item.externalUnit, item.unit.codigo, item.unit.nombre])
    });
  }

  if (includeVentas) {
    sheets.push({
      name: "Mapeo Ventas",
      headers: ["ID CA", "Tienda", "Arrendatario", "RUT"],
      rows: ventasMapeos.map((item) => [item.salesAccountId, item.storeName, item.tenant.nombreComercial, item.tenant.rut])
    });
  }

  const filteredSuffix = scope === "filtered" ? `-${tab}` : "";
  return {
    fileName: `finance-mappings-${scope}${filteredSuffix}-${dateStamp()}`,
    sheets
  };
}

async function buildExportResult(
  dataset: ExportDataset,
  scope: ExportScope,
  proyectoId: string,
  searchParams: URLSearchParams
): Promise<ExportResult> {
  if (dataset === "proyectos") {
    return buildProyectosExport(scope);
  }
  if (dataset === "locales") {
    return buildLocalesExport(scope, proyectoId, searchParams);
  }
  if (dataset === "arrendatarios") {
    return buildArrendatariosExport(scope, proyectoId, searchParams);
  }
  if (dataset === "contratos") {
    return buildContratosExport(scope, proyectoId);
  }
  if (dataset === "finance_tenants") {
    return buildFinanzasArrendatariosExport(scope, proyectoId, searchParams);
  }
  if (dataset === "finance_eerr") {
    return buildFinanzasEerrExport(scope, proyectoId, searchParams);
  }
  return buildFinanzasMapeosExport(scope, proyectoId, searchParams);
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestId = getRequestId(request);
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const sync = getOptionalBooleanSearchParam(searchParams, "sync") ?? true;
    if (!sync) {
      return NextResponse.json(
        {
          message: "Exportacion asincrona disponible via POST /api/jobs/exports."
        },
        { status: 409 }
      );
    }

    const datasetRaw = searchParams.get("dataset");
    if (!isExportDataset(datasetRaw)) {
      throw new ApiError(400, "dataset invalido.");
    }

    const scopeRaw = searchParams.get("scope");
    if (!isExportScope(scopeRaw)) {
      throw new ApiError(400, "scope invalido.");
    }

    const dataset = datasetRaw;
    const scope = scopeRaw;
    const proyectoId = ensureProyectoId(dataset, searchParams.get("projectId"));
    const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
    const rowLimit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, EXPORT_MAX_ROWS)
        : EXPORT_MAX_ROWS;

    const exportResult = await buildExportResult(dataset, scope, proyectoId, searchParams);
    const cappedSheets = applyExportRowCap(exportResult.sheets, rowLimit);
    const buffer = buildExcelWorkbookBuffer(cappedSheets);
    logDuration("export_excel", startedAt, {
      requestId,
      dataset,
      scope,
      proyectoId,
      sheets: cappedSheets.length
    });
    return createExcelDownloadResponse(buffer, exportResult.fileName);
  } catch (error) {
    logError("export_excel_failed", {
      requestId,
      error: error instanceof Error ? error.message : "unknown"
    });
    return handleApiError(error);
  }
}

