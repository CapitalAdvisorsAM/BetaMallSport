import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, "src");

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function collectTsxFiles(directory, acc = []) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const nextPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectTsxFiles(nextPath, acc);
      continue;
    }
    if (entry.isFile() && nextPath.endsWith(".tsx")) {
      acc.push(nextPath);
    }
  }
  return acc;
}

function getLineAndColumn(content, index) {
  const prefix = content.slice(0, index);
  const lines = prefix.split("\n");
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { line, column };
}

function addIssue(issues, filePath, index, message) {
  const { line, column } = getLineAndColumn(fs.readFileSync(filePath, "utf8"), index);
  issues.push({
    filePath: toPosix(path.relative(repoRoot, filePath)),
    line,
    column,
    message
  });
}

function checkKpiCards(filePath, content, issues) {
  const matches = content.matchAll(/<KpiCard\b[\s\S]*?\/>/g);
  for (const match of matches) {
    const snippet = match[0];
    if (!/\bmetricId\s*=/.test(snippet)) {
      addIssue(issues, filePath, match.index ?? 0, "KpiCard must declare metricId.");
    }
  }
}

function checkRechartsFiles(filePath, content, issues) {
  const importsRecharts =
    content.includes('from "recharts"') || content.includes("from 'recharts'");
  if (!importsRecharts) {
    return;
  }

  const usesMetricChartCard = /<MetricChartCard\b/.test(content);
  if (!usesMetricChartCard) {
    addIssue(
      issues,
      filePath,
      content.indexOf("recharts"),
      "Files importing recharts must render MetricChartCard."
    );
  }
}

function checkTooltipFreeText(filePath, content, issues) {
  const matches = content.matchAll(/<MetricTooltip\b[\s\S]*?\/>/g);
  for (const match of matches) {
    if (/explanation\s*=/.test(match[0])) {
      addIssue(issues, filePath, match.index ?? 0, "MetricTooltip cannot receive free-text explanation.");
    }
  }
}

function main() {
  const files = collectTsxFiles(srcRoot);
  const issues = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    if (content.includes("<KpiCard")) {
      checkKpiCards(filePath, content, issues);
    }
    if (content.includes("recharts")) {
      checkRechartsFiles(filePath, content, issues);
    }
    if (content.includes("<MetricTooltip")) {
      checkTooltipFreeText(filePath, content, issues);
    }
  }

  if (issues.length > 0) {
    console.error("Metric formula guardrail failed:");
    for (const issue of issues) {
      console.error(`- ${issue.filePath}:${issue.line}:${issue.column} ${issue.message}`);
    }
    process.exit(1);
  }

  console.log("Metric formula guardrail passed.");
}

main();
