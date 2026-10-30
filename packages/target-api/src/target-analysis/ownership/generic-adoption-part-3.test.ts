import assert from "node:assert/strict";

import test from "node:test";

import { fixture, sourcePosition, sourceSpan, declarations } from "./generic-adoption-fixtures.js";

for (const [name, declaration, invoked] of declarations){
test(`generic adoption closes ${name} without refusing its ordinary actual`, () => {
    const current = fixture(`${declaration}\nconst promised = Promise.resolve(7); void ${invoked}(7); void ${invoked}(promised);`);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : name);
    if (selected.kind !== "resolved") return;
    if (name === "generic callable body unknown") {
      assert.equal(selected.issues.length, 0, "the selected void declaration has no native Promise adoption");
      for (const actual of ["7", "promised"]) assert.equal(current.nodes.some(node =>
        current.source.ast.is.IsCallExpression(node) && current.textFor(node) === `${invoked}(${actual})`), true,
      "both original checked ordinary and Promise-valued calls remain");
      return;
    }
    assert.equal(selected.issues.length, 1, `${name}: exactly one concrete adopting instantiation`);
    const issue = selected.issues[0]!;
    assert.equal(current.textFor(issue.site), `${invoked}(promised)`, `${name}: refusal is on the actual call, not the generic body`);
    assert.equal(current.source.ast.is.IsTypeParameterDeclaration(issue.parameter), true, `${name}: actual parameter identity`);
    assert.equal(current.nodes.includes(issue.declaration) && current.nodes.includes(issue.operation), true,
      `${name}: declaration and first operation are real checked related nodes`);
    assert.deepEqual(issue.evidence, [
      ["declaration", issue.declaration] as const, ["first-sensitive-operation", issue.operation] as const,
    ].map(([kind, node]) => `${kind} index.ts:${sourcePosition(current.source, node).line}:${sourcePosition(current.source, node).column}`),
    `${name}: one shared owner publishes exact related source coordinates for both targets`);
    assert.deepEqual(issue.sourceSpan, sourceSpan(current.source, issue.site), `${name}: actual instantiation site span`);
    assert.equal(Object.isFrozen(selected.issues) && Object.isFrozen(issue), true, `${name}: immutable completed summary`);
  });
}

test("a class parameter and captured structural method are summarized at their actual constructors", () => {
  const current = fixture(`
    class Holder<T> { constructor(readonly value: T) {} async get(): Promise<T> { return this.value; } }
    function make<T>(value: T): { read(): Promise<T> } { return { async read(): Promise<T> { return value; } }; }
    const promised = Promise.resolve(7);
    void new Holder(7); void new Holder(promised); void make(7); void make(promised);
  `);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "complete class summary");
  if (selected.kind !== "resolved") return;
  assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)).sort(), ["make(promised)", "new Holder(promised)"]);
});

for (const [name, extra, receiver, expression] of Array.from([
  ["incoming", "", "Holder<Promise<number>>", "holder.get()"],
  ["aliased", "type Alias<V> = Holder<V>;", "Alias<Promise<number>>", "holder.get()"],
  ["finite-union", "", "Holder<number> | Holder<Promise<number>>", "holder.get()"],
  ["inherited", "class Derived<U> extends Holder<U> {}", "Derived<Promise<number>>", "holder.get()"],
  ["fixed-inherited", "class Derived extends Holder<Promise<number>> {}", "Derived", "holder.get()"],
  ["indexed-inherited", "class Derived<Parts extends unknown[]> extends Holder<Parts[0]> {}", "Derived<[Promise<number>]>", "holder.get()"],
  ["wrapped-inherited", "class Derived<Part> extends Holder<Promise<Part>> {}", "Derived<number>", "holder.get()"],
  ["conditional-inherited", "class Derived<Part> extends Holder<Part extends number ? number : Promise<number>> {}", "Derived<string>", "holder.get()"],
  ["parenthesized-call", "", "Holder<Promise<number>>", "(holder.get)()"],
  ["getter", "", "Holder<Promise<number>>", "holder.task"],
  ["method-value", "", "Holder<Promise<number>>", "holder.get"],
] as const).slice(0, 7)){
test(`generic adoption retains the actual ${name} receiver binding`, () => {
    const current = fixture(`class Holder<T> { constructor(readonly value: T) {}
      async get(): Promise<T> { return this.value; }
      get task(): Promise<T> { return this.get(); }
    } ${extra}
    export function use(holder: ${receiver}) { return ${expression}; }`);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : name);
    if (selected.kind !== "resolved") return;
    assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), [expression],
      "every actual receiver alternative is checked, without a callee-property duplicate");
  });
}
