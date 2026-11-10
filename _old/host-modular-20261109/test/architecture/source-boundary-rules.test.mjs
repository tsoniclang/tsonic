import assert from "node:assert/strict";
import test from "node:test";
import { readArchitectureTypeScript } from "./tooling/typescript-source.mjs";
import { checkerImportFindings, moduleLifetimeFindings, sourceForwardingFindings } from "./tooling/source-boundaries.mjs";

function findings(text, file = "packages/target-api/src/source-semantics/example.ts") {
  const source = readArchitectureTypeScript(new Map([[file, text]]));
  return source.sourceFiles.flatMap(input => [
    ...checkerImportFindings(source, input), ...moduleLifetimeFindings(source, input), ...sourceForwardingFindings(source, input),
  ]);
}

test("checker vocabulary belongs only to the actual Host input adapter, not merely a similarly named directory", () => {
  const text = 'import type { Type as Input, CheckedSourceProgram } from "@tsonic/tsts";';
  assert.deepEqual(findings(text, "packages/host/src/ingress/reader.ts"), []);
  for (const file of ["packages/host/src/host-input/reader.ts", "packages/source-core/src/host-input/reader.ts",
    "packages/host/src/ingress/contract.ts", "packages/target-api/src/host-input/reader.ts",
    "packages/target-api/src/source-semantics/host-input/reader.ts", "packages/source-core/src/reader.ts", "src/host-input/reader.ts"]) {
    assert.equal(findings(text, file).some(row => row.rule === "checker-type-or-query-import"), true, file);
  }
});

test("module-owned collections cannot hold per-program Source identities, including unmutated generic collections", () => {
  for (const text of ["const cache = new WeakMap();", "export const identities = new WeakSet();",
    "const cache = new WeakMap<object, number>();", "export const identities = new WeakSet<object>();",
    "const cache = new Map<object, number>();", "const cache = new Set<object>();",
    "const cache = Object.freeze(new Map<object, number>());", "const cache = { nested: new WeakSet<object>() };",
    "const retained = (() => { const cache = new WeakMap<object, number>(); return value => cache.get(value); })();",
    "const cache = new Map(); export function retain(node) { cache.set(node, 1); }",
    "const cache = new Map<object, number>(); export function retain(node) { cache.set(node, 1); }",
    "const cache = new Set(); export function retain(node) { cache.add(node); }",
    "const cache = new Set<object>(); export function retain(node) { cache.add(node); }",
    "class Registry { static cache = new WeakMap(); }",
    "class Registry { static cache = new WeakSet(); }",
    "class Registry { static { const cache = new WeakMap(); } }",
    "class Registry { static cache = new Map(); static retain(node) { this.cache.set(node, 1); } }",
    "class Registry { static cache = new Set(); } export function retain(node) { Registry.cache.add(node); }",
    "class Registry { static cache = new WeakMap<object, number>(); }",
    "class Registry { static cache = new WeakSet<object>(); }",
    "class Registry { static cache = new Map<object, number>(); static retain(node) { this.cache.set(node, 1); } }",
    "class Registry { static cache = new Set<object>(); } export function retain(node) { Registry.cache.add(node); }"]) {
    for (const file of ["packages/target-api/src/source-semantics/example.ts", "packages/host/src/host-input/example.ts",
      "packages/source-core/src/host-input/example.ts", "src/policy/example.ts"]) {
      assert.equal(findings(text, file).some(row => row.rule === "module-owned-mutable-cache"), true, `${file}: ${text}`);
    }
  }
});

test("checker import types and reexports obey the same original module boundary as imports", () => {
  for (const text of [
    'export type { Type as Hidden } from "@tsonic/tsts";',
    'export * as Raw from "@tsonic/tsts";',
    'type Hidden = import("@tsonic/tsts").Signature;',
    'type Hidden = import("@tsonic/tsts/internal/checker").Type;',
  ]) assert.equal(findings(text).some(row => row.rule === "checker-type-or-query-import" ||
    row.rule === "checker-namespace-import" || row.rule === "private-checker-entry"), true);
  assert.deepEqual(findings('type Site = import("@tsonic/tsts").Node; type Syntax = import("@tsonic/tsts/target-ast").Node;'), []);
});

