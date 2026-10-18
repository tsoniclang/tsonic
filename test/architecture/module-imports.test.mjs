import assert from "node:assert/strict";
import test from "node:test";
import { buildTypeScriptModuleAnalysis } from "./tooling/module-graph.mjs";

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
