import type { ContractStatus, MasterStatus, UnitType } from "@prisma/client";
import type {
  Tenant360Contract,
  Tenant360MonthlyPoint,
  Tenant360SalesPoint,
  Tenant360Projection,
  GapAnalysisRow,
  BillingCategory,
  OccupancyDayEntry,
} from "./tenant-360";

// --- Local profile ---
export type Local360Profile = {
  id: string;
  codigo: string;
  nombre: string;
  glam2: number;
  piso: string | null;
  tipo: UnitType;
  zonaNombre: string | null;
  categoriaTamano: string | null;
  esGLA: boolean;
  estado: MasterStatus;
};

// --- Quick stats (header) ---
export type Local360QuickStats = {
  glam2: number;
  currentTenantName: string | null;
  currentTenantId: string | null;
  currentRentUf: number | null;
  totalDaysOccupied: number;
  totalDaysVacant: number;
  totalDaysGrace: number;
  occupancyPct: number;
  totalUniqueTenants: number;
  ufValue: number;
  ufDate: string;
};

// --- KPIs ---
export type Local360Kpis = {
  occupancyPct: number;
  currentRentUf: number | null;
  realizationPct: number | null;
  averageSalesUfPerM2: number | null;
  totalBillingUf: number;
  totalGapUf: number;
  totalSalesPesos: number;
};

// --- Tenant history (chronological succession of tenants on this local) ---
export type TenantHistoryRate = {
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  tipo: string;
  valor: number;
  esDiciembre: boolean;
};

export type TenantHistoryDiscount = {
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  tipo: string;
  valor: number;
};

export type TenantHistoryEntry = {
  contractId: string;
  numeroContrato: string;
  tenantId: string;
  tenantName: string;
  tenantRut: string;
  fechaInicio: string;
  fechaTermino: string;
  fechaEntrega: string | null;
  fechaApertura: string | null;
  totalDays: number;
  daysInRange: number;
  totalBillingUf: number;
  totalSalesPesos: number;
  monthlyRentUf: number | null;
  estado: ContractStatus;
  isCurrent: boolean;
  rateEvolution: TenantHistoryRate[];
  discounts: TenantHistoryDiscount[];
};

// --- Occupancy aggregated by month ---
export type OccupancyMonthlyPoint = {
  period: string;
  daysOccupied: number;
  daysVacant: number;
  daysGrace: number;
  totalDays: number;
  occupancyPct: number;
};

// --- Energy cost timeline ---
export type EnergyMonthlyPoint = {
  period: string;
  costoUf: number;
};

// --- Peer comparison (vs other locals in same zona/tipo) ---
export type LocalPeerStat = {
  unitId: string;
  codigo: string;
  glam2: number;
  totalBillingUf: number;
  billingUfPerM2: number;
  isCurrent: boolean;
};

export type LocalPeerComparison = {
  peerCount: number;
  thisLocal: {
    billingUfPerM2: number;
    totalBillingUf: number;
  };
  peerAvgBillingUfPerM2: number;
  peerMedianBillingUfPerM2: number;
  rankBilling: { position: number; total: number };
  peers: LocalPeerStat[];
};

// --- Local Comercial tab — replicates Excel "Local Comercial" sheet ---

export type LocalCommercialAnalysisRow = {
  metric: string;
  byPeriod: Record<string, number | null>;
  ytd: number | null;
};

export type LocalCommercialBreakdownRow = {
  group3: string;
  byPeriod: Record<string, number>;
  ytd: number;
};

export type TenantSelectorEntry = {
  tenantId: string;
  tenantName: string;
  fechaInicio: string;
  fechaTermino: string;
  isCurrent: boolean;
};

export type TenantOnLocalAnalysis = {
  tenantId: string;
  tenantName: string;
  isCurrent: boolean;
  ids: { unitCodigo: string; dataContableId: string | null; ventasId: string | null };
  rows: LocalCommercialAnalysisRow[];
  breakdownUfM2: LocalCommercialBreakdownRow[];
  breakdownUf: LocalCommercialBreakdownRow[];
  totalFacturacionUfM2: LocalCommercialAnalysisRow;
};

export type CategoryAnalysis = {
  categoria: string;
  rows: LocalCommercialAnalysisRow[];
};

export type SimilarLocalRow = {
  unitId: string;
  codigo: string;
  nombre: string;
  ocupacionM2Current: number;
  ocupacionYtdM2: number;
  facturacionYtdUfM2: number;
  ventasYtdUfM2: number;
  costoOcupacionYtdPct: number | null;
  isCurrent: boolean;
};

export type SimilarLocalsTable = {
  filterTamano: string | null;
  filterTipo: string;
  filterPiso: string | null;
  rows: SimilarLocalRow[];
  total: SimilarLocalRow;
};

// --- Root response ---
export type Local360Data = {
  profile: Local360Profile;
  quickStats: Local360QuickStats;
  kpis: Local360Kpis;
  monthlyTimeline: Tenant360MonthlyPoint[];
  tenantHistory: TenantHistoryEntry[];
  contracts: Tenant360Contract[];
  billingBreakdown: BillingCategory[];
  salesPerformance: Tenant360SalesPoint[];
  occupancyTimeline: OccupancyMonthlyPoint[];
  occupancyDays: OccupancyDayEntry[];
  energyTimeline: EnergyMonthlyPoint[];
  gapAnalysis: GapAnalysisRow[];
  projections: Tenant360Projection;
  peerComparison: LocalPeerComparison | null;
  tenantsForSelector: TenantSelectorEntry[];
  tenantOnLocalAnalysis: TenantOnLocalAnalysis | null;
  categoryAnalysis: CategoryAnalysis;
  similarLocalsTable: SimilarLocalsTable;
};
