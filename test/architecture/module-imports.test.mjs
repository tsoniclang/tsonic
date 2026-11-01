import assert from "node:assert/strict";
import test from "node:test";
import { buildTypeScriptModuleAnalysis } from "./tooling/module-graph.mjs";
import { evaluateFunctionLiveness } from "./tooling/architecture-rules.mjs";

test("module import inventory separates actual JavaScript imports from fixture strings", () => {
  const source = new Map([
    ["main.mjs", `
      import "./side-effect.mjs";
      import { value } from "./value.mjs";
      export { value };
      export { other } from "./missing.mjs";
      const fixture = \`import { backing } from "./fixture-only.js";\`;
      const typeFixture = \`type Hidden = typeof import("./type-fixture-only.js");\`;
      void import("./dynamic.mjs");
      void import(\`./template.mjs\`);
      void import(("./wrapped-string.mjs"));
      void import(((\`./wrapped-template.mjs\`)));
    `],
    ["side-effect.mjs", "export {};"],
    ["value.mjs", "export const value = 1;"],
    ["dynamic.mjs", "export const value = 2;"],
    ["template.mjs", "export const value = 3;"],
    ["wrapped-string.mjs", "export const value = 4;"],
    ["wrapped-template.mjs", "export const value = 5;"],
    ["type-use.ts", 'export type Imported = typeof import("./typed-value.js");'],
    ["typed-value.ts", "export const value = 6;"],
    ["wrapped-types.ts", `
      void import("./asserted.mjs" as const);
      void import("./assertion.mjs" satisfies string);
      void import("./non-null.mjs"!);
      void import(<const>"./satisfies.mjs");
    `],
    ["asserted.mjs", "export const value = 7;"],
    ["assertion.mjs", "export const value = 8;"],
    ["non-null.mjs", "export const value = 9;"],
    ["satisfies.mjs", "export const value = 10;"],
  ]);
  const result = buildTypeScriptModuleAnalysis(source);
  assert.equal(result.modules.length, source.size);
  assert.deepEqual(result.edges.map(edge => [edge.specifier, edge.unresolved]), [
    ["./dynamic.mjs", false],
    ["./missing.mjs", true],
    ["./side-effect.mjs", false],
    ["./template.mjs", false],
    ["./value.mjs", false],
    ["./wrapped-string.mjs", false],
    ["./wrapped-template.mjs", false],
    ["./typed-value.js", false],
    ["./asserted.mjs", false],
    ["./assertion.mjs", false],
    ["./non-null.mjs", false],
    ["./satisfies.mjs", false],
  ]);
});

test("function liveness follows checked public re-exports, local calls and actual test readers, not registry strings", () => {
  const files = new Map([
    ["public.ts", 'export { exposed } from "./barrel.js";'],
    ["barrel.ts", 'export { publicFunction as exposed } from "./functions.js";'],
    ["functions.ts", `
      export function publicFunction() { return 1; }
      export function localHelper() { return 2; }
      export function testSeam() { return 3; }
      export function registryOnly() { return 4; }
      export function recursiveOnly() { return recursiveOnly(); }
      export const unusedArrow = () => 5;
      const result = localHelper();
      const registry = ["functions.ts#registryOnly"];
    `],
    ["actual.test.mjs", 'import { testSeam as chosen } from "./functions.js"; chosen();'],
  ]);
  const result = buildTypeScriptModuleAnalysis(files);
  assert.deepEqual(evaluateFunctionLiveness({ modules: result.modules, entrypoints: ["public.ts"] })
    .map(finding => finding.target), ["functions.ts#recursiveOnly", "functions.ts#registryOnly", "functions.ts#unusedArrow"]);
  const source = result.modules.find(module => module.file === "functions.ts");
  assert.equal(Object.isFrozen(source.functionExports) && Object.isFrozen(source.functionReads), true);
  assert.throws(() => evaluateFunctionLiveness({ modules: [{ file: "missing.ts" }], entrypoints: [] }),
    /requires its checked function-use inventory/u);
});

test("module runtime inventory projects the canonical static import/export fact", () => {
  const source = new Map([
    ["main.ts", `
      import type { Shape } from "./types.js";
      import { type Other } from "./other.js";
      export type { Shape } from "./types.js";
      export { type Other } from "./other.js";
      import { value } from "./value.js";
      export { value } from "./value.js";
      void import("./dynamic.js");
      type Imported = typeof import("./typed.js");
    `],
    ["types.ts", "export interface Shape {}"], ["other.ts", "export interface Other {}"],
    ["value.ts", "export const value = 1;"], ["dynamic.ts", "export const dynamic = 2;"],
    ["typed.ts", "export const typed = 3;"],
  ]);
  const result = buildTypeScriptModuleAnalysis(source);
  const main = result.modules.find(module => module.file === "main.ts");
  assert.deepEqual(main.runtimeSpecifiers, ["./value.js", "./value.js", "./dynamic.js"]);
  assert.equal(Object.isFrozen(main) && Object.isFrozen(main.runtimeSpecifiers), true,
    "the canonical runtime projection is immutable, not another mutable classification cache");
  assert.equal(result.edges.filter(edge => edge.source === "main.ts").length, 8,
    "all type/value/import-type/dynamic edges remain available for architecture and reachability");
});
