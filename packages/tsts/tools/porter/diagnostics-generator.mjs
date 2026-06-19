// TSTS diagnostics catalog generator.
//
// Reads the pinned TS-Go diagnostics message catalog
// (packages/tsts/_vendor/typescript-go/internal/diagnostics/diagnostics_generated.go)
// and emits the generated diagnostic message catalog under
// packages/tsts/src/internal/diagnostics/generated/messages.ts.
//
// This is the TypeScript analogue of TS-Go's diagnostics_generated.go, produced
// deterministically from the same authoritative source. diagnostics_generated.go
// is itself generated from src/compiler/diagnosticMessages.json +
// extraDiagnosticMessages.json by the Go generate.go build script; parsing the
// pinned generated Go file (rather than re-deriving names from JSON) keeps the
// exported message variable names, keys, codes, text and category EXACTLY
// faithful to the product contract that the rest of TS-Go references — including
// the Go exported-identifier `X_`/`X` munging baked into convertPropertyName.
//
// Output files carry file-level @tsgo-generated metadata and are checked the same
// way as the AST generated artifacts and the Go-compat facades:
// missing / stale / orphan / untracked / invalid. Safe-write contract: create
// missing, no-op identical, fail on different unless --force.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { hashText, resolveRepo, writeTextSafely } from "./porter.mjs";

const GENERATOR = "porter:diagnostics";
const GENERATED_KIND = "diagnostics-generated";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function diagnosticsConfig(config) {
  const tsRoot = (config.tsRoot ?? "packages/tsts/src").replace(/\/$/, "");
  const sourceRoot = (config.sourceRoot ?? "packages/tsts/_vendor/typescript-go").replace(/\/$/, "");
  return {
    tsRoot,
    generatedDir: config.diagnosticsGeneratedDir ?? "internal/diagnostics/generated",
    catalogInput: config.diagnosticsCatalogInput ?? `${sourceRoot}/internal/diagnostics/diagnostics_generated.go`,
    localeInput: config.diagnosticsLocaleInput ?? `${sourceRoot}/internal/diagnostics/loc_generated.go`,
    localeDir: config.diagnosticsLocaleDir ?? `${sourceRoot}/internal/diagnostics/loc`,
  };
}

// ---------------------------------------------------------------------------
// Catalog parsing
//
// Every entry in diagnostics_generated.go is emitted by generate.go on a single
// line in a fixed field order:
//
//   var <VarName> = &Message{code: <int>, category: Category<Cat>, key: "<key>", text: "<text>"[, <boolField>: true]...}
//
// followed by a keyToMessage(key) switch. We parse the var lines into ordered
// catalog records. The Go double-quoted string literals in this catalog only use
// the `\"` and `\\` escapes (verified against the pinned source), which are a
// strict subset of JSON string escapes, so JSON.parse of the quoted segment is an
// exact decode.
// ---------------------------------------------------------------------------

// The Go category constant names (CategoryWarning/CategoryError/...) are ported
// 1:1 as exported value constants in the hand-written diagnostics.ts (Go:
// `type Category int32` + iota const block). The generated catalog references
// them by the same names the Go catalog uses.
const GO_CATEGORY_NAMES = new Set(["CategoryWarning", "CategoryError", "CategorySuggestion", "CategoryMessage"]);

const MESSAGE_LINE = /^var ([A-Za-z_][A-Za-z0-9_]*) = &Message\{code: (\d+), category: (Category(?:Warning|Error|Suggestion|Message)), key: ("(?:[^"\\]|\\.)*"), text: ("(?:[^"\\]|\\.)*")((?:, (?:reportsUnnecessary|elidedInCompatibilityPyramid|reportsDeprecated): true)*)\}$/;

const BOOL_FIELD = /, (reportsUnnecessary|elidedInCompatibilityPyramid|reportsDeprecated): true/g;

function decodeGoString(quoted) {
  // The catalog only contains `\"` and `\\` escapes, which JSON also recognizes
  // identically. JSON.parse therefore round-trips the exact value.
  return JSON.parse(quoted);
}

export function parseCatalog(source) {
  const records = [];
  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("var ") || !line.includes("= &Message{")) continue;
    const match = MESSAGE_LINE.exec(line);
    if (!match) {
      throw new Error(`unparseable diagnostics catalog entry: ${line}`);
    }
    const [, varName, codeText, goCategory, keyQuoted, textQuoted, boolTail] = match;
    if (!GO_CATEGORY_NAMES.has(goCategory)) throw new Error(`unknown diagnostic category ${goCategory} in: ${line}`);
    const flags = { reportsUnnecessary: false, elidedInCompatibilityPyramid: false, reportsDeprecated: false };
    for (const flagMatch of boolTail.matchAll(BOOL_FIELD)) {
      flags[flagMatch[1]] = true;
    }
    records.push({
      varName,
      code: Number.parseInt(codeText, 10),
      category: goCategory,
      key: decodeGoString(keyQuoted),
      text: decodeGoString(textQuoted),
      reportsUnnecessary: flags.reportsUnnecessary,
      elidedInCompatibilityPyramid: flags.elidedInCompatibilityPyramid,
      reportsDeprecated: flags.reportsDeprecated,
    });
  }
  if (records.length === 0) {
    throw new Error("diagnostics catalog parse produced zero entries; source format may have changed");
  }
  return records;
}

