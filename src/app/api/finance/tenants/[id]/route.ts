export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { VARIABLE_RENT_LAG_MONTHS } from "@/lib/constants";
import { getFinanceFrom, getFinanceProjectId, getFinanceTo } from "@/lib/finance/api-params";
import { resolveMonthRange, toPeriodKey } from "@/lib/finance/period-range";
import { buildTenant360Data } from "@/lib/finance/tenant-360";
import { buildPeerComparison } from "@/lib/finance/peer-comparison";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const projectId = getFinanceProjectId(searchParams);
    const tenantId = params.id;
    const from = getFinanceFrom(searchParams);
    const to = getFinanceTo(searchParams);

    if (!projectId) {
      throw new ApiError(400, "projectId requerido.");
    }

    const { desdeDate, hastaDate } = resolveMonthRange(from, to);

    // Phase 1: tenant + contracts (need unit IDs for phase 2)
    const [tenant, contracts] = await Promise.all([
      prisma.tenant.findFirst({
        where: { id: tenantId, proyectoId: projectId },
        select: {
          id: true,
          rut: true,
          razonSocial: true,
          nombreComercial: true,
          vigente: true,
          email: true,
          telefono: true
        }
      }),
      prisma.contract.findMany({
        where: { arrendatarioId: tenantId, proyectoId: projectId },
        include: {
          local: {
            select: { id: true, codigo: true, nombre: true, glam2: true, esGLA: true }
          },
          tarifas: { orderBy: { vigenciaDesde: "desc" } },
          ggcc: { orderBy: { vigenciaDesde: "desc" } },
          anexos: { orderBy: { fecha: "desc" } }
        },
        orderBy: { fechaInicio: "desc" }
      })
    ]);

    if (!tenant) {
      throw new ApiError(404, "Arrendatario no encontrado.");
    }

    const unitIds = [...new Set(contracts.map((c) => c.localId))];
    const contractIds = contracts.map((c) => c.id);

    // Phase 2: parallel data fetch
    const [accountingRecords, sales, contractDays, latestUf] = await Promise.all([
      prisma.accountingRecord.findMany({
        where: {
          projectId,
          tenantId,
          period: { gte: desdeDate, lte: hastaDate }
        },
        select: {
          unitId: true,
          period: true,
          group1: true,
          group3: true,
          denomination: true,
          valueUf: true
        },
        orderBy: [{ group1: "asc" }, { group3: "asc" }, { period: "asc" }]
      }),
      prisma.tenantSale.findMany({
        where: {
          projectId,
          tenantId,
          period: {
            gte: new Date(Date.UTC(desdeDate.getUTCFullYear(), desdeDate.getUTCMonth() - VARIABLE_RENT_LAG_MONTHS, 1)),
            lte: hastaDate
          }
        },
        select: { tenantId: true, period: true, salesUf: true },
        orderBy: { period: "asc" }
      }),
      contractIds.length > 0
        ? prisma.contractDay.findMany({
            where: {
              contratoId: { in: contractIds },
              fecha: { gte: desdeDate, lte: hastaDate }
            },
            select: {
              localId: true,
              fecha: true,
              estadoDia: true,
              glam2: true,
              local: { select: { codigo: true } }
            },
            orderBy: [{ localId: "asc" }, { fecha: "asc" }]
          })
        : [],
      prisma.valorUF.findFirst({ orderBy: { fecha: "desc" } })
    ]);

    // Build periods array
    const allPeriods = new Set<string>();
    let cursor = new Date(desdeDate);
    while (cursor <= hastaDate) {
      allPeriods.add(toPeriodKey(cursor));
      cursor = new Date(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1);
    }
    const periods = [...allPeriods].sort();

    // Phase 3: peer comparison — find the tenant's category from their units
    const tenantUnits = await prisma.unit.findMany({
      where: { id: { in: unitIds }, proyectoId: projectId },
      select: { zona: { select: { nombre: true } } }
    });
    const tenantCategoria = tenantUnits.find((u) => u.zona)?.zona?.nombre ?? null;

    const peerComparison = tenantCategoria
      ? await buildPeerComparison({
          projectId,
          tenantId,
          tenantName: tenant.nombreComercial || tenant.razonSocial,
          categoria: tenantCategoria,
          desdeDate,
          hastaDate,
          prisma
        })
      : null;

    const data = buildTenant360Data({
      tenant,
      contracts,
      accountingRecords,
      sales,
      contractDays,
      latestUf,
      periods,
      peerComparison
    });

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
