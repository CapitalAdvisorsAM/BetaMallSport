import type { EerrCategoria, EerrData, EerrDetalleResponse, EerrLocalDetalle, EerrSection } from "@/types/finance";

type NumericLike = number | string | { toString(): string };

type RegistroContableBase = {
  grupo1: string;
  grupo3: string;
  periodo: Date;
  valorUf: NumericLike;
};

export type RegistroContableDetalle = {
  grupo1: string;
  periodo: Date;
  valorUf: NumericLike;
  categoriaTipo: string | null;
  localId: string | null;
  arrendatarioId: string | null;
  local: { codigo: string; nombre: string } | null;
  arrendatario: { nombreComercial: string } | null;
};

// Grupos que van SOBRE el EBITDA (costos operacionales)
export const OPERATING_COST_GROUPS = new Set([
  "VACANCIA G.C. + CONTRIBUCIONES",
  "GASTOS MARKETING",
  "GASTOS INMOBILIARIA",
]);

// Grupos entre EBITDA y EBIT (depreciación / amortización)
export const EBIT_GROUPS = new Set([
  "DEPRECIACION",
  "EDI",
]);

// Grupos entre EBIT y Resultado del Ejercicio
export const RESULTADO_GROUPS = new Set([
  "RESULTADO NO OPERACIONAL",
  "IMPUESTOS",
]);

// Unión — todos los grupos bajo el EBITDA
export const BELOW_EBITDA_GROUPS = new Set([...EBIT_GROUPS, ...RESULTADO_GROUPS]);

export const COST_GROUPS = new Set([...OPERATING_COST_GROUPS, ...BELOW_EBITDA_GROUPS]);

// Orden de líneas (grupo3) dentro de cada sección — igual al CDG EE.RR sheet
export const LINE_ORDER: Record<string, string[]> = {
  "INGRESOS DE EXPLOTACION": [
    "ARRIENDO DE LOCAL FIJO",
    "ARRIENDO DE LOCAL VARIABLE",
    "SIMULADORES Y MODULO",
    "ARRIENDO DE ESPACIO",
    "ARRIENDO BODEGA",
    "INGRESOS POR VENTA DE ENERGIA",
    "Otros Ingresos.",
    "5% ADMINISTRACION GASTO COMUN",
    "INGRESO  MARKETING",
  ],
  "VACANCIA G.C. + CONTRIBUCIONES": [
    "Contribuciones",
    "Gastos Operaciones",
    "Mano de Obra y Gastos del Personal",
    "Gastos Administración",
    "RECUPERACION GASTOS COMUNES",
  ],
  "GASTOS MARKETING": [
    "FONDO DE PROMOCION",
    "Auspicios / Ferias Externas",
    "BTL / Eventos / Ferias Internas",
    "Medios",
    "POP / Merchandising",
    "Publicidad y Campaña",
    "Finelizacion y Experiencia",
    "Sitio WEB",
    "Varios MK",
  ],
  "GASTOS INMOBILIARIA": [
    "Gastos Administración Inmobiliaria",
    "Honorarios Externos",
  ],
};

