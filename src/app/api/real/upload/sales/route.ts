import { DataUploadType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { parseVentas } from "@/lib/real/parse-sales";
import { similarity } from "@/lib/real/parse-utils";
import { getFormFieldValue } from "@/lib/real/api-params";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = getFormFieldValue(formData, ["projectId", "proyectoId"]);

    if (!file || !projectId) throw new ApiError(400, "Se requiere archivo y projectId.");
    if (file.size > 50 * 1024 * 1024) throw new ApiError(400, "El archivo no puede superar 50 MB.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseVentas(buffer);

    if (rows.length === 0) throw new ApiError(400, "No se encontraron filas con Tipo = 'Real'.");

    const [tenants, existingMappings] = await Promise.all([
      prisma.tenant.findMany({
        where: { projectId: projectId },
        select: { id: true, rut: true, nombreComercial: true },
      }),
      prisma.salesTenantMapping.findMany({
        where: { projectId },
        select: { salesAccountId: true, tenantId: true },
      }),
    ]);
    const tenantBySalesAccountId = new Map(existingMappings.map((mapping) => [mapping.salesAccountId, mapping.tenantId]));

    const uniqueSalesAccountIds = [...new Set(rows.map((row) => row.idCa))];
    const unmapped: Array<{
      idCa: number;
      tienda: string;
      sugerencias: Array<{ nombre: string; rut: string; score: number }>;
    }> = [];
    const newMappings: Array<{
      projectId: string;
      salesAccountId: number;
      storeName: string;
      tenantId: string;
      createdBy: string;
    }> = [];

    for (const salesAccountId of uniqueSalesAccountIds) {
      if (tenantBySalesAccountId.has(salesAccountId)) continue;

      const store = rows.find((row) => row.idCa === salesAccountId)?.tienda ?? "";
      const scored = tenants
        .map((tenant) => ({
          ...tenant,
          score: similarity(store, tenant.nombreComercial)
        }))
        .sort((a, b) => b.score - a.score);

      if (scored[0] && scored[0].score >= 0.7) {
        tenantBySalesAccountId.set(salesAccountId, scored[0].id);
        newMappings.push({
          projectId,
          salesAccountId,
          storeName: store,
          tenantId: scored[0].id,
          createdBy: session.user.id
        });
      } else {
        unmapped.push({
          idCa: salesAccountId,
          tienda: store,
          sugerencias: scored.slice(0, 3).map((tenant) => ({
            nombre: tenant.nombreComercial,
            rut: tenant.rut,
            score: tenant.score
          }))
        });
      }
    }

    if (newMappings.length > 0) {
      await prisma.salesTenantMapping.createMany({ data: newMappings, skipDuplicates: true });
    }

    const periods = [...new Set(rows.map((row) => row.mes.toISOString().slice(0, 7)))];

    const BATCH_SIZE = 100;
    const upsertOps = rows
      .filter((row) => tenantBySalesAccountId.has(row.idCa))
      .map((row) => {
        const tenantId = tenantBySalesAccountId.get(row.idCa)!;
        const period = new Date(Date.UTC(row.mes.getFullYear(), row.mes.getMonth(), 1));
        return prisma.tenantSale.upsert({
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
        type: DataUploadType.SALES,
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
      automaticMatches: newMappings.length,
      matchesAutomaticos: newMappings.length,
      sinMapeo: unmapped
    });
  } catch (error) {
    return handleApiError(error);
  }
}
