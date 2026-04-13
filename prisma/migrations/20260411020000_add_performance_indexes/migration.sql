-- Performance indexes for slow page loads

-- Contract: accelerate dashboard date-range queries
CREATE INDEX "Contrato_proyectoId_fechaInicio_fechaTermino_idx"
  ON "Contrato" ("proyectoId", "fechaInicio", "fechaTermino");

-- AccountingRecord: accelerate finance tenant detail queries
CREATE INDEX "RegistroContable_proyectoId_arrendatarioId_periodo_idx"
  ON "RegistroContable" ("proyectoId", "arrendatarioId", "periodo");
