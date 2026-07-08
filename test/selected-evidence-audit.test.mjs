import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;

const riskRules = Object.freeze([
  { id: "checker.getResolvedSignature", pattern: /getResolvedSignature\s*\(/g },
  { id: "checker.getResolvedSymbol", pattern: /getResolvedSymbol\s*\(/g },
  { id: "checker.getSymbolAtLocation", pattern: /getSymbolAtLocation\s*\(/g },
  { id: "checker.getPropertyOfType", pattern: /getPropertyOfType\s*\(/g },
  { id: "checker.getTypeAtLocation", pattern: /getTypeAtLocation\s*\(/g },
  { id: "checker.getTypeFromTypeNode", pattern: /getTypeFromTypeNode\s*\(/g },
  { id: "broad-catch-return", pattern: /catch\s*\{\s*return\s+(?:undefined|false);?\s*\}/g },
  { id: "safe-helper", pattern: /\bsafeGet[A-Za-z0-9_]*/g },
  { id: "raw-TypeArguments", pattern: /\bTypeArguments\b/g },
  { id: "raw-Text", pattern: /\.Text\b/g },
  { id: "object-keys", pattern: /\bObject\.keys\s*\(/g },
  { id: "ownKeys", pattern: /\bownKeys\b/g },
  { id: "source-usage-channel", pattern: /\b(?:sourceUsage|sourceMemberNames|TargetSourceUsageHints)\b/g },
]);

const auditRows = Object.freeze([
  row("packages/host/src/analysis/project-source.ts", "project source analysis", "post-check-type-only-query", "Allowed host analysis query over already-checked project graph; not a target-side selected-operation proof."),
  row("packages/host/src/analysis/queries.ts", "ExtensionCompilerQueryContext adapter", "selected-evidence-compliant", "Allowed public read-only compiler query facade; consumers remain responsible for selected-evidence contracts."),
  row("packages/host/src/analysis/symbols.ts", "read-only compiler query helpers", "selected-evidence-compliant", "Allowed helper boundary behind public host query context; not a C# target fallback path."),
  row("packages/host/src/diagnostics.ts", "diagnostic descriptor validation", "provider-declaration-production", "Allowed object-shape validation of host diagnostics data."),
  row("packages/host/src/plugins/discovery.ts", "plugin manifest validation", "provider-declaration-production", "Allowed object-shape validation of installed plugin metadata."),
  row("packages/host/src/project-config.ts", "project config validation", "provider-declaration-production", "Allowed object-shape validation of user project config."),
  row("packages/host/src/target-facts/queries.ts", "target fact query materialization", "selected-evidence-compliant", "Allowed target fact query consumption; does not select source operations from names."),
]);

test("host selected-evidence audit inventory covers every current host risk-pattern file", () => {
  const matchedFiles = [...new Set(collectFindings().map((finding) => finding.file))].sort();
  assert.deepEqual(auditRows.map((entry) => entry.file).sort(), matchedFiles);
});

test("host selected-evidence audit expands every matched occurrence into a classified row", () => {
  const findings = collectFindings();
  const rows = findings.map((finding) => ({
    ...finding,
    ...auditRows.find((entry) => entry.file === finding.file),
  }));
  assert.equal(rows.length, findings.length);
  assert.deepEqual(
    rows.filter((entry) =>
      entry.symbol.trim().length === 0 ||
      entry.classification.trim().length === 0 ||
      entry.action.trim().length === 0),
    [],
  );
});

function row(file, symbol, classification, action) {
  return Object.freeze({
    file,
    symbol,
    classification,
    action,
  });
}

function collectFindings() {
  return sourceFiles(join(repoRoot, "packages/host/src")).flatMap((filePath) => {
    const file = relative(repoRoot, filePath).split(sep).join("/");
    const text = readFileSync(filePath, "utf8");
    return riskRules.flatMap((rule) => {
      rule.pattern.lastIndex = 0;
      return [...text.matchAll(rule.pattern)].map((match) => ({
        file,
        ruleId: rule.id,
        line: lineNumberAt(text, match.index ?? 0),
        snippet: lineAt(text, match.index ?? 0).trim(),
      }));
    });
  });
}

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entryName) => {
    const path = join(directory, entryName);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : path.endsWith(".ts")
        ? [path]
        : [];
  });
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let offset = 0; offset < index; offset += 1) {
    if (text.charCodeAt(offset) === 10) {
      line += 1;
    }
  }
  return line;
}

function lineAt(text, index) {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? text.length : end);
}
