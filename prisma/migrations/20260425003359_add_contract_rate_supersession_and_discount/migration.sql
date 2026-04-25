-- Bitemporal supersession on ContractRate + new ContractRateDiscount entity.
--
-- Context: rate adjustments (corrections + amendments + retroactive backdating) need
-- to preserve "what we knew when". Adds transaction-time columns to ContratoTarifa
-- and creates ContratoTarifaDescuento as a first-class temporal entity for discounts
-- (the embedded descuento* columns on ContratoTarifa are now @deprecated, kept for
-- backward compat, no production rows use them today per audit).

-- 1. ContratoTarifa: supersession metadata (all nullable, no backfill needed).
ALTER TABLE "ContratoTarifa"
  ADD COLUMN "supersededAt"    TIMESTAMPTZ(3),
  ADD COLUMN "supersededBy"    UUID,
  ADD COLUMN "supersedeReason" TEXT,
  ADD COLUMN "amendmentId"     UUID;

-- 2. ContratoTarifa: FK to ContratoAnexo (optional link for hybrid capture).
ALTER TABLE "ContratoTarifa"
  ADD CONSTRAINT "ContratoTarifa_amendmentId_fkey"
  FOREIGN KEY ("amendmentId") REFERENCES "ContratoAnexo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. ContratoTarifa: index for "active rows" queries (the dominant access pattern).
CREATE INDEX "ContratoTarifa_contratoId_supersededAt_idx"
  ON "ContratoTarifa"("contratoId", "supersededAt");

-- 4. ContratoTarifaDescuento: discounts as their own bitemporal entity.
CREATE TABLE "ContratoTarifaDescuento" (
    "id"              UUID NOT NULL,
    "contractRateId"  UUID NOT NULL,
    "tipo"            "TipoDescuentoTarifa" NOT NULL,
    "valor"           DECIMAL(10,4) NOT NULL,
    "vigenciaDesde"   DATE NOT NULL,
    "vigenciaHasta"   DATE,
    "createdAt"       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt"    TIMESTAMPTZ(3),
    "supersededBy"    UUID,
    "supersedeReason" TEXT,
    "amendmentId"     UUID,

    CONSTRAINT "ContratoTarifaDescuento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContratoTarifaDescuento_contractRateId_idx"
  ON "ContratoTarifaDescuento"("contractRateId");
CREATE INDEX "ContratoTarifaDescuento_contractRateId_supersededAt_idx"
  ON "ContratoTarifaDescuento"("contractRateId", "supersededAt");
CREATE INDEX "ContratoTarifaDescuento_contractRateId_vigenciaDesde_idx"
  ON "ContratoTarifaDescuento"("contractRateId", "vigenciaDesde");

ALTER TABLE "ContratoTarifaDescuento"
  ADD CONSTRAINT "ContratoTarifaDescuento_contractRateId_fkey"
  FOREIGN KEY ("contractRateId") REFERENCES "ContratoTarifa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContratoTarifaDescuento"
  ADD CONSTRAINT "ContratoTarifaDescuento_amendmentId_fkey"
  FOREIGN KEY ("amendmentId") REFERENCES "ContratoAnexo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
