export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";

// Convierte número serial de Excel a Date (primer día del mes)
function excelSerialToDate(serial: number): Date {
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function normStr(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toUpperCase();
}

// Similaridad simple basada en caracteres comunes (Jaccard sobre bigramas)
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const getBigrams = (str: string) => {
    const s = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) s.add(str.slice(i, i + 2));
    return s;
  };
  const ba = getBigrams(a);
  const bb = getBigrams(b);
  let intersection = 0;
  for (const bg of ba) if (bb.has(bg)) intersection++;
  return (2 * intersection) / (ba.size + bb.size);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const proyectoId = formData.get("proyectoId") as string | null;

    if (!file || !proyectoId) {
      throw new ApiError(400, "Se requiere archivo y proyectoId.");
    }
    if (file.size > 15 * 1024 * 1024) {
      throw new ApiError(400, "El archivo no puede superar 15 MB.");
    }

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(Buffer.from(buffer), { type: "buffer" });
    const ws = wb.Sheets["Maestro"];
    if (!ws) {
      throw new ApiError(400, 'El archivo no contiene la hoja "Maestro".');
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

    // Obtener todos los locales del proyecto para matching
    const locales = await prisma.local.findMany({
      where: { proyectoId },
      select: { id: true, codigo: true, nombre: true }
    });

    // Obtener mapeos ya existentes
    const mapeosExistentes = await prisma.mapeoLocalContable.findMany({
      where: { proyectoId },
      select: { localExterno: true, localId: true }
    });
    const mapeoMap = new Map(mapeosExistentes.map((m) => [m.localExterno, m.localId]));

    // Locales únicos en el archivo
    const externosUnicos = [...new Set(rows.map((r) => normStr(r["Local"])).filter(Boolean))];

    // Para cada externo sin mapeo, buscar el mejor match
    const sinMapeo: { localExterno: string; sugerencias: { localId: string; codigo: string; nombre: string; score: number }[] }[] = [];
    const nuevosMapeos: { proyectoId: string; localExterno: string; localId: string; creadoPor: string }[] = [];

    for (const ext of externosUnicos) {
      if (mapeoMap.has(ext)) continue;

      // Intentar match exacto primero
      const exacto = locales.find((l) => normStr(l.codigo) === ext || normStr(l.nombre) === ext);
      if (exacto) {
        mapeoMap.set(ext, exacto.id);
        nuevosMapeos.push({ proyectoId, localExterno: ext, localId: exacto.id, creadoPor: session.user.id });
        continue;
      }

      // Fuzzy match
      const scored = locales
        .map((l) => ({
          localId: l.id,
          codigo: l.codigo,
          nombre: l.nombre,
          score: Math.max(similarity(ext, normStr(l.codigo)), similarity(ext, normStr(l.nombre)))
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      const best = scored[0];
      if (best && best.score >= 0.75) {
        mapeoMap.set(ext, best.localId);
        nuevosMapeos.push({ proyectoId, localExterno: ext, localId: best.localId, creadoPor: session.user.id });
      } else {
        sinMapeo.push({ localExterno: ext, sugerencias: scored });
      }
    }

    // Guardar nuevos mapeos automáticos
    if (nuevosMapeos.length > 0) {
      await prisma.mapeoLocalContable.createMany({ data: nuevosMapeos, skipDuplicates: true });
    }

    // Procesar registros
    let periodo: Date | null = null;
    const registros: {
      proyectoId: string;
      localId: string;
      periodo: Date;
      grupo1: string;
      grupo3: string;
      denominacion: string;
      valorUf: number;
    }[] = [];

    for (const row of rows) {
      const localExt = normStr(row["Local"]);
      const localId = mapeoMap.get(localExt);
      if (!localId) continue;

      const mesRaw = row["Mes"];
      const periodoRow =
        typeof mesRaw === "number" ? excelSerialToDate(mesRaw) : new Date(String(mesRaw));
      if (!periodo) periodo = periodoRow;

      const valorUf = parseFloat(String(row["Valor UF"] ?? "0").replace(",", "."));
      if (isNaN(valorUf)) continue;

      registros.push({
        proyectoId,
        localId,
        periodo: periodoRow,
        grupo1: String(row["GRUPO 1"] ?? "").trim(),
        grupo3: String(row["GRUPO 3"] ?? "").trim(),
        denominacion: String(row["Denominación objeto"] ?? "").trim(),
        valorUf
      });
    }

    // Upsert registros contables
    let insertados = 0;
    if (registros.length > 0) {
      // Borrar registros del mismo periodo/proyecto antes de insertar (reemplazo mensual)
      if (periodo) {
        await prisma.registroContable.deleteMany({
          where: { proyectoId, periodo }
        });
      }
      const result = await prisma.registroContable.createMany({ data: registros, skipDuplicates: true });
      insertados = result.count;
    }

    // Registrar en CargaDatos
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
      periodo: periodo?.toISOString().slice(0, 7) ?? null,
      totalFilas: rows.length,
      registrosInsertados: insertados,
      matchesAutomaticos: nuevosMapeos.length,
      sinMapeo
    });
  } catch (error) {
    return handleApiError(error);
  }
}
