-- AlterTable: add sales threshold for tiered variable rent
ALTER TABLE "ContratoTarifa" ADD COLUMN "umbralVentasUf" DECIMAL(14,4);
