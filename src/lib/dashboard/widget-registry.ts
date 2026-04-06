export type FormulaVariant = {
  id: string;
  label: string;
  description: string;
};

export type WidgetParameter = {
  key: string;
  label: string;
  type: "number" | "boolean";
  defaultValue: number | boolean;
  min?: number;
  max?: number;
};

export type WidgetDefinition = {
  id: string;
  title: string;
  category: "kpi" | "chart";
  section: "ocupacion" | "ingresos" | "ggcc" | "cartera" | "charts";
  defaultEnabled: boolean;
  formulaVariants?: FormulaVariant[];
  parameters?: WidgetParameter[];
};

export const WIDGET_REGISTRY = {
  // ── Ocupación ────────────────────────────────────────────────────────────
  kpi_ocupacion_pct: {
    id: "kpi_ocupacion_pct",
    title: "Ocupación del proyecto",
    category: "kpi",
    section: "ocupacion",
    defaultEnabled: true,
    formulaVariants: [
      {
        id: "vigente_y_gracia",
        label: "Vigente + Gracia",
        description: "Incluye contratos VIGENTE y GRACIA como locales ocupados.",
      },
      {
        id: "solo_vigente",
        label: "Solo Vigente",
        description: "Cuenta solo contratos VIGENTE. GRACIA se trata como vacante.",
      },
    ],
    parameters: [
      {
        key: "umbralAlto",
        label: "Umbral ocupación alta (%)",
        type: "number",
        defaultValue: 85,
        min: 50,
        max: 100,
      },
      {
        key: "umbralBajo",
        label: "Umbral ocupación baja (%)",
        type: "number",
        defaultValue: 70,
        min: 0,
        max: 99,
      },
    ],
  },
  kpi_gla_arrendada: {
    id: "kpi_gla_arrendada",
    title: "GLA arrendada",
    category: "kpi",
    section: "ocupacion",
    defaultEnabled: true,
  },
  kpi_locales_sin_arrendatario: {
    id: "kpi_locales_sin_arrendatario",
    title: "Locales sin arrendatario",
    category: "kpi",
    section: "ocupacion",
    defaultEnabled: true,
  },
  kpi_renta_en_riesgo: {
    id: "kpi_renta_en_riesgo",
    title: "Renta en riesgo",
    category: "kpi",
    section: "ocupacion",
    defaultEnabled: true,
    parameters: [
      {
        key: "dias",
        label: "Ventana de riesgo (días)",
        type: "number",
        defaultValue: 90,
        min: 30,
        max: 180,
      },
    ],
  },

  // ── Ingresos ─────────────────────────────────────────────────────────────
  kpi_facturacion_total: {
    id: "kpi_facturacion_total",
    title: "Facturación total (UF)",
    category: "kpi",
    section: "ingresos",
    defaultEnabled: true,
  },
  kpi_arriendo_fijo: {
    id: "kpi_arriendo_fijo",
    title: "Arriendo fijo (UF)",
    category: "kpi",
    section: "ingresos",
    defaultEnabled: true,
  },
  kpi_ingreso_clp: {
    id: "kpi_ingreso_clp",
    title: "Ingreso mensual (CLP)",
    category: "kpi",
    section: "ingresos",
    defaultEnabled: true,
  },
  kpi_renta_variable: {
    id: "kpi_renta_variable",
    title: "Renta variable",
    category: "kpi",
    section: "ingresos",
    defaultEnabled: true,
  },
  kpi_simuladores_modulos: {
    id: "kpi_simuladores_modulos",
    title: "Simuladores / Módulos",
    category: "kpi",
    section: "ingresos",
    defaultEnabled: true,
  },
  kpi_bodega_espacio: {
    id: "kpi_bodega_espacio",
    title: "Bodega + Espacio",
    category: "kpi",
    section: "ingresos",
    defaultEnabled: true,
  },

  // ── GGCC ─────────────────────────────────────────────────────────────────
  kpi_ggcc_mensual: {
    id: "kpi_ggcc_mensual",
    title: "Gasto común mensual (UF)",
    category: "kpi",
    section: "ggcc",
    defaultEnabled: true,
  },

  // ── Cartera ───────────────────────────────────────────────────────────────
  kpi_cartera_vigentes: {
    id: "kpi_cartera_vigentes",
    title: "Contratos vigentes",
    category: "kpi",
    section: "cartera",
    defaultEnabled: true,
  },
  kpi_cartera_gracia: {
    id: "kpi_cartera_gracia",
    title: "En período de gracia",
    category: "kpi",
    section: "cartera",
    defaultEnabled: true,
  },
  kpi_cartera_terminado_anticipado: {
    id: "kpi_cartera_terminado_anticipado",
    title: "Terminados anticipadamente",
    category: "kpi",
    section: "cartera",
    defaultEnabled: true,
  },
  kpi_cartera_terminado: {
    id: "kpi_cartera_terminado",
    title: "Terminados",
    category: "kpi",
    section: "cartera",
    defaultEnabled: true,
  },

  // ── Charts ────────────────────────────────────────────────────────────────
  chart_ocupacion_walt: {
    id: "chart_ocupacion_walt",
    title: "% Ocupación GLA + WALT",
    category: "chart",
    section: "charts",
    defaultEnabled: true,
    formulaVariants: [
      {
        id: "con_walt",
        label: "Ocupación + WALT",
        description: "Muestra la línea de ocupación y la línea de WALT sobre el mismo eje.",
      },
      {
        id: "solo_ocupacion",
        label: "Solo Ocupación",
        description: "Muestra únicamente la línea de ocupación, sin WALT.",
      },
    ],
  },
  chart_renta_fija_serie: {
    id: "chart_renta_fija_serie",
    title: "Renta Fija Total (UF)",
    category: "chart",
    section: "charts",
    defaultEnabled: true,
  },
  chart_contratos_activos: {
    id: "chart_contratos_activos",
    title: "Contratos Activos",
    category: "chart",
    section: "charts",
    defaultEnabled: true,
  },
  chart_gla_arrendada_vacante: {
    id: "chart_gla_arrendada_vacante",
    title: "GLA Arrendada vs Vacante (m²)",
    category: "chart",
    section: "charts",
    defaultEnabled: true,
  },
  chart_vencimientos_mes: {
    id: "chart_vencimientos_mes",
    title: "Vencimientos por Mes",
    category: "chart",
    section: "charts",
    defaultEnabled: true,
  },
  chart_ingresos_tipo_local: {
    id: "chart_ingresos_tipo_local",
    title: "Ingresos por Tipo de Local (UF)",
    category: "chart",
    section: "charts",
    defaultEnabled: true,
  },
  chart_concentracion_gla: {
    id: "chart_concentracion_gla",
    title: "Concentración GLA por Categoría",
    category: "chart",
    section: "charts",
    defaultEnabled: true,
  },
} as const satisfies Record<string, WidgetDefinition>;

