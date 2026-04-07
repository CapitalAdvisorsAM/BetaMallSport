export type MetricFormulaDefinition = {
  title: string;
  formula: string;
  detail: string;
};

export const METRIC_FORMULAS = {
  kpi_dashboard_ocupacion_pct: {
    title: "Ocupacion del proyecto",
    formula: "SUM(GLA arrendada) / SUM(GLA total activa) * 100",
    detail: "Cuenta locales con contrato vigente o en gracia sobre el total de GLA activa."
  },
  kpi_dashboard_gla_arrendada_m2: {
    title: "GLA arrendada",
    formula: "SUM(glam2 de locales GLA arrendados)",
    detail: "Suma m2 de locales con esGLA=true y contrato activo."
  },
  kpi_dashboard_locales_sin_arrendatario: {
    title: "Locales sin arrendatario",
    formula: "COUNT(locales activos) - COUNT(locales con contrato vigente/en gracia)",
    detail: "Total de locales activos sin arrendatario al corte."
  },
  kpi_dashboard_renta_riesgo_90d_uf: {
    title: "Renta en riesgo (90d)",
    formula: "SUM(renta fija UF de contratos que vencen entre hoy y hoy+90 dias)",
    detail: "Incluye solo renta fija contractual (UF/m2 o UF fija), excluye renta variable."
  },
  kpi_dashboard_facturacion_total_uf: {
    title: "Facturacion total (UF)",
    formula:
      "Arriendo fijo + Arriendo variable + Simuladores/Modulos + Bodega/Espacio + Energia",
    detail: "Total mensual del periodo seleccionado en UF."
  },
  kpi_dashboard_arriendo_fijo_uf: {
    title: "Arriendo fijo (UF)",
    formula: "SUM(renta fija por contrato vigente)",
    detail: "Para UF/m2 usa valor*GLA; para UF fija usa valor directo."
  },
  kpi_dashboard_ingreso_mensual_clp: {
    title: "Ingreso mensual (CLP)",
    formula: "Facturacion total (UF) * valor UF vigente",
    detail: "Convierte el total UF usando el ultimo valor UF registrado."
  },
  kpi_dashboard_ingresos_uf: {
    title: "Ingresos (UF)",
    formula: "SUM(valor UF) donde grupo1 = INGRESOS DE EXPLOTACION",
    detail: "Total de ingresos operacionales del periodo seleccionado en el dashboard financiero."
  },
  kpi_dashboard_ebitda_uf: {
    title: "EBITDA (UF)",
    formula:
      "SUM(valor UF) de secciones sobre EBITDA (excluye DEPRECIACION, EDI, RESULTADO NO OPERACIONAL e IMPUESTOS)",
    detail: "EBITDA del periodo segun estructura EE.RR."
  },
  kpi_dashboard_ytd_ingresos_uf: {
    title: "YTD Ingresos (UF)",
    formula: "SUM mensual de ingresos operacionales desde enero hasta el periodo seleccionado",
    detail: "Compara acumulado anual actual versus acumulado anual del ano previo."
  },
  kpi_dashboard_ytd_ebitda_uf: {
    title: "YTD EBITDA (UF)",
    formula: "SUM mensual de EBITDA desde enero hasta el periodo seleccionado",
    detail: "Compara acumulado anual actual versus acumulado anual del ano previo."
  },
  kpi_dashboard_uf_por_m2: {
    title: "UF por m2",
    formula: "Ingresos del periodo (UF) / GLA total del proyecto (m2)",
    detail: "Relaciona ingresos operacionales con m2 de GLA total."
  },
  kpi_dashboard_vacancia_pct: {
    title: "Vacancia (%)",
    formula: "(Locales GLA vacantes / Locales GLA totales) * 100",
    detail: "Disponible para modo mensual segun contratos activos en el mes."
  },
  chart_dashboard_ingresos_ebitda_uf: {
    title: "Evolucion mensual de ingresos y EBITDA (UF)",
    formula:
      "Serie mensual: ingresos actuales, ingresos ano anterior alineados y EBITDA actual",
    detail: "Permite comparar tendencia y brecha contra el ano anterior."
  },
  kpi_dashboard_renta_variable_uf: {
    title: "Renta variable",
    formula: "SUM(ventas UF por local * porcentaje variable del contrato)",
    detail: "Calculada para contratos con porcentaje variable y ventas disponibles."
  },
  kpi_dashboard_simuladores_modulos_uf: {
    title: "Simuladores/Mod.",
    formula: "SUM(renta fija UF de locales tipo SIMULADOR o MODULO)",
    detail: "Acumula solo contratos activos de esos tipos de local."
  },
  kpi_dashboard_bodega_espacio_uf: {
    title: "Bodega + Espacio",
    formula: "SUM(renta fija UF de locales tipo BODEGA y ESPACIO)",
    detail: "Suma mensual de ambos tipos al periodo seleccionado."
  },
  kpi_dashboard_ggcc_mensual_uf: {
    title: "Gasto comun mensual (UF)",
    formula: "SUM(tarifaBaseUfM2 * glam2 * (1 + pctAdministracion/100))",
    detail: "Estimacion de GGCC mensual para contratos vigentes con configuracion GGCC."
  },
  kpi_dashboard_cartera_vigentes: {
    title: "Cartera Vigentes",
    formula: "COUNT(contratos con estado VIGENTE)",
    detail: "Conteo de contratos en estado VIGENTE."
  },
  kpi_dashboard_cartera_gracia: {
    title: "Cartera En Gracia",
    formula: "COUNT(contratos con estado GRACIA)",
    detail: "Conteo de contratos en estado GRACIA."
  },
  kpi_dashboard_cartera_terminado_anticipado: {
    title: "Cartera Terminados Anticipadamente",
    formula: "COUNT(contratos con estado TERMINADO_ANTICIPADO)",
    detail: "Conteo de contratos terminados antes del plazo pactado."
  },
  kpi_dashboard_cartera_terminado: {
    title: "Cartera Terminados",
    formula: "COUNT(contratos con estado TERMINADO)",
    detail: "Conteo de contratos terminados por fecha o cierre."
  },
  kpi_rent_roll_snapshot_renta_fija_total_uf: {
    title: "Rent Roll Snapshot - Renta fija total (UF)",
    formula: "SUM(glam2 * tarifa fija UF/m2 vigente en la fecha snapshot)",
    detail: "Total de renta fija contractual al dia seleccionado."
  },
  kpi_rent_roll_snapshot_ggcc_total_uf: {
    title: "Rent Roll Snapshot - GGCC total (UF)",
    formula: "SUM(tarifaBaseUfM2 * glam2 * (1 + pctAdministracion/100))",
    detail: "GGCC total de contratos vigentes en la fecha snapshot."
  },
  kpi_rent_roll_snapshot_ventas_periodo_uf: {
    title: "Rent Roll Snapshot - Ventas periodo (UF)",
    formula: "SUM(ventas UF por local para el periodo asociado a la fecha snapshot)",
    detail: "Usa el periodo de ventas derivado de la fecha seleccionada."
  },
  kpi_rent_roll_snapshot_walt_global: {
    title: "Rent Roll Snapshot - WALT global",
    formula: "SUM(meses restantes * glam2) / SUM(glam2)",
    detail: "Promedio ponderado de plazo remanente de contratos activos."
  },
  kpi_rent_roll_header_gla_total_m2: {
    title: "Rent Roll Header - GLA total (m2)",
    formula: "SUM(glam2 de todos los locales del proyecto)",
    detail: "No discrimina estado operativo del local."
  },
  kpi_rent_roll_header_ocupacion_pct: {
    title: "Rent Roll Header - % ocupacion",
    formula: "GLA ocupada / GLA total * 100",
    detail: "GLA ocupada considera locales con estado OCUPADO."
  },
  kpi_rent_roll_header_renta_fija_mes_uf: {
    title: "Rent Roll Header - Renta fija mes (UF)",
    formula: "SUM(renta fija mensual UF de contratos activos en locales ocupados)",
    detail: "Calculada al dia del snapshot."
  },
  kpi_rent_roll_header_ggcc_mes_uf: {
    title: "Rent Roll Header - GGCC mes (UF)",
    formula: "SUM(ggcc mensual UF de contratos activos en locales ocupados)",
    detail: "Incluye solo contratos activos asociados a locales ocupados."
  },
  chart_rent_roll_concentracion_gla_categoria: {
    title: "Concentracion GLA por categoria",
    formula: "SUM(GLA arrendada por categoria) / SUM(GLA arrendada total) * 100",
    detail: "Agrupa contratos activos por categoria derivada de Local.zona."
  },
  chart_rent_roll_ocupacion_walt: {
    title: "% Ocupacion GLA + WALT",
    formula: "Ocupacion: GLA arrendada/GLA total*100; WALT: SUM(meses*GLA)/SUM(GLA)",
    detail: "Serie mensual historica y proyectada con corte al mes."
  },
  chart_rent_roll_renta_fija_total_uf: {
    title: "Renta Fija Total (UF)",
    formula: "SUM(renta fija UF mensual por contrato activo en cada periodo)",
    detail: "Se muestra por mes en historico y proyeccion."
  },
  chart_rent_roll_contratos_activos: {
    title: "Contratos Activos",
    formula: "COUNT(DISTINCT contratoId activo por periodo)",
    detail: "Incluye contratos en estado OCUPADO o GRACIA."
  },
  chart_rent_roll_gla_arrendada_vacante_m2: {
    title: "GLA Arrendada vs Vacante (m2)",
    formula: "GLA vacante = GLA total - GLA arrendada",
    detail: "Comparacion mensual de superficie arrendada y vacante."
  },
  chart_rent_roll_vencimientos_por_mes: {
    title: "Vencimientos de Contratos por Mes",
    formula: "COUNT(contratos cuya fechaTermino cae en el mes)",
    detail: "Conteo mensual de contratos que vencen."
  },
  chart_rent_roll_ingresos_tipo_local_uf: {
    title: "Ingresos por Tipo de Local (UF)",
    formula:
      "SUM(renta fija UF) por tipo: regular, simulador/modulo, bodega/espacio",
    detail: "Apila ingresos mensuales por segmento de tipo de local."
  },
  chart_rent_roll_custom_widget: {
    title: "Widget personalizado",
    formula: "Formula configurable definida en Configuracion de dashboard.",
    detail: "Evalua la expresion seleccionada por el usuario sobre la serie historica mensual."
  }
} as const satisfies Record<string, MetricFormulaDefinition>;

export type MetricFormulaId = keyof typeof METRIC_FORMULAS;

export function getMetricFormula(metricId: MetricFormulaId): MetricFormulaDefinition {
  return METRIC_FORMULAS[metricId];
}
