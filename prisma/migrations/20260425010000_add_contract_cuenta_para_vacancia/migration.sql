-- Add `cuentaParaVacancia` flag to Contract.
-- When false, the contract's local does NOT count as occupied for vacancy KPIs,
-- even though the contract is otherwise active (rent, GGCC, billing all unchanged).
-- Default true preserves prior behavior for existing contracts.
ALTER TABLE "Contrato"
ADD COLUMN "cuentaParaVacancia" BOOLEAN NOT NULL DEFAULT true;
