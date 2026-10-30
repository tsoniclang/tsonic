import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { namedDeclaration, namedVariable } from "../fixtures/source-navigation.mjs";
import { fixture } from "./source-storage-recursive-projections-fixtures.mjs";

for (const exported of [false, true]){
for (const access of ["value.value", 'value["value"]']){
for (const reverse of [false, true]){
test(`recursive data projection retains separate tree entries (${exported ? "exported" : "private"}, ${access}, ${reverse})`, () => {
    const current = fixture(`
      class Value {}
      class Leaf extends Value { constructor(readonly token: object) { super(); } }
      class Branch extends Value { constructor(readonly value: Value[]) { super(); } }
      const fallback = {}; const left = {}; const right = {};
      ${exported ? "export " : ""}function descend(value: Value): object {
        if (value instanceof Branch) return descend(${access}[0]);
        if (value instanceof Leaf) return value.token;
        return fallback;
      }
      const first = descend(new Branch([new Branch([new Leaf(left)])]));
      const second = descend(new Branch([new Branch([new Leaf(right)])]));
    `);
    const selections = [["first", "left"], ["second", "right"]];
    for (const [name, original] of reverse ? selections.reverse() : selections) current.expect(name, [original, "fallback"]);
  });
}
}
}

test("recursive structural record projections retain their exact fields without a class requirement", () => {
  const current = fixture(`
    declare const stop: boolean;
    interface Tree { readonly token: object; readonly children: readonly Tree[]; }
    function descend(tree: Tree): object {
      if (stop) return tree.token;
      return descend(tree.children[0]);
    }
    const left = {}; const right = {};
    const first = descend({ token: left, children: [{ token: left, children: [] }] });
    const second = descend({ token: right, children: [{ token: right, children: [] }] });
  `);
  current.expect("first", ["left"]);
  current.expect("second", ["right"]);
});

for (const readonly of [true, false]){
test(`recursive optional ${readonly ? "readonly" : "writable"} collection publications remain finite and preserve input boundaries`, () => {
    const current = fixture(`
      type Tree = number | ${readonly ? "readonly " : ""}Tree[] | null | undefined;
      export function inspect(tree: Tree): Tree { return tree; }
      const original = {}; const result = original;
    `);
    current.expect("result", ["original"]);
    let parameter;
    current.source.ast.forEachChild(current.file, node => {
      if (current.source.ast.is.IsFunctionDeclaration(node)) parameter = current.source.ast.parameters(node)[0];
    });
    const input = current.storage.subjectFor(parameter);
    assert.equal(input.kind === "resolved", true, "the recursive external formal is retained");
    const origins = current.storage.closedOriginsFor(input.subject);
    assert.equal(origins.kind === "open" && origins.boundaries.some(boundary => boundary.kind === "external-input"),
      true, "finite folding never certifies an external recursive input as closed");
    assert.equal(current.storage.failureReason() === undefined, true, "finite projection and work budgets remain enabled");
  });
}

test("an unrelated private query does not unfold an exported recursive field publication indefinitely", () => {
  const current = fixture(`
    class Value {}
    class Leaf extends Value { constructor(readonly value: { token: object }) { super(); } }
    class Branch extends Value { constructor(readonly value: Value[]) { super(); } }
    declare function expose(value: { token: object }): void;
    export function descend(value: Value): Value {
      if (value instanceof Branch) return descend(value.value[0]);
      return value;
    }
    export function render(value: Value): void {
      const selected = descend(value);
      if (selected instanceof Leaf) expose(selected.value);
    }
    const original = {}; const result = original;
  `);
  current.expect("result", ["original"]);
});

for (const call of ["first.read(left)", 'first["read"](left)', "identity(first.read)(left)"]){
test(`a projection nested in ${call} preserves the whole recursive callback and argument tuple`, () => {
    const current = fixture(`
      declare const stop: boolean;
      function identity<Value>(value: Value): Value { return value; }
      interface Pair { left: object; right: object; }
      interface Reader { read: (pair: Pair) => object; }
      function rotate(first: Reader, second: Reader, left: Pair, right: Pair): object {
        if (stop) return ${call};
        return rotate(second, first, right, left);
      }
      const leftReader: Reader = { read: pair => pair.left };
      const rightReader: Reader = { read: pair => pair.right };
      const original = {}; const forbidden = {}; const separate = {};
      const first = rotate(leftReader, rightReader,
        { left: original, right: forbidden }, { left: forbidden, right: original });
      const second = rotate(leftReader, rightReader,
        { left: separate, right: forbidden }, { left: forbidden, right: separate });
    `);
    current.expect("first", ["original"]);
    current.expect("second", ["separate"]);
  });
}
