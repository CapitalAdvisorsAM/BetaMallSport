import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { parseVentas } from "@/lib/finanzas/parse-ventas";
import { similarity } from "@/lib/finanzas/parse-contable";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const proyectoId = formData.get("proyectoId") as string | null;

    if (!file || !proyectoId) throw new ApiError(400, "Se requiere archivo y proyectoId.");
    if (file.size > 50 * 1024 * 1024) throw new ApiError(400, "El archivo no puede superar 50 MB.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const filas = parseVentas(buffer);

    if (filas.length === 0) throw new ApiError(400, "No se encontraron filas con Tipo = 'Real'.");

    // Cargar locales y mapeos existentes
    const locales = await prisma.local.findMany({
      where: { proyectoId },
      select: { id: true, codigo: true, nombre: true }
    });
    const mapeosExistentes = await prisma.mapeoVentasLocal.findMany({
      where: { proyectoId },
      select: { idCa: true, localId: true }
    });
    const mapeoVentasMap = new Map(mapeosExistentes.map((m) => [m.idCa, m.localId]));

    // IDs CA únicos
    const idCasUnicos = [...new Set(filas.map((f) => f.idCa))];
    const sinMapeo: { idCa: number; tienda: string; sugerencias: { codigo: string; nombre: string; score: number }[] }[] = [];
    const nuevosMapeos: { proyectoId: string; idCa: number; tiendaNombre: string; localId: string; creadoPor: string }[] = [];

    for (const idCa of idCasUnicos) {
      if (mapeoVentasMap.has(idCa)) continue;

      const tienda = filas.find((f) => f.idCa === idCa)?.tienda ?? "";

      // Fuzzy match por nombre de tienda vs local.nombre
      const scored = locales
        .map((l) => ({
          ...l,
          score: Math.max(similarity(tienda, l.nombre), similarity(tienda, l.codigo))
        }))
        .sort((a, b) => b.score - a.score);

      if (scored[0] && scored[0].score >= 0.7) {
        mapeoVentasMap.set(idCa, scored[0].id);
        nuevosMapeos.push({ proyectoId, idCa, tiendaNombre: tienda, localId: scored[0].id, creadoPor: session.user.id });
      } else {
        sinMapeo.push({
          idCa,
          tienda,
          sugerencias: scored.slice(0, 3).map((l) => ({ codigo: l.codigo, nombre: l.nombre, score: l.score }))
        });
      }
    }

    if (nuevosMapeos.length > 0) {
      await prisma.mapeoVentasLocal.createMany({ data: nuevosMapeos, skipDuplicates: true });
    }

    // Upsert VentaLocal
    const periodos = [...new Set(filas.map((f) => f.mes.toISOString().slice(0, 7)))];
    let upsertados = 0;

    for (const fila of filas) {
      const localId = mapeoVentasMap.get(fila.idCa);
      if (!localId) continue;

      const periodoStr = fila.mes.toISOString().slice(0, 7); // "YYYY-MM"

      await prisma.ventaLocal.upsert({
        where: { localId_periodo: { localId, periodo: periodoStr } },
        update: { ventasUf: fila.ventasUf, updatedAt: new Date() },
        create: {
          proyectoId,
          localId,
          periodo: periodoStr,
          ventasUf: fila.ventasUf
        }
      });
      upsertados++;
    }

    await prisma.cargaDatos.create({
      data: {
        proyectoId,
        tipo: "VENTAS",
        usuarioId: session.user.id,
        archivoNombre: file.name,
        archivoUrl: "",
        registrosCargados: upsertados,
        estado: "OK",
        errorDetalle: sinMapeo.length > 0 ? ({ sinMapeo } as object) : undefined
      }
    });

    return NextResponse.json({
      periodos,
      totalFilas: filas.length,
      registrosUpserted: upsertados,
      matchesAutomaticos: nuevosMapeos.length,
      sinMapeo
    });
  } catch (error) {
    return handleApiError(error);
  }
}
