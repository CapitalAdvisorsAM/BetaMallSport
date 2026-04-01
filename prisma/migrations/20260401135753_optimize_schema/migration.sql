/*
  Warnings:

  - The primary key for the `Account` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Arrendatario` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CargaDatos` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Contrato` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ContratoAnexo` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ContratoDia` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `contratoId` column on the `ContratoDia` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `ContratoGGCC` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ContratoLocal` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ContratoTarifa` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `IngresoEnergia` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Local` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Proyecto` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Session` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ValorUF` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `VentaLocal` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `id` on the `Account` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `userId` on the `Account` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Arrendatario` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `proyectoId` on the `Arrendatario` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `CargaDatos` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `proyectoId` on the `CargaDatos` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `usuarioId` on the `CargaDatos` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Contrato` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `proyectoId` on the `Contrato` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `localId` on the `Contrato` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `arrendatarioId` on the `Contrato` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `ContratoAnexo` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `contratoId` on the `ContratoAnexo` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `usuarioId` on the `ContratoAnexo` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `ContratoDia` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `proyectoId` on the `ContratoDia` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `localId` on the `ContratoDia` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `ContratoGGCC` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `contratoId` on the `ContratoGGCC` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `ContratoLocal` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `contratoId` on the `ContratoLocal` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `localId` on the `ContratoLocal` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `ContratoTarifa` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `contratoId` on the `ContratoTarifa` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `IngresoEnergia` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `proyectoId` on the `IngresoEnergia` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `localId` on the `IngresoEnergia` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Local` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `proyectoId` on the `Local` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Proyecto` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Session` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `userId` on the `Session` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `ValorUF` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `VentaLocal` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `proyectoId` on the `VentaLocal` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `localId` on the `VentaLocal` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "Arrendatario" DROP CONSTRAINT "Arrendatario_proyectoId_fkey";

-- DropForeignKey
ALTER TABLE "CargaDatos" DROP CONSTRAINT "CargaDatos_proyectoId_fkey";

-- DropForeignKey
ALTER TABLE "Contrato" DROP CONSTRAINT "Contrato_arrendatarioId_fkey";

-- DropForeignKey
ALTER TABLE "Contrato" DROP CONSTRAINT "Contrato_localId_fkey";

-- DropForeignKey
ALTER TABLE "Contrato" DROP CONSTRAINT "Contrato_proyectoId_fkey";

-- DropForeignKey
ALTER TABLE "ContratoAnexo" DROP CONSTRAINT "ContratoAnexo_contratoId_fkey";

-- DropForeignKey
ALTER TABLE "ContratoDia" DROP CONSTRAINT "ContratoDia_contratoId_fkey";

-- DropForeignKey
ALTER TABLE "ContratoDia" DROP CONSTRAINT "ContratoDia_localId_fkey";

-- DropForeignKey
ALTER TABLE "ContratoDia" DROP CONSTRAINT "ContratoDia_proyectoId_fkey";

-- DropForeignKey
ALTER TABLE "ContratoGGCC" DROP CONSTRAINT "ContratoGGCC_contratoId_fkey";

-- DropForeignKey
ALTER TABLE "ContratoLocal" DROP CONSTRAINT "ContratoLocal_contratoId_fkey";

-- DropForeignKey
ALTER TABLE "ContratoLocal" DROP CONSTRAINT "ContratoLocal_localId_fkey";

-- DropForeignKey
ALTER TABLE "ContratoTarifa" DROP CONSTRAINT "ContratoTarifa_contratoId_fkey";

-- DropForeignKey
ALTER TABLE "IngresoEnergia" DROP CONSTRAINT "IngresoEnergia_localId_fkey";

-- DropForeignKey
ALTER TABLE "IngresoEnergia" DROP CONSTRAINT "IngresoEnergia_proyectoId_fkey";

-- DropForeignKey
ALTER TABLE "Local" DROP CONSTRAINT "Local_proyectoId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "VentaLocal" DROP CONSTRAINT "VentaLocal_localId_fkey";

-- DropForeignKey
ALTER TABLE "VentaLocal" DROP CONSTRAINT "VentaLocal_proyectoId_fkey";

-- DropIndex
DROP INDEX "Arrendatario_nombreComercial_trgm_idx";

-- DropIndex
DROP INDEX "Arrendatario_rut_trgm_idx";

-- DropIndex
DROP INDEX "Contrato_numeroContrato_trgm_idx";

-- DropIndex
DROP INDEX "ContratoGGCC_contratoId_vigenciaDesde_idx";

-- DropIndex
DROP INDEX "idx_contrato_ggcc_covering";

-- DropIndex
DROP INDEX "ContratoTarifa_contratoId_tipo_vigencia_idx";

-- DropIndex
DROP INDEX "idx_contrato_tarifa_covering";

-- DropIndex
DROP INDEX "Local_codigo_trgm_idx";

-- DropIndex
DROP INDEX "Local_nombre_trgm_idx";

-- DropIndex
DROP INDEX "idx_venta_local_proyecto_periodo";

-- AlterTable
ALTER TABLE "Account" DROP CONSTRAINT "Account_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "userId",
ADD COLUMN     "userId" UUID NOT NULL,
ADD CONSTRAINT "Account_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Arrendatario" DROP CONSTRAINT "Arrendatario_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "proyectoId",
ADD COLUMN     "proyectoId" UUID NOT NULL,
ADD CONSTRAINT "Arrendatario_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "CargaDatos" DROP CONSTRAINT "CargaDatos_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "proyectoId",
ADD COLUMN     "proyectoId" UUID NOT NULL,
DROP COLUMN "usuarioId",
ADD COLUMN     "usuarioId" UUID NOT NULL,
ADD CONSTRAINT "CargaDatos_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Contrato" DROP CONSTRAINT "Contrato_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "proyectoId",
ADD COLUMN     "proyectoId" UUID NOT NULL,
DROP COLUMN "localId",
ADD COLUMN     "localId" UUID NOT NULL,
DROP COLUMN "arrendatarioId",
ADD COLUMN     "arrendatarioId" UUID NOT NULL,
ADD CONSTRAINT "Contrato_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ContratoAnexo" DROP CONSTRAINT "ContratoAnexo_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "contratoId",
ADD COLUMN     "contratoId" UUID NOT NULL,
DROP COLUMN "usuarioId",
ADD COLUMN     "usuarioId" UUID NOT NULL,
ADD CONSTRAINT "ContratoAnexo_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ContratoDia" DROP CONSTRAINT "ContratoDia_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "proyectoId",
ADD COLUMN     "proyectoId" UUID NOT NULL,
DROP COLUMN "localId",
ADD COLUMN     "localId" UUID NOT NULL,
DROP COLUMN "contratoId",
ADD COLUMN     "contratoId" UUID,
ADD CONSTRAINT "ContratoDia_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ContratoGGCC" DROP CONSTRAINT "ContratoGGCC_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "contratoId",
ADD COLUMN     "contratoId" UUID NOT NULL,
ADD CONSTRAINT "ContratoGGCC_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ContratoLocal" DROP CONSTRAINT "ContratoLocal_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "contratoId",
ADD COLUMN     "contratoId" UUID NOT NULL,
DROP COLUMN "localId",
ADD COLUMN     "localId" UUID NOT NULL,
ADD CONSTRAINT "ContratoLocal_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ContratoTarifa" DROP CONSTRAINT "ContratoTarifa_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "contratoId",
ADD COLUMN     "contratoId" UUID NOT NULL,
ADD CONSTRAINT "ContratoTarifa_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "IngresoEnergia" DROP CONSTRAINT "IngresoEnergia_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "proyectoId",
ADD COLUMN     "proyectoId" UUID NOT NULL,
DROP COLUMN "localId",
ADD COLUMN     "localId" UUID NOT NULL,
ADD CONSTRAINT "IngresoEnergia_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Local" DROP CONSTRAINT "Local_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "proyectoId",
ADD COLUMN     "proyectoId" UUID NOT NULL,
ADD CONSTRAINT "Local_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Proyecto" DROP CONSTRAINT "Proyecto_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "Proyecto_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Session" DROP CONSTRAINT "Session_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "userId",
ADD COLUMN     "userId" UUID NOT NULL,
ADD CONSTRAINT "Session_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ValorUF" DROP CONSTRAINT "ValorUF_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "ValorUF_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "VentaLocal" DROP CONSTRAINT "VentaLocal_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "proyectoId",
ADD COLUMN     "proyectoId" UUID NOT NULL,
DROP COLUMN "localId",
ADD COLUMN     "localId" UUID NOT NULL,
ADD CONSTRAINT "VentaLocal_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "Arrendatario_proyectoId_idx" ON "Arrendatario"("proyectoId");

-- CreateIndex
CREATE INDEX "Arrendatario_proyectoId_vigente_idx" ON "Arrendatario"("proyectoId", "vigente");

-- CreateIndex
CREATE UNIQUE INDEX "Arrendatario_proyectoId_rut_key" ON "Arrendatario"("proyectoId", "rut");

-- CreateIndex
CREATE INDEX "CargaDatos_proyectoId_idx" ON "CargaDatos"("proyectoId");

-- CreateIndex
CREATE INDEX "CargaDatos_proyectoId_tipo_idx" ON "CargaDatos"("proyectoId", "tipo");

-- CreateIndex
CREATE INDEX "Contrato_proyectoId_idx" ON "Contrato"("proyectoId");

-- CreateIndex
CREATE INDEX "Contrato_localId_idx" ON "Contrato"("localId");

-- CreateIndex
CREATE INDEX "Contrato_arrendatarioId_idx" ON "Contrato"("arrendatarioId");

-- CreateIndex
CREATE INDEX "Contrato_proyectoId_estado_idx" ON "Contrato"("proyectoId", "estado");

-- CreateIndex
CREATE INDEX "Contrato_proyectoId_updatedAt_idx" ON "Contrato"("proyectoId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contrato_proyectoId_numeroContrato_key" ON "Contrato"("proyectoId", "numeroContrato");

-- CreateIndex
CREATE INDEX "ContratoAnexo_contratoId_idx" ON "ContratoAnexo"("contratoId");

-- CreateIndex
CREATE INDEX "ContratoAnexo_contratoId_fecha_idx" ON "ContratoAnexo"("contratoId", "fecha");

-- CreateIndex
CREATE INDEX "ContratoAnexo_usuarioId_idx" ON "ContratoAnexo"("usuarioId");

-- CreateIndex
CREATE INDEX "ContratoDia_proyectoId_idx" ON "ContratoDia"("proyectoId");

-- CreateIndex
CREATE INDEX "ContratoDia_proyectoId_fecha_idx" ON "ContratoDia"("proyectoId", "fecha");

-- CreateIndex
CREATE INDEX "ContratoDia_contratoId_idx" ON "ContratoDia"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "ContratoDia_localId_fecha_key" ON "ContratoDia"("localId", "fecha");

-- CreateIndex
CREATE INDEX "ContratoGGCC_contratoId_idx" ON "ContratoGGCC"("contratoId");

-- CreateIndex
CREATE INDEX "ContratoGGCC_contratoId_vigenciaDesde_idx" ON "ContratoGGCC"("contratoId", "vigenciaDesde");

-- CreateIndex
CREATE INDEX "ContratoLocal_contratoId_idx" ON "ContratoLocal"("contratoId");

-- CreateIndex
CREATE INDEX "ContratoLocal_localId_idx" ON "ContratoLocal"("localId");

-- CreateIndex
CREATE UNIQUE INDEX "ContratoLocal_contratoId_localId_key" ON "ContratoLocal"("contratoId", "localId");

-- CreateIndex
CREATE INDEX "ContratoTarifa_contratoId_idx" ON "ContratoTarifa"("contratoId");

-- CreateIndex
CREATE INDEX "ContratoTarifa_contratoId_tipo_vigenciaDesde_idx" ON "ContratoTarifa"("contratoId", "tipo", "vigenciaDesde");

-- CreateIndex
CREATE INDEX "IngresoEnergia_proyectoId_periodo_idx" ON "IngresoEnergia"("proyectoId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "IngresoEnergia_localId_periodo_key" ON "IngresoEnergia"("localId", "periodo");

-- CreateIndex
CREATE INDEX "Local_proyectoId_idx" ON "Local"("proyectoId");

-- CreateIndex
CREATE INDEX "Local_proyectoId_estado_idx" ON "Local"("proyectoId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Local_proyectoId_codigo_key" ON "Local"("proyectoId", "codigo");

-- CreateIndex
CREATE INDEX "VentaLocal_proyectoId_periodo_idx" ON "VentaLocal"("proyectoId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "VentaLocal_localId_periodo_key" ON "VentaLocal"("localId", "periodo");

-- AddForeignKey
ALTER TABLE "Local" ADD CONSTRAINT "Local_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngresoEnergia" ADD CONSTRAINT "IngresoEnergia_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngresoEnergia" ADD CONSTRAINT "IngresoEnergia_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaLocal" ADD CONSTRAINT "VentaLocal_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaLocal" ADD CONSTRAINT "VentaLocal_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arrendatario" ADD CONSTRAINT "Arrendatario_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_arrendatarioId_fkey" FOREIGN KEY ("arrendatarioId") REFERENCES "Arrendatario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoLocal" ADD CONSTRAINT "ContratoLocal_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoLocal" ADD CONSTRAINT "ContratoLocal_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoTarifa" ADD CONSTRAINT "ContratoTarifa_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoAnexo" ADD CONSTRAINT "ContratoAnexo_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoGGCC" ADD CONSTRAINT "ContratoGGCC_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoDia" ADD CONSTRAINT "ContratoDia_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoDia" ADD CONSTRAINT "ContratoDia_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoDia" ADD CONSTRAINT "ContratoDia_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargaDatos" ADD CONSTRAINT "CargaDatos_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
