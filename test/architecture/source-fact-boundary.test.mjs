// Host/target Source boundary (nextgen plan §2, invariants I1 and I2; supervisor ruling 2026-11-07).
// I1: no checker Type / Signature / Symbol / Resolved*Info is reachable from the target-facing target-api entries.
// I2: tsonic-csharp reads Source answers only through SourceProgramFacts: it never imports the Host-internal entry
//     `@tsonic/target-api/host`, never imports Type / Signature / Symbol from `@tsonic/tsts`, never calls `semantics(`
//     and has no `resolveTypeWithState`. Zero findings are allowed; there is no allowlist.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const tsonicRoot = path.join(workspace, "tsonic");
const csharpSource = path.join(workspace, "tsonic-csharp", "src");
const checkerNames = /^(Type|Signature|Symbol|Resolved\w*Info)$/u;

async function typeScriptFiles(root, suffix) {
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(file);
      else if (entry.name.endsWith(suffix)) files.push(file);
    }
  }
  return files.sort();
}

function importedNames(text, specifier) {
  const names = [];
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\/]/gu, "\\$&");
  const named = new RegExp(`import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s+from\\s+"${escaped}"`, "gu");
  for (const match of text.matchAll(named)) {
    for (const name of match[1].split(",")) {
      const imported = name.trim().replace(/^type\s+/u, "").split(/\s+as\s+/u)[0].trim();
      if (imported !== "") names.push(imported);
    }
  }
  const inline = new RegExp(`import\\(\\s*"${escaped}"\\s*\\)\\.(\\w+)`, "gu");
  for (const match of text.matchAll(inline)) names.push(match[1]);
  return names;
}

