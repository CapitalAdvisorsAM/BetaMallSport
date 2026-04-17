import type { ContractStatus, ContractRateType, ContractDiscountType } from "@prisma/client";

export type ContractApiBaseRow = {
  id: string;
  proyectoId: string;
  localId: string;
  localIds: string[];
  arrendatarioId: string;
  numeroContrato: string;
  fechaInicio: string;
  fechaTermino: string;
  fechaEntrega: string | null;
  fechaApertura: string | null;
  pctFondoPromocion: string | null;
  pctAdministracionGgcc: string | null;
  multiplicadorDiciembre: string | null;
  multiplicadorJunio: string | null;
  multiplicadorJulio: string | null;
  multiplicadorAgosto: string | null;
  codigoCC: string | null;
  diasGracia: number;
  estado: ContractStatus;
  pdfUrl: string | null;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContractTarifaApiRow = {
  id: string;
  contratoId: string;
  tipo: ContractRateType;
  valor: string;
  umbralVentasUf: string | null;
  pisoMinimoUf: string | null;
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  esDiciembre: boolean;
  descuentoTipo: ContractDiscountType | null;
  descuentoValor: string | null;
  descuentoDesde: string | null;
  descuentoHasta: string | null;
  createdAt: string;
};

export type ContractGgccApiRow = {
  id: string;
  contratoId: string;
  tarifaBaseUfM2: string;
  pctAdministracion: string;
  pctReajuste: string | null;
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  proximoReajuste: string | null;
  mesesReajuste: number | null;
  createdAt: string;
};

export type ContractCreateApiResponse = ContractApiBaseRow;

export type ContractUpdateApiResponse = ContractApiBaseRow & {
  tarifas: ContractTarifaApiRow[];
  ggcc: ContractGgccApiRow[];
};

export type ContractWriteApiResponse = ContractCreateApiResponse | ContractUpdateApiResponse;

export type ContractManagerOption = {
  id: string;
  label: string;
};

export type ContractManagerListItem = {
  id: string;
  numeroContrato: string;
  diasGracia: number;
  estado: ContractStatus;
  pdfUrl: string | null;
  fechaInicio: string;
  fechaTermino: string;
  pctFondoPromocion: string | null;
  pctAdministracionGgcc: string | null;
  multiplicadorDiciembre: string | null;
  multiplicadorJunio: string | null;
  multiplicadorJulio: string | null;
  multiplicadorAgosto: string | null;
  local: { id: string; codigo: string; nombre: string };
  locales: Array<{ id: string; codigo: string; nombre: string }>;
  arrendatario: { id: string; nombreComercial: string; razonSocial: string };
  tarifas: Array<{
    tipo: "FIJO_UF_M2" | "FIJO_UF" | "PORCENTAJE";
    valor: string;
    umbralVentasUf: string | null;
    pisoMinimoUf: string | null;
    vigenciaDesde: string;
    vigenciaHasta: string | null;
    esDiciembre: boolean;
    descuentoTipo: ContractDiscountType | null;
    descuentoValor: string | null;
    descuentoDesde: string | null;
    descuentoHasta: string | null;
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
};

export type ContractExtractionResponse = {
  numeroContrato: string | null;
  arrendatarioRut: string | null;
  arrendatarioNombre: string | null;
  localCodigo: string | null;
  glam2: string | null;
  fechaInicio: string | null;
  fechaTermino: string | null;
  pctFondoPromocion: string | null;
  pctAdministracionGgcc: string | null;
  tarifas: Array<{
    tipo: "FIJO_UF_M2" | "PORCENTAJE";
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
    vigenciaHasta: null;
    proximoReajuste: null;
  }>;
  arrendatarioId: string | null;
  localId: string | null;
};