export function loadCatalog(config) {
  const dc = diagnosticsConfig(config);
  const source = readFileSync(resolveRepo(dc.catalogInput), "utf8");
  return parseCatalog(source);
}

// ---------------------------------------------------------------------------
// Emitter
// ---------------------------------------------------------------------------

// Faithful analogue of the `&Message{...}` literal. Optional bool fields are
// emitted only when true, exactly as generate.go does, so the TypeScript catalog
// mirrors the Go catalog field-for-field.
function emitMessage(record) {
  const parts = [
    `code: ${record.code}`,
    `category: ${record.category}`,
    `key: ${JSON.stringify(record.key)}`,
    `text: ${JSON.stringify(record.text)}`,
  ];
  if (record.reportsUnnecessary) parts.push("reportsUnnecessary: true");
  if (record.elidedInCompatibilityPyramid) parts.push("elidedInCompatibilityPyramid: true");
  if (record.reportsDeprecated) parts.push("reportsDeprecated: true");
  return `export const ${record.varName}: Message = { ${parts.join(", ")} };`;
}

// Distinct Go category constants referenced by the catalog, in canonical order
// (matches the iota declaration order in diagnostics.ts).
const CATEGORY_ORDER = ["CategoryWarning", "CategoryError", "CategorySuggestion", "CategoryMessage"];

