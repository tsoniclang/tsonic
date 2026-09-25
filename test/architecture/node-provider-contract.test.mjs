import assert from "node:assert/strict";
import test from "node:test";
import { evaluateNodeProviderContract } from "./tooling/node-provider-contract.mjs";

for (const target of ["Csharp", "Rust"]) {
  const options = {
    targetPackage: `@tsonic/target-${target.toLowerCase()}`,
    factoryName: `create${target}ProviderPackage`,
  };
  const valid = new Map([
    ["nodejs/src/index.ts", 'import { createNodePackage } from "./provider/package.js";'],
    ["nodejs/src/provider/package.ts", `export function createNodePackage() { return ${options.factoryName}(definition); }`],
    ["nodejs/src/provider/modules/http/declarations.ts", 'export const moduleSpecifier = "node:http";'],
    ["nodejs/src/provider/model/types.ts", "export interface Types {}"],
  ]);
  test(`${target} Node uses the shared provider ownership contract`, () => {
    assert.deepEqual(evaluateNodeProviderContract(valid, options), []);
  });
  for (const [name, file, source, expected] of [
    ["transport", "modules/local.ts", "registerSourceDeclarationProvider(provider);", "transport"],
    ["model recovery", "modules/local.ts", "function getDeclarationModel() {}", "transport"],
    ["rebasing", "modules/local.ts", "function rebaseProviderType(type) {}", "transport"],
    ["unowned root", "extension.ts", "export const extension = {};", "owner"],
    ["second factory", "modules/local.ts", `${options.factoryName}(definition);`, "factory"],
    ["unresolved import", "modules/local.ts", 'import { missing } from "./missing.js";', "unresolved"],
    ["private SDK", "modules/local.ts", `import {} from "${options.targetPackage}/dist/private.js";`, "public provider SDK"],
    ["fragmented family", "modules/http.ts", "export const module = {};", "nested"],
    ["model impurity", "model/types.ts", 'import {} from "../modules/http/declarations.js";', "immutable model"],
    ["package cycle", "modules/local.ts", 'import {} from "../package.js";', "package assembly"],
    ["implementation barrel", "modules/http/index.ts", "export function build() {}", "ARCH-INDEX"],
    ["vague helper", "modules/http/helpers.ts", "export const value = 1;", "helper"],
    ["oversized owner", "modules/large.ts", "\n".repeat(601), "600 lines"],
  ]) {
    test(`${target} Node rejects ${name}`, () => {
      const mutated = new Map(valid);
      mutated.set(`nodejs/src/provider/${file}`, source);
      const findings = evaluateNodeProviderContract(mutated, options);
      assert.ok(findings.some(finding => finding.includes(expected)), findings.join("\n"));
    });
  }
}
