export type ProjectOption = {
  id: string;
  nombre: string;
  slug?: string;
};

export type LocalRef = {
  id: string;
  codigo: string;
  nombre: string;
};

export type TenantRef = {
  id: string;
  rut: string;
  razonSocial: string;
  nombreComercial: string;
};

export type TenantFinanceRow = {
  id: string;
  rut: string;
  razonSocial: string;
  nombreComercial: string;
  locales: LocalRef[];
  periodos: string[];
  facturacionPorPeriodo: Record<string, number>;
  ventasPorPeriodo: Record<string, number>;
  totalFacturado: number;
  totalVentas: number;
  costoOcupacion: number | null;
  totalEsperado: number | null;
  brechaUf: number | null;
  brechaPct: number | null;
};

export type EerrLocalDetalle = {
  localId: string;
  localCodigo: string;
  localNombre: string;
  arrendatarioId: string | null;
  arrendatarioNombre: string | null;
  porPeriodo: Record<string, number>;
  total: number;
};

export type EerrCategoria = {
  categoriaTipo: string;
  porPeriodo: Record<string, number>;
  total: number;
  locales: EerrLocalDetalle[];
};

export type EerrDetalleResponse = {
  categorias: EerrCategoria[];
};

export type ArrendatarioPartidaDetalle = {
  grupo1: string;
  grupo3: string;
  denominacion: string;
  valorUf: number;
};

export type EerrLine = {
  grupo3: string;
  tipo: "ingreso" | "costo";
  porPeriodo: Record<string, number>;
  total: number;
  presupuestoPorPeriodo?: Record<string, number>;
  presupuestoTotal?: number | null;
  varianzaTotal?: number | null;
  varianzaPct?: number | null;
};

export type EerrSection = {
  grupo1: string;
  tipo: "ingreso" | "costo";
  lineas: EerrLine[];
  porPeriodo: Record<string, number>;
  total: number;
  presupuestoPorPeriodo?: Record<string, number>;
  presupuestoTotal?: number | null;
  varianzaTotal?: number | null;
  varianzaPct?: number | null;
};

export type EerrData = {
  periodos: string[];
  secciones: EerrSection[];
  ebitda: { porPeriodo: Record<string, number>; total: number };
  ebit:   { porPeriodo: Record<string, number>; total: number };
  presupuestoEbitda?: { porPeriodo: Record<string, number>; total: number } | null;
  presupuestoEbit?: { porPeriodo: Record<string, number>; total: number } | null;
};

export type ContableSuggestion = {
  codigo: string;
  nombre: string;
  score: number;
};

export type ContableUnmapped = {
  localCodigo: string;
  arrendatarioNombre: string;
  sugerencias: ContableSuggestion[];
};

export type VentasUnmapped = {
  idCa: string;
  tienda: string;
  sugerencias: ContableSuggestion[];
};

export type ContableUploadResult = {
  periodos: string[];
  totalFilas: number;
  registrosInsertados: number;
  matchesAutomaticos: number;
  sinMapeo: ContableUnmapped[];
};

export type VentasUploadResult = {
  periodos: string[];
  totalFilas: number;
  registrosUpserted: number;
  matchesAutomaticos: number;
  sinMapeo: VentasUnmapped[];
};

export type ExpenseBudgetUnrecognized = {
  rowNumber: number;
  periodo: string | null;
  grupo1: string;
  grupo3: string;
  reason: string;
};

export type ExpenseBudgetUploadResult = {
  recordsInserted: number;
  unrecognized: ExpenseBudgetUnrecognized[];
  summary: { total: number; periodos: string[] };
};

export type BalanceUploadResult = {
  recordsInserted: number;
  unrecognized: Array<{
    rowNumber: number;
    accountCode: string;
    reason: string;
  }>;
  summary: { total: number; periodos: string[] };
};

export type BankUploadResult = {
  recordsInserted: number;
  unrecognized: Array<{
    rowNumber: number;
    operationNumber: string;
    reason: string;
  }>;
  summary: { total: number; periodos: string[] };
};

export type BudgetVsActualMonthly = {
  period: string;
  budgetUf: number;
  actualUf: number;
  varianceUf: number;
  variancePct: number;
  achievementPct: number;
};

export type BudgetVsActualTenantRow = {
  tenantId: string;
  rut: string;
  nombreComercial: string;
  locales: { codigo: string; nombre: string }[];
  glam2: number;
  budgetUf: number;
  actualUf: number;
  varianceUf: number;
  variancePct: number;
  achievementPct: number;
  /** Periods (YYYY-MM) where the contract has a PORCENTAJE tarifa but no sales were reported for the lagged period. */
  missingSalesPeriods: string[];
};

export type BudgetVsActualSummary = {
  totalBudgetUf: number;
  totalActualUf: number;
  totalVarianceUf: number;
  totalVariancePct: number;
  totalAchievementPct: number;
  tenantsOverBudget: number;
  tenantsUnderBudget: number;
  tenantCount: number;
};

export type BudgetVsActualResponse = {
  periods: string[];
  monthly: BudgetVsActualMonthly[];
  rows: BudgetVsActualTenantRow[];
  summary: BudgetVsActualSummary;
};

export type WaterfallMode = "mom" | "yoy";

export type WaterfallCategory =
  | "starting"
  | "new_contracts"
  | "lost_contracts"
  | "rate_changes"
  | "variable_rent"
  | "ggcc_changes"
  | "other"
  | "ending";

export type WaterfallBar = {
  category: WaterfallCategory;
  label: string;
  value: number;
  cumulative: number;
  isTotal: boolean;
};

export type WaterfallResponse = {
  mode: WaterfallMode;
  currentPeriod: string;
  previousPeriod: string;
  bars: WaterfallBar[];
  currentTotal: number;
  previousTotal: number;
  netChange: number;
  netChangePct: number;
  glaArrendadaCurrent: number;
  glaArrendadaPrevious: number;
};

export type EeffLine = {
  accountCode: string;
  accountName: string;
  byPeriod: Record<string, number>;
  total: number;
};

export type EeffCategory = {
  category: string;
  byPeriod: Record<string, number>;
  total: number;
  lines: EeffLine[];
};

export type EeffGroup = {
  group: string;
  byPeriod: Record<string, number>;
  total: number;
  categories: EeffCategory[];
};

export type EeffResponse = {
  periods: string[];
  groups: EeffGroup[];
  totalsByPeriod: Record<string, number>;
  liquidityByPeriod: Record<string, number>;
};

export type CashFlowSection = {
  classification: string;
  byPeriod: Record<string, number>;
  total: number;
};

export type CashFlowResponse = {
  periods: string[];
  sections: CashFlowSection[];
  inflowsByPeriod: Record<string, number>;
  netByPeriod: Record<string, number>;
  cumulativeByPeriod: Record<string, number>;
};
