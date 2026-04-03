import type { EerrCategoria, EerrData, EerrDetalleResponse, EerrLine, EerrLocalDetalle, EerrSection } from "@/types/finanzas";

type NumericLike = number | string | { toString(): string };

type RegistroContableBase = {
  grupo1: string;
  grupo3: string;
  periodo: Date;
  valorUf: NumericLike;
};

export type RegistroContableDetalle = {
  periodo: Date;
  valorUf: NumericLike;
  categoriaTipo: string | null;
  localId: string | null;
  local: { codigo: string; nombre: string } | null;
  arrendatario: { nombreComercial: string } | null;
};

// Grupos que van SOBRE el EBITDA (costos operacionales)
export const OPERATING_COST_GROUPS = new Set([
  "VACANCIA G.C. + CONTRIBUCIONES",
  "GASTOS MARKETING",
  "GASTOS INMOBILIARIA",
]);

// Grupos BAJO el EBITDA (no operacionales)
export const BELOW_EBITDA_GROUPS = new Set([
  "DEPRECIACION",
  "EDI",
  "IMPUESTOS",
  "RESULTADO NO OPERACIONAL",
]);

export const COST_GROUPS = new Set([...OPERATING_COST_GROUPS, ...BELOW_EBITDA_GROUPS]);

// Orden preferido de secciones para el EE.RR
const SECTION_ORDER = [
  "INGRESOS DE EXPLOTACION",
  "VACANCIA G.C. + CONTRIBUCIONES",
  "GASTOS MARKETING",
  "GASTOS INMOBILIARIA",
  "DEPRECIACION",
  "EDI",
  "RESULTADO NO OPERACIONAL",
  "IMPUESTOS",
];

/** Formatea un valor UF para el EE.RR: negativos en paréntesis, puntos de miles */
export function formatEerr(value: number, decimals = 0): string {
  if (value === 0) return "—";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("es-CL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return value < 0 ? `(${formatted})` : formatted;
}

export function calculateEbitdaMargin(ingresos: number, ebitda: number): number | null {
  return ingresos !== 0 ? (ebitda / ingresos) * 100 : null;
}

export function buildEerrData(registros: RegistroContableBase[]): EerrData {
  const periodos = [
    ...new Set(registros.map((r) => r.periodo.toISOString().slice(0, 7)))
  ].sort();

  const sections = new Map<string, EerrSection>();

  for (const registro of registros) {
    const tipo: "ingreso" | "costo" = COST_GROUPS.has(registro.grupo1) ? "costo" : "ingreso";
    const periodoKey = registro.periodo.toISOString().slice(0, 7);
    const valor = Number(registro.valorUf);

    let section = sections.get(registro.grupo1);
    if (!section) {
      section = { grupo1: registro.grupo1, tipo, lineas: [], porPeriodo: {}, total: 0 };
      sections.set(registro.grupo1, section);
    }

    section.porPeriodo[periodoKey] = (section.porPeriodo[periodoKey] ?? 0) + valor;
    section.total += valor;

    let line = section.lineas.find((l) => l.grupo3 === registro.grupo3);
    if (!line) {
      line = { grupo3: registro.grupo3, tipo, porPeriodo: {}, total: 0 };
      section.lineas.push(line);
    }
    line.porPeriodo[periodoKey] = (line.porPeriodo[periodoKey] ?? 0) + valor;
    line.total += valor;
  }

  // EBITDA = suma de todas las secciones SOBRE la línea (valores ya vienen con signo del CDG)
  const ebitda = { porPeriodo: {} as Record<string, number>, total: 0 };
  const ebit   = { porPeriodo: {} as Record<string, number>, total: 0 };

  sections.forEach((section) => {
    const isAbove = !BELOW_EBITDA_GROUPS.has(section.grupo1);
    for (const [p, v] of Object.entries(section.porPeriodo)) {
      if (isAbove) ebitda.porPeriodo[p] = (ebitda.porPeriodo[p] ?? 0) + v;
      ebit.porPeriodo[p] = (ebit.porPeriodo[p] ?? 0) + v;
    }
    if (isAbove) ebitda.total += section.total;
    ebit.total += section.total;
  });

  // Ordenar secciones según orden preferido del EE.RR
  const secciones = [...sections.values()].sort((a, b) => {
    const ia = SECTION_ORDER.indexOf(a.grupo1);
    const ib = SECTION_ORDER.indexOf(b.grupo1);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return { periodos, secciones, ebitda, ebit };
}

export function buildEerrDetalle(registros: RegistroContableDetalle[]): EerrDetalleResponse {
  const catMap = new Map<string, { cat: EerrCategoria; localMap: Map<string, EerrLocalDetalle> }>();

  for (const r of registros) {
    const catKey = r.categoriaTipo ?? "Sin categoría";
    const periodoKey = r.periodo.toISOString().slice(0, 7);
    const valor = Number(r.valorUf);

    if (!catMap.has(catKey)) {
      catMap.set(catKey, {
        cat: { categoriaTipo: catKey, porPeriodo: {}, total: 0, locales: [] },
        localMap: new Map()
      });
    }
    const { cat, localMap } = catMap.get(catKey)!;
    cat.porPeriodo[periodoKey] = (cat.porPeriodo[periodoKey] ?? 0) + valor;
    cat.total += valor;

    if (!r.localId || !r.local) continue; // skip property-level rows for drill-down

    if (!localMap.has(r.localId)) {
      const loc: EerrLocalDetalle = {
        localId: r.localId,
        localCodigo: r.local.codigo,
        localNombre: r.local.nombre,
        arrendatarioNombre: r.arrendatario?.nombreComercial ?? null,
        porPeriodo: {},
        total: 0
      };
      localMap.set(r.localId, loc);
      cat.locales.push(loc);
    }
    const loc = localMap.get(r.localId)!;
    loc.porPeriodo[periodoKey] = (loc.porPeriodo[periodoKey] ?? 0) + valor;
    loc.total += valor;
  }

  return { categorias: [...catMap.values()].map(({ cat }) => cat) };
}
