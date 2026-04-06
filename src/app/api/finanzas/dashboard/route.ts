import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { BELOW_EBITDA_GROUPS } from "@/lib/finanzas/eerr";

type Modo = "mes" | "año" | "ltm";

function getRange(modo: Modo, periodo: string): { desdeDate: Date; hastaDate: Date } {
  if (modo === "mes") {
    const d = new Date(`${periodo}-01`);
    return { desdeDate: d, hastaDate: d };
  }
  if (modo === "año") {
    return {
      desdeDate: new Date(`${periodo}-01-01`),
      hastaDate: new Date(`${periodo}-12-01`)
    };
  }
  // ltm: 12 months ending at periodo
  const end = new Date(`${periodo}-01`);
  const start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
  return { desdeDate: start, hastaDate: end };
}

function shiftYearBack(range: { desdeDate: Date; hastaDate: Date }) {
  return {
    desdeDate: new Date(range.desdeDate.getFullYear() - 1, range.desdeDate.getMonth(), 1),
    hastaDate: new Date(range.hastaDate.getFullYear() - 1, range.hastaDate.getMonth(), 1)
  };
}

function ytdRange(periodo: string) {
  const year = periodo.slice(0, 4);
  return {
    desdeDate: new Date(`${year}-01-01`),
    hastaDate: new Date(`${periodo}-01`)
  };
}

// CDG ya almacena los valores con signo correcto — no se requiere normalización.
function normalizeValor(_grupo1: string, raw: { toString(): string }): number {
  return Number(raw);
}

function sumRegistros(
  registros: { grupo1: string; valorUf: { toString(): string } }[],
  gruposIncluir?: Set<string>
): number {
  return registros.reduce((acc, r) => {
    if (gruposIncluir && !gruposIncluir.has(r.grupo1)) return acc;
    return acc + normalizeValor(r.grupo1, r.valorUf);
  }, 0);
}

function sumEbitda(registros: { grupo1: string; valorUf: { toString(): string } }[]): number {
  return registros.reduce((acc, r) => {
    if (BELOW_EBITDA_GROUPS.has(r.grupo1)) return acc;
    return acc + normalizeValor(r.grupo1, r.valorUf);
  }, 0);
}