// Orden preferido de secciones para el EE.RR
export const SECTION_ORDER = [
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

export type BudgetRegistro = {
  grupo1: string;
  grupo3: string;
  periodo: Date;
  valorUf: NumericLike;
};

export type BuildEerrDataOptions = {
  /** Presupuesto por grupo contable (ExpenseBudget + ingresos si se desea). */
  budgets?: BudgetRegistro[] | null;
};

function computeVariance(real: number, ppto: number | null): { varianzaTotal: number | null; varianzaPct: number | null } {
  if (ppto === null) return { varianzaTotal: null, varianzaPct: null };
  const varianzaTotal = real - ppto;
  if (ppto === 0) return { varianzaTotal, varianzaPct: null };
  return { varianzaTotal, varianzaPct: (varianzaTotal / Math.abs(ppto)) * 100 };
}

export function buildEerrData(
  registros: RegistroContableBase[],
  options: BuildEerrDataOptions = {}
): EerrData {
  const budgets = options.budgets ?? [];
  const periodosSet = new Set<string>(registros.map((r) => r.periodo.toISOString().slice(0, 7)));
  for (const b of budgets) {
    periodosSet.add(b.periodo.toISOString().slice(0, 7));
  }
  const periodos = [...periodosSet].sort();

  const sections = new Map<string, EerrSection>();

  for (const registro of registros) {
    const tipo: "ingreso" | "costo" = OPERATING_COST_GROUPS.has(registro.grupo1) ? "costo" : "ingreso";
    const periodoKey = registro.periodo.toISOString().slice(0, 7);
    // CDG ya almacena los valores con signo correcto — sin negación adicional.
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

  // Inyectar presupuesto (sin crear lineas nuevas si el real no existe — sí se crean para que aparezcan)
  for (const b of budgets) {
    const tipo: "ingreso" | "costo" = OPERATING_COST_GROUPS.has(b.grupo1) ? "costo" : "ingreso";
    const periodoKey = b.periodo.toISOString().slice(0, 7);
    const valor = Number(b.valorUf);

    let section = sections.get(b.grupo1);
    if (!section) {
      section = {
        grupo1: b.grupo1,
        tipo,
        lineas: [],
        porPeriodo: {},
        total: 0,
        presupuestoPorPeriodo: {},
        presupuestoTotal: 0
      };
      sections.set(b.grupo1, section);
    }
    if (!section.presupuestoPorPeriodo) section.presupuestoPorPeriodo = {};
    section.presupuestoPorPeriodo[periodoKey] = (section.presupuestoPorPeriodo[periodoKey] ?? 0) + valor;
    section.presupuestoTotal = (section.presupuestoTotal ?? 0) + valor;

    let line = section.lineas.find((l) => l.grupo3 === b.grupo3);
    if (!line) {
      line = {
        grupo3: b.grupo3,
        tipo,
        porPeriodo: {},
        total: 0,
        presupuestoPorPeriodo: {},
        presupuestoTotal: 0
      };
      section.lineas.push(line);
    }
    if (!line.presupuestoPorPeriodo) line.presupuestoPorPeriodo = {};
    line.presupuestoPorPeriodo[periodoKey] = (line.presupuestoPorPeriodo[periodoKey] ?? 0) + valor;
    line.presupuestoTotal = (line.presupuestoTotal ?? 0) + valor;
  }

  const ebitda    = { porPeriodo: {} as Record<string, number>, total: 0 };
  const ebit      = { porPeriodo: {} as Record<string, number>, total: 0 };
  const resultado = { porPeriodo: {} as Record<string, number>, total: 0 };
  const pptoEbitda    = { porPeriodo: {} as Record<string, number>, total: 0 };
  const pptoEbit      = { porPeriodo: {} as Record<string, number>, total: 0 };
  const pptoResultado = { porPeriodo: {} as Record<string, number>, total: 0 };
  const hasBudgets = budgets.length > 0;

  sections.forEach((section) => {
    const isAbove    = !BELOW_EBITDA_GROUPS.has(section.grupo1);
    const isEbitLine = EBIT_GROUPS.has(section.grupo1);

    for (const [p, v] of Object.entries(section.porPeriodo)) {
      if (isAbove)               ebitda.porPeriodo[p]    = (ebitda.porPeriodo[p]    ?? 0) + v;
      if (isAbove || isEbitLine) ebit.porPeriodo[p]      = (ebit.porPeriodo[p]      ?? 0) + v;
                                 resultado.porPeriodo[p] = (resultado.porPeriodo[p] ?? 0) + v;
    }
    if (isAbove)               ebitda.total    += section.total;
    if (isAbove || isEbitLine) ebit.total      += section.total;
                               resultado.total += section.total;

    if (hasBudgets && section.presupuestoPorPeriodo) {
      for (const [p, v] of Object.entries(section.presupuestoPorPeriodo)) {
        if (isAbove)               pptoEbitda.porPeriodo[p]    = (pptoEbitda.porPeriodo[p]    ?? 0) + v;
        if (isAbove || isEbitLine) pptoEbit.porPeriodo[p]      = (pptoEbit.porPeriodo[p]      ?? 0) + v;
                                   pptoResultado.porPeriodo[p] = (pptoResultado.porPeriodo[p] ?? 0) + v;
      }
      if (isAbove)               pptoEbitda.total    += section.presupuestoTotal ?? 0;
      if (isAbove || isEbitLine) pptoEbit.total      += section.presupuestoTotal ?? 0;
                                 pptoResultado.total += section.presupuestoTotal ?? 0;
    }
  });

  // Calcular varianzas para secciones y líneas
  if (hasBudgets) {
    sections.forEach((section) => {
      const sectionPpto = section.presupuestoTotal ?? null;
      const sectionVar = computeVariance(section.total, sectionPpto);
      section.varianzaTotal = sectionVar.varianzaTotal;
      section.varianzaPct = sectionVar.varianzaPct;

      for (const line of section.lineas) {
        const linePpto = line.presupuestoTotal ?? null;
        const lineVar = computeVariance(line.total, linePpto);
        line.varianzaTotal = lineVar.varianzaTotal;
        line.varianzaPct = lineVar.varianzaPct;
      }
    });
  }

  // Ordenar secciones según orden preferido del EE.RR
  const secciones = [...sections.values()].sort((a, b) => {
    const ia = SECTION_ORDER.indexOf(a.grupo1);
    const ib = SECTION_ORDER.indexOf(b.grupo1);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  // Ordenar líneas (grupo3) dentro de cada sección según orden CDG
  secciones.forEach((s) => {
    const order = LINE_ORDER[s.grupo1];
    if (order) {
      s.lineas.sort((a, b) => {
        const ia = order.indexOf(a.grupo3);
        const ib = order.indexOf(b.grupo3);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
    }
  });

  return {
    periodos,
    secciones,
    ebitda,
    ebit,
    resultado,
    presupuestoEbitda:    hasBudgets ? pptoEbitda    : null,
    presupuestoEbit:      hasBudgets ? pptoEbit      : null,
    presupuestoResultado: hasBudgets ? pptoResultado : null
  };
}

export function buildEerrDetalle(registros: RegistroContableDetalle[]): EerrDetalleResponse {
  const catMap = new Map<string, { cat: EerrCategoria; localMap: Map<string, EerrLocalDetalle> }>();

  for (const r of registros) {
    const catKey = r.categoriaTipo ?? "Sin categoría";
    const periodoKey = r.periodo.toISOString().slice(0, 7);
    // CDG ya almacena los valores con signo correcto — sin negación adicional.
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
        arrendatarioId: r.arrendatarioId ?? null,
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


