import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const repoRoot = process.cwd();

const canonicalTargets = [
  "src/app/api/contracts/route.ts",
  "src/app/api/contracts/[id]/route.ts",
  "src/app/api/contracts/[id]/pdf/route.ts",
  "src/app/api/tenants",
  "src/app/api/units",
  "src/app/api/projects",
  "src/app/(dashboard)/rent-roll/contracts",
  "src/app/(dashboard)/rent-roll/tenants",
  "src/app/(dashboard)/rent-roll/units",
  "src/app/(dashboard)/rent-roll/projects",
  "src/components/rent-roll/TenantsCrudPanel.tsx",
  "src/components/rent-roll/TenantsViewTable.tsx",
  "src/components/rent-roll/UnitsCrudPanel.tsx",
  "src/components/rent-roll/UnitsViewTable.tsx",
  "src/components/rent-roll/ProjectCrudPanel.tsx",
  "src/components/crud",
  "src/components/ui/data-table-columns.tsx",
  "src/hooks/useCrudResource.ts",
  "src/lib/http/client-errors.ts",
  "src/lib/project-query.ts",
  "src/lib/tenants/tenant-service.ts",
  "src/lib/units/unit-service.ts",
  "src/lib/rent-roll/tenants.ts",
  "src/lib/rent-roll/units.ts",
  "src/app/api/tenants",
  "src/app/api/units"
];

const fileExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const bannedSpanishRoots = new Set([
  "arrendatario",
  "arrendatarios",
  "local",
  "locales",
  "proyecto",
  "proyectos"
]);

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function collectFiles(entryPath, acc) {
  if (!fs.existsSync(entryPath)) {
    return;
  }

  const stat = fs.statSync(entryPath);
  if (stat.isFile()) {
    if (fileExtensions.has(path.extname(entryPath))) {
      acc.push(entryPath);
    }
    return;
  }

  const entries = fs.readdirSync(entryPath, { withFileTypes: true });
  for (const entry of entries) {
    const nextPath = path.join(entryPath, entry.name);
    if (entry.isDirectory()) {
      collectFiles(nextPath, acc);
    } else if (entry.isFile() && fileExtensions.has(path.extname(entry.name))) {
      acc.push(nextPath);
    }
  }
}

function shouldFlagPathSegment(segment) {
  const normalized = segment.toLowerCase();
  return bannedSpanishRoots.has(normalized);
}

function addIssue(issues, filePath, line, column, message) {
  issues.push({
    filePath: toPosix(path.relative(repoRoot, filePath)),
    line,
    column,
    message
  });
}

function checkPathSegments(absolutePath, issues) {
  const relPath = toPosix(path.relative(repoRoot, absolutePath));
  const segments = relPath.split("/");
  for (let i = 0; i < segments.length; i += 1) {
    const raw = segments[i];
    const stem = raw.replace(/\.[^.]+$/, "");
    if (shouldFlagPathSegment(stem)) {
      addIssue(
        issues,
        absolutePath,
        1,
        1,
        `Spanish path segment "${raw}" is not allowed in canonical core modules.`
      );
      return;
    }
  }
}

function visitIdentifierDeclarations(sourceFile, issues) {
  function checkIdentifier(node) {
    if (!node || !ts.isIdentifier(node)) {
      return;
    }
    const identifier = node.text.toLowerCase();
    if (!bannedSpanishRoots.has(identifier)) {
      return;
    }
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    addIssue(
      issues,
      sourceFile.fileName,
      line + 1,
      character + 1,
      `Spanish identifier "${node.text}" is not allowed. Use canonical English naming.`
    );
  }

  function visit(node) {
    if (ts.isVariableDeclaration(node)) {
      checkIdentifier(node.name);
    } else if (
      ts.isFunctionDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isEnumDeclaration(node)
    ) {
      checkIdentifier(node.name);
    } else if (ts.isImportSpecifier(node)) {
      checkIdentifier(node.name);
    } else if (ts.isImportClause(node)) {
      checkIdentifier(node.name);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function main() {
  const files = [];
  for (const target of canonicalTargets) {
    collectFiles(path.resolve(repoRoot, target), files);
  }

  const issues = [];
  for (const filePath of files) {
    checkPathSegments(filePath, issues);

    const content = fs.readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    visitIdentifierDeclarations(sourceFile, issues);
  }

  if (issues.length > 0) {
    console.error("Core naming check failed:");
    for (const issue of issues) {
      console.error(`- ${issue.filePath}:${issue.line}:${issue.column} ${issue.message}`);
    }
    process.exit(1);
  }

  console.log("Core naming check passed.");
}

main();
