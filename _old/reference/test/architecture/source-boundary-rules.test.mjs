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
  for (const file of ["packages/host/src/host-input/reader.ts", "packages/source-core/src/host-input/reader.ts"]) assert.deepEqual(findings(text, file), []);
  for (const file of ["packages/target-api/src/host-input/reader.ts", "packages/target-api/src/source-semantics/host-input/reader.ts", "packages/source-core/src/reader.ts", "src/host-input/reader.ts"]) {
    assert.equal(findings(text, file).some(row => row.rule === "checker-type-or-query-import"), true, file);
  }
});

test("module-owned WeakMap/WeakSet and mutated Map/Set caches cannot hold per-program Source identities", () => {
  for (const text of ["const cache = new WeakMap();", "export const identities = new WeakSet();",
    "const cache = new WeakMap<object, number>();", "export const identities = new WeakSet<object>();",
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
    const labels = new Map([["kind", "value"]]);
    export function createView() { const cache = new WeakMap(); return { retain(node) { cache.set(node, 1); } }; }
    function unrelated() { const labels = new Map(); labels.set("local", 1); }
    class View { cache = new WeakMap(); retain(node) { this.cache.set(node, 1); } }
    class PrivateView { #cache = new WeakSet<object>(); retain(node) { this.#cache.add(node); } }
    class Metadata { static labels = new Map([["kind", "value"]]); }
    export function createClassView() {
      return class View { static cache = new WeakMap(); static retain(node) { this.cache.set(node, 1); } };
    }
  `), []);
});

test("Native forwarding preserves one original refusal code, message and site without a new Source code", () => {
  assert.deepEqual(findings(`function forward(refusal) { return { code: refusal.code, category: "error", source: "tsonic",
    message: refusal.message, sourceNode: refusal.site }; }`, "src/analysis/program/source-facts.ts"), []);
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
