/**
 * Verifies the EXCLUDE USING gist constraint on ContratoTarifa rejects
 * a deliberate overlap. Runs entirely inside a transaction that's rolled
 * back at the end — no permanent data is written.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, Prisma } from "@prisma/client";
import { loadEnvFile } from "./db-audit/load-env.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnvFile(path.resolve(__dirname, "..", ".env"));

const prisma = new PrismaClient({ log: ["error"] });

async function main() {
  // Pick any contract — we don't care which.
  const sample = await prisma.contract.findFirst({ select: { id: true, numeroContrato: true } });
  if (!sample) {
    console.log("No contracts in DB; skipping.");
    return;
  }

  const probeIds = [];
  let result = "UNKNOWN";

  try {
    await prisma.$transaction(async (tx) => {
      // Insert two rows whose date ranges overlap. Same group key.
      const a = await tx.contractRate.create({
        data: {
          contratoId: sample.id,
          tipo: "FIJO_UF_M2",
          valor: new Prisma.Decimal("99.99"),
          vigenciaDesde: new Date("2099-01-01"),
          vigenciaHasta: new Date("2099-12-31"),
          esDiciembre: false
        }
      });
      probeIds.push(a.id);

      // The constraint should reject this insert (range [2099-06-01, 2099-12-31]
      // overlaps [2099-01-01, 2099-12-31] in the same (contratoId, tipo, esDiciembre,
      // umbralVentasUf=0) group, both supersededAt IS NULL).
      const b = await tx.contractRate.create({
        data: {
          contratoId: sample.id,
          tipo: "FIJO_UF_M2",
          valor: new Prisma.Decimal("88.88"),
          vigenciaDesde: new Date("2099-06-01"),
          vigenciaHasta: new Date("2099-12-31"),
          esDiciembre: false
        }
      });
      probeIds.push(b.id);

      // If we reach here, the constraint did NOT fire — that's a problem.
      result = "FAILED_TO_REJECT";
      throw new Error("rollback after probe");
    });
  } catch (err) {
    if (result === "FAILED_TO_REJECT") {
      // we forced rollback after success — the constraint is missing
    } else if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2010"
    ) {
      // Generic raw query error — could be the GIST exclusion
      result = "REJECTED_BY_DB";
    } else if (err.message && /exclusion|conflicts|ContratoTarifa_no_active_overlap/i.test(err.message)) {
      result = "REJECTED_BY_DB";
    } else if (err instanceof Error && /rollback after probe/.test(err.message)) {
      // probe path — already set FAILED_TO_REJECT
    } else {
      // Some other error — could still be the constraint surfacing as a different code
      console.log("Error during probe:", err.message);
      result = /exclusion|overlap/i.test(err.message ?? "") ? "REJECTED_BY_DB" : "UNKNOWN_ERROR";
    }
  }

  if (result === "REJECTED_BY_DB") {
    console.log("✓ Constraint rejected the deliberate overlap (as expected).");
  } else {
    console.log(`✗ ${result} — constraint may not be enforcing correctly.`);
    process.exitCode = 1;
  }

  // Defensive cleanup in case any probe row leaked outside the rolled-back tx.
  if (probeIds.length > 0) {
    await prisma.contractRate.deleteMany({ where: { id: { in: probeIds } } });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
