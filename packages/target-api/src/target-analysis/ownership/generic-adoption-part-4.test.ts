import assert from "node:assert/strict";

import test from "node:test";

import { assertDeclaredAdoption, fixture } from "./generic-adoption-fixtures.js";

for (const form of ["uncalled", "nonresolver", "ignored-source-argument", "unused-native-input"] as const){
test("opaque native inputs do not taint unrelated resolving paths: " + form, () => {
    const payload = form === "nonresolver" ? "() => { void value; }" : "() => { resolve(value); }";
    const run = form === "uncalled" ? "void actual;"
      : form === "unused-native-input" ? "(() => {})();" : "actual();";
    const current = fixture(`
      declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
      function ignore(callback: () => void): () => void { void callback; return () => {}; }
      function wrap<Value>(value: Value): Promise<Value | number> {
        return new Promise<Value | number>(resolve => {
          const payload = ${payload};
          nativeInvoke([${form === "ignored-source-argument" ? "ignore(payload)" : "payload"}], actual => { ${run} });
          resolve(7);
        });
      }
      export function run(value: Promise<number>): void { void wrap(value); }
    `);
    const { source, nodes } = current;
    const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
    assert.equal(native !== undefined && source.ast.body(native) === undefined, true,
      "the original checked native declaration remains the selected contract, without a callback-execution hook");
    assertDeclaredAdoption(current, 1, "wrap(value)");
  });
}
