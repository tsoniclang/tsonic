import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;

const riskRules = Object.freeze([
  { id: "checker.getResolvedSignature", pattern: /getResolvedSignature\s*\(/g },
  { id: "checker.getResolvedSymbol", pattern: /getResolvedSymbol\s*\(/g },
  { id: "checker.getResolvedSymbolOrNil", pattern: /getResolvedSymbolOrNil\s*\(/g },
  { id: "checker.getSignatureDeclaration", pattern: /getSignatureDeclaration\s*\(/g },
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
  { id: "raw-compiler-node-kind", pattern: /\.Kind\b/g },
  { id: "raw-compiler-subject-field", pattern: /\.(?:Flags|Name|Declarations|ValueDeclaration)\b/g },
  { id: "raw-semantic-subject-field", pattern: /\.flags\b/g },
  { id: "source-usage-channel", pattern: /\b(?:sourceUsage|sourceMemberNames|TargetSourceUsageHints)\b/g },
  { id: "target-analysis-selected-call-query", pattern: /\bgetResolvedCall(?:ReturnType|ParameterDeclarations|ParameterTypes)\b/g },
]);

const auditRows = Object.freeze([
  row("packages/host/src/analysis/guards.ts", "opaque fact-subject guards", "tsts-contract-gap", "Replace raw node/symbol shape checks with public TSTS subject-kind queries.", "Tracked by .analysis/tsts-issues/20260710-013000-public-fact-subject-kind-and-alias-queries.md and this exhaustive scanner."),
  row("packages/host/src/analysis/project-source.ts", "project source analysis", "post-check-type-only-query", "Allowed host analysis query over the already-checked project graph; it does not prove a selected target operation.", "Focused namespace/re-export/module graph tests plus this occurrence-level inventory."),
  row("packages/host/src/analysis/queries.ts", "read-only compiler query adapter", "selected-evidence-compliant", "Allowed public read-only compiler query facade after removal of selected-call reconstruction APIs.", "Architecture scanner forbids getResolvedCall* APIs and inventories every remaining checker query."),
  row("packages/host/src/analysis/symbols.ts", "read-only compiler query helpers", "selected-evidence-compliant", "Allowed helper boundary behind public host analysis; not a target-side selected-operation fallback.", "Focused alias/module-reference tests plus this occurrence-level inventory."),
  row("packages/host/src/diagnostics.ts", "bounded diagnostic serialization", "provider-declaration-production", "Allowed validation and bounded display of diagnostic payloads; raw shape reads are not semantic compiler input.", "Diagnostic contract tests plus this occurrence-level inventory."),
  row("packages/host/src/plugins/discovery.ts", "plugin manifest validation", "provider-declaration-production", "Allowed object-shape validation of installed plugin metadata.", "Plugin discovery contract tests plus this occurrence-level inventory."),
  row("packages/host/src/project-config.ts", "project config validation", "provider-declaration-production", "Allowed object-shape validation of user project config.", "Project-config negative tests plus this occurrence-level inventory."),
  row("packages/host/src/target-facts/queries.ts", "target fact query materialization", "selected-evidence-compliant", "Consumes finalized selected-target facts and performs declaration/type-only queries without reselecting source calls.", "Target-fact/backend fail-closed tests plus the ban on getResolvedCall* query APIs."),
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
    symbol: `${finding.enclosingSymbol} (${auditRows.find((entry) => entry.file === finding.file)?.symbol ?? "unclassified"})`,
  }));
  assert.equal(rows.length, findings.length);
  assert.deepEqual(
    rows.filter((entry) =>
      entry.symbol.trim().length === 0 ||
      entry.classification.trim().length === 0 ||
      entry.action.trim().length === 0 ||
      entry.coverage.trim().length === 0),
    [],
  );
});

test("host selected-evidence audit rejects removed selected-call reconstruction APIs", () => {
  const forbidden = collectFindings()
    .filter((finding) => finding.ruleId === "target-analysis-selected-call-query")
    .map((finding) => `${finding.file}:${finding.line}: ${finding.snippet}`);
  assert.deepEqual(forbidden, []);
});

function row(file, symbol, classification, action, coverage) {
  return Object.freeze({
    file,
    symbol,
    classification,
    action,
    coverage,
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
        enclosingSymbol: enclosingSymbolAt(text, match.index ?? 0),
      }));
    });
  });
}

function enclosingSymbolAt(text, index) {
  const prefix = text.slice(0, index);
  const functionMatches = [...prefix.matchAll(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g)];
  const methodMatches = [...prefix.matchAll(/^\s{4}([A-Za-z0-9_]+)\s*\([^\n]*\)\s*\{/gm)];
  const candidates = [
    ...functionMatches.map((match) => ({ index: match.index ?? -1, name: match[1] })),
    ...methodMatches.map((match) => ({ index: match.index ?? -1, name: match[1] })),
  ].sort((left, right) => right.index - left.index);
  return candidates[0]?.name ?? "module scope";
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
