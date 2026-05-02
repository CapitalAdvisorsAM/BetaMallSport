export type ContractComparisonMatchLevel = "strict" | "zone" | "category" | "none";

export type ContractComparisonMetric = {
  current: number | null;
  peerAverage: number | null;
  peerMedian: number | null;
  deltaVsAverage: number | null;
  rankPosition: number | null;
  rankTotal: number;
};

export type ContractComparisonRow = {
  contractId: string;
  numeroContrato: string;
  arrendatario: string;
  localCodigo: string;
  localNombre: string;
  localGlam2: number;
  fixedRentUf: number | null;
  fixedRentUfM2: number | null;
  ggccUf: number | null;
  ggccUfM2: number | null;
  variablePct: number | null;
  pisoMinimoUf: number | null;
  pctFondoPromocion: number | null;
  discountLabel: string | null;
  avgBillingUfM2: number | null;
  avgSalesUfM2: number | null;
  occupancyCostPct: number | null;
  gapPct: number | null;
  diasRestantes: number;
};

export type ContractComparison = {
  contractId: string;
  cohortLabel: string;
  matchLevel: ContractComparisonMatchLevel;
  peerCount: number;
  current: ContractComparisonRow;
  metrics: {
    fixedRentUfM2: ContractComparisonMetric;
    ggccUfM2: ContractComparisonMetric;
    variablePct: ContractComparisonMetric;
    pisoMinimoUf: ContractComparisonMetric;
    avgBillingUfM2: ContractComparisonMetric;
    avgSalesUfM2: ContractComparisonMetric;
    occupancyCostPct: ContractComparisonMetric;
    gapPct: ContractComparisonMetric;
    diasRestantes: ContractComparisonMetric;
  };
  peers: ContractComparisonRow[];
};
