-- CreateEnum
CREATE TYPE "TenantCategory" AS ENUM ('ENTERTAINMENT', 'LIFESTYLE', 'SERVICES', 'POWERSPORTS', 'OUTDOOR', 'ACCESSORIES', 'MULTISPORT', 'BICYCLES', 'GYM');

-- AlterTable
ALTER TABLE "Arrendatario" ADD COLUMN "category" "TenantCategory";
