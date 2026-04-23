import type { PeriodoMetrica } from "@/types/rent-roll-timeline";

export type PeriodoField =
  | "pctOcupacionGLA"
  | "waltMeses"
  | "glaArrendadaM2"
  | "glaTotalM2"
  | "glaVacanteM2"
  | "rentaFijaUf"
  | "contratosActivos"
  | "ingresosFijoUf"
  | "ingresosSimuladorModuloUf"
  | "ingresosBodegaEspacioUf"
  | "ingresosTotalUf"
  | "ingresosPorM2Uf"
  | "contratosQueVencenEsteMes"
  // Variable rent fields (null when no VentaLocal data exists)
  | "rentaVariableUf"
  | "ventasTotalUf"
  | "pctRentaVariableContratoPromedio"
  | "pctRentaVariableEnIngresos"
  | "ingresosTotalConVariableUf"
  | "ventasPorM2Uf";

export type DisplayFormat = "number" | "uf" | "percent" | "m2" | "months";

export type FormulaConfig =
  | { type: "single"; field: PeriodoField; format: DisplayFormat }
  | {
      type: "binary";
      fieldA: PeriodoField;
      operator: "+" | "-" | "*" | "/";
      fieldB: PeriodoField;
      format: DisplayFormat;
    };

export const PERIODO_FIELD_CATALOG: Record<
  PeriodoField,
  { label: string; defaultFormat: DisplayFormat }
> = {
  pctOcupacionGLA:                   { label: "% Ocupación GLA",                    defaultFormat: "percent" },
  waltMeses:                         { label: "WALT (meses)",                        defaultFormat: "months"  },
  glaArrendadaM2:                    { label: "GLA Arrendada",                       defaultFormat: "m2"      },
  glaTotalM2:                        { label: "GLA Total",                           defaultFormat: "m2"      },
  glaVacanteM2:                      { label: "GLA Vacante",                         defaultFormat: "m2"      },
  rentaFijaUf:                       { label: "Renta Fija",                          defaultFormat: "uf"      },
  contratosActivos:                  { label: "Contratos Activos",                   defaultFormat: "number"  },
  ingresosFijoUf:                    { label: "Ingresos Fijos",                      defaultFormat: "uf"      },
  ingresosSimuladorModuloUf:         { label: "Ingr. Simuladores/Mod.",              defaultFormat: "uf"      },
  ingresosBodegaEspacioUf:           { label: "Ingr. Bodega/Espacio",                defaultFormat: "uf"      },
  ingresosTotalUf:                   { label: "Ingresos Totales (fijos)",            defaultFormat: "uf"      },
  ingresosPorM2Uf:                   { label: "Ingresos Fijos por m²",              defaultFormat: "uf"      },
  contratosQueVencenEsteMes:         { label: "Vencimientos del mes",                defaultFormat: "number"  },
  // Variable rent
  rentaVariableUf:                   { label: "Renta Variable",                      defaultFormat: "uf"      },
  ventasTotalUf:                     { label: "Ventas Totales",                      defaultFormat: "uf"      },
  pctRentaVariableContratoPromedio:  { label: "% Renta Variable Promedio (contrato)",defaultFormat: "percent" },
  pctRentaVariableEnIngresos:        { label: "% Renta Variable en Ingresos",        defaultFormat: "percent" },
  ingresosTotalConVariableUf:        { label: "Ingresos Totales (incl. variable)",   defaultFormat: "uf"      },
  ventasPorM2Uf:                     { label: "Ventas por m²",                      defaultFormat: "uf"      },
};

export type ChartDataPoint = {
  periodo: string;
  value: number | null;
  esFuturo: boolean;
};

function resolveField(periodo: PeriodoMetrica, field: PeriodoField): number | null {
  switch (field) {
    case "pctOcupacionGLA":           return periodo.pctOcupacionGLA;
    case "waltMeses":                 return periodo.waltMeses;
    case "glaArrendadaM2":            return periodo.glaArrendadaM2;
    case "glaTotalM2":                return periodo.glaTotalM2;
    case "glaVacanteM2":              return periodo.glaTotalM2 - periodo.glaArrendadaM2;
    case "rentaFijaUf":               return periodo.rentaFijaUf;
    case "contratosActivos":          return periodo.contratosActivos;
    case "ingresosFijoUf":            return periodo.ingresosFijoUf;
    case "ingresosSimuladorModuloUf": return periodo.ingresosSimuladorModuloUf;
    case "ingresosBodegaEspacioUf":   return periodo.ingresosBodegaEspacioUf;
    case "ingresosTotalUf":
      return periodo.ingresosFijoUf + periodo.ingresosSimuladorModuloUf + periodo.ingresosBodegaEspacioUf;
    case "ingresosPorM2Uf":
      return periodo.glaArrendadaM2 > 0
        ? (periodo.ingresosFijoUf + periodo.ingresosSimuladorModuloUf + periodo.ingresosBodegaEspacioUf) / periodo.glaArrendadaM2
        : null;
    case "contratosQueVencenEsteMes": return periodo.contratosQueVencenEsteMes;
    // Variable rent fields
    case "rentaVariableUf":                  return periodo.rentaVariableUf;
    case "ventasTotalUf":                    return periodo.ventasTotalUf;
    case "pctRentaVariableContratoPromedio": return periodo.pctRentaVariableContratoPromedio;
    case "pctRentaVariableEnIngresos": {
      const v = periodo.rentaVariableUf;
      if (v === null) return null;
      const f = periodo.ingresosFijoUf + periodo.ingresosSimuladorModuloUf + periodo.ingresosBodegaEspacioUf;
      return f + v > 0 ? (v / (f + v)) * 100 : null;
    }
    case "ingresosTotalConVariableUf": {
      const v = periodo.rentaVariableUf;
      const f = periodo.ingresosFijoUf + periodo.ingresosSimuladorModuloUf + periodo.ingresosBodegaEspacioUf;
      return v !== null ? f + v : f;
    }
    case "ventasPorM2Uf":
      return periodo.ventasTotalUf !== null && periodo.glaArrendadaM2 > 0
        ? periodo.ventasTotalUf / periodo.glaArrendadaM2
        : null;
  }
}

function applyOperator(a: number, op: "+" | "-" | "*" | "/", b: number): number | null {
  if (op === "/" && b === 0) return null;
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "*") return a * b;
  return a / b;
}

export function evaluateFormula(
  periodos: PeriodoMetrica[],
  config: FormulaConfig
): ChartDataPoint[] {
  return periodos.map((p) => {
    let value: number | null;

    if (config.type === "single") {
      value = resolveField(p, config.field);
    } else {
      const a = resolveField(p, config.fieldA);
      const b = resolveField(p, config.fieldB);
      value = a !== null && b !== null ? applyOperator(a, config.operator, b) : null;
    }

    return { periodo: p.periodo, value, esFuturo: p.esFuturo };
  });
}

export function getFormulaDisplay(config: FormulaConfig): string {
  if (config.type === "single") {
    return PERIODO_FIELD_CATALOG[config.field].label;
  }
  const labelA = PERIODO_FIELD_CATALOG[config.fieldA].label;
  const labelB = PERIODO_FIELD_CATALOG[config.fieldB].label;
  const opLabel = config.operator === "*" ? "×" : config.operator === "/" ? "÷" : config.operator;
  return `${labelA} ${opLabel} ${labelB}`;
}
