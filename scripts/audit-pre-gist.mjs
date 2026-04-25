/**
 * Pre-flight check before adding the EXCLUDE USING gist constraint to ContratoTarifa.
 *
 * The constraint will reject two ACTIVE rows (supersededAt IS NULL) with the same
 *   (contratoId, tipo, esDiciembre, COALESCE(umbralVentasUf, 0))
 * whose [vigenciaDesde, COALESCE(vigenciaHasta, 'infinity')] ranges overlap.
 *
 * If this script reports any rows, the migration will fail. Clean them first.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { loadEnvFile } from "./db-audit/load-env.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnvFile(path.resolve(__dirname, "..", ".env"));

const prisma = new PrismaClient({ log: ["error"] });

const overlaps = await prisma.$queryRaw`
  SELECT
    a."contratoId",
    c."numeroContrato",
    a.tipo,
    a."esDiciembre",
    COALESCE(a."umbralVentasUf", 0) AS umbral,
    a.id AS id_a,
    b.id AS id_b,
    a."vigenciaDesde" AS desde_a,
    COALESCE(a."vigenciaHasta", DATE '9999-12-31') AS hasta_a,
    b."vigenciaDesde" AS desde_b,
    COALESCE(b."vigenciaHasta", DATE '9999-12-31') AS hasta_b
  FROM "ContratoTarifa" a
  JOIN "ContratoTarifa" b
    ON a."contratoId" = b."contratoId"
   AND a.tipo = b.tipo
   AND a."esDiciembre" = b."esDiciembre"
   AND COALESCE(a."umbralVentasUf", 0) = COALESCE(b."umbralVentasUf", 0)
   AND a.id < b.id
   AND a."supersededAt" IS NULL
   AND b."supersededAt" IS NULL
  JOIN "Contrato" c ON c.id = a."contratoId"
  WHERE a."vigenciaDesde" <= COALESCE(b."vigenciaHasta", DATE '9999-12-31')
    AND b."vigenciaDesde" <= COALESCE(a."vigenciaHasta", DATE '9999-12-31')
`;

console.log(`Active overlaps under new grouping (contratoId, tipo, esDiciembre, umbral):`);
console.log(`  ${overlaps.length} pairs`);

if (overlaps.length > 0) {
  console.log(`\nDetails (top 10):`);
  overlaps.slice(0, 10).forEach((row) => {
    const dec = row.esDiciembre ? "DEC" : "REG";
    console.log(`  · ${row.numeroContrato} [${row.tipo}/${dec}/u=${row.umbral}]`);
    console.log(`      ${row.desde_a.toISOString().slice(0, 10)} → ${row.hasta_a.toISOString().slice(0, 10)}`);
    console.log(`      ${row.desde_b.toISOString().slice(0, 10)} → ${row.hasta_b.toISOString().slice(0, 10)}`);
  });
  console.log(`\n⚠ Migration will fail. Clean these before applying GIST constraint.`);
  process.exitCode = 1;
} else {
  console.log(`\n✓ Safe to apply GIST constraint.`);
}

await prisma.$disconnect();
