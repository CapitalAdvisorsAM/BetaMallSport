import { DataUploadType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { parseVentas } from "@/lib/finance/parse-sales";
import { similarity } from "@/lib/finance/parse-utils";
import { getFormFieldValue } from "@/lib/finance/api-params";

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

    const units = await prisma.unit.findMany({
      where: { proyectoId: projectId },
      select: { id: true, codigo: true, nombre: true }
    });
    const existingMappings = await prisma.salesUnitMapping.findMany({
      where: { projectId },
      select: { salesAccountId: true, unitId: true }
    });
    const unitBySalesAccountId = new Map(existingMappings.map((mapping) => [mapping.salesAccountId, mapping.unitId]));

    const uniqueSalesAccountIds = [...new Set(rows.map((row) => row.idCa))];
    const unmapped: Array<{
      idCa: number;
      tienda: string;
      sugerencias: Array<{ codigo: string; nombre: string; score: number }>;
    }> = [];
    const newMappings: Array<{
      projectId: string;
      salesAccountId: number;
      storeName: string;
      unitId: string;
      createdBy: string;
    }> = [];

    for (const salesAccountId of uniqueSalesAccountIds) {
      if (unitBySalesAccountId.has(salesAccountId)) continue;

      const store = rows.find((row) => row.idCa === salesAccountId)?.tienda ?? "";
      const scored = units
        .map((unit) => ({
          ...unit,
          score: Math.max(similarity(store, unit.nombre), similarity(store, unit.codigo))
        }))
        .sort((a, b) => b.score - a.score);

      if (scored[0] && scored[0].score >= 0.7) {
        unitBySalesAccountId.set(salesAccountId, scored[0].id);
        newMappings.push({
          projectId,
          salesAccountId,
          storeName: store,
          unitId: scored[0].id,
          createdBy: session.user.id
        });
      } else {
        unmapped.push({
          idCa: salesAccountId,
          tienda: store,
          sugerencias: scored.slice(0, 3).map((unit) => ({
            codigo: unit.codigo,
            nombre: unit.nombre,
            score: unit.score
          }))
        });
      }
    }

    if (newMappings.length > 0) {
      await prisma.salesUnitMapping.createMany({ data: newMappings, skipDuplicates: true });
    }

    const periods = [...new Set(rows.map((row) => row.mes.toISOString().slice(0, 7)))];
    let upserted = 0;

    for (const row of rows) {
      const unitId = unitBySalesAccountId.get(row.idCa);
      if (!unitId) continue;

      const period = row.mes.toISOString().slice(0, 7);

      await prisma.unitSale.upsert({
        where: { unitId_period: { unitId, period } },
        update: { salesUf: row.ventasUf, updatedAt: new Date() },
        create: {
          projectId,
          unitId,
          period,
          salesUf: row.ventasUf
        }
      });
      upserted += 1;
    }

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
