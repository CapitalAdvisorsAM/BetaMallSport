export type EstadoLocal = "VIGENTE" | "GRACIA" | "VACANTE" | "TERMINADO_ANTICIPADO";

export type RentRollRow = {
  localId: string;
  localCodigo: string;
  localNombre: string;
  glam2: number;
  estado: EstadoLocal;
  arrendatario: string | null;
  tarifaUfM2: number | null;
  rentaFijaUf: number | null;
  ggccUf: number | null;
  ventasUf: number | null;
  fechaTermino: string | null;
  diasParaVencimiento: number | null;
};

export type RentRollKpis = {
  glaTotal: number;
  glaCupado: number;
  pctOcupacion: number;
  rentaFijaTotalUf: number;
  ggccTotalUf: number;
};
