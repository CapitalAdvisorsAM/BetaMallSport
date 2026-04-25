import { DataUploadType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { parseVentasPresupuestadas } from "@/lib/real/parse-budgeted-sales";
import { similarity } from "@/lib/real/parse-utils";
import { getFormFieldValue } from "@/lib/real/api-params";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = getFormFieldValue(formData, ["projectId", "proyectoId"]);

    if (!file || !projectId) throw new ApiError(400, "Se requiere archivo y projectId.");
    if (file.size > 50 * 1024 * 1024) throw new ApiError(400, "El archivo no puede superar 50 MB.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseVentasPresupuestadas(buffer);

    if (rows.length === 0) throw new ApiError(400, "No se encontraron filas de presupuesto.");

    const tenants = await prisma.tenant.findMany({
      where: { projectId: projectId },
      select: { id: true, rut: true, nombreComercial: true },
    });

    const uniqueTiendas = [...new Set(rows.map((row) => row.tienda).filter(Boolean))];
    const tenantByTienda = new Map<string, string>();
    const unmapped: Array<{
      tienda: string;
      sugerencias: Array<{ nombre: string; rut: string; score: number }>;
    }> = [];

    for (const tienda of uniqueTiendas) {
      const key = tienda.toLowerCase();
      const scored = tenants
        .map((tenant) => ({
          ...tenant,
          score: similarity(tienda, tenant.nombreComercial)
        }))
        .sort((a, b) => b.score - a.score);

      if (scored[0] && scored[0].score >= 0.7) {
        tenantByTienda.set(key, scored[0].id);
      } else {
        unmapped.push({
          tienda,
          sugerencias: scored.slice(0, 3).map((tenant) => ({
            nombre: tenant.nombreComercial,
            rut: tenant.rut,
            score: tenant.score
          }))
        });
      }
    }

    const periods = [...new Set(rows.map((row) => row.mes.toISOString().slice(0, 7)))];

    const BATCH_SIZE = 100;
    const upsertOps = rows
      .filter((row) => tenantByTienda.has(row.tienda.toLowerCase()))
      .map((row) => {
        const tenantId = tenantByTienda.get(row.tienda.toLowerCase())!;
        const period = new Date(Date.UTC(row.mes.getFullYear(), row.mes.getMonth(), 1));
        return prisma.tenantBudgetedSale.upsert({
          where: { tenantId_period: { tenantId, period } },
          update: { salesPesos: row.ventasPesos, updatedAt: new Date() },
          create: { projectId, tenantId, period, salesPesos: row.ventasPesos },
        });
      });

    for (let i = 0; i < upsertOps.length; i += BATCH_SIZE) {
      await prisma.$transaction(upsertOps.slice(i, i + BATCH_SIZE));
    }
    const upserted = upsertOps.length;

    await prisma.dataUpload.create({
      data: {
        projectId,
        type: DataUploadType.BUDGETED_SALES,
        userId: session.user.id,
        fileName: file.name,
        fileUrl: "",
        recordsLoaded: upserted,
        status: "OK",
        errorDetail: unmapped.length > 0 ? ({ sinMapeo: unmapped } as object) : undefined
      }
    });
    invalidateMetricsCacheByProject(projectId);

    return NextResponse.json({
      periods,
      periodos: periods,
      totalFilas: rows.length,
      recordsUpserted: upserted,
      registrosUpserted: upserted,
      automaticMatches: uniqueTiendas.length - unmapped.length,
      matchesAutomaticos: uniqueTiendas.length - unmapped.length,
      sinMapeo: unmapped
    });
  } catch (error) {
    return handleApiError(error);
  }
}
