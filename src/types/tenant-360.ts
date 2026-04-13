import type { ContractDayStatus, ContractRateType, ContractStatus } from "@prisma/client";

// --- Tenant Profile ---
export type Tenant360Profile = {
  id: string;
  rut: string;
  razonSocial: string;
  nombreComercial: string;
  vigente: boolean;
  email: string | null;
  telefono: string | null;
};

// --- Quick Stats (in header) ---
export type Tenant360QuickStats = {
  totalLeasedM2: number;
  activeContractCount: number;
  monthlyFixedRentUf: number;
  monthlyFixedRentClp: number;
  ufValue: number;
  ufDate: string;
};

// --- KPIs ---
export type Tenant360Kpis = {
  costoOcupacionPct: number | null;
  rentaFijaMensualUf: number;
  rentaFijaClp: number;
  ggccEstimadoUf: number;
  ventasPromedioMensualUf: number;
  waltMeses: number;
  facturacionUfM2: number | null;
  ventasUfM2: number | null;
};

// --- Financial Timeline (chart data) ---
export type Tenant360MonthlyPoint = {
  period: string;
  billingUf: number;
  salesUf: number;
  costoOcupacionPct: number | null;
  billingUfM2: number | null;
};

// --- Contract Rate ---
export type Tenant360Rate = {
  tipo: ContractRateType;
  valor: number;
  umbralVentasUf: number | null;
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  esDiciembre: boolean;
};

// --- Contract GGCC ---
export type Tenant360Ggcc = {
  tarifaBaseUfM2: number;
  pctAdministracion: number;
  pctReajuste: number | null;
  proximoReajuste: string | null;
  mesesReajuste: number | null;
  vigenciaDesde: string;
  vigenciaHasta: string | null;
};

// --- Contract Amendment ---
export type Tenant360Amendment = {
  id: string;
  fecha: string;
  descripcion: string;
  camposModificados: string[];
};

// --- Contract Detail ---
export type Tenant360Contract = {
  id: string;
  numeroContrato: string;
  localCodigo: string;
  localNombre: string;
  localGlam2: number;
  estado: ContractStatus;
  fechaInicio: string;
  fechaTermino: string;
  fechaEntrega: string | null;
  fechaApertura: string | null;
  diasGracia: number;
  diasRestantes: number;
  multiplicadorDiciembre: number | null;
  pctFondoPromocion: number | null;
  codigoCC: string | null;
  pdfUrl: string | null;
  notas: string | null;
  tarifaActual: Tenant360Rate | null;
  historialTarifas: Tenant360Rate[];
  ggccActual: Tenant360Ggcc | null;
  anexos: Tenant360Amendment[];
};

// --- Billing Breakdown ---
export type BillingCategory = {
  group1: string;
  group3: string;
  byPeriod: Record<string, number>;
  total: number;
};

// --- Sales Performance ---
export type Tenant360SalesPoint = {
  period: string;
  salesUf: number;
  salesPerM2: number;
  variableRentUf: number;
  salesClp: number | null;
};

// --- Occupancy Timeline ---
export type OccupancyDayEntry = {
  localCodigo: string;
  fecha: string;
  estadoDia: ContractDayStatus;
  glam2: number;
};

// --- Projections ---
export type ExpiringContract = {
  id: string;
  localCodigo: string;
  fechaTermino: string;
  diasRestantes: number;
  rentaFijaUf: number;
  riskLevel: "low" | "medium" | "high";
};

export type Tenant360Projection = {
  expiringContracts: ExpiringContract[];
  totalRentAtRiskUf: number;
};

// --- Gap Analysis ---
export type GapAnalysisRow = {
  period: string;
  expectedBillingUf: number;
  actualBillingUf: number;
  gapUf: number;
  gapPct: number;
  occupiedDays: number | null;
  totalDays: number | null;
  expectedProRataUf: number | null;
  gapProRataUf: number | null;
  gapProRataPct: number | null;
};

// --- Peer comparison ---
export type PeerComparisonRow = {
  tenantName: string;
  glam2: number;
  facturacionUfM2: number;
  ventasUfM2: number;
  costoOcupacionPct: number | null;
  isCurrent: boolean;
};

export type PeerComparison = {
  categoria: string;
  peerCount: number;
  avgFacturacionUfM2: number;
  avgVentasUfM2: number;
  avgCostoOcupacionPct: number | null;
  currentFacturacionUfM2: number;
  currentVentasUfM2: number;
  currentCostoOcupacionPct: number | null;
  peers: PeerComparisonRow[];
};

// --- Root response ---
export type Tenant360Data = {
  profile: Tenant360Profile;
  quickStats: Tenant360QuickStats;
  kpis: Tenant360Kpis;
  monthlyTimeline: Tenant360MonthlyPoint[];
  contracts: Tenant360Contract[];
  billingBreakdown: BillingCategory[];
  salesPerformance: Tenant360SalesPoint[];
  occupancyDays: OccupancyDayEntry[];
  projections: Tenant360Projection;
  gapAnalysis: GapAnalysisRow[];
  peerComparison: PeerComparison | null;
};
