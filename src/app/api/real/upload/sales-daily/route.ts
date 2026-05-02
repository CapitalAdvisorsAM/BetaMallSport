import { DataUploadType, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { parseVentasDiarias } from "@/lib/real/parse-sales-daily";
import { similarity } from "@/lib/real/parse-utils";
import { getFormFieldValue } from "@/lib/real/api-params";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeStoreName(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function mappingKey(idCa: string, tienda: string): string {
  return `${idCa}__${normalizeStoreName(tienda)}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = getFormFieldValue(formData, ["projectId", "proyectoId"]);

    if (!file || !projectId) throw new ApiError(400, "Se requiere archivo y projectId.");
    if (file.size > 50 * 1024 * 1024) throw new ApiError(400, "El archivo no puede superar 50 MB.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseVentasDiarias(buffer);
    if (rows.length === 0) throw new ApiError(400, "No se encontraron filas con Tipo = 'Real'.");

    const [tenants, existingMappings] = await Promise.all([
      prisma.tenant.findMany({
        where: { projectId },
        select: { id: true, rut: true, nombreComercial: true }
      }),
      prisma.salesTenantMapping.findMany({
        where: { projectId },
        select: { salesAccountId: true, storeName: true, tenantId: true }
      })
    ]);

    const tenantBySalesStore = new Map(
      existingMappings.map((m) => [mappingKey(m.salesAccountId, m.storeName), m.tenantId])
    );

    const uniqueStores = new Map<string, { idCa: string; tienda: string }>();
    for (const row of rows) {
      const key = mappingKey(row.idCa, row.tienda);
      if (!uniqueStores.has(key)) uniqueStores.set(key, { idCa: row.idCa, tienda: row.tienda });
    }

    const unmapped: Array<{
      idCa: string;
      tienda: string;
      sugerencias: Array<{ nombre: string; rut: string; score: number }>;
    }> = [];
    const newMappings: Array<{
      projectId: string;
      salesAccountId: string;
      storeName: string;
      tenantId: string;
      createdBy: string;
    }> = [];

    for (const [key, storeEntry] of uniqueStores) {
      if (tenantBySalesStore.has(key)) continue;
      const salesAccountId = storeEntry.idCa;
      const store = storeEntry.tienda;
      const scored = tenants
        .map((t) => ({ ...t, score: similarity(store, t.nombreComercial) }))
        .sort((a, b) => b.score - a.score);

      if (scored[0] && scored[0].score >= 0.7) {
        tenantBySalesStore.set(key, scored[0].id);
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
          sugerencias: scored.slice(0, 3).map((t) => ({
            nombre: t.nombreComercial,
            rut: t.rut,
            score: t.score
          }))
        });
      }
    }

    if (newMappings.length > 0) {
      await prisma.salesTenantMapping.createMany({ data: newMappings, skipDuplicates: true });
    }

    // Replace-by-date-range: clear all existing daily rows in the date span
    // covered by this upload to keep the table consistent with the source
    // file (matches the behaviour of the bank movement upload).
    const dates = rows.map((r) => r.fecha.getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    const BATCH = 200;
    let upserted = 0;

    await prisma.$transaction(async (tx) => {
      await tx.tenantSaleDaily.deleteMany({
        where: { projectId, date: { gte: minDate, lte: maxDate } }
      });

      for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        await tx.tenantSaleDaily.createMany({
          data: slice.map((r) => ({
            projectId,
            tenantId: tenantBySalesStore.get(mappingKey(r.idCa, r.tienda)) ?? null,
            salesAccountId: r.idCa,
            storeName: r.tienda,
            date: r.fecha,
            period: r.periodo,
            day: r.dia,
            totalReceipts: new Prisma.Decimal(r.totalBoletas),
            totalExemptReceipts: new Prisma.Decimal(r.totalBoletasExentas),
            totalInvoices: new Prisma.Decimal(r.totalFacturas),
            totalCreditNotes: new Prisma.Decimal(r.totalNotasCredito),
            salesPesos: new Prisma.Decimal(r.ventasPesos),
            registrationDate: r.fechaRegistro,
            sizeCategory: r.categoriaTamano,
            typeCategory: r.categoriaTipo,
            floor: r.piso,
            glaType: r.glaTipo
          }))
        });
        upserted += slice.length;
      }
    });

    const periods = [...new Set(rows.map((r) => r.periodo.toISOString().slice(0, 7)))];

    await prisma.dataUpload.create({
      data: {
        projectId,
        type: DataUploadType.SALES_DAILY,
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
      recordsInserted: upserted,
      registrosCargados: upserted,
      automaticMatches: newMappings.length,
      matchesAutomaticos: newMappings.length,
      sinMapeo: unmapped
    });
  } catch (error) {
    return handleApiError(error);
  }
}
