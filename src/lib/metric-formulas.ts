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
  kpi_rent_roll_snapshot_facturacion_esperada_vs_real: {
    title: "Rent Roll Snapshot - Facturacion esperada vs real",
    formula: "SUM(ingreso esperado por contrato) / SUM(registros contables INGRESOS DE EXPLOTACION)",
    detail: "Compara la renta contractual esperada contra la facturacion real del periodo contable."
  },
  kpi_rent_roll_snapshot_brecha_total: {
    title: "Rent Roll Snapshot - Brecha total",
    formula: "SUM(ingreso esperado) - SUM(facturado real)",
    detail: "Diferencia entre lo que deberia cobrarse segun contrato y lo facturado realmente."
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
  },
  kpi_tenant360_costo_ocupacion_pct: {
    title: "Costo de ocupacion (%)",
    formula: "SUM(facturacion UF) / SUM(ventas UF) * 100",
    detail: "Ratio entre facturacion total y ventas totales del arrendatario en el periodo."
  },
  kpi_tenant360_renta_fija_uf: {
    title: "Renta fija mensual (UF)",
    formula: "SUM(renta fija por contrato activo del arrendatario)",
    detail: "Para UF/m2 usa valor*GLA; para UF fija usa valor directo. Solo contratos VIGENTE/GRACIA."
  },
  kpi_tenant360_renta_fija_clp: {
    title: "Renta fija mensual (CLP)",
    formula: "Renta fija UF * valor UF vigente",
    detail: "Convierte renta fija UF del arrendatario usando el ultimo valor UF registrado."
  },
  kpi_tenant360_ggcc_estimado_uf: {
    title: "GGCC estimado (UF)",
    formula: "SUM(tarifaBaseUfM2 * glam2 * (1 + pctAdministracion/100)) por contrato activo",
    detail: "Gasto comun estimado mensual para todos los contratos activos del arrendatario."
  },
  kpi_tenant360_ventas_promedio_uf: {
    title: "Ventas promedio mensual (UF)",
    formula: "SUM(ventas UF) / COUNT(periodos con ventas)",
    detail: "Promedio mensual de ventas del arrendatario en el rango seleccionado."
  },
  kpi_tenant360_walt_meses: {
    title: "WALT (meses)",
    formula: "SUM(meses restantes * glam2) / SUM(glam2)",
    detail: "Plazo promedio ponderado remanente de los contratos activos del arrendatario."
  },
  kpi_tenant360_renta_riesgo_uf: {
    title: "Renta en riesgo (UF)",
    formula: "SUM(renta fija UF de contratos que vencen en los proximos 90 dias)",
    detail: "Renta fija mensual que se perderia si no se renuevan contratos proximos a vencer."
  },
  kpi_tenant360_gap_analysis: {
    title: "Brecha facturacion",
    formula: "Facturacion esperada (segun contrato) - Facturacion real (segun registros contables)",
    detail: "Positivo = subfacturado, negativo = sobrefacturado. Incluye arriendo fijo, GGCC, fondo promocion y renta variable."
  },
  kpi_tenant360_facturacion_uf_m2: {
    title: "Facturacion (UF/m\u00b2)",
    formula: "Promedio mensual facturacion UF / GLA arrendada m\u00b2",
    detail: "Facturacion promedio mensual normalizada por metro cuadrado arrendado. Permite comparar tenants de distinto tamano."
  },
  kpi_tenant360_ventas_uf_m2: {
    title: "Ventas (UF/m\u00b2)",
    formula: "Promedio mensual ventas UF / GLA arrendada m\u00b2",
    detail: "Ventas promedio mensual por metro cuadrado arrendado. Indicador clave de productividad del tenant."
  },
  kpi_bva_presupuesto_uf: {
    title: "Presupuesto total (UF)",
    formula: "SUM(ingreso esperado por contrato usando ventas presupuestadas)",
    detail: "Ingreso contractual esperado calculado con ventas presupuestadas para renta variable."
  },
  kpi_bva_facturado_real_uf: {
    title: "Facturado real (UF)",
    formula: "SUM(registros contables INGRESOS DE EXPLOTACION)",
    detail: "Total facturado real segun registros contables del periodo."
  },
  kpi_bva_varianza_uf: {
    title: "Varianza (UF)",
    formula: "Presupuesto UF - Facturado real UF",
    detail: "Diferencia entre presupuesto y facturacion real. Positivo = subfacturado."
  },
  kpi_bva_cumplimiento_pct: {
    title: "Cumplimiento (%)",
    formula: "Facturado real UF / Presupuesto UF * 100",
    detail: "Porcentaje de cumplimiento del presupuesto. 100% = exacto, >100% = sobre-cumplimiento."
  },
  chart_bva_mensual: {
    title: "Presupuesto vs Real mensual",
    formula: "Serie mensual: presupuesto UF, facturado real UF, cumplimiento %",
    detail: "Compara presupuesto contractual contra facturacion real por mes."
  },
  kpi_finance_waterfall_prev: {
    title: "Ingreso del periodo anterior",
    formula: "SUM(valor UF) donde grupo1 = INGRESOS DE EXPLOTACION para el periodo anterior",
    detail: "Ingreso total del periodo base para la comparacion waterfall."
  },
  kpi_finance_waterfall_current: {
    title: "Ingreso del periodo actual",
    formula: "SUM(valor UF) donde grupo1 = INGRESOS DE EXPLOTACION para el periodo actual",
    detail: "Ingreso total del periodo actual en la comparacion waterfall."
  },
  chart_finance_waterfall: {
    title: "Analisis de variacion de ingresos por categoria",
    formula: "Waterfall: ingreso anterior + nuevos contratos + contratos perdidos + cambios tarifa + renta variable + GGCC + otros = ingreso actual",
    detail: "Descompone la variacion de ingresos entre dos periodos en categorias de cambio."
  },
  chart_finance_occupancy: {
    title: "Ocupacion por dimension",
    formula: "GLA vacante = GLA total - GLA arrendada; Vacancia % = GLA vacante / GLA total * 100",
    detail: "Muestra la evolucion mensual de la ocupacion segmentada por tipo de local, tamano o piso."
  },
  chart_finance_facturacion: {
    title: "Facturacion UF/m2 por dimension",
    formula: "UF/m2 = SUM(valueUf donde group1=INGRESOS DE EXPLOTACION) / GLA ocupada",
    detail: "Intensidad de facturacion mensual segmentada por tamano, tipo o piso."
  },
  chart_finance_ventas: {
    title: "Ventas UF/m2 por dimension",
    formula: "UF/m2 = SUM(salesUf) / GLA ocupada por dimension",
    detail: "Ventas mensuales distribuidas proporcionalmente por GLA de locales activos."
  },
  chart_finance_costo_ocupacion: {
    title: "Costo de ocupacion por arrendatario",
    formula: "Costo Ocupacion % = (Facturacion UF / Ventas UF) * 100",
    detail: "Porcentaje de ventas que el arrendatario destina al pago de arriendo y cargos comunes."
  },
  chart_finance_ggcc: {
    title: "Deficit de gastos comunes",
    formula: "Deficit = Recuperacion GGCC - Costos operacionales; Deficit % = Deficit / Recuperacion * 100",
    detail: "Compara la recuperacion de gastos comunes vs costos reales de operacion."
  }
} as const satisfies Record<string, MetricFormulaDefinition>;

export type MetricFormulaId = keyof typeof METRIC_FORMULAS;

export function getMetricFormula(metricId: MetricFormulaId): MetricFormulaDefinition {
  return METRIC_FORMULAS[metricId];
}
