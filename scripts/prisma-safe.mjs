import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const cmd = process.platform === "win32" ? "npx.cmd" : "npx";

function die(message) {
  console.error(message);
  process.exit(1);
}

function hasAnyArg(flag) {
  return args.includes(flag);
}

const normalized = args.join(" ").toLowerCase();
const isReset = normalized.includes("migrate reset") || normalized.includes("db reset");
const isDbPush = normalized.includes("db push");
const isForceReset = hasAnyArg("--force-reset") || hasAnyArg("--accept-data-loss");

if (process.env.NODE_ENV === "production") {
  die(
    "Bloqueado: no se permite ejecutar comandos Prisma contra producción desde scripts.\n" +
      "Sugerencia: usa un pipeline/runner controlado (y credenciales sin permisos de DROP)."
  );
}

// Bloqueo duro de operaciones típicamente destructivas.
if (isReset) {
  if (process.env.PRISMA_RESET_OK !== "YES_I_KNOW") {
    die(
      "Bloqueado: 'prisma migrate reset' puede borrar datos.\n" +
        "Si realmente quieres hacerlo, setea PRISMA_RESET_OK=YES_I_KNOW para esta ejecución."
    );
  }
}

if (isDbPush || isForceReset) {
  if (process.env.PRISMA_PUSH_OK !== "YES_I_KNOW") {
    die(
      "Bloqueado: 'prisma db push' (o flags de data loss) puede ser destructivo.\n" +
        "Si realmente quieres hacerlo, setea PRISMA_PUSH_OK=YES_I_KNOW para esta ejecución."
    );
  }
}

const result = spawnSync(cmd, ["prisma", ...args], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);

