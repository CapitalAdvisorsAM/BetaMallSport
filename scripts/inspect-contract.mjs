import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { loadEnvFile } from "./db-audit/load-env.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
loadEnvFile(path.join(repoRoot, ".env"));

const numeroContrato = process.argv[2];
if (!numeroContrato) {
  console.error("uso: node scripts/inspect-contract.mjs <numeroContrato>");
  process.exit(1);
}

const prisma = new PrismaClient({ log: ["error"] });
const c = await prisma.contract.findFirst({
  where: { numeroContrato },
  include: { tarifas: { orderBy: [{ tipo: "asc" }, { vigenciaDesde: "asc" }] } }
});

if (!c) {
  console.log("no encontrado");
  process.exit(1);
}

console.log(`Contrato ${c.numeroContrato}`);
console.log(`  fechaInicio:  ${c.fechaInicio?.toISOString().slice(0, 10)}`);
console.log(`  fechaTermino: ${c.fechaTermino?.toISOString().slice(0, 10)}`);
console.log(`  tarifas (${c.tarifas.length}):`);
c.tarifas.forEach((t) => {
  const inv = t.vigenciaHasta && t.vigenciaHasta < t.vigenciaDesde ? " ⚠ INVERTIDO" : "";
  console.log(
    `    [${t.tipo}] desde=${t.vigenciaDesde?.toISOString().slice(0, 10)} hasta=${t.vigenciaHasta?.toISOString().slice(0, 10) ?? "∞"} valor=${t.valor} umbral=${t.umbralVentasUf ?? "-"} createdAt=${t.createdAt?.toISOString().slice(0, 19)}${inv}`
  );
});

await prisma.$disconnect();
