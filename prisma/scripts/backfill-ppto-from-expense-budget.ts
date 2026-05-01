/**
 * Backfill: Convert legacy ExpenseBudget rows into AccountingRecord scenario=PPTO.
 *
 * Run once after the migration `add_accounting_scenario` is applied:
 *   npx tsx prisma/scripts/backfill-ppto-from-expense-budget.ts [--dry-run]
 *
 * Idempotent: skips rows that already have a matching PPTO record (same
 * projectId + period + group3 + valueUf).
 */
import { AccountingScenario, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  const budgets = await prisma.expenseBudget.findMany({
    orderBy: [{ projectId: "asc" }, { periodo: "asc" }]
  });

  if (budgets.length === 0) {
    console.log("No ExpenseBudget rows to migrate.");
    return;
  }

  console.log(`Found ${budgets.length} ExpenseBudget rows. Dry-run: ${dryRun}`);

  let inserted = 0;
  let skipped = 0;

  for (const budget of budgets) {
    const existing = await prisma.accountingRecord.findFirst({
      where: {
        projectId: budget.projectId,
        period: budget.periodo,
        group3: budget.grupo3,
        scenario: AccountingScenario.PPTO,
        unitId: null,
        tenantId: null
      },
      select: { id: true }
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      inserted += 1;
      continue;
    }

    await prisma.accountingRecord.create({
      data: {
        projectId: budget.projectId,
        period: budget.periodo,
        group1: budget.grupo1,
        group3: budget.grupo3,
        denomination: budget.grupo3,
        valueUf: budget.valorUf,
        scenario: AccountingScenario.PPTO
      }
    });
    inserted += 1;
  }

  console.log(`Inserted: ${inserted}. Skipped (already present): ${skipped}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
