import type { EerrData, EerrLine, EerrSection } from "@/types/finanzas";

type NumericLike = number | string | { toString(): string };

type RegistroContableBase = {
  grupo1: string;
  grupo3: string;
  periodo: Date;
  valorUf: NumericLike;
};

export const COST_GROUPS = new Set([
  "VACANCIA G.C. + CONTRIBUCIONES",
  "GASTOS MARKETING",
  "GASTOS INMOBILIARIA",
  "DEPRECIACION",
  "EDI",
  "IMPUESTOS",
  "RESULTADO NO OPERACIONAL"
]);

export function getEerrValueTone(tipo: "ingreso" | "costo", valor: number): string {
  if (valor === 0) {
    return "text-slate-400";
  }
  if (tipo === "ingreso") {
    return valor > 0 ? "text-emerald-700" : "text-red-600";
  }
  return valor < 0 ? "text-red-600" : "text-slate-700";
}

export function calculateEbitdaMargin(ingresos: number, ebitda: number): number | null {
  return ingresos !== 0 ? (ebitda / ingresos) * 100 : null;
}

export function buildEerrData(
  registros: RegistroContableBase[]
): EerrData {
  const periodos = [...new Set(registros.map((registro) => registro.periodo.toISOString().slice(0, 7)))].sort();
  const sections = new Map<string, EerrSection>();

  registros.forEach((registro) => {
    const tipo: "ingreso" | "costo" = COST_GROUPS.has(registro.grupo1) ? "costo" : "ingreso";
    const periodoKey = registro.periodo.toISOString().slice(0, 7);
    const valor = Number(registro.valorUf);

    const section =
      sections.get(registro.grupo1) ??
      ({
        grupo1: registro.grupo1,
        tipo,
        lineas: [],
        porPeriodo: {},
        total: 0
      } satisfies EerrSection);

    if (!sections.has(registro.grupo1)) {
      sections.set(registro.grupo1, section);
    }

    section.porPeriodo[periodoKey] = (section.porPeriodo[periodoKey] ?? 0) + valor;
    section.total += valor;

    let line = section.lineas.find((candidate) => candidate.grupo3 === registro.grupo3);
    if (!line) {
      line = {
        grupo3: registro.grupo3,
        tipo,
        porPeriodo: {},
        total: 0
      } satisfies EerrLine;
      section.lineas.push(line);
    }

    line.porPeriodo[periodoKey] = (line.porPeriodo[periodoKey] ?? 0) + valor;
    line.total += valor;
  });

  const ebitda = {
    porPeriodo: {} as Record<string, number>,
    total: 0
  };

  sections.forEach((section) => {
    const sign = section.tipo === "ingreso" ? 1 : -1;
    Object.entries(section.porPeriodo).forEach(([periodo, value]) => {
      ebitda.porPeriodo[periodo] = (ebitda.porPeriodo[periodo] ?? 0) + sign * value;
    });
    ebitda.total += sign * section.total;
  });

  return {
    periodos,
    secciones: [...sections.values()],
    ebitda
  };
}
