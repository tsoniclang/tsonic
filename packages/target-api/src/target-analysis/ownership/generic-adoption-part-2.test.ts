import assert from "node:assert/strict";
import test from "node:test";
import { nativePayloadContinuationCases, fixture } from './generic-adoption-fixtures.js';

for (const form of nativePayloadContinuationCases) for (const adopting of [false, true]) {
  for (const ordinary of [false, true]) for (const reversed of [false, true]) {
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
      const selected = current.query();
      assert.equal(selected.kind, adopting && !ordinary ? "unresolved" : "resolved",
        "possible helper invocations retain their demanded owner, not a source-global argument union");
      if (selected.kind === "resolved") assert.equal(selected.issues.length, 0,
        "ordinary identity or the actual observer/number inverse stays admitted");
      else assert.equal(current.textFor(selected.at), form.expression, "the relevant resolving helper demand owns uncertainty");
    });
  }
}

for (const form of ["uncalled", "nonresolver", "ignored-source-argument", "unused-native-input"] as const) {
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
    const selected = current.query();
    assert.equal(selected.kind, "resolved", "only relevant callable payloads may open resolver execution");
    if (selected.kind === "resolved") assert.equal(selected.issues.length, 0,
      "unused or proven nonresolving payloads do not create a generic adoption refusal");
  });
}
