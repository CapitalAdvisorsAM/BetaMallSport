-- Rename ventasUf → ventasPesos and widen precision from DECIMAL(14,4) to DECIMAL(18,2)
-- Table: VentaArrendatario (TenantSale)
ALTER TABLE "VentaArrendatario" RENAME COLUMN "ventasUf" TO "ventasPesos";
ALTER TABLE "VentaArrendatario" ALTER COLUMN "ventasPesos" TYPE DECIMAL(18,2);

-- Table: VentaPresupuestadaArrendatario (TenantBudgetedSale)
ALTER TABLE "VentaPresupuestadaArrendatario" RENAME COLUMN "ventasUf" TO "ventasPesos";
ALTER TABLE "VentaPresupuestadaArrendatario" ALTER COLUMN "ventasPesos" TYPE DECIMAL(18,2);
