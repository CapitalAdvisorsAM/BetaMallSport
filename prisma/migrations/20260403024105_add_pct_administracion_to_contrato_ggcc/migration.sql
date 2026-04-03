/*
  Warnings:

  - Added the required column `pctAdministracion` to the `ContratoGGCC` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ContratoGGCC" ADD COLUMN     "pctAdministracion" DECIMAL(6,3) NOT NULL;