test("one per-view factory and immutable metadata do not become module ownership violations", () => {
  assert.deepEqual(findings(`
    const labels = Object.freeze({ kind: "value", nested: Object.freeze(["first", "second"]) });
    export function createView() { const cache = new WeakMap(); return { retain(node) { cache.set(node, 1); } }; }
    function unrelated() { const labels = new Map(); labels.set("local", 1); }
    class View { cache = new WeakMap(); retain(node) { this.cache.set(node, 1); } }
    class InitializedView { cache = (() => { const cache = new WeakMap(); return cache; })(); }
    class PrivateView { #cache = new WeakSet<object>(); retain(node) { this.#cache.add(node); } }
    class Metadata { static labels = Object.freeze(["kind", "value"]); }
    export function createClassView() {
      return class View { static cache = new WeakMap(); static retain(node) { this.cache.set(node, 1); } };
    }
  `), []);
});

test("the canonical lifetime AST rule preserves transparent immutable data and rejects malformed freeze ownership", () => {
  assert.deepEqual(findings("const primitiveValues = [1, 2];"), []);
  for (const expression of [
    'Object.freeze(({ kind: "fact" }))',
    'Object.freeze({ kind: "fact" } as const)',
    'Object.freeze({ kind: "fact" } satisfies { readonly kind: string })',
    'Object.freeze(<{ readonly kind: string }>{ kind: "fact" })',
    'Object.freeze({ kind: "fact" }!)',
    'Object.freeze(-1)', 'Object.freeze(true)', 'Object.freeze(null)',
    'Object.freeze([1n, false, `fact`, () => 1, function read() { return 2; }])',
  ]) assert.deepEqual(findings(`const facts = ${expression};`), []);
  for (const expression of ["Object.freeze()", "Object.freeze({}, {})", "Object.freeze(new Map())",
    "freeze({})", "Custom.freeze({})", "Object.other({})"])
    assert.equal(findings(`const facts = ${expression};`).filter(row => row.rule === "module-owned-mutable-cache").length, 1);
  assert.equal(findings("let current; const nested = { action() { return 1; } };").some(row => row.rule === "module-owned-mutable-cache"), true);
});

test("immutable data resolves original imported declarations without accepting missing, mutable or cyclic aliases", () => {
  const owner = "packages/host/src/context/register.ts";
  const dependency = "packages/host/src/context/program.ts";
  const classify = (text, original) => {
    const source = readArchitectureTypeScript(new Map([[owner, text], [dependency, original]]));
    const file = source.sourceFiles.find(file => source.ast.getFileName(file).endsWith(owner));
    assert.equal(file !== undefined, true, "actual alias consumer exists before classification");
    return moduleLifetimeFindings(source, file, { immutableData: true });
  };
  assert.deepEqual(classify('import { createProgram as create } from "./program.js"; const factory = Object.freeze({ create });',
    "export function createProgram() { return 1; }"), []);
  assert.deepEqual(classify('import { labels } from "./program.js"; const factory = Object.freeze({ labels });',
    'const original = Object.freeze(["stable"]); export { original as labels };'), []);
  for (const original of ["export let labels = 1;", "export const labels = [];", "export declare const labels: number;",
    'import { factory } from "./register.js"; export const labels = factory;']) {
    assert.equal(classify('import { labels } from "./program.js"; export const factory = Object.freeze({ labels });', original)
      .some(row => row.rule === "module-owned-mutable-cache"), true, original);
  }
  assert.equal(classify('import { missing } from "./program.js"; const factory = Object.freeze({ missing });',
    "export const other = 1;").some(row => row.rule === "module-owned-mutable-cache"), true);
});

