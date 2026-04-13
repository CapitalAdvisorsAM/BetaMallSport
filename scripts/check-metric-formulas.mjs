import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

// ---------------------------------------------------------------------------
// 1. Extract all metric formula IDs from metric-formulas.ts
//    Structural completeness (title/formula/detail) is enforced by the
//    TypeScript `satisfies Record<string, MetricFormulaDefinition>` annotation.
// ---------------------------------------------------------------------------

const formulasPath = path.join(repoRoot, "src/lib/metric-formulas.ts");
if (!fs.existsSync(formulasPath)) {
  console.error("check-metric-formulas: src/lib/metric-formulas.ts not found.");
  process.exit(1);
}

const formulasContent = fs.readFileSync(formulasPath, "utf8");

// Top-level keys: lines indented with exactly 2 spaces followed by word chars and a colon
const keyMatches = [...formulasContent.matchAll(/^  ([\w_]+):/gm)];
const validIds = new Set(keyMatches.map((m) => m[1]));

if (validIds.size === 0) {
  console.error("check-metric-formulas: no formula IDs found in metric-formulas.ts.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Scan source files for getMetricFormula("...") and validate IDs
// ---------------------------------------------------------------------------

const EXT = new Set([".ts", ".tsx"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "dist"]);

function scanDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) scanDir(full, callback);
    } else if (entry.isFile() && EXT.has(path.extname(entry.name))) {
      callback(full);
    }
  }
}

const USAGE_RE = /getMetricFormula\(["']([^"']+)["']\)/g;
const issues = [];

scanDir(path.join(repoRoot, "src"), (filePath) => {
  const content = fs.readFileSync(filePath, "utf8");
  for (const match of content.matchAll(USAGE_RE)) {
    const usedId = match[1];
    if (!validIds.has(usedId)) {
      const rel = path.relative(repoRoot, filePath).split(path.sep).join("/");
      issues.push(`${rel}: references unknown metric formula id "${usedId}"`);
    }
  }
});

// ---------------------------------------------------------------------------
// 3. Report
// ---------------------------------------------------------------------------

if (issues.length > 0) {
  console.error("check-metric-formulas failed:");
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  process.exit(1);
}

console.log(`check-metric-formulas: ${validIds.size} formulas validated.`);
