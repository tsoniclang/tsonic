import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceStorageDomainPublications } from "../../packages/target-api/dist/target-analysis/source-storage/graph/domain-publications.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { checkedSource, namedVariable, projectSourceFile } from "../fixtures/source-navigation.mjs";

async function fixture(body) {
  const checked = await checkedSource("publication-demands", {
    "globals.d.ts": `interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {} interface Number {}
interface String {} interface RegExp {} interface Array<Value> { [index: number]: Value; length: number; }
interface ReadonlyArray<Value> { readonly [index: number]: Value; readonly length: number; }`,
    "src/index.ts": `export {}; ${body}`,
  });
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
  const variable = name => namedVariable(source.ast, file, name);
  const subject = name => {
    const selected = storage.subjectFor(variable(name));
    assert.equal(selected.kind, "resolved", `checked subject ${name}`);
    return selected.subject;
  };
  return { source, file, storage, variable, subject,
    selection: name => storage.closedOriginsFor(subject(name)) };
}

test("unknown infinitely instantiated members need a real source demand", async () => {
  const current = await fixture(`
    interface Input<Value> { readonly value: Value; readonly next: Input<Input<Value>>; }
    declare const outside: Input<object>;
    export const exposed = outside;
    const original = {};
    const selected = original;
  `);
  const selected = current.selection("selected");
  assert.equal(selected.kind === "complete" && selected.origins.length === 1 &&
    selected.origins[0].subject.node === current.source.ast.as.AsVariableDeclaration(current.variable("original")).Initializer,
    true, "no type-only next path is manufactured and the actual allocation is retained");
  assert.equal(current.selection("outside").kind, "open", "the outside input remains outside");
  assert.equal(current.storage.failureReason(), undefined, "all original limits remain enabled");
});

for (const conditional of [false, true]) {
  test(`an actual ${conditional ? "conditional nested" : "direct"} store publishes its backing value`, async () => {
    const current = await fixture(`
      interface Cell { payload: { token: object }; }
      interface Input<Value> {
        readonly value: Value;
        readonly next: Input<Input<Value>>;
        readonly gated: Value extends Input<Input<Input<Input<Input<Input<object>>>>>> ? Cell : {};
      }
      declare function consume(input: ${conditional ? "Input<object>" : "Cell"}): void;
      const original = {};
      const backing = { token: original };
      export function leak(input: ${conditional ? "Input<object>" : "Cell"}): void {
        input.${conditional ? "next.next.next.next.next.next.gated." : ""}payload = backing;
        consume(input);
      }
      const selected = backing.token;
    `);
    const selected = current.selection("selected");
    assert.equal(selected.kind === "open" && selected.boundaries.some(boundary => boundary.kind === "opaque-write"),
      true, `the actual backing storage escapes through the ${conditional ? "ordered conditional" : "direct"} source path`);
    assert.equal(current.storage.failureReason(), undefined, "a finite authored path needs no depth or type-shape approximation");
  });
}

test("publication admission preserves union, intersection and nested argument correlations", async () => {
  const current = await fixture(`
    interface A { a: object; } interface B { b: object; }
    interface F<Left, Right> { readonly left: Left; readonly right: Right; }
    interface Box<Value> { readonly value: Value; }
    declare const union: Box<A | B>;
    declare const intersection: Box<A & B>;
    declare const crossed: Box<F<F<A, B>, F<B, A>>>;
    declare const aligned: Box<F<F<A, A>, F<B, B>>>;
  `);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const bindings = Object.freeze({});
  const publications = createSourceStorageDomainPublications(budget, bindings);
  const subject = current.subject("union");
  const types = ["union", "intersection", "crossed", "aligned"].map(name =>
    current.source.semantics.forFile(current.file).declarations.declaredValueType(current.variable(name)));
  assert.equal(types.every(type => type !== undefined) && new Set(types).size === 4, true, "four exact checked types");
  const exposure = current.variable("union");
  const receiver = Object.freeze({ subject, bindings, type: types[0] });
  for (const type of types) {
    publications.add(subject, type, current.file, exposure, true, "opaque-write", false, subject, receiver, bindings);
  }
  assert.equal(publications.size(), 4, "the same subject, receiver and exposure never erase exact distinct types");
  assert.equal(types.every((type, index) => publications.at(index).type === type), true, "argument ordering and operators stay exact");
  assert.equal(budget.failure(), undefined);
});

test("union and intersection views of one allocation retain each actual publication", async () => {
  const current = await fixture(`
    interface A { left: object; }
    interface B { right: object; }
    interface Box<Value> { readonly value: Value; }
    const left = {};
    const right = {};
    const backing = { left, right };
    const shared = { value: backing };
    export const union: Box<A | B> = shared;
    export const intersection: Box<A & B> = shared;
    const selectedLeft = backing.left;
    const selectedRight = backing.right;
  `);
  for (const name of ["selectedLeft", "selectedRight"]) {
    const selected = current.selection(name);
    assert.equal(selected.kind === "open", true, `${name}: the actual member remains exposed`);
    for (const exposure of ["union", "intersection"]) {
      assert.equal(selected.kind === "open" && selected.boundaries.some(boundary =>
        boundary.kind === "external-write" && boundary.exposure === current.variable(exposure)),
      true, `${name}: the ${exposure} view keeps its own exposure`);
    }
  }
  assert.equal(current.storage.failureReason(), undefined, "checked views do not need a type-summary approximation");
});

test("known recursive Link allocations retain every stored payload and separate private creation", async () => {
  const current = await fixture(`
    class Link {
      constructor(readonly payload: { token: object }, readonly next: Link | undefined) {}
    }
    const left = { token: {} };
    const right = { token: {} };
    const privateValue = { token: {} };
    export const published = new Link(left, new Link(right, undefined));
    const privateLink = new Link(privateValue, undefined);
    const first = left.token;
    const second = right.token;
    const separate = privateValue.token;
  `);
  for (const name of ["first", "second"]) {
    const selected = current.selection(name);
    assert.equal(selected.kind === "open" && selected.boundaries.some(boundary => boundary.kind === "external-write"),
      true, `${name}: every actual stored allocation is published, not folded by recursive type`);
  }
  assert.equal(current.selection("separate").kind, "complete", "an unrelated private allocation stays separate");
  assert.equal(current.storage.failureReason(), undefined);
});
