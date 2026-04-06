import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { parseContable, similarity } from "@/lib/finanzas/parse-contable";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const proyectoId = formData.get("proyectoId") as string | null;

    if (!file || !proyectoId) throw new ApiError(400, "Se requiere archivo y proyectoId.");
    if (file.size > 30 * 1024 * 1024) throw new ApiError(400, "El archivo no puede superar 30 MB.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const filas = parseContable(buffer);

    if (filas.length === 0) throw new ApiError(400, "No se encontraron filas con Ce.coste = 'Real'.");

    // Cargar locales y arrendatarios del proyecto
    const locales = await prisma.unit.findMany({
      where: { proyectoId },
      select: { id: true, codigo: true, nombre: true }
    });
    // Mapeos existentes de locales contables
    const mapeosExistentes = await prisma.mapeoLocalContable.findMany({
      where: { proyectoId },
      select: { localExterno: true, localId: true }
    });
    const mapeoLocalMap = new Map(mapeosExistentes.map((m) => [m.localExterno, m.localId]));

    // Códigos únicos en el archivo
    const codigosUnicos = [...new Set(filas.map((f) => f.localCodigo))];
    const sinMapeo: { localCodigo: string; arrendatarioNombre: string; sugerencias: { codigo: string; nombre: string; score: number }[] }[] = [];
    const nuevosMapeos: { proyectoId: string; localExterno: string; localId: string; creadoPor: string }[] = [];

    for (const codigo of codigosUnicos) {
      if (mapeoLocalMap.has(codigo)) continue;

      // 1. Match exacto por código
      const exacto = locales.find((l) => l.codigo === codigo || l.codigo === `L${codigo}`);
      if (exacto) {
        mapeoLocalMap.set(codigo, exacto.id);
        nuevosMapeos.push({ proyectoId, localExterno: codigo, localId: exacto.id, creadoPor: session.user.id });
        continue;
      }

      // 2. Match por nombre del arrendatario en la fila
      const arrendatarioNombreEnFila = filas.find((f) => f.localCodigo === codigo)?.arrendatarioNombre ?? "";
      if (arrendatarioNombreEnFila) {
        const porNombre = locales
          .map((l) => ({
            ...l,
            score: Math.max(
              similarity(arrendatarioNombreEnFila, l.nombre),
              similarity(arrendatarioNombreEnFila, l.codigo)
            )
          }))
          .sort((a, b) => b.score - a.score);

        if (porNombre[0] && porNombre[0].score >= 0.75) {
          mapeoLocalMap.set(codigo, porNombre[0].id);
          nuevosMapeos.push({ proyectoId, localExterno: codigo, localId: porNombre[0].id, creadoPor: session.user.id });
          continue;
        }

        sinMapeo.push({
          localCodigo: codigo,
          arrendatarioNombre: arrendatarioNombreEnFila,
          sugerencias: porNombre.slice(0, 3).map((l) => ({ codigo: l.codigo, nombre: l.nombre, score: l.score }))
        });
      } else {
        sinMapeo.push({ localCodigo: codigo, arrendatarioNombre: "", sugerencias: [] });
      }
    }

    if (nuevosMapeos.length > 0) {
      await prisma.mapeoLocalContable.createMany({ data: nuevosMapeos, skipDuplicates: true });
    }

    // Obtener arrendatarioId por localId (via contrato vigente)
    const contratosPorLocal = await prisma.contract.findMany({
      where: { proyectoId, estado: { in: ["VIGENTE", "GRACIA"] } },
      select: { localId: true, arrendatarioId: true }
    });
    const arrendatarioPorLocal = new Map(contratosPorLocal.map((c) => [c.localId, c.arrendatarioId]));

    // Construir registros
    const periodos = [...new Set(filas.map((f) => f.mes.toISOString().slice(0, 7)))];
    const registros: {
      proyectoId: string;
      localId: string;
      arrendatarioId: string | null;
      periodo: Date;
      grupo1: string;
      grupo3: string;
      denominacion: string;
      valorUf: number;
      categoriaTamano: string | null;
      categoriaTipo: string | null;
      piso: string | null;
    }[] = [];

    for (const fila of filas) {
      const localId = mapeoLocalMap.get(fila.localCodigo);
      if (!localId) continue;
      const arrendatarioId = arrendatarioPorLocal.get(localId) ?? null;

      registros.push({
        proyectoId,
        localId,
        arrendatarioId,
        periodo: fila.mes,
        grupo1: fila.grupo1,
        grupo3: fila.grupo3,
        denominacion: fila.denominacion || fila.grupo3,
        valorUf: fila.valorUf,
        categoriaTamano: fila.categoriaTamano || null,
        categoriaTipo: fila.categoriaTipo || null,
        piso: fila.piso || null
      });
    }

    // Reemplazar data del mismo periodo
    let insertados = 0;
    if (registros.length > 0) {
      for (const periodo of periodos) {
        await prisma.registroContable.deleteMany({
          where: { proyectoId, periodo: new Date(`${periodo}-01`) }
        });
      }
      const result = await prisma.registroContable.createMany({ data: registros, skipDuplicates: true });
      insertados = result.count;
    }

    await prisma.cargaDatos.create({
      data: {
        proyectoId,
        tipo: "CONTABLE",
        usuarioId: session.user.id,
        archivoNombre: file.name,
        archivoUrl: "",
        registrosCargados: insertados,
        estado: "OK",
        errorDetalle: sinMapeo.length > 0 ? ({ sinMapeo } as object) : undefined
      }
    });

    return NextResponse.json({
      periodos,
      totalFilas: filas.length,
      registrosInsertados: insertados,
      matchesAutomaticos: nuevosMapeos.length,
      sinMapeo
    });
  } catch (error) {
    return handleApiError(error);
  }
}
