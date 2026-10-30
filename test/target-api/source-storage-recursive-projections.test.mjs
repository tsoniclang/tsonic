import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { namedDeclaration, namedVariable } from "../fixtures/source-navigation.mjs";
import { fixture } from "./source-storage-recursive-projections.split-fixtures.mjs";

for (const openFirst of [false, true]){
test(`boundary frontiers retain activation and query-order independence (${openFirst ? "open first" : "closed first"})`, () => {
    const current = fixture(`
      declare const external: object[];
      function first(values: object[]): object { return values[0]; }
      const original = {};
      const known = first([original]);
      const unknown = first(external);
    `);
    const checkOpen = () => {
      const selected = current.query("unknown");
      assert.equal(selected.kind === "open", true, "the exact outside activation remains open");
      assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-input"), true,
        "the contributing outside component retains its boundary");
      assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("original")), false,
        "the separate closed activation does not become an outside producer");
    };
    if (openFirst) checkOpen();
    current.expect("known", ["original"]);
    checkOpen();
    current.expect("known", ["original"]);
  });
}

for (const openFirst of [false, true]){
test(`bounded recursive boundary walks never poison exact closed invocation results (${openFirst})`, () => {
    const current = fixture(`
      interface Tree { readonly token: object; readonly children: readonly Tree[]; }
      declare const outside: Tree;
      function first(tree: Tree): object { return tree.children[0] ? first(tree.children[0]) : tree.token; }
      const token = {}; const result = first({ token, children: [] });
      const external = first(outside);
    `);
    const inspect = () => {
      const selected = current.query("external");
      assert.equal(selected.kind === "open", true, "an unbound recursive input retains its actual frontier");
      assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-input"), true,
        "the bounded walk publishes external input, not a fabricated recursive producer");
    };
    if (openFirst) inspect();
    current.expect("result", ["token"]);
    inspect();
    current.expect("result", ["token"]);
  });
}

test("an unproved inspection retains its exact opaque operand even when the object's checked view has no members", () => {
  const current = fixture(`
    declare function inspect(value: object): boolean;
    const token = {};
    const original = { token };
    const alias = original;
    const observed = inspect(alias);
    const selected = alias.token;
  `);
  const identity = current.query("alias");
  assert.equal(identity.kind === "complete", true,
    "a by-value opaque operation cannot replace the original container identity");
  assert.equal(identity.origins.length === 1 && identity.origins[0].subject.node === current.initializer("original"), true,
    "the exact original allocation survives the memberless public view");
  const selected = current.query("selected");
  assert.equal(selected.kind === "open", true,
    "an empty public view cannot certify preservation of the original contained storage");
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-write" &&
    current.source.ast.is.IsCallExpression(boundary.exposure)), true,
    "the real checked invocation owns the opacity witness");
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("token")), true,
    "opacity does not erase the independently known original contained value");
  assert.equal(current.storage.failureReason() === undefined, true, "no synthetic effect or new resource ceiling is required");
});

test("an escaping private callable retains future opaque inputs independently of its observed empty-object call", () => {
  const current = fixture(`
    declare function nativeFreeze<T>(value: T): Readonly<T>;
    function freeze(value: object): object { return nativeFreeze(value); }
    export function retained(): (value: object) => object { freeze({}); return freeze; }
  `);
  const declaration = namedDeclaration(current.source.ast, current.file, "nativeFreeze");
  const owner = namedDeclaration(current.source.ast, current.file, "freeze");
  const parameter = current.source.ast.parameters(owner)[0];
  const storage = createSourceStorageQuery(current.source, [current.file], undefined, {
    call(node, selected) {
      const semantics = current.source.semantics.forNode(node);
      return semantics.declarations.signatureDeclaration(selected.selectedSignature) === declaration
        ? { resultAlias: selected.sourceArguments[0].expression } : undefined;
    },
  });
  const subject = storage.subjectFor(parameter);
  const bindings = storage.bindingsForDeclaration(owner);
  assert.equal(subject.kind === "resolved" && bindings.kind === "resolved", true, "the actual escaping callable owns its declaration entry");
  const selected = storage.closedOriginsFor(subject.subject, bindings.bindings);
  assert.equal(selected.kind === "open", true, "one observed local call does not close future callers of the returned function");
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-input"), true,
    "the retained declaration entry supplies its exact external-input witness");
  assert.equal(storage.failureReason() === undefined, true, "the shared source owner retains the original finite guards");
});