export type WidgetId = keyof typeof WIDGET_REGISTRY;

export const WIDGET_IDS = Object.keys(WIDGET_REGISTRY) as WidgetId[];

export function getWidget(id: WidgetId): WidgetDefinition {
  return WIDGET_REGISTRY[id] as WidgetDefinition;
}

/** Resolved config for a single widget — merges DB row with registry defaults */
export type ResolvedWidgetConfig = {
  widgetId: WidgetId;
  enabled: boolean;
  position: number;
  formulaVariant: string;
  parameters: Record<string, number | boolean>;
};

type RawConfig = {
  widgetId: string;
  enabled: boolean;
  position: number;
  formulaVariant: string | null;
  parameters: unknown;
};

/** Merge DB rows with registry defaults, filling in any missing widgets at the end */
export function resolveWidgetConfigs(dbRows: RawConfig[]): ResolvedWidgetConfig[] {
  const byId = new Map(dbRows.map((row) => [row.widgetId, row]));

  const resolved: ResolvedWidgetConfig[] = WIDGET_IDS.map((id, index) => {
    const widget = getWidget(id);
    const row = byId.get(id);

    const defaultVariant = widget.formulaVariants?.[0]?.id ?? "";
    const defaultParams: Record<string, number | boolean> = {};
    for (const p of widget.parameters ?? []) {
      defaultParams[p.key] = p.defaultValue;
    }

    const rawParams =
      row?.parameters !== null && typeof row?.parameters === "object"
        ? (row.parameters as Record<string, number | boolean>)
        : {};

    return {
      widgetId: id,
      enabled: row?.enabled ?? widget.defaultEnabled,
      position: row?.position ?? index,
      formulaVariant: row?.formulaVariant ?? defaultVariant,
      parameters: { ...defaultParams, ...rawParams },
    };
  });

  return resolved.sort((a, b) => a.position - b.position);
}