test("immutable vector and string composition resolves the same local and imported originals structurally", () => {
  const owner = "packages/host/src/libraries/register.ts";
  const dependency = "packages/host/src/libraries/identities.ts";
  const cases = [
    ["spread", 'const original = Object.freeze(["first", Object.freeze({ kind: "second" })]);', 'Object.freeze(["prefix", ...selected])', true],
    ["nested-spread", 'const first = Object.freeze(["first"]); const original = Object.freeze([...first, "second"]);', 'Object.freeze([...selected])', true],
    ["literal-index", 'const original = Object.freeze(["first", "second"]);', 'selected[1]', true],
    ["spread-index", 'const first = Object.freeze(["first"]); const original = Object.freeze([...first, "second"]);', 'selected[1]', true],
    ["empty-spread", 'const original = Object.freeze([]);', 'Object.freeze([...selected, "last"])', true],
    ["template", 'const original = "first";', '`head:${selected}:tail`', true],
    ["string-plus", 'const original = "first";', 'selected + `:tail`', true],
    ["template-plus", 'const original = "first";', '`head:${selected}` + `:tail`', true],
    ["numeric-spelling", 'const original = Object.freeze(["first", "second"]);', 'selected[0x1]', true],
    ["shared-vector", 'const level0 = Object.freeze(["leaf"]);' + Array.from({ length: 15 }, (_, index) =>
      `const level${index + 1} = Object.freeze([...level${index}, ...level${index}]);`).join("\n") + 'const original = level15;', 'selected[32767]', true],
    ["raw-vector-spread", 'const original = ["first"];', 'Object.freeze([...selected])', false],
    ["mutable-original", 'let original = Object.freeze(["first"]);', 'Object.freeze([...selected])', false],
    ["mutable-element", 'const original = Object.freeze([{}]);', 'Object.freeze([...selected])', false],
    ["mutable-alias", 'let backing = Object.freeze(["first"]); const original = backing;', 'Object.freeze([...selected])', false],
    ["spread-outside-freeze", 'const original = Object.freeze(["first"]);', '[...selected]', false],
    ["object-spread", 'const original = Object.freeze(["first"]);', 'Object.freeze({ ...selected })', false],
    ["nonvector-spread", 'const original = Object.freeze({ value: "first" });', 'Object.freeze([...selected])', false],
    ["nonliteral-index", 'const original = Object.freeze(["first"]);', 'selected[Number("0")]', false],
    ["computed-index", 'const original = Object.freeze(["first"]);', 'selected[0 + 0]', false],
    ["named-index", 'const index = 0; const original = Object.freeze(["first"]);', 'selected[index]', false],
    ["negative-index", 'const original = Object.freeze(["first"]);', 'selected[-1]', false],
    ["fractional-index", 'const original = Object.freeze(["first"]);', 'selected[0.5]', false],
    ["out-of-range", 'const original = Object.freeze(["first"]);', 'selected[1]', false],
    ["empty-index", 'const original = Object.freeze([]);', 'selected[0]', false],
    ["raw-vector-index", 'const original = ["first"];', 'selected[0]', false],
    ["unknown-length", 'declare const original: readonly string[];', 'selected[0]', false],
    ["missing-original", 'const other = "first";', 'selected[0]', false],
    ["alias-cycle", 'const original = cycle; const cycle = original;', 'Object.freeze([...selected])', false],
    ["accessor", 'const original = Object.freeze({ get value() { return "first"; } });', 'Object.freeze([selected])', false],
    ["callback", 'function original() { return "first"; }', '`${selected()}`', false],
    ["slice", 'const original = Object.freeze(["first"]);', 'Object.freeze(selected.slice())', false],
    ["filter", 'const original = Object.freeze(["first"]);', 'Object.freeze(selected.filter(() => true))', false],
    ["nonfreeze-call", 'const original = "first";', 'String(selected)', false],
    ["numeric-template", 'const original = 1;', '`${selected}`', false],
    ["numeric-plus", 'const original = 1;', 'selected + "tail"', false],
    ["string-plus-number", 'const original = "first";', 'selected + 1', false],
    ["unary-string", 'const original = -"first";', '`${selected}`', false],
    ["other-operator", 'const original = "first";', 'selected - "tail"', false],
    ["mutable-string", 'let original = "first";', '`${selected}`', false],
    ["array-string", 'const original = Object.freeze(["first"]);', '`${selected}`', false],
    ["foreign-original", 'import { original } from "not-supplied";', '`${selected}`', false],
  ];
  assert.equal(cases.length, 41, "complete independently expected structural composition domain");
  for (const mode of ["local", "imported"]) {
    for (const [name, original, expression, expected] of cases) {
      const imported = original.includes("const original") || original.includes("let original") || original.includes("function original")
        ? original.replace(/(?=(?:declare )?(?:const|let|function) original\b)/u, "export ") : `${original}\nexport { original };`;
      const text = mode === "local" ? `${original}\nconst selected = original;\nconst answer = ${expression};`
        : `import { original as selected } from './identities.js';\nconst answer = ${expression};`;
      const source = readArchitectureTypeScript(new Map([[owner, text], ...(mode === "imported" ? [[dependency, imported]] : [])]));
      const file = source.sourceFiles.find(file => source.ast.getFileName(file).endsWith(owner));
      assert.equal(file !== undefined, true, `${mode}/${name}: original consumer exists`);
      const rows = moduleLifetimeFindings(source, file, { immutableData: true });
      const answer = text.indexOf("answer =");
      assert.equal(rows.some(row => row.start === answer), !expected, `${mode}/${name}: exact answer classification`);
      if (expected) assert.deepEqual(rows, [], `${mode}/${name}: complete positive findings`);
    }
  }
});