async function queryPeriod(proyectoId: string, desde: Date, hasta: Date) {
  return prisma.registroContable.findMany({
    where: { proyectoId, periodo: { gte: desde, lte: hasta } },
    select: { grupo1: true, periodo: true, valorUf: true }
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get("proyectoId");
    const modo = (searchParams.get("modo") ?? "mes") as Modo;
    const periodo = searchParams.get("periodo");

    if (!proyectoId) throw new ApiError(400, "proyectoId requerido.");
    if (!periodo) throw new ApiError(400, "periodo requerido.");

    const range = getRange(modo, periodo);
    const priorRange = shiftYearBack(range);

    // Fetch registros for current and prior period in parallel
    const [registrosActual, registrosPrior, localesGLA, contratos] = await Promise.all([
      queryPeriod(proyectoId, range.desdeDate, range.hastaDate),
      queryPeriod(proyectoId, priorRange.desdeDate, priorRange.hastaDate),
      prisma.local.findMany({
        where: { proyectoId, esGLA: true },
        select: { id: true, glam2: true }
      }),
      modo === "mes"
        ? prisma.contrato.findMany({
            where: {
              proyectoId,
              fechaInicio: { lte: range.desdeDate },
              fechaTermino: { gte: range.desdeDate }
            },
            select: { localId: true }
          })
        : Promise.resolve([])
    ]);

    const INGRESOS_G1 = new Set(["INGRESOS DE EXPLOTACION"]);
    const ingresosActual = sumRegistros(registrosActual, INGRESOS_G1);
    const ingresosAnterior = sumRegistros(registrosPrior, INGRESOS_G1);
    const ebitdaActual = sumEbitda(registrosActual);
    const ebitdaAnterior = sumEbitda(registrosPrior);

    // YTD (only for modo=mes)
    let ytdIngresos: { actual: number; anterior: number } | null = null;
    let ytdEbitda: { actual: number; anterior: number } | null = null;
    if (modo === "mes") {
      const ytd = ytdRange(periodo);
      const priorYtd = shiftYearBack(ytd);
      const [ytdRegs, priorYtdRegs] = await Promise.all([
        queryPeriod(proyectoId, ytd.desdeDate, ytd.hastaDate),
        queryPeriod(proyectoId, priorYtd.desdeDate, priorYtd.hastaDate)
      ]);
      ytdIngresos = {
        actual: sumRegistros(ytdRegs, INGRESOS_G1),
        anterior: sumRegistros(priorYtdRegs, INGRESOS_G1)
      };
      ytdEbitda = {
        actual: sumEbitda(ytdRegs),
        anterior: sumEbitda(priorYtdRegs)
      };
    }

    // UF/m2
    const totalGlam2 = localesGLA.reduce((s, l) => s + Number(l.glam2), 0);
    const ufPorm2 = totalGlam2 > 0 ? ingresosActual / totalGlam2 : null;

    // Vacancia (mes mode only)
    let vacanciaPct: number | null = null;
    const totalLocalesGLA = localesGLA.length;
    let localesOcupados = 0;
    if (modo === "mes" && contratos.length >= 0) {
      const ocupadosSet = new Set((contratos as { localId: string }[]).map((c) => c.localId));
      localesOcupados = localesGLA.filter((l) => ocupadosSet.has(l.id)).length;
      vacanciaPct = totalLocalesGLA > 0 ? ((totalLocalesGLA - localesOcupados) / totalLocalesGLA) * 100 : null;
    }

    // Gráfico: monthly series for the range period + prior year
    // Build month list from range
    const meses: string[] = [];
    const cur = new Date(range.desdeDate);
    while (cur <= range.hastaDate) {
      meses.push(cur.toISOString().slice(0, 7));
      cur.setMonth(cur.getMonth() + 1);
    }

    const ingByMonth = new Map<string, number>();
    const ebitdaByMonth = new Map<string, number>();
    const ingPriorByMonth = new Map<string, number>();

    for (const r of registrosActual) {
      const p = r.periodo.toISOString().slice(0, 7);
      const v = normalizeValor(r.grupo1, r.valorUf);
      if (r.grupo1 === "INGRESOS DE EXPLOTACION") ingByMonth.set(p, (ingByMonth.get(p) ?? 0) + v);
      if (!BELOW_EBITDA_GROUPS.has(r.grupo1)) ebitdaByMonth.set(p, (ebitdaByMonth.get(p) ?? 0) + v);
    }
    for (const r of registrosPrior) {
      const priorDate = r.periodo;
      const alignedKey = `${priorDate.getFullYear() + 1}-${String(priorDate.getMonth() + 1).padStart(2, "0")}`;
      if (r.grupo1 === "INGRESOS DE EXPLOTACION") {
        ingPriorByMonth.set(alignedKey, (ingPriorByMonth.get(alignedKey) ?? 0) + normalizeValor(r.grupo1, r.valorUf));
      }
    }

    const grafico = {
      meses,
      ingresosActual: meses.map((m) => ingByMonth.get(m) ?? 0),
      ingresosAnterior: meses.map((m) => ingPriorByMonth.get(m) ?? 0),
      ebitdaActual: meses.map((m) => ebitdaByMonth.get(m) ?? 0)
    };

    // EE.RR summary table
    const seccionesMap = new Map<string, { actual: number; anterior: number }>();
    for (const r of registrosActual) {
      const s = seccionesMap.get(r.grupo1) ?? { actual: 0, anterior: 0 };
      s.actual += normalizeValor(r.grupo1, r.valorUf);
      seccionesMap.set(r.grupo1, s);
    }
    for (const r of registrosPrior) {
      const s = seccionesMap.get(r.grupo1) ?? { actual: 0, anterior: 0 };
      s.anterior += normalizeValor(r.grupo1, r.valorUf);
      seccionesMap.set(r.grupo1, s);
    }
    const seccionesEerr = [...seccionesMap.entries()].map(([grupo1, v]) => ({ grupo1, ...v }));

    return NextResponse.json({
      kpis: {
        ingresos: { actual: ingresosActual, anterior: ingresosAnterior },
        ebitda: {
          actual: ebitdaActual,
          anterior: ebitdaAnterior,
          margenPct: ingresosActual !== 0 ? (ebitdaActual / ingresosActual) * 100 : null
        },
        ytdIngresos,
        ytdEbitda,
        ufPorm2,
        vacanciaPct,
        totalLocalesGLA,
        localesOcupados
      },
      grafico,
      seccionesEerr
    });
  } catch (error) {
    return handleApiError(error);
  }
}