export function emitMessages(records) {
  const usedCategories = CATEGORY_ORDER.filter((name) => records.some((record) => record.category === name));
  const lines = [];
  lines.push(`import type { Category, Key, Message } from "../diagnostics.js";`);
  lines.push("");
  for (const name of usedCategories) {
    lines.push(`const ${name}: Category = ${CATEGORY_ORDER.indexOf(name)};`);
  }
  lines.push("");
  for (const record of records) {
    lines.push(emitMessage(record));
    lines.push("");
  }
  // Faithful analogue of keyToMessage(key) in diagnostics_generated.go: a switch
  // mapping each diagnostic key to its message constant, returning undefined for
  // unknown keys (Go: returns nil).
  lines.push(`export function keyToMessage(key: Key): Message | undefined {`);
  lines.push(`  switch (key) {`);
  for (const record of records) {
    lines.push(`    case ${JSON.stringify(record.key)}:`);
    lines.push(`      return ${record.varName};`);
  }
  lines.push(`    default:`);
  lines.push(`      return undefined;`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push("");
  return lines.join("\n");
}

const LOCALES = [
  { tag: "zh-CN", constName: "zhCN" },
  { tag: "zh-TW", constName: "zhTW" },
  { tag: "cs-CZ", constName: "csCZ" },
  { tag: "de-DE", constName: "deDE" },
  { tag: "es-ES", constName: "esES" },
  { tag: "fr-FR", constName: "frFR" },
  { tag: "it-IT", constName: "itIT" },
  { tag: "ja-JP", constName: "jaJP" },
  { tag: "ko-KR", constName: "koKR" },
  { tag: "pl-PL", constName: "plPL" },
  { tag: "pt-BR", constName: "ptBR" },
  { tag: "ru-RU", constName: "ruRU" },
  { tag: "tr-TR", constName: "trTR" },
];

export function emitLocalizedMessages(_records, config) {
  const lines = [];
  const sentinelFile = `${LOCALES[0].tag}.json.gz`;
  const localeVendorPath = "_vendor/typescript-go/internal/diagnostics/loc";
  const workspaceLocaleVendorPath = "packages/tsts/_vendor/typescript-go/internal/diagnostics/loc";
  lines.push(`import { existsSync, readFileSync } from "node:fs";`);
  lines.push(`import { dirname, join, resolve } from "node:path";`);
  lines.push(`import { fileURLToPath } from "node:url";`);
  lines.push(`import { gunzipSync } from "node:zlib";`);
  lines.push(`import type { int } from "../../../go/scalars.js";`);
  lines.push(`import type { GoMap } from "../../../go/compat.js";`);
  lines.push(`import type { Tag } from "../../../go/golang.org/x/text/language.js";`);
  lines.push(`import { English, Low, MustParse, NewMatcher } from "../../../go/golang.org/x/text/language.js";`);
  lines.push(`import type { Key } from "../diagnostics.js";`);
  lines.push("");
  lines.push(`export const matcher = NewMatcher([`);
  lines.push(`  English,`);
  for (const locale of LOCALES) {
    lines.push(`  MustParse(${JSON.stringify(locale.tag)}),`);
  }
  lines.push(`]);`);
  lines.push("");
  lines.push(`type LocaleLoader = (() => GoMap<Key, string>) | undefined;`);
  lines.push("");
  lines.push(`let localeRootValue: string | undefined;`);
  lines.push("");
  lines.push(`function localeRootCandidates(moduleDir: string): string[] {`);
  lines.push(`  const candidates: string[] = [join(moduleDir, "loc")];`);
  lines.push(`  let current = moduleDir;`);
  lines.push(`  for (let depth = 0; depth < 10; depth++) {`);
  lines.push(`    candidates.push(resolve(current, ${JSON.stringify(localeVendorPath)}));`);
  lines.push(`    candidates.push(resolve(current, ${JSON.stringify(workspaceLocaleVendorPath)}));`);
  lines.push(`    const parent = dirname(current);`);
  lines.push(`    if (parent === current) {`);
  lines.push(`      break;`);
  lines.push(`    }`);
  lines.push(`    current = parent;`);
  lines.push(`  }`);
  lines.push(`  return candidates;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function localeRoot(): string {`);
  lines.push(`  if (localeRootValue !== undefined) {`);
  lines.push(`    return localeRootValue;`);
  lines.push(`  }`);
  lines.push(`  const moduleDir = dirname(fileURLToPath(import.meta.url));`);
  lines.push(`  const candidates = localeRootCandidates(moduleDir);`);
  lines.push(`  for (const candidate of candidates) {`);
  lines.push(`    if (existsSync(join(candidate, ${JSON.stringify(sentinelFile)}))) {`);
  lines.push(`      localeRootValue = candidate;`);
  lines.push(`      return candidate;`);
  lines.push(`    }`);
  lines.push(`  }`);
  lines.push(`  throw new Error(\`localized diagnostic data not found. Checked: \${candidates.join(", ")}\`);`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function loadLocaleData(fileName: string): GoMap<Key, string> {`);
  lines.push(`  const text = gunzipSync(readFileSync(join(localeRoot(), fileName))).toString("utf8");`);
  lines.push(`  return new globalThis.Map<Key, string>(globalThis.Object.entries(JSON.parse(text)) as Array<[Key, string]>);`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function once(loader: () => GoMap<Key, string>): () => GoMap<Key, string> {`);
  lines.push(`  let cached: GoMap<Key, string> | undefined;`);
  lines.push(`  return (): GoMap<Key, string> => {`);
  lines.push(`    cached ??= loader();`);
  lines.push(`    return cached;`);
  lines.push(`  };`);
  lines.push(`}`);
  lines.push("");
  lines.push(`const localeFuncs: LocaleLoader[] = [`);
  lines.push(`  undefined,`);
  for (const locale of LOCALES) {
    lines.push(`  once(() => loadLocaleData(${JSON.stringify(`${locale.tag}.json.gz`)})),`);
  }
  lines.push(`];`);
  lines.push("");
  lines.push(`export function loadMatchedLocaleMessages(loc: Tag): GoMap<Key, string> | undefined {`);
  lines.push(`  const [, index, confidence] = matcher.Match(loc);`);
  lines.push(`  if (confidence < Low || index < 0 || index >= localeFuncs.length) {`);
  lines.push(`    return undefined;`);
  lines.push(`  }`);
  lines.push(`  const load = localeFuncs[index as int];`);
  lines.push(`  return load?.();`);
  lines.push(`}`);
  lines.push("");
  return lines.join("\n");
}

const EMITTERS = [
  { file: "messages.ts", emit: emitMessages, inputs: catalogInputDigests },
  { file: "loc.ts", emit: emitLocalizedMessages, inputs: localeInputDigests },
];

// ---------------------------------------------------------------------------
// File assembly + metadata
// ---------------------------------------------------------------------------

function catalogInputDigests(dc) {
  return [
    {
      path: dc.catalogInput,
      contentHash: hashText(readFileSync(resolveRepo(dc.catalogInput), "utf8")),
    },
  ];
}

function localeInputDigests(dc) {
  return [
    {
      path: dc.localeInput,
      contentHash: hashText(readFileSync(resolveRepo(dc.localeInput), "utf8")),
    },
    ...LOCALES.map((locale) => {
      const inputPath = `${dc.localeDir}/${locale.tag}.json.gz`;
      return {
        path: inputPath,
        contentHash: hashText(readFileSync(resolveRepo(inputPath)).toString("base64")),
      };
    }),
  ];
}

function generatedHeader(relativePath, body, sourceRevision, inputs) {
  const metadata = {
    schemaVersion: 1,
    kind: GENERATED_KIND,
    generator: GENERATOR,
    sourceRevision,
    inputs,
    path: relativePath,
    contentHash: hashText(body),
  };
  return `// Code generated by TSTS diagnostics generator. DO NOT EDIT.\n// @tsgo-generated ${JSON.stringify(metadata)}\n\n`;
}

// Returns Map<tsRootRelativePath, fullFileText>.
export function buildDiagnosticsGeneratedFiles(config, sourceRevision) {
  const dc = diagnosticsConfig(config);
  const records = loadCatalog(config);
  const files = new Map();
  for (const emitter of EMITTERS) {
    const relativePath = `${dc.generatedDir}/${emitter.file}`;
    const body = emitter.emit(records, config);
    const header = generatedHeader(relativePath, body, sourceRevision, emitter.inputs(dc));
    files.set(relativePath, header + body);
  }
  return files;
}

function generatedDirAbsolute(config) {
  const dc = diagnosticsConfig(config);
  return resolveRepo(path.join(dc.tsRoot, dc.generatedDir));
}

function walkTsFiles(root) {
  if (!existsSync(root)) return [];
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

function parseDiagnosticsMetadata(text) {
  const match = /^\/\/ @tsgo-generated\s+({[^\n\r]+})/m.exec(text);
  if (!match) return undefined;
  try {
    return JSON.parse(match[1]);
  } catch {
    return undefined;
  }
}

// Returns { missing, stale, orphan, untracked, invalid } — same shape as the AST
// and facade generated-artifact checks.
export function buildDiagnosticsGeneratedArtifactStatus(config, sourceRevision) {
  const dc = diagnosticsConfig(config);
  const expected = buildDiagnosticsGeneratedFiles(config, sourceRevision);
  const expectedPaths = new Set(expected.keys());
  const root = generatedDirAbsolute(config);
  const actualFiles = walkTsFiles(root).map((file) => `${dc.generatedDir}/${path.relative(root, file).split(path.sep).join("/")}`);
  const actualPaths = new Set(actualFiles);

  const missing = [];
  const stale = [];
  const orphan = [];
  const untracked = [];
  const invalid = [];

  for (const relativePath of [...expectedPaths].sort()) {
    if (!actualPaths.has(relativePath)) {
      missing.push({ path: relativePath, reason: "Expected generated diagnostics artifact is missing." });
    }
  }

  for (const relativePath of actualFiles) {
    const absolute = resolveRepo(path.join(dc.tsRoot, relativePath));
    const text = readFileSync(absolute, "utf8");
    const metadata = parseDiagnosticsMetadata(text);
    if (!metadata) {
      untracked.push({ path: relativePath, reason: "Generated diagnostics directory file is missing @tsgo-generated metadata." });
      continue;
    }
    if (metadata.kind !== GENERATED_KIND || metadata.generator !== GENERATOR) {
      invalid.push({ path: relativePath, reason: "Generated diagnostics file metadata kind/generator is not diagnostics-generated/porter:diagnostics." });
      continue;
    }
    if (!expectedPaths.has(relativePath)) {
      orphan.push({ path: relativePath, reason: "Generated diagnostics file is no longer produced from the current catalog." });
      continue;
    }
    if (text !== expected.get(relativePath)) {
      stale.push({ path: relativePath, reason: "Generated diagnostics file differs from the current deterministic generator output." });
    }
  }

  return { missing, stale, orphan, untracked, invalid };
}

export function collectDiagnosticsArtifactFailures(status) {
  const failures = [];
  if (status.missing.length > 0) failures.push(`${status.missing.length} missing diagnostics generated artifacts`);
  if (status.stale.length > 0) failures.push(`${status.stale.length} stale diagnostics generated artifacts`);
  if (status.orphan.length > 0) failures.push(`${status.orphan.length} orphan diagnostics generated artifacts`);
  if (status.untracked.length > 0) failures.push(`${status.untracked.length} untracked diagnostics generated artifacts`);
  if (status.invalid.length > 0) failures.push(`${status.invalid.length} invalid diagnostics generated artifacts`);
  return failures;
}

export function writeDiagnosticsGenerated(config, sourceRevision, options = {}) {
  const dc = diagnosticsConfig(config);
  const expected = buildDiagnosticsGeneratedFiles(config, sourceRevision);
  const results = [];
  for (const [relativePath, text] of expected) {
    const absolute = resolveRepo(path.join(dc.tsRoot, relativePath));
    const outcome = writeTextSafely(absolute, text, { force: options.force === true, label: "diagnostics generated artifact" });
    results.push({ path: relativePath, outcome });
  }
  return results;
}

export function emptyDiagnosticsGeneratedArtifactStatus() {
  return { missing: [], stale: [], orphan: [], untracked: [], invalid: [] };
}
