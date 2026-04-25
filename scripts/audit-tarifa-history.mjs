import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, Prisma } from "@prisma/client";
import { loadEnvFile } from "./db-audit/load-env.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
loadEnvFile(path.join(repoRoot, ".env"));

const prisma = new PrismaClient({ log: ["error"] });

function title(text) {
  console.log(`\n${"=".repeat(text.length)}\n${text}\n${"=".repeat(text.length)}`);
}

function sub(text) {
  console.log(`\n— ${text}`);
}

function fmt(n) {
  return new Intl.NumberFormat("es-CL").format(Number(n) || 0);
}

async function main() {
  title("AUDITORÍA — historial de tarifas y GGCC");
  console.log(`DB target: ${process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ":***@") ?? "(none)"}`);

  sub("1. Volumen");
  const [contractCount, rateCount, ggccCount, amendmentCount] = await Promise.all([
    prisma.contract.count(),
    prisma.contractRate.count(),
    prisma.contractCommonExpense.count(),
    prisma.contractAmendment.count(),
  ]);
  console.log(`  Contratos:           ${fmt(contractCount)}`);
  console.log(`  ContractRate:        ${fmt(rateCount)}`);
  console.log(`  ContractGGCC:        ${fmt(ggccCount)}`);
  console.log(`  ContractAmendment:   ${fmt(amendmentCount)}`);

  sub("2. Tarifas con vigencia invertida (vigenciaHasta < vigenciaDesde)");
  const inverted = await prisma.$queryRaw`
    SELECT id, "contratoId", tipo, "vigenciaDesde", "vigenciaHasta"
    FROM "ContratoTarifa"
    WHERE "vigenciaHasta" IS NOT NULL AND "vigenciaHasta" < "vigenciaDesde"
  `;
  console.log(`  Filas con rango invertido: ${fmt(inverted.length)}`);
  inverted.slice(0, 5).forEach((row) => console.log(`    · ${row.id} tipo=${row.tipo} ${row.vigenciaDesde.toISOString().slice(0, 10)} → ${row.vigenciaHasta?.toISOString().slice(0, 10)}`));

  sub("3. Overlaps de tarifas dentro de un mismo contrato (tipo + umbral)");
  const overlaps = await prisma.$queryRaw`
    SELECT
      a."contratoId",
      c."numeroContrato",
      a.tipo,
      a.id AS id_a,
      b.id AS id_b,
      a."vigenciaDesde" AS desde_a,
      COALESCE(a."vigenciaHasta", DATE '9999-12-31') AS hasta_a,
      b."vigenciaDesde" AS desde_b,
      COALESCE(b."vigenciaHasta", DATE '9999-12-31') AS hasta_b,
      a.valor AS valor_a,
      b.valor AS valor_b
    FROM "ContratoTarifa" a
    JOIN "ContratoTarifa" b
      ON a."contratoId" = b."contratoId"
     AND a.tipo = b.tipo
     AND COALESCE(a."umbralVentasUf", 0) = COALESCE(b."umbralVentasUf", 0)
     AND a.id < b.id
    JOIN "Contrato" c ON c.id = a."contratoId"
    WHERE a."vigenciaDesde" < COALESCE(b."vigenciaHasta", DATE '9999-12-31')
      AND b."vigenciaDesde" < COALESCE(a."vigenciaHasta", DATE '9999-12-31')
    ORDER BY c."numeroContrato", a.tipo
  `;
  console.log(`  Pares de tarifas solapadas: ${fmt(overlaps.length)}`);
  const overlapContracts = new Set(overlaps.map((r) => r.contratoId));
  console.log(`  Contratos afectados:        ${fmt(overlapContracts.size)}`);
  overlaps.slice(0, 8).forEach((row) => {
    console.log(`    · ${row.numeroContrato} [${row.tipo}] ${row.desde_a.toISOString().slice(0, 10)}→${row.hasta_a.toISOString().slice(0, 10)} valor=${row.valor_a}  ∩  ${row.desde_b.toISOString().slice(0, 10)}→${row.hasta_b.toISOString().slice(0, 10)} valor=${row.valor_b}`);
  });

  sub("4. Overlaps de GGCC dentro de un mismo contrato");
  const ggccOverlaps = await prisma.$queryRaw`
    SELECT
      a."contratoId",
      c."numeroContrato",
      a.id AS id_a,
      b.id AS id_b,
      a."vigenciaDesde" AS desde_a,
      COALESCE(a."vigenciaHasta", DATE '9999-12-31') AS hasta_a,
      b."vigenciaDesde" AS desde_b,
      COALESCE(b."vigenciaHasta", DATE '9999-12-31') AS hasta_b
    FROM "ContratoGGCC" a
    JOIN "ContratoGGCC" b
      ON a."contratoId" = b."contratoId"
     AND a.id < b.id
    JOIN "Contrato" c ON c.id = a."contratoId"
    WHERE a."vigenciaDesde" < COALESCE(b."vigenciaHasta", DATE '9999-12-31')
      AND b."vigenciaDesde" < COALESCE(a."vigenciaHasta", DATE '9999-12-31')
    ORDER BY c."numeroContrato"
  `;
  console.log(`  Pares de GGCC solapados:  ${fmt(ggccOverlaps.length)}`);
  console.log(`  Contratos afectados:      ${fmt(new Set(ggccOverlaps.map((r) => r.contratoId)).size)}`);

  sub("5. Tarifas con descuento embebido");
  const withDiscount = await prisma.contractRate.count({
    where: { descuentoTipo: { not: null } }
  });
  const discountBreakdown = await prisma.$queryRaw`
    SELECT
      "descuentoTipo" AS tipo,
      COUNT(*)::int AS n,
      COUNT(CASE WHEN "descuentoDesde" IS NULL THEN 1 END)::int AS sin_desde,
      COUNT(CASE WHEN "descuentoHasta" IS NULL THEN 1 END)::int AS sin_hasta
    FROM "ContratoTarifa"
    WHERE "descuentoTipo" IS NOT NULL
    GROUP BY "descuentoTipo"
  `;
  console.log(`  Tarifas con descuento:    ${fmt(withDiscount)}`);
  discountBreakdown.forEach((row) => console.log(`    · ${row.tipo}: ${fmt(row.n)} (sin desde: ${fmt(row.sin_desde)}, sin hasta: ${fmt(row.sin_hasta)})`));

  sub("6. Anexos que tocan tarifas o GGCC");
  const amendmentsTarifa = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n
    FROM "ContratoAnexo"
    WHERE "camposModificados"::text LIKE '%tarifa%'
       OR "camposModificados"::text LIKE '%ggcc%'
  `;
  const churnyContracts = await prisma.$queryRaw`
    SELECT
      c."numeroContrato",
      COUNT(*)::int AS anexos
    FROM "ContratoAnexo" a
    JOIN "Contrato" c ON c.id = a."contratoId"
    WHERE a."camposModificados"::text LIKE '%tarifa%'
       OR a."camposModificados"::text LIKE '%ggcc%'
    GROUP BY c."numeroContrato"
    HAVING COUNT(*) >= 2
    ORDER BY anexos DESC
    LIMIT 10
  `;
  console.log(`  Anexos tocando tarifa/GGCC:  ${fmt(amendmentsTarifa[0]?.n ?? 0)}`);
  console.log(`  Contratos con >=2 anexos tarifa/GGCC (top 10):`);
  churnyContracts.forEach((row) => console.log(`    · ${row.numeroContrato}: ${fmt(row.anexos)} anexos`));

  sub("7. Tarifas por contrato (distribución)");
  const distribution = await prisma.$queryRaw`
    SELECT n_tarifas, COUNT(*)::int AS contratos
    FROM (
      SELECT "contratoId", COUNT(*)::int AS n_tarifas FROM "ContratoTarifa" GROUP BY "contratoId"
    ) t
    GROUP BY n_tarifas
    ORDER BY n_tarifas
  `;
  distribution.forEach((row) => console.log(`    · ${fmt(row.n_tarifas)} tarifa(s): ${fmt(row.contratos)} contratos`));

  sub("8. Riesgo: filas de tarifa sin vigenciaHasta (abiertas) por contrato+tipo");
  const openEnded = await prisma.$queryRaw`
    SELECT "contratoId", tipo, COUNT(*)::int AS abiertas
    FROM "ContratoTarifa"
    WHERE "vigenciaHasta" IS NULL
    GROUP BY "contratoId", tipo
    HAVING COUNT(*) > 1
  `;
  console.log(`  (contratoId, tipo) con >1 tarifa abierta: ${fmt(openEnded.length)}`);
  openEnded.slice(0, 5).forEach((row) => console.log(`    · ${row.contratoId} [${row.tipo}]: ${row.abiertas} filas sin vigenciaHasta`));

  title("FIN");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
