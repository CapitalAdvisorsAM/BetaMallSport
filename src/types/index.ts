import type { EstadoContrato, EstadoDiaContrato, UserRole } from "@prisma/client";
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
  RentRollMetricaRow,
  RentRollResumen,
  RentRollMetricasResponse
} from "@/types/metricas";
export type { PeriodoMetrica, TimelineResponse } from "@/types/timeline";

export type RentRollRow = {
  id: string;
  local: string;
  arrendatario: string;
  estado: EstadoDiaContrato;
  fechaInicio: Date;
  fechaTermino: Date;
  tarifaVigenteUfM2: string;
  m2: string;
};

export type AppRole = UserRole;

export type RentRollUploadRow = {
  rowNumber: number;
  numeroContrato: string;
  localCodigo: string;
  arrendatarioRut: string;
  estado: EstadoContrato;
  fechaInicio: string;
  fechaTermino: string;
  fechaEntrega: string | null;
  fechaApertura: string | null;
  tarifaTipo: "FIJO_UF_M2" | "FIJO_UF" | "PORCENTAJE";
  tarifaValor: string;
  tarifaVigenciaDesde: string;
  tarifaVigenciaHasta: string | null;
  pctFondoPromocion: string | null;
  codigoCC: string | null;
  ggccPctAdministracion: string | null;
  ggccPctReajuste: string | null;
  notas: string | null;
  ggccTipo: "FIJO_UF_M2" | "FIJO_UF" | null;
  ggccValor: string | null;
  ggccTarifaBaseUfM2?: string | null;
  ggccVigenciaDesde: string | null;
  ggccVigenciaHasta: string | null;
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
  proyectoId: string;
  localId: string;
  localIds: string[];
  arrendatarioId: string;
  numeroContrato?: string;
  fechaInicio: string;
  fechaTermino: string;
  fechaEntrega: string | null;
  fechaApertura: string | null;
  estado: EstadoContrato;
  rentaVariable: Array<{
    pctRentaVariable: string;
    vigenciaDesde: string;
    vigenciaHasta: string | null;
  }>;
  pctFondoPromocion: string | null;
  pctAdministracionGgcc: string | null;
  codigoCC: string | null;
  pdfUrl: string | null;
  notas: string | null;
  tarifas: Array<{
    tipo: "FIJO_UF_M2" | "FIJO_UF" | "PORCENTAJE";
    valor: string;
    vigenciaDesde: string;
    vigenciaHasta: string | null;
    esDiciembre: boolean;
  }>;
  ggcc: Array<{
    tarifaBaseUfM2: string;
    pctAdministracion: string;
    pctReajuste: string | null;
    vigenciaDesde: string;
    vigenciaHasta: string | null;
    proximoReajuste: string | null;
    mesesReajuste: number | null;
  }>;
  anexo: {
    fecha: string;
    descripcion: string;
  } | null;
};
