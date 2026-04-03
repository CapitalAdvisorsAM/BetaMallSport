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
};

export type EerrLine = {
  grupo3: string;
  tipo: "ingreso" | "costo";
  porPeriodo: Record<string, number>;
  total: number;
};

export type EerrSection = {
  grupo1: string;
  tipo: "ingreso" | "costo";
  lineas: EerrLine[];
  porPeriodo: Record<string, number>;
  total: number;
};

export type EerrData = {
  periodos: string[];
  secciones: EerrSection[];
  ebitda: {
    porPeriodo: Record<string, number>;
    total: number;
  };
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
  idCa: number;
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
