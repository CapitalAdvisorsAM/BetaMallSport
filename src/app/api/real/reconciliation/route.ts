export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { VARIABLE_RENT_LAG_MONTHS } from "@/lib/constants";
import { getFinanceFrom, getFinanceProjectId, getFinanceTo } from "@/lib/real/api-params";
import { resolveMonthRange, toPeriodKey } from "@/lib/real/period-range";
import { buildReconciliation } from "@/lib/real/reconciliation";
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

    // Generate period list
    const periods: string[] = [];
    const cursor = new Date(desdeDate);
    while (cursor <= hastaDate) {
      periods.push(toPeriodKey(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    const [contracts, accountingRecords, sales] = await Promise.all([
      prisma.contract.findMany({
        where: {
          projectId: projectId,
          estado: { in: ["VIGENTE", "GRACIA"] },
          fechaInicio: { lte: hastaDate },
          fechaTermino: { gte: desdeDate }
        },
        include: {
          local: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              glam2: true
            }
          },
          arrendatario: {
            select: {
              id: true,
              rut: true,
              nombreComercial: true
            }
          },
          tarifas: {
            orderBy: { vigenciaDesde: "desc" },
            select: {
              tipo: true,
              valor: true,
              vigenciaDesde: true,
              vigenciaHasta: true,
              esDiciembre: true
            }
          },
          ggcc: {
            orderBy: { vigenciaDesde: "desc" },
            select: {
              tarifaBaseUfM2: true,
              pctAdministracion: true,
              vigenciaDesde: true,
              vigenciaHasta: true
            }
          }
        }
      }),
      prisma.accountingRecord.findMany({
        where: {
          projectId,
          period: { gte: desdeDate, lte: hastaDate },
          group1: "INGRESOS DE EXPLOTACION"
        },
        select: {
          unitId: true,
          period: true,
          group1: true,
          group3: true,
          valueUf: true
        }
      }),
      prisma.tenantSale.findMany({
        where: {
          projectId,
          period: {
            gte: new Date(Date.UTC(desdeDate.getUTCFullYear(), desdeDate.getUTCMonth() - VARIABLE_RENT_LAG_MONTHS, 1)),
            lte: hastaDate
          }
        },
        select: {
          tenantId: true,
          period: true,
          salesPesos: true
        }
      })
    ]);

    const result = buildReconciliation(contracts, accountingRecords, sales, periods);

    return NextResponse.json({
      periods,
      ...result
    });
  } catch (error) {
    return handleApiError(error);
  }
}
