import assert from "node:assert/strict";

import test from "node:test";

import { assertDeclaredAdoption, nativePayloadContinuationCases, fixture } from "./generic-adoption-fixtures.js";

for (const form of nativePayloadContinuationCases){
for (const adopting of [false, true]){
for (const ordinary of [false, true]){
for (const reversed of [false, true]){
test("native payload demand-owner continuation keeps exact " + form.name + "/" + adopting + "/" + ordinary + "/" + reversed, () => {
      const expose = form.name === "native-forwarded-helper"
        ? "nativeInvoke([payload], next => { nativeAgain(next); });"
        : "nativeInvoke([payload], next => { next(); });";
      const separate = adopting ? form.adopter : form.ordinary;
      const creation = adopting ? "make(resolve, value)" : "make((actual: Value): void => { void actual; }, value)";
      const current = fixture(`
        declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
        declare function nativeAgain(callback: () => void): void;
        ${form.declarations}
        function wrap<Value>(value: Value): Promise<Value | number> {
          return new Promise<Value | number>(resolve => {
            const payload = ${creation};
            ${reversed ? separate + expose : expose + separate}
          });
        }
        export function run(value: ${ordinary ? "number" : "Promise<number>"}): void { void wrap(value); }
      `);
      const { source, nodes } = current;
      const invoke = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
      const again = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeAgain");
      assert.equal(invoke !== undefined && source.ast.body(invoke) === undefined &&
        again !== undefined && source.ast.body(again) === undefined, true,
        "the original checked native declaration remains the selected contract, without a callback-execution hook");
      assertDeclaredAdoption(current, ordinary ? 0 : 1, "wrap(value)");
    });
}
}
}
}
