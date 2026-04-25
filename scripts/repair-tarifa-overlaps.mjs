import path from "node:path";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { loadEnvFile } from "./db-audit/load-env.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
loadEnvFile(path.join(repoRoot, ".env"));

const prisma = new PrismaClient({ log: ["error"] });

const APPLY = process.argv.includes("--apply");
const MODE = APPLY ? "APPLY" : "DRY-RUN";

const MS_PER_DAY = 86_400_000;

function fmtDate(d) {
  return d ? d.toISOString().slice(0, 10) : "∞";
}

function fmt(n) {
  return new Intl.NumberFormat("es-CL").format(Number(n) || 0);
}

function dayBefore(date) {
  return new Date(date.getTime() - MS_PER_DAY);
}

async function main() {
  console.log(`\n=== REPARACIÓN DE TARIFAS (${MODE}) ===`);
  console.log(`DB: ${process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ":***@") ?? "(none)"}`);
  console.log(`Ejecuta con --apply para escribir cambios. Sin flag = dry-run.\n`);

  const invertedRaw = await prisma.$queryRaw`
    SELECT t.id, t.tipo, t."vigenciaDesde", t."vigenciaHasta",
           c."numeroContrato", c."fechaTermino"
    FROM "ContratoTarifa" t
    JOIN "Contrato" c ON c.id = t."contratoId"
    WHERE t."vigenciaHasta" IS NOT NULL AND t."vigenciaHasta" < t."vigenciaDesde"
  `;

  const phantomRows = [];
  const invertedNeedingReview = [];
  for (const row of invertedRaw) {
    const isPhantom = row.fechaTermino && row.vigenciaDesde > row.fechaTermino;
    if (isPhantom) {
      phantomRows.push(row);
    } else {
      invertedNeedingReview.push(row);
    }
  }

  console.log(`── A. Rangos invertidos ──`);
  console.log(`   Fantasmas (vigenciaDesde posterior a fechaTermino): ${fmt(phantomRows.length)}`);
  phantomRows.forEach((row) => {
    console.log(`   🗑 ${row.numeroContrato} [${row.tipo}] id=${row.id}`);
    console.log(`     desde=${fmtDate(row.vigenciaDesde)} hasta=${fmtDate(row.vigenciaHasta)}  (fin contrato: ${fmtDate(row.fechaTermino)})`);
    console.log(`     → DELETE (nunca aplicará)`);
  });
  console.log(`   Otros invertidos (revisión manual): ${fmt(invertedNeedingReview.length)}`);
  invertedNeedingReview.forEach((row) => {
    console.log(`   ⚠ ${row.numeroContrato} [${row.tipo}] id=${row.id}`);
    console.log(`     desde=${fmtDate(row.vigenciaDesde)} hasta=${fmtDate(row.vigenciaHasta)}`);
    console.log(`     → REQUIERE REVISIÓN MANUAL`);
  });

  const contractsWithOverlap = await prisma.$queryRaw`
    SELECT DISTINCT a."contratoId"
    FROM "ContratoTarifa" a
    JOIN "ContratoTarifa" b
      ON a."contratoId" = b."contratoId"
     AND a.tipo = b.tipo
     AND COALESCE(a."umbralVentasUf", 0) = COALESCE(b."umbralVentasUf", 0)
     AND a.id < b.id
    WHERE a."vigenciaDesde" < COALESCE(b."vigenciaHasta", DATE '9999-12-31')
      AND b."vigenciaDesde" < COALESCE(a."vigenciaHasta", DATE '9999-12-31')
  `;

  const contractIds = contractsWithOverlap.map((r) => r.contratoId);
  console.log(`\n── B. Contratos con tarifas solapadas ──`);
  console.log(`   Contratos afectados: ${fmt(contractIds.length)}`);

  const proposals = [];
  const duplicatesToSupersede = [];

  for (const contratoId of contractIds) {
    const contrato = await prisma.contract.findUnique({
      where: { id: contratoId },
      select: { numeroContrato: true, fechaTermino: true }
    });
    // Only consider active rows (supersededAt IS NULL). Already-superseded rows
    // are historical and never participate in repairs.
    const rates = await prisma.contractRate.findMany({
      where: { contratoId, supersededAt: null },
      orderBy: [{ tipo: "asc" }, { umbralVentasUf: "asc" }, { vigenciaDesde: "asc" }, { createdAt: "asc" }]
    });

    const groups = new Map();
    for (const rate of rates) {
      const key = `${rate.tipo}::${rate.umbralVentasUf?.toString() ?? "0"}::${rate.esDiciembre ? "DEC" : "REG"}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(rate);
    }

    console.log(`\n   ▸ ${contrato.numeroContrato}  (fin contrato: ${fmtDate(contrato.fechaTermino)})`);

    for (const [key, list] of groups) {
      if (list.length < 2) continue;
      const [tipo, umbral, decFlag] = key.split("::");
      const labelExtra = [
        umbral !== "0" ? `umbral=${umbral}` : null,
        decFlag === "DEC" ? "diciembre" : null
      ].filter(Boolean).join(", ");
      console.log(`     ${tipo}${labelExtra ? ` (${labelExtra})` : ""}`);

      list.sort((a, b) => {
        const desdeDelta = a.vigenciaDesde.getTime() - b.vigenciaDesde.getTime();
        if (desdeDelta !== 0) return desdeDelta;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      // Phase 1: deduplicate exact-key clones. When two rows share vigenciaDesde
      // (and same tipo/umbral/esDiciembre), keep the OLDEST createdAt (presumably
      // the original) and supersede the rest as "duplicate from sync re-import".
      // This handles the case where an external sync re-inserts existing rows.
      const survivors = [];
      const seenDesde = new Map(); // desde-iso → first row
      for (const row of list) {
        const desdeKey = row.vigenciaDesde.toISOString().slice(0, 10);
        const earlier = seenDesde.get(desdeKey);
        if (earlier) {
          // duplicate — supersede the LATER one (this row)
          duplicatesToSupersede.push({
            id: row.id,
            numeroContrato: contrato.numeroContrato,
            tipo: row.tipo,
            vigenciaDesde: row.vigenciaDesde
          });
          console.log(`       ⊘ desde=${fmtDate(row.vigenciaDesde)} hasta=${fmtDate(row.vigenciaHasta)} valor=${row.valor}  (DUPLICATE — supersede)`);
          continue;
        }
        seenDesde.set(desdeKey, row);
        survivors.push(row);
      }

      // Phase 2: close-the-gap on the deduplicated list.
      for (let i = 0; i < survivors.length; i++) {
        const row = survivors[i];
        const next = survivors[i + 1];
        const current = row.vigenciaHasta;
        let proposed = current;

        if (next) {
          const maxAllowed = dayBefore(next.vigenciaDesde);
          if (current === null || current >= next.vigenciaDesde) {
            proposed = maxAllowed;
          }
        }

        const changed = (current?.getTime() ?? null) !== (proposed?.getTime() ?? null);
        const marker = changed ? "✎" : " ";
        const currentStr = fmtDate(current);
        const proposedStr = fmtDate(proposed);
        const changeStr = changed ? `  →  hasta=${proposedStr}` : "";
        console.log(`       ${marker} desde=${fmtDate(row.vigenciaDesde)} hasta=${currentStr} valor=${row.valor}${changeStr}`);

        if (changed) {
          proposals.push({
            id: row.id,
            numeroContrato: contrato.numeroContrato,
            tipo: row.tipo,
            vigenciaDesde: row.vigenciaDesde,
            oldHasta: current,
            newHasta: proposed
          });
        }
      }
    }
  }

  console.log(`\n── C. Resumen ──`);
  console.log(`   UPDATEs (cerrar bases):      ${fmt(proposals.length)}`);
  console.log(`   SUPERSEDED (duplicados):     ${fmt(duplicatesToSupersede.length)}`);
  console.log(`   DELETEs (fantasmas):         ${fmt(phantomRows.length)}`);
  console.log(`   Invertidos manuales:         ${fmt(invertedNeedingReview.length)}`);

  const sqlLines = [
    "-- Generated by scripts/repair-tarifa-overlaps.mjs",
    `-- ${new Date().toISOString()}`,
    `-- ${proposals.length} updates + ${duplicatesToSupersede.length} supersedes + ${phantomRows.length} deletes`,
    "BEGIN;"
  ];
  for (const p of proposals) {
    sqlLines.push(
      `-- ${p.numeroContrato} [${p.tipo}] desde=${fmtDate(p.vigenciaDesde)} hasta ${fmtDate(p.oldHasta)} → ${fmtDate(p.newHasta)}`
    );
    sqlLines.push(
      `UPDATE "ContratoTarifa" SET "vigenciaHasta" = DATE '${fmtDate(p.newHasta)}' WHERE id = '${p.id}';`
    );
  }
  for (const dup of duplicatesToSupersede) {
    sqlLines.push(
      `-- DUPLICATE ${dup.numeroContrato} [${dup.tipo}] desde=${fmtDate(dup.vigenciaDesde)} (supersede)`
    );
    sqlLines.push(
      `UPDATE "ContratoTarifa" SET "supersededAt" = NOW(), "supersedeReason" = 'duplicate from sync re-import (cleanup)' WHERE id = '${dup.id}';`
    );
  }
  for (const row of phantomRows) {
    sqlLines.push(
      `-- PHANTOM ${row.numeroContrato} [${row.tipo}] desde=${fmtDate(row.vigenciaDesde)} (fin contrato ${fmtDate(row.fechaTermino)})`
    );
    sqlLines.push(`DELETE FROM "ContratoTarifa" WHERE id = '${row.id}';`);
  }
  sqlLines.push("COMMIT;", "");
  const sqlPath = path.join(repoRoot, "scripts", "repair-tarifa-overlaps.generated.sql");
  writeFileSync(sqlPath, sqlLines.join("\n"));
  console.log(`   SQL generado: scripts/repair-tarifa-overlaps.generated.sql`);

  if (!APPLY) {
    console.log(`\n   (DRY-RUN — sin cambios en BD. Re-ejecuta con --apply para escribir.)`);
    return;
  }

  const supersedeAt = new Date();
  console.log(`\n   Aplicando ${fmt(proposals.length)} updates + ${fmt(duplicatesToSupersede.length)} supersedes + ${fmt(phantomRows.length)} deletes...`);
  await prisma.$transaction([
    ...proposals.map((p) =>
      prisma.contractRate.update({
        where: { id: p.id },
        data: { vigenciaHasta: p.newHasta }
      })
    ),
    ...duplicatesToSupersede.map((dup) =>
      prisma.contractRate.update({
        where: { id: dup.id },
        data: {
          supersededAt: supersedeAt,
          supersedeReason: "duplicate from sync re-import (cleanup)"
        }
      })
    ),
    ...phantomRows.map((row) =>
      prisma.contractRate.delete({ where: { id: row.id } })
    )
  ]);
  console.log(`   ✓ Aplicado.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
