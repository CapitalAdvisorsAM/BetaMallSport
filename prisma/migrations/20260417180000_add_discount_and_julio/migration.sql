-- CreateEnum
CREATE TYPE "TipoDescuentoTarifa" AS ENUM ('PORCENTAJE', 'MONTO_UF');

-- AlterTable: Contract multiplicadorJulio
ALTER TABLE "Contrato"
ADD COLUMN "multiplicadorJulio" DECIMAL(6,3);

-- AlterTable: ContractRate discount fields
ALTER TABLE "ContratoTarifa"
ADD COLUMN "descuentoTipo" "TipoDescuentoTarifa";

ALTER TABLE "ContratoTarifa"
ADD COLUMN "descuentoValor" DECIMAL(10,4);

ALTER TABLE "ContratoTarifa"
ADD COLUMN "descuentoDesde" DATE;

ALTER TABLE "ContratoTarifa"
ADD COLUMN "descuentoHasta" DATE;