/** I2 findings for one C# source text (exported for the self-check below). */
export function csharpSourceBoundaryFindings(file, text) {
  const findings = [];
  if (/(?:from\s+|import\s*\(\s*)"@tsonic\/target-api\/host"/u.test(text)) findings.push(`${file}: imports @tsonic/target-api/host`);
  for (const name of importedNames(text, "@tsonic/tsts")) {
    if (/^(Type|Signature|Symbol)$/u.test(name)) findings.push(`${file}: imports checker ${name} from @tsonic/tsts`);
  }
  if (/\bsemantics\s*\(/u.test(text)) findings.push(`${file}: calls semantics(...)`);
  if (/\bresolveTypeWithState\b/u.test(text)) findings.push(`${file}: uses resolveTypeWithState`);
  if (/\bhostSourceProgramOf(?:AnalysisHost)?\b/u.test(text)) findings.push(`${file}: opens the Host program handle`);
  return findings;
}

test("I2 self-check: the C# boundary scan recognises every forbidden form", () => {
  assert.equal(csharpSourceBoundaryFindings("a.ts", `import { hostSourceProgramOf } from "@tsonic/target-api/host";`).length, 2);
  assert.equal(csharpSourceBoundaryFindings("a.ts", `import type { Node, Type } from "@tsonic/tsts";`).length, 1);
  assert.equal(csharpSourceBoundaryFindings("a.ts", `let t: import("@tsonic/tsts").Signature;`).length, 1);
  assert.equal(csharpSourceBoundaryFindings("a.ts", `source.semantics (node).types;`).length, 1);
  assert.equal(csharpSourceBoundaryFindings("a.ts", `resolveTypeWithState(state, type);`).length, 1);
  assert.deepEqual(csharpSourceBoundaryFindings("a.ts",
    `import type { Node, SourceFile } from "@tsonic/tsts";\nconst x = facts.analyses.integerRange(node);`), []);
});

test("I2: tsonic-csharp reads Source answers through SourceProgramFacts only", async (t) => {
  if (!existsSync(csharpSource)) {
    t.skip(`tsonic-csharp is not checked out next to tsonic (${csharpSource})`);
    return;
  }
  const findings = [];
  for (const file of await typeScriptFiles(csharpSource, ".ts")) {
    findings.push(...csharpSourceBoundaryFindings(path.relative(workspace, file), await readFile(file, "utf8")));
  }
  assert.deepEqual(findings, []);
});

/** Every .d.ts reachable from an entry through relative imports and re-exports. */
async function declarationClosure(entry) {
  const seen = new Set();
  const pending = [entry];
  while (pending.length > 0) {
    const file = pending.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(/(?:from\s+|import\s*\(\s*)"(\.{1,2}\/[^"]+)"/gu)) {
      pending.push(path.resolve(path.dirname(file), match[1].replace(/\.js$/u, ".d.ts")));
    }
  }
  return [...seen].sort();
}

test("I1: no checker type is reachable from the target-facing target-api entries", async (t) => {
  const dist = path.join(tsonicRoot, "packages", "target-api", "dist", "public");
  const entries = ["source.d.ts", "analysis.d.ts", "provider.d.ts", "artifacts.d.ts"].map(name => path.join(dist, name));
  if (!entries.every(entry => existsSync(entry))) {
    t.skip("target-api is not built (dist/public missing)");
    return;
  }
  const findings = [];
  const files = new Set();
  for (const entry of entries) for (const file of await declarationClosure(entry)) files.add(file);
  for (const file of [...files].sort()) {
    const text = await readFile(file, "utf8");
    for (const name of importedNames(text, "@tsonic/tsts")) {
      if (checkerNames.test(name)) findings.push(`${path.relative(dist, file)}: ${name}`);
    }
  }
  assert.deepEqual(findings, []);
});

// ---- I3: only target-api/src/host-input reads the checker inside the Host value model and role model -----------------
// Scanned: source-semantics/local-type-flow/**, source-navigation/** and source-model/** (the checker-free syntax layer) (production files; the test-program helper
// type-flow-test-program.ts is test support). The patterns are those of local-type-flow/program-facts.test.ts (A3).
// A scanned file may import host-input only as types (the adapter interfaces and opaque handles); a value import would
// call a checker reader directly. Every module a scanned file value-imports outside host-input is scanned for checker
// imports and checker query APIs as well, transitively, so a checker read cannot hide one import away.
const hostSource = path.join(tsonicRoot, "packages", "target-api", "src");
const i3Roots = [path.join(hostSource, "source-semantics", "local-type-flow"), path.join(hostSource, "source-navigation"),
  path.join(hostSource, "source-model")];
const i3CheckerNames = /^(Type|Signature|Symbol|TypeCheckerQueries|TypeShapeQueries|SourceFileQueries|Resolved\w+|Type\w*Info)$/u;
const i3ScannedLine = [
  /(?<![-\w])semantics\b/u, /\bSourceFileSemantics\b/u, /\bSourceProgramSemantics\b/u, /\bSourceTypeComponentEvidence\b/u,
  /\bexpressionType\b/u, /\b(?:queries|query|caller|formalQuery)\.(?:types|declarations|operations|facts|propertyNames)\b/u,
  /\bgetSourceFileQueries\b/u, /\.checker\b/u,
];
const i3ReachedLine = [/\bSourceFileSemantics\b/u, /\bSourceProgramSemantics\b/u, /\bgetSourceFileQueries\b/u, /\bexpressionType\b/u];

/** I3 findings for one Host source text; `scanned` = inside the scanned roots (exported for the self-check). */
export function hostCheckerBoundaryFindings(file, text, scanned) {
  const findings = [];
  for (const name of importedNames(text, "@tsonic/tsts")) {
    if (i3CheckerNames.test(name)) findings.push(`${file}: imports checker ${name} from @tsonic/tsts`);
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    for (const pattern of scanned ? i3ScannedLine : i3ReachedLine) {
      if (pattern.test(line)) findings.push(`${file}: ${trimmed.slice(0, 160)}`);
    }
  }
  return findings;
}

/** Relative value imports of a source text: specifier and the imported value names (type-only names excluded). */
function relativeValueImports(text) {
  const imports = [];
  for (const match of text.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+"(\.{1,2}\/[^"]+)"/gu)) {
    if (match[1] !== undefined) continue;
    const names = match[2].split(",").map(name => name.trim()).filter(name => name !== "" && !name.startsWith("type "));
    if (names.length > 0) imports.push({ specifier: match[3], names });
  }
  for (const match of text.matchAll(/import\s+(?:\*\s+as\s+\w+|\w+)\s+from\s+"(\.{1,2}\/[^"]+)"/gu)) {
    imports.push({ specifier: match[1], names: ["*"] });
  }
  for (const match of text.matchAll(/export\s+(?:\*|\{[^}]*\})\s+from\s+"(\.{1,2}\/[^"]+)"/gu)) {
    imports.push({ specifier: match[1], names: ["*"] });
  }
  return imports;
}

