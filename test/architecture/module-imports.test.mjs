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
      void import("./dynamic.mjs");
    `],
    ["side-effect.mjs", "export {};"],
    ["value.mjs", "export const value = 1;"],
    ["dynamic.mjs", "export const value = 2;"],
  ]);
  const result = buildTypeScriptModuleAnalysis(source);
  assert.equal(result.modules.length, source.size);
  assert.deepEqual(result.edges.map(edge => [edge.specifier, edge.unresolved]), [
    ["./dynamic.mjs", false],
    ["./missing.mjs", true],
    ["./side-effect.mjs", false],
    ["./value.mjs", false],
  ]);
});
