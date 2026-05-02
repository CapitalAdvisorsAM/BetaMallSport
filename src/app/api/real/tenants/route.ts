export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { AccountingScenario } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getFinanceFrom, getFinanceProjectId, getFinanceTo } from "@/lib/real/api-params";
import { resolveMonthRange } from "@/lib/real/period-range";
import { buildUfRateMap, getUfRate } from "@/lib/real/uf-lookup";
import { buildTenantFinanceRows } from "@/lib/real/tenants";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const projectId = getFinanceProjectId(searchParams);
    const from = getFinanceFrom(searchParams);
    const to = getFinanceTo(searchParams);

    if (!projectId) {
      throw new ApiError(400, "projectId requerido.");
    }

    const { desdeDate, hastaDate } = resolveMonthRange(from, to);

    const tenants = await prisma.tenant.findMany({
      where: { projectId: projectId, vigente: true },
      orderBy: { nombreComercial: "asc" },
      select: {
        id: true,
        rut: true,
        razonSocial: true,
        nombreComercial: true,
        contratos: {
          where: { estado: { in: ["VIGENTE", "GRACIA"] } },
          select: {
            localId: true,
            local: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
                glam2: true
              }
            },
            tarifas: {
              where: {
                supersededAt: null,
                tipo: { in: ["FIJO_UF_M2", "PORCENTAJE"] },
                vigenciaDesde: { lte: hastaDate },
                OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: desdeDate } }]
              },
              orderBy: { vigenciaDesde: "desc" },
              select: { tipo: true, valor: true }
            },
            ggcc: {
              where: { supersededAt: null, vigenciaDesde: { lte: hastaDate } },
              orderBy: { vigenciaDesde: "desc" },
              take: 1,
              select: { tarifaBaseUfM2: true, pctAdministracion: true }
            }
          }
        }
      }
    });

    const unitIds = [...new Set(tenants.flatMap((tenant) => tenant.contratos.map((contract) => contract.localId)))];
    if (unitIds.length === 0) {
      return NextResponse.json({ tenants: [], arrendatarios: [] });
    }

    const [accountingRecords, sales] = await Promise.all([
      prisma.accountingRecord.findMany({
        where: {
          projectId,
          unitId: { in: unitIds },
          period: { gte: desdeDate, lte: hastaDate },
          group1: "INGRESOS DE EXPLOTACION",
          scenario: AccountingScenario.REAL
        },
        select: {
          unitId: true,
          period: true,
          valueUf: true
        }
      }),
      prisma.tenantSale.findMany({
        where: {
          projectId,
          tenantId: { in: tenants.map((t) => t.id) },
          period: { gte: desdeDate, lte: hastaDate }
        },
        select: {
          tenantId: true,
          period: true,
          salesPesos: true
        }
      })
    ]);

    const legacyAccountingRecords = accountingRecords.map((record) => ({
      localId: record.unitId,
      periodo: record.period,
      valorUf: record.valueUf
    }));
    const ufRateByPeriod = await buildUfRateMap([...new Set(sales.map((sale) => sale.period.toISOString().slice(0, 7)))]);
    const legacySales = sales.map((sale) => ({
      tenantId: sale.tenantId,
      periodo: sale.period.toISOString().slice(0, 7),
      ventasPesos: (() => {
        const period = sale.period.toISOString().slice(0, 7);
        const uf = getUfRate(period, ufRateByPeriod);
        return uf > 0 ? Number(sale.salesPesos) / uf : 0;
      })()
    }));

    const rows = buildTenantFinanceRows(tenants, legacyAccountingRecords, legacySales);
    return NextResponse.json({ tenants: rows, arrendatarios: rows });
  } catch (error) {
    return handleApiError(error);
  }
}