test("I3 self-check: the Host checker scan recognises every forbidden form", () => {
  assert.equal(hostCheckerBoundaryFindings("a.ts", `import type { Node, Type } from "@tsonic/tsts";`, true).length, 1);
  assert.equal(hostCheckerBoundaryFindings("a.ts", `const t = queries.types.expressionType(node);`, true).length, 2);
  assert.equal(hostCheckerBoundaryFindings("a.ts", `const s = source.semantics.forNode(node);`, true).length, 1);
  assert.equal(hostCheckerBoundaryFindings("a.ts", `import type { SourceFileSemantics } from "../x.js";`, false).length, 1);
  assert.deepEqual(hostCheckerBoundaryFindings("a.ts",
    `import { Node_Expression } from "../../source-navigation/ast.js";\n// semantics in a comment\nimport { x } from "../source-semantics/y.js";`, true), []);
  assert.deepEqual(relativeValueImports(`import type { A } from "./a.js";\nimport { type B, c } from "./b.js";\nimport { type D } from "./d.js";`),
    [{ specifier: "./b.js", names: ["c"] }]);
});

test("I3: local-type-flow and source-navigation read no checker; host-input is reached through its interfaces only", async () => {
  const hostInput = path.join(hostSource, "host-input") + path.sep;
  const scannedFiles = [];
  for (const root of i3Roots) {
    for (const file of await typeScriptFiles(root, ".ts")) {
      if (!file.endsWith(".test.ts") && !file.endsWith(".d.ts") && path.basename(file) !== "type-flow-test-program.ts") scannedFiles.push(file);
    }
  }
  assert.equal(scannedFiles.length > 40, true, "the scan sees the type-flow and navigation sources");
  const scanned = new Set(scannedFiles);
  const findings = [];
  const seen = new Set();
  const pending = [...scannedFiles];
  while (pending.length > 0) {
    const file = pending.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const text = await readFile(file, "utf8");
    const relative = path.relative(hostSource, file);
    findings.push(...hostCheckerBoundaryFindings(relative, text, scanned.has(file)));
    for (const { specifier, names } of relativeValueImports(text)) {
      const target = path.resolve(path.dirname(file), specifier.replace(/\.js$/u, ".ts"));
      if (target.startsWith(hostInput)) {
        findings.push(`${relative}: value-imports ${names.join(", ")} from ${path.relative(hostSource, target)} (host-input is reached through its interfaces only)`);
      } else pending.push(target);
    }
  }
  assert.deepEqual(findings, []);
});

test("I1: the target-facing entries do not export the Host program handle", async () => {
  const source = await readFile(path.join(tsonicRoot, "packages", "target-api", "src", "public", "source.ts"), "utf8");
  const analysis = await readFile(path.join(tsonicRoot, "packages", "target-api", "src", "public", "analysis.ts"), "utf8");
  for (const [name, text] of [["source.ts", source], ["analysis.ts", analysis]]) {
    assert.equal(/\bhostSourceProgramOf\b|\bcreateHostSourceProgram\b|\bHostSourceProgram\b/u.test(text), false, name);
    assert.equal(/from\s+"\.\.\/target-analysis\/index\.js"|from\s+"\.\.\/source-semantics\/index\.js"/u.test(text), false, name);
  }
});
