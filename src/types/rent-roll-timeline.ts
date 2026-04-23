export type PeriodoMetrica = {
  periodo: string; // "2025-01"
  esFuturo: boolean;
  pctOcupacionGLA: number;
  waltMeses: number;
  glaArrendadaM2: number;
  glaTotalM2: number;
  rentaFijaUf: number;
  contratosActivos: number;
  ingresosFijoUf: number;
  ingresosSimuladorModuloUf: number;
  ingresosBodegaEspacioUf: number;
  contratosQueVencenEsteMes: number;
  // Variable rent — null when no VentaLocal data exists for the period
  rentaVariableUf: number | null;
  ventasTotalUf: number | null;
  pctRentaVariableContratoPromedio: number | null;
};

export type TimelineResponse = {
  periodos: PeriodoMetrica[];
};