test("a returned generic fixed method preserves its captured value without inventing a replaceable method slot", () => {
  const current = fixture(`
    export function hold<T>(value: T): { read(): T } { return { read() { return value; } }; }
    const original = {}; const separate = {};
    const first = hold(original); const second = hold(separate);
    const selected = first.read(); const other = second.read();
  `);
  current.expect("selected", ["original"]);
  current.expect("other", ["separate"]);
});

test("a writable returned function property remains externally replaceable", () => {
  const current = fixture(`
    const original = {};
    export const retained: { read: () => object } = { read: () => original };
    const selected = retained.read;
  `);
  const selected = current.query("selected");
  assert.equal(selected.kind === "open", true, "a function-valued data property is not a fixed native method");
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-write"), true,
    "the real writable slot retains its outside writer");
  assert.equal(current.storage.failureReason() === undefined, true, "fixed-method handling does not discharge writable-property evidence");
});

test("generic nested array calls retain finite checked types and exact scoped origins", () => {
  const current = fixture(`
    function first<T>(values: T[], fallback: T): T { return values.length === 0 ? fallback : values[0]!; }
    function nested<T>(values: T[][], fallback: T): T { return first(first(values, []), fallback); }
    const left = {}; const right = {};
    const one = nested([[left]], left);
    const two = nested([[right]], right);
  `);
  for (const [name, original] of [["one", "left"], ["two", "right"]]) {
    const selected = current.storage.subjectFor(current.initializer(name));
    assert.equal(selected.kind === "resolved", true, "exact checked result subject");
    assert.equal(current.storage.typeFor(selected.subject).kind === "resolved", true,
      "a checked generic component does not flatten unrelated invocation substitutions");
    current.expect(name, [original]);
  }
});

for (const access of ["this.values", 'this["values"]']){
for (const tuple of [false, true]){
test(`projected ${tuple ? "tuple" : "array"} stores retain writer activation and physical receiver for ${access}`, () => {
    const current = fixture(`
      function identity<Value>(value: Value): Value { return value; }
      class Box {
        values: ${tuple ? "[object]" : "object[]"};
        constructor(value: object) { this.values = [value]; }
        replace(value: object): void { ${access} = [identity(value)]; }
        read(): object { return ${access}[0]!; }
      }
      const initial = {}; const replacement = {}; const otherInitial = {}; const otherReplacement = {};
      const first = new Box(initial); const second = new Box(otherInitial);
      first.replace(replacement); second.replace(otherReplacement);
      const one = first.read(); const two = second.read();
    `);
    current.expect("one", ["initial", "replacement"]);
    current.expect("two", ["otherInitial", "otherReplacement"]);
  });
}
}

test("projected closure-owned stores do not execute uninvoked writers or mix captured activations", () => {
  const current = fixture(`
    function make(seed: object) {
      const values: object[][] = [[seed]];
      return {
        replace(value: object): void { values[0] = [value]; },
        read(): object { return values[0]![0]!; },
      };
    }
    const initial = {}; const replacement = {}; const other = {}; const unused = {};
    const first = make(initial); const second = make(other);
    first.replace(replacement);
    function never(): void { second.replace(unused); }
    const one = first.read(); const two = second.read();
  `);
  current.expect("one", ["initial", "replacement"]);
  current.expect("two", ["other"]);
});

test("abstract local queries retain writes in their own entry region without inventing a caller", () => {
  const current = fixture(`
    const initial = {}; const replacement = {};
    export function choose(flag: boolean): object {
      let value: object = initial;
      if (flag) value = replacement;
      const selected = value;
      return selected;
    }
  `);
  current.expect("selected", ["initial", "replacement"]);
});

test("implicit construction retains initializer receivers inside an uninvoked exported entry", () => {
  const current = fixture(`
    const token = {};
    export class Box { readonly value: object = token; }
    export function inspect(): object {
      const box = new Box();
      const selected = box.value;
      return selected;
    }
  `);
  current.expect("selected", ["token"]);
});

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
