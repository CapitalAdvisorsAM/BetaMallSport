export type CostoOcupacionRow = {
  tenantId: string;
  tenantName: string;
  locales: { codigo: string; nombre: string }[];
  glaM2: number;
  facturacionUfM2: number;
  ventasUfM2: number;
  costoOcupacionPct: number | null;
  facturacionYtdUfM2: number;
  ventasYtdUfM2: number;
  costoOcupacionYtdPct: number | null;
};

export type CostoOcupacionResponse = {
  period: string;
  ytdFrom: string;
  rows: CostoOcupacionRow[];
};
