import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "../../packages/tsts/dist/src/index.js";
import { analyzeCheckedTypeScriptModules, buildTypeScriptModuleAnalysis, buildTypeScriptModuleGraph, resolveRelativeModule } from "./tooling/module-graph.mjs";
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
      const dynamicName = "./fixture-only.js";
      void import(dynamicName);
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
      export function capturedShorthand() { return 6; }
      const result = localHelper();
      const registry = ["functions.ts#registryOnly"];
    `],
    ["context.ts", 'import { capturedShorthand } from "./functions.js"; const context = { capturedShorthand }; context.capturedShorthand();'],
    ["actual.test.mjs", 'import { testSeam as chosen } from "./functions.js"; chosen(); export function readerOnly() { return 7; }'],
  ]);
  const result = buildTypeScriptModuleAnalysis(files);
  const modules = result.modules.filter(module => module.file !== "actual.test.mjs");
  const readers = result.modules.filter(module => module.file === "actual.test.mjs");
  assert.deepEqual(evaluateFunctionLiveness({ modules, readers, entrypoints: ["public.ts"] })
    .map(finding => finding.target), ["functions.ts#recursiveOnly", "functions.ts#registryOnly", "functions.ts#unusedArrow"]);
  const source = result.modules.find(module => module.file === "functions.ts");
  assert.equal(Object.isFrozen(source.functionExports) && Object.isFrozen(source.functionReads), true);
  assert.equal(result.modules.find(module => module.file === "context.ts").functionReads.includes("functions.ts#capturedShorthand"), true);
  assert.throws(() => evaluateFunctionLiveness({ modules: [{ file: "missing.ts" }], readers: [], entrypoints: [] }),
    /requires its checked function-use inventory/u);
  assert.throws(() => evaluateFunctionLiveness({ modules, entrypoints: ["public.ts"] }),
    /requires its checked reader-module inventory/u);
});

test("function liveness resolves actual test imports through the declared source/output roots", () => {
  const files = new Map([
    ["src/index.ts", 'export { publicFunction } from "./functions.js";'],
    ["src/functions.ts", "export function publicFunction() { return 1; } export function testSeam() { return 2; } export function unused() { return 3; }"],
    ["test/actual.test.mjs", 'import { testSeam } from "../dist/functions.js"; testSeam();'],
  ]);
  const resolutionRoots = ["src", "dist"];
  const source = createCompilerSessionFromFiles({
    currentDirectory: "/architecture",
    files: new Map([...files].map(([file, text]) => [`/architecture/${file}`, text])),
    rootFiles: [...files.keys()],
    compilerOptions: {
      allowJs: true, module: "esnext", moduleResolution: "bundler", noLib: true,
      noResolve: true, skipLibCheck: true, target: "esnext",
      rootDirs: resolutionRoots.map(root => `/architecture/${root}`),
    },
  }).checkSource();
  const result = analyzeCheckedTypeScriptModules(source, files, "/architecture/", resolutionRoots);
  const modules = result.modules.filter(module => module.file.startsWith("src/"));
  const readers = result.modules.filter(module => module.file.startsWith("test/"));
  assert.equal(readers[0].functionReads.includes("src/functions.ts#testSeam"), true);
  assert.equal(result.edges.find(edge => edge.source === "test/actual.test.mjs").target, "src/functions.ts");
  assert.deepEqual(evaluateFunctionLiveness({ modules, readers, entrypoints: ["src/index.ts"] })
    .map(finding => finding.target), ["src/functions.ts#unused"]);
  assert.equal(Object.isFrozen(result.modules) && Object.isFrozen(readers[0].functionReads), true);
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

test("the architecture graph owns all empty, namespace, default and mixed import/export runtime forms", () => {
  const files = new Map([["main.ts", `
    import "./side.js";
    import {} from "./empty.js";
    import type Default from "./type-default.js";
    import Default, { type Shape } from "./default.js";
    import * as Namespace from "./namespace.js";
    import type * as Types from "./type-namespace.js";
    import { type Shape, value } from "./mixed.js";
    export {} from "./empty-export.js";
    export * from "./star.js";
    export * as Named from "./named-star.js";
    export type * from "./type-star.js";
    export { type Shape, value } from "./mixed-export.js";
    export { type Shape } from "./only-type.js";
  `]]);
  const result = buildTypeScriptModuleAnalysis(files);
  assert.equal(result.modules.length, 1);
  assert.equal(result.edges.length, 13);
  assert.deepEqual(result.modules[0].runtimeSpecifiers, ["./side.js", "./empty.js", "./default.js", "./namespace.js",
    "./mixed.js", "./empty-export.js", "./star.js", "./named-star.js", "./mixed-export.js"]);
});

test("relative module resolution preserves unique declarations, ambiguity and explicit source/output roots", () => {
  const files = new Map([["src/model/contract.d.ts", "export interface Value {}"], ["src/data/index.ts", "export {};"]]);
  const declaration = resolveRelativeModule("src/main.ts", "./model/contract.js", files, []);
  assert.equal(declaration.target, "src/model/contract.d.ts");
  assert.equal(Object.isFrozen(declaration) && Object.isFrozen(declaration.candidates), true);
  assert.equal(resolveRelativeModule("src/main.ts", "./data", files, []).target, "src/data/index.ts");
  assert.equal(resolveRelativeModule("test/main.ts", "../dist/model/contract.js", files, ["src", "dist"]).target, "src/model/contract.d.ts");
  const ambiguous = resolveRelativeModule("src/main.ts", "./same.js", new Map([["src/same.ts", ""], ["src/same.mts", ""]]), []);
  assert.equal(ambiguous.target === undefined && ambiguous.ambiguous, true);
  assert.equal(resolveRelativeModule("src/main.ts", "./missing.js", files, []).target === undefined, true);
  assert.throws(() => analyzeCheckedTypeScriptModules({}, files, "/architecture/", [""]), /explicit source\/output/u);
  assert.throws(() => analyzeCheckedTypeScriptModules({}, files, "/architecture/", undefined), /explicit source\/output/u);
  assert.equal(resolveRelativeModule("src/main.ts", "./data/index.ts", files, []).target, "src/data/index.ts");
  assert.equal(resolveRelativeModule("src/main.ts", "./model/contract.cjs", files, []).target, "src/model/contract.d.ts");
  assert.deepEqual(buildTypeScriptModuleGraph(new Map([["main.ts", 'import "./missing.js";']])),
    buildTypeScriptModuleAnalysis(new Map([["main.ts", 'import "./missing.js";']])).edges);
});

test("checked graph ownership ignores genuinely checked files outside the selected root or source inventory", () => {
  const source = createCompilerSessionFromFiles({ currentDirectory: "/architecture", files: new Map([
    ["/architecture/main.ts", 'export function value() { return 1; } export { outside } from "/foreign/outside.js";'],
    ["/foreign/outside.ts", "export function outside() { return 2; }"],
    ["/architecture/unselected.ts", "export function unselected() { return 3; }"],
  ]), rootFiles: ["/architecture/main.ts", "/foreign/outside.ts", "/architecture/unselected.ts"],
  compilerOptions: { noLib: true, noResolve: true, module: "esnext", target: "esnext" } }).checkSource();
  const result = analyzeCheckedTypeScriptModules(source, new Map([["main.ts", 'export function value() { return 1; } export { outside } from "/foreign/outside.js";']]), "/architecture/", []);
  assert.deepEqual(result.modules.map(module => module.file), ["main.ts"]);
  assert.deepEqual(result.modules[0].functionExports, ["main.ts#value"]);
  assert.deepEqual(result.edges.map(edge => edge.specifier), ["/foreign/outside.js"]);
});