test("Native forwarding preserves one original refusal code, message and site without a new Source code", () => {
  assert.deepEqual(findings(`function forward(refusal) { return { code: refusal.code, category: "error", source: "tsonic",
    message: refusal.message, sourceNode: refusal.site }; }`, "src/analysis/program/source-facts.ts"), []);
  assert.deepEqual(findings(`function forward(refusal) { return { "code": refusal.code, "source": "tsonic",
    "message": refusal.message, "sourceNode": refusal.site, 0: "native" }; }`, "src/analysis/program/source-facts.ts"), []);
  for (const text of [
    'const issue = { code: "TSONIC_LOCAL_TYPE_NEW", source: "tsonic", message: "new", sourceNode: node };',
    'function forward(refusal) { return { code: refusal.code, source: "tsonic", message: "changed", sourceNode: refusal.site }; }',
    'function forward(refusal, foreign) { return { code: refusal.code, source: "tsonic", message: foreign.message, sourceNode: refusal.site }; }',
    'function forward(refusal) { return { code: refusal.code, source: "tsonic", message: refusal.message, sourceNode: foreign }; }',
  ]) assert.equal(findings(text, "src/analysis/program/source-facts.ts").length > 0, true);
});

test("Native-owned failures and the exact resource infrastructure code stay independent", () => {
  assert.deepEqual(findings('const issue = { code: "CSHARP_NATIVE_REPRESENTATION", source: "tsonic-csharp", message: "native", sourceNode: node };', "src/analysis/example.ts"), []);
  assert.deepEqual(findings('const code = "TSONIC_COMPILER_RESOURCE_LIMIT";', "src/analysis/example.ts"), []);
  assert.equal(findings('const code = "TSONIC_COMPILER_RESOURCE_LIMIT_OTHER";', "src/analysis/example.ts").length, 1);
});

test("Native follows demand dispositions without comparing Host refusal codes", () => {
  for (const expression of ['("TSONIC_SOURCE_FORM_UNSUPPORTED")', '"TSONIC_SOURCE_FORM_UNSUPPORTED" as const',
    '<string>"TSONIC_SOURCE_FORM_UNSUPPORTED"', '"TSONIC_SOURCE_FORM_UNSUPPORTED" satisfies string',
    '"TSONIC_SOURCE_FORM_UNSUPPORTED"!'])
    assert.equal(findings(`const code = ${expression}; if (refusal.code === code) reject();`, "src/analysis/native-operands.ts")
      .some(row => row.rule === "native-source-code-comparison"), true, expression);
  for (const text of [
    'if (source.disposition !== "false" || source.whenTrue.code !== "TSONIC_SOURCE_FORM_UNSUPPORTED") reject();',
    'if (source.disposition !== "true" || source.whenFalse.code !== "TSONIC_SOURCE_FORM_UNSUPPORTED") reject();',
    'if (source.disposition !== "left" || controlledRight.code !== "TSONIC_SOURCE_FORM_UNSUPPORTED") reject();',
    'if (application.argumentDisposition !== "skip" || argument.operand.code !== "TSONIC_SOURCE_FORM_UNSUPPORTED") reject();',
    'if ("TSONIC_COMPILER_RESOURCE_LIMIT" === refusal.code) reject();',
    'const code = "TSONIC_COMPILER_RESOURCE_LIMIT"; const alias = code; if (refusal.code == alias) reject();',
    'switch (refusal.code) { case "TSONIC_SOURCE_FORM_UNSUPPORTED": reject(); }',
    'if (refusal.code === `TSONIC_SOURCE_FORM_UNSUPPORTED`) reject();',
  ]) assert.equal(findings(text, "src/analysis/native-operands.ts").some(row => row.rule === "native-source-code-comparison"), true);
  assert.deepEqual(findings(`
    function selected(source) {
      if (source.disposition === "left") return source.control;
      if (source.whenTrue.kind === "refused") return source.whenTrue;
      return source.whenTrue.value;
    }
    function forward(refusal) { return { code: refusal.code, category: "error", source: "tsonic",
      message: refusal.message, sourceNode: refusal.site }; }
    const example = "refusal.code === 'TSONIC_SOURCE_FORM_UNSUPPORTED'";
  `, "src/analysis/native-operands.ts"), []);
});
