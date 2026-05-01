import type { ContractStatus, ContractDayStatus, UserRole } from "@prisma/client";
export type { ApplyReport, PreviewRow, RowStatus, UploadPreview } from "./upload";
export type {
  ContractApiBaseRow,
  ContractCreateApiResponse,
  ContractExtractionResponse,
  ContractGgccApiRow,
  ContractManagerListItem,
  ContractManagerOption,
  ContractTarifaApiRow,
  ContractUpdateApiResponse,
  ContractWriteApiResponse
} from "./contracts";
export type {
  RentRollMetricRow,
  RentRollSummary,
  RentRollMetricsResponse
} from "@/types/metrics";
export type { PeriodoMetrica, TimelineResponse } from "@/types/rent-roll-timeline";
export type {
  BudgetedSaleCellPayload,
  BudgetedSaleCellResponse,
  BudgetedSalesMatrixResponse,
  BudgetedSalesMatrixRow,
  BudgetedSalesMatrixSummary
} from "@/types/rent-roll";
export type {
  OccupancyDimensionRow,
  OccupancyPeriodSnapshot,
  OccupancyTimeSeriesResponse
} from "./occupancy";
export type {
  FacturacionDimensionSeries,
  FacturacionResponse,
  FacturacionSeriesPoint
} from "./billing";
export type {
  VentasAnalyticsResponse,
  VentasDimensionSeries,
  VentasSeriesPoint
} from "./sales-analytics";
export type {
  CostoOcupacionResponse,
  CostoOcupacionRow
} from "./occupancy-cost";
export type { VentasDiariasResponse, DailyDimensionRow } from "./sales-daily";
export type {
  PanelCdgCell,
  PanelCdgKpi,
  PanelCdgResponse,
  PanelCdgUnit
} from "./panel-cdg";
export type {
  EeffCategory,
  EeffGroup,
  EeffLine,
  EeffResponse,
  CashFlowResponse,
  CashFlowSection,
  BalanceUploadResult,
  BankUploadResult
} from "./finance";
export type {
  GgccCostBreakdown,
  GgccDeficitByDimension,
  GgccDeficitPeriodRow,
  GgccDeficitResponse
} from "./ggcc-deficit";
export type {
  Tenant360Data,
  Tenant360Profile,
  Tenant360QuickStats,
  Tenant360Kpis,
  Tenant360MonthlyPoint,
  Tenant360Contract,
  Tenant360Rate,
  Tenant360Ggcc,
  Tenant360Amendment,
  Tenant360SalesPoint,
  Tenant360Projection,
  ExpiringContract,
  GapAnalysisRow,
  BillingCategory,
  OccupancyDayEntry,
  PeerComparison,
  PeerComparisonRow
} from "./tenant-360";
export type {
  Local360Data,
  Local360Profile,
  Local360QuickStats,
  Local360Kpis,
  TenantHistoryEntry,
  TenantHistoryRate,
  TenantHistoryDiscount,
  OccupancyMonthlyPoint,
  EnergyMonthlyPoint,
  LocalPeerComparison,
  LocalPeerStat
} from "./local-360";

export type RentRollRow = {
  id: string;
  local: string;
  arrendatario: string;
  estado: ContractDayStatus;
  fechaInicio: string;
  fechaTermino: string;
  tarifaVigenteUfM2: string;
  m2: string;
};

export type AppRole = UserRole;

export type RentRollUploadRow = {
  rowNumber: number;
  numeroContrato: string;
  localCodigo: string;
  arrendatarioNombre: string;
  estado: ContractStatus;
  fechaInicio: string;
  fechaTermino: string;
  fechaEntrega: string | null;
  fechaApertura: string | null;
  tarifaTipo: "FIJO_UF_M2" | "FIJO_UF" | "PORCENTAJE";
  tarifaValor: string;
  tarifaVigenciaDesde: string;
  tarifaVigenciaHasta: string | null;
  pctFondoPromocion: string | null;
  multiplicadorDiciembre: string | null;
  multiplicadorJunio: string | null;
  multiplicadorJulio: string | null;
  multiplicadorAgosto: string | null;
  codigoCC: string | null;
  ggccPctAdministracion: string | null;
  ggccPctReajuste: string | null;
  notas: string | null;
  ggccTipo: "FIJO_UF_M2" | "FIJO_UF" | null;
  ggccValor: string | null;
  ggccTarifaBaseUfM2?: string | null;
  ggccMesesReajuste: number | null;
  anexoFecha: string | null;
  anexoDescripcion: string | null;
};

export type UploadIssue = {
  rowNumber: number;
  message: string;
};

export type RentRollPreviewPayload = {
  rows: RentRollUploadRow[];
  errors: UploadIssue[];
  warnings: string[];
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
  };
  report?: {
    created: number;
    updated: number;
    rejected: number;
    rejectedRows: UploadIssue[];
  };
};

export type ContractFormPayload = {
  projectId: string;
  localId: string;
  localIds: string[];
  arrendatarioId: string;
  numeroContrato?: string;
  fechaInicio: string;
  fechaTermino: string;
  fechaEntrega: string | null;
  fechaApertura: string | null;
  diasGracia: number;
  cuentaParaVacancia: boolean;
  rentaVariable: Array<{
    pctRentaVariable: string;
    umbralVentasUf: string;
    pisoMinimoUf: string | null;
    vigenciaDesde: string;
    vigenciaHasta: string | null;
  }>;
  pctFondoPromocion: string | null;
  pctAdministracionGgcc: string | null;
  multiplicadorDiciembre: string | null;
  multiplicadorJunio: string | null;
  multiplicadorJulio: string | null;
  multiplicadorAgosto: string | null;
  codigoCC: string | null;
  pdfUrl: string | null;
  notas: string | null;
  tarifas: Array<{
    tipo: "FIJO_UF_M2" | "FIJO_UF" | "PORCENTAJE";
    valor: string;
    vigenciaDesde: string;
    vigenciaHasta: string | null;
    esDiciembre: boolean;
    descuentoTipo: "PORCENTAJE" | "MONTO_UF" | null;
    descuentoValor: string | null;
    descuentoDesde: string | null;
    descuentoHasta: string | null;
  }>;
  ggcc: Array<{
    tarifaBaseUfM2: string;
    pctAdministracion: string;
    pctReajuste: string | null;
    proximoReajuste: string | null;
    mesesReajuste: number | null;
  }>;
  anexo: {
    fecha: string;
    descripcion: string;
  } | null;
};
