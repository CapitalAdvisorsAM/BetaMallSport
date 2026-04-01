import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";

// Grupos que representan salidas (se muestran en positivo cuando son negativos en la data)
const GRUPOS_COSTO = new Set([
  "VACANCIA G.C. + CONTRIBUCIONES",
  "GASTOS MARKETING",
  "GASTOS INMOBILIARIA",
  "DEPRECIACION",
  "EDI",
  "IMPUESTOS",
  "RESULTADO NO OPERACIONAL"
]);

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get("proyectoId");
    const desde = searchParams.get("desde"); // YYYY-MM
    const hasta = searchParams.get("hasta"); // YYYY-MM

    if (!proyectoId) throw new ApiError(400, "proyectoId requerido.");

    const desdeDate = desde ? new Date(`${desde}-01`) : new Date("2024-01-01");
    const hastaDate = hasta ? new Date(`${hasta}-01`) : new Date();

    const registros = await prisma.registroContable.findMany({
      where: {
        proyectoId,
        periodo: { gte: desdeDate, lte: hastaDate }
      },
      include: { local: { select: { codigo: true, nombre: true } } },
      orderBy: { periodo: "asc" }
    });

    // Obtener periodos únicos ordenados
    const periodosSet = new Set(registros.map((r) => r.periodo.toISOString().slice(0, 7)));
    const periodos = [...periodosSet].sort();

    // Agrupar: grupo1 -> grupo3 -> periodo -> suma
    type Linea = {
      grupo3: string;
      tipo: "ingreso" | "costo";
      porPeriodo: Record<string, number>;
      total: number;
    };
    type Seccion = {
      grupo1: string;
      tipo: "ingreso" | "costo";
      lineas: Linea[];
      porPeriodo: Record<string, number>;
      total: number;
    };

    const seccionMap = new Map<string, Seccion>();

    for (const reg of registros) {
      const tipo: "ingreso" | "costo" = GRUPOS_COSTO.has(reg.grupo1) ? "costo" : "ingreso";
      const periodoKey = reg.periodo.toISOString().slice(0, 7);
      const valor = Number(reg.valorUf);

      if (!seccionMap.has(reg.grupo1)) {
        seccionMap.set(reg.grupo1, { grupo1: reg.grupo1, tipo, lineas: [], porPeriodo: {}, total: 0 });
      }
      const seccion = seccionMap.get(reg.grupo1)!;
      seccion.porPeriodo[periodoKey] = (seccion.porPeriodo[periodoKey] ?? 0) + valor;
      seccion.total += valor;

      let linea = seccion.lineas.find((l) => l.grupo3 === reg.grupo3);
      if (!linea) {
        linea = { grupo3: reg.grupo3, tipo, porPeriodo: {}, total: 0 };
        seccion.lineas.push(linea);
      }
      linea.porPeriodo[periodoKey] = (linea.porPeriodo[periodoKey] ?? 0) + valor;
      linea.total += valor;
    }

    // Calcular EBITDA por periodo
    const ebitdaPorPeriodo: Record<string, number> = {};
    let ebitdaTotal = 0;
    for (const [, sec] of seccionMap) {
      const signo = sec.tipo === "ingreso" ? 1 : -1;
      for (const [p, v] of Object.entries(sec.porPeriodo)) {
        ebitdaPorPeriodo[p] = (ebitdaPorPeriodo[p] ?? 0) + signo * v;
      }
      ebitdaTotal += signo * sec.total;
    }

    return NextResponse.json({
      periodos,
      secciones: [...seccionMap.values()],
      ebitda: { porPeriodo: ebitdaPorPeriodo, total: ebitdaTotal }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
