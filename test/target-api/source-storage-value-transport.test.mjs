import assert from "node:assert/strict";
import test from "node:test";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { checkedSource, namedVariable, projectSourceFile } from "../fixtures/source-navigation.mjs";

async function fixture(name, text = `
    const original = () => 3;
    const first: (left: number) => number = original;
    const second: (left: number, right: number) => number = first;
  `) {
  const checked = await checkedSource(name, { "globals.d.ts": `
    interface Object {} interface Function {} interface CallableFunction extends Function {}
    interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
    interface Number {} interface String {} interface RegExp {}
    interface Array<T> { [index: number]: T; length: number; }
    interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
  `, "src/index.ts": `export {}; ${text}` });
  assert.equal(checked.diagnostics.length, 0);
  assert.equal(checked.extensionDiagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const { ast } = source;
  const nodes = [];
  const visit = node => { nodes.push(node); ast.forEachChild(node, child => { if (child !== undefined) visit(child); }); };
  visit(file);
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
  const variable = name => namedVariable(ast, file, name);
  const initializer = declaration => ast.as.AsVariableDeclaration(declaration).Initializer;
  const subject = node => {
    const selected = storage.subjectFor(node);
    assert.equal(selected.kind, "resolved");
    return selected.subject;
  };
  return { storage, subject, original: variable("original"), first: variable("first"),
    second: variable("second"), initializer, variable, source, file,
    declaration: name => nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === name) };
}

test("source value transport retains each read and immediate alias edge without transitive bypasses", async () => {
  const { storage, subject, original, first, second, initializer } = await fixture("source-value-transport");
  const path = [second, initializer(second), first, initializer(first), original, initializer(original)];
  for (let index = 0; index < path.length - 1; index += 1) {
    const current = subject(path[index]);
    assert.equal(current.node === path[index], true, `exact source value ${index}`);
    const incoming = storage.incomingFor(current);
    assert.equal(incoming.kind, "resolved");
    assert.equal(incoming.subjects.length, 1, `one immediate value input ${index}`);
    assert.equal(incoming.subjects[0] === subject(path[index + 1]), true, `no skipped intermediate read ${index}`);
  }
  const selected = storage.boundOriginsFor(subject(second), storage.emptyBindings);
  assert.equal(selected.kind, "resolved");
  assert.equal(selected.subjects.length, 1);
  assert.equal(selected.subjects[0] === subject(initializer(original)), true, "original callable identity remains unchanged");
});

test("bound value frontiers retain ordered boundaries and resume before only the selected root", async () => {
  const { storage, subject, original, first, second, initializer } = await fixture("source-value-frontier");
  const firstBoundary = subject(initializer(first));
  const secondBoundary = subject(initializer(second));
  const boundaries = [firstBoundary, secondBoundary];
  const selected = storage.boundValueFrontierFor(subject(second), storage.emptyBindings, boundaries);
  assert.equal(selected.kind, "resolved");
  assert.equal(selected.frontier.length, 1);
  assert.equal(selected.frontier[0].kind, "boundary");
  assert.equal(selected.frontier[0].subject === secondBoundary, true);
  assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.frontier) && Object.isFrozen(selected.frontier[0]), true);
  const previous = storage.boundValueFrontierFor(secondBoundary, selected.frontier[0].bindings, boundaries, "input");
  assert.equal(previous.kind, "resolved");
  assert.equal(previous.frontier.length, 1);
  assert.equal(previous.frontier[0].kind, "boundary");
  assert.equal(previous.frontier[0].subject === firstBoundary, true, "second adapter retains first adapter, not raw original");
  const producer = storage.boundValueFrontierFor(firstBoundary, previous.frontier[0].bindings, boundaries, "input");
  assert.equal(producer.kind, "resolved");
  assert.equal(producer.frontier.length, 1);
  assert.equal(producer.frontier[0].kind, "origin");
  assert.equal(producer.frontier[0].subject === subject(initializer(original)), true);
  const root = storage.boundValueFrontierFor(secondBoundary, selected.frontier[0].bindings, boundaries);
  assert.equal(root.kind, "resolved");
  assert.equal(root.frontier.length, 1);
  assert.equal(root.frontier[0].subject === secondBoundary, true, "input queries cannot poison later value queries");
});

test("guarded value frontiers retain prior conversions instead of exposing their raw producer", async () => {
  const current = await fixture("source-value-guarded-frontier", `
    const original = () => 3;
    const first: (left: number) => number = original;
    function choose(present: boolean) {
      const optional: typeof first | undefined = present ? first : undefined;
      if (optional !== undefined) {
        const second: (left: number, right: number) => number = optional;
        return second;
      }
      return undefined;
    }
    const result = choose(true);
  `);
  const { storage, subject, initializer, first, second } = current;
  const firstBoundary = subject(initializer(first));
  const secondBoundary = subject(initializer(second));
  const selected = storage.boundValueFrontierFor(secondBoundary, storage.emptyBindings,
    [firstBoundary, secondBoundary], "input");
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "exact frontier");
  assert.equal(selected.frontier.length, 1, selected.frontier.map(value =>
    `${value.kind}:${current.source.ast.kindName(value.subject.node)}:${value.subject.node === firstBoundary.node ? "first" : "other"}`).join(", "));
  assert.equal(selected.frontier[0].kind, "boundary");
  assert.equal(selected.frontier[0].subject === firstBoundary, true, "guard keeps first conversion and removes absent alternative");
});

test("value frontiers reject forged tokens and malformed boundaries without invoking getters", async () => {
  const current = await fixture("source-value-frontier-owned");
  const foreign = await fixture("source-value-frontier-foreign");
  const { storage, subject, second } = current;
  const root = subject(second);
  const other = foreign.subject(foreign.second);
  for (const boundaries of [[other], [{}], [Object.create(root)], new Array(1), null, {}]) {
    assert.equal(storage.boundValueFrontierFor(root, storage.emptyBindings, boundaries).kind, "unresolved");
  }
  const getter = Object.defineProperty([], "0", { get: () => assert.fail("boundary accessor executed") });
  assert.equal(storage.boundValueFrontierFor(root, storage.emptyBindings, getter).kind, "unresolved");
  for (const bindings of [foreign.storage.emptyBindings, {}, Object.create(storage.emptyBindings)]) {
    assert.equal(storage.boundValueFrontierFor(root, bindings, []).kind, "unresolved");
  }
  for (const position of [null, "before", "after", 0]) {
    assert.equal(storage.boundValueFrontierFor(root, storage.emptyBindings, [], position).kind, "unresolved");
  }
  assert.equal(storage.boundValueFrontierFor(root, storage.emptyBindings, []).kind, "resolved",
    "invalid query inputs cannot poison independent valid evidence");
});

test("nominal narrowing preserves the contributing conversion boundary, not its unconverted origin", async () => {
  const current = await fixture("source-value-nominal-frontier", `
    class Base { readonly tag = 0; }
    class Left extends Base { readonly left = 1; }
    class Right extends Base { readonly right = 2; }
    const original = new Left();
    const first: Base = original;
    function choose(present: boolean) {
      const optional: Base = present ? first : new Right();
      if (optional instanceof Left) {
        const second: Base = optional;
        return second;
      }
      return new Right();
    }
    const result = choose(true);
  `);
  const { storage, subject, initializer, first, second } = current;
  const firstBoundary = subject(initializer(first));
  const secondBoundary = subject(initializer(second));
  const selected = storage.boundValueFrontierFor(secondBoundary, storage.emptyBindings,
    [firstBoundary, secondBoundary], "input");
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "exact frontier");
  assert.equal(selected.frontier.length, 1);
  assert.equal(selected.frontier[0].kind, "boundary");
  assert.equal(selected.frontier[0].subject === firstBoundary, true);
});

for (const expression of ["(original)", "original as (() => number)", "original satisfies (() => number)",
  "original!", "<() => number>original", "[original][0]"]) {
  test(`value boundaries retain exact expression identity through ${expression}`, async () => {
    const current = await fixture(`source-value-expression-${expression.length}`, `
      const original = () => 3;
      const first: (left: number) => number = ${expression};
      const second: (left: number, right: number) => number = first;
    `);
    const { storage, subject, initializer, first, second, original } = current;
    const boundary = subject(initializer(first));
    assert.equal(boundary.node === initializer(first), true, "a checked expression is not replaced by its operand or storage owner");
    const selected = storage.boundValueFrontierFor(subject(second), storage.emptyBindings, [boundary]);
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "exact frontier");
    assert.equal(selected.frontier.length === 1 && selected.frontier[0].subject === boundary, true);
    const producer = storage.boundValueFrontierFor(boundary, selected.frontier[0].bindings, [boundary], "input");
    assert.equal(producer.kind, "resolved", producer.kind === "unresolved" ? producer.reason : "exact operand");
    assert.equal(producer.frontier.length === 1 && producer.frontier[0].kind === "origin" &&
      producer.frontier[0].subject === subject(initializer(original)), true, "wrapper retains original input identity");
  });
}

test("returned closure frontiers retain distinct argument activations through the same conversion site", async () => {
  const current = await fixture("source-value-frontier-activation", `
    const original = () => 3;
    const other = () => 4;
    function retain(callback: () => number) {
      const first: (left: number) => number = callback;
      return () => first;
    }
    const firstReader = retain(original);
    const otherReader = retain(other);
    const second = firstReader();
    const alternative = otherReader();
  `);
  const { storage, subject, initializer, first, variable } = current;
  const boundary = subject(initializer(first));
  const contexts = [];
  for (const [name, producer] of [["second", "original"], ["alternative", "other"]]) {
    const selected = storage.boundValueFrontierFor(subject(variable(name)), storage.emptyBindings, [boundary]);
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "exact activation");
    assert.equal(selected.frontier.length === 1 && selected.frontier[0].subject === boundary, true, name);
    contexts.push(selected.frontier[0].bindings);
    const activation = storage.boundActivationsFor(current.declaration("retain"), selected.frontier[0].bindings);
    assert.equal(activation.kind, "resolved", activation.kind === "unresolved" ? activation.reason : "exact retained activation");
    assert.equal(activation.activations.length, 1);
    assert.equal(activation.activations[0].kind, "invocation");
    assert.equal(activation.activations[0].invocation === initializer(variable(name === "second" ? "firstReader" : "otherReader")), true);
    assert.equal(activation.activations[0].callerBindings === storage.emptyBindings, true);
    assert.equal(Object.isFrozen(activation) && Object.isFrozen(activation.activations) && Object.isFrozen(activation.activations[0]), true);
    const input = storage.boundValueFrontierFor(boundary, selected.frontier[0].bindings, [boundary], "input");
    assert.equal(input.kind, "resolved", input.kind === "unresolved" ? input.reason : "exact input");
    assert.equal(input.frontier.length === 1 && input.frontier[0].subject === subject(initializer(variable(producer))), true,
      `${name}: only its own actual argument`);
  }
  assert.equal(contexts[0] !== contexts[1], true, "equal source boundary does not merge independent activations");
  const symbolic = storage.bindingsForDeclaration(current.declaration("retain"));
  assert.equal(symbolic.kind, "resolved");
  const retained = storage.boundActivationsFor(current.declaration("retain"), symbolic.bindings);
  assert.equal(retained.kind, "resolved");
  assert.equal(retained.activations.length === 1 && retained.activations[0].kind === "declaration" &&
    retained.activations[0].bindings === symbolic.bindings, true, "declaration-only proof never invents a selected call");
  for (const owner of [{}, current.file, first]) {
    assert.equal(storage.boundActivationsFor(owner, contexts[0]).kind, "unresolved", "only an owned declaration can query activation");
  }
  assert.equal(storage.boundActivationsFor(current.declaration("retain"), {}).kind, "unresolved", "bindings cannot be forged");
});

test("frontiers revalidate mutable boundaries and retain only immutable boundary indexes", async () => {
  const current = await fixture("source-value-frontier-boundary-index");
  const { storage, subject, initializer, first, second, original } = current;
  const boundary = subject(initializer(first));
  const mutable = [boundary];
  const firstSelection = storage.boundValueFrontierFor(subject(second), storage.emptyBindings, mutable);
  assert.equal(firstSelection.kind, "resolved");
  assert.equal(firstSelection.frontier.length === 1 && firstSelection.frontier[0].subject === boundary, true);
  mutable.length = 0;
  const withoutBoundary = storage.boundValueFrontierFor(subject(second), storage.emptyBindings, mutable);
  assert.equal(withoutBoundary.kind, "resolved");
  assert.equal(withoutBoundary.frontier.length === 1 &&
    withoutBoundary.frontier[0].subject === subject(initializer(original)), true, "mutable indexes never reuse stale boundaries");
  mutable.push({});
  assert.equal(storage.boundValueFrontierFor(subject(second), storage.emptyBindings, mutable).kind, "unresolved");
  const frozen = Object.freeze([boundary]);
  for (let index = 0; index < 100; index += 1) {
    const selected = storage.boundValueFrontierFor(subject(second), storage.emptyBindings, frozen);
    assert.equal(selected.kind, "resolved");
    assert.equal(selected.frontier.length === 1 && selected.frontier[0].subject === boundary, true);
  }
  assert.equal(storage.failureReason(), undefined);
});

test("nested retained activations expose exact caller bindings without guessing type arguments", async () => {
  const current = await fixture("source-value-frontier-nested-activation", `
    const original = () => 3;
    function retain<Value>(callback: () => Value) {
      const first: (left: number) => Value = callback;
      return () => first;
    }
    function outer<Value>(callback: () => Value) {
      const retained = retain<Value>(callback);
      return () => retained();
    }
    const reader = outer<number>(original);
    const second = reader();
  `);
  const { storage, subject, initializer, first, second, variable, declaration } = current;
  const boundary = subject(initializer(first));
  const selected = storage.boundValueFrontierFor(subject(second), storage.emptyBindings, [boundary]);
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "exact nested frontier");
  assert.equal(selected.frontier.length === 1 && selected.frontier[0].subject === boundary, true);
  const inner = storage.boundActivationsFor(declaration("retain"), selected.frontier[0].bindings);
  assert.equal(inner.kind, "resolved", inner.kind === "unresolved" ? inner.reason : "exact inner activation");
  assert.equal(inner.activations.length === 1 && inner.activations[0].kind === "invocation" &&
    inner.activations[0].invocation === initializer(variable("retained")), true);
  const outer = storage.boundActivationsFor(declaration("outer"), inner.activations[0].callerBindings);
  assert.equal(outer.kind, "resolved", outer.kind === "unresolved" ? outer.reason : "exact outer activation");
  assert.equal(outer.activations.length === 1 && outer.activations[0].kind === "invocation" &&
    outer.activations[0].invocation === initializer(variable("reader")) &&
    outer.activations[0].callerBindings === storage.emptyBindings, true);
  const input = storage.boundValueFrontierFor(boundary, selected.frontier[0].bindings, [boundary], "input");
  assert.equal(input.kind, "resolved");
  assert.equal(input.frontier.length === 1 && input.frontier[0].subject === subject(initializer(current.original)), true);
});

test("value frontiers and activation queries cannot bypass any independent source storage budget", async () => {
  const current = await fixture("source-value-frontier-finite-budgets");
  for (const key of Object.keys(defaultSourceStorageLimits)) {
    const storage = createSourceStorageQuery(current.source, current.source.navigation.sourceFiles,
      { ...defaultSourceStorageLimits, [key]: 1 });
    assert.equal(storage.failureReason() !== undefined, true, key);
    assert.equal(storage.boundValueFrontierFor(current.subject(current.second), storage.emptyBindings, []).kind,
      "unresolved", `${key}: frontier fails closed`);
    assert.equal(storage.boundActivationsFor(current.initializer(current.original), storage.emptyBindings).kind,
      "unresolved", `${key}: activation fails closed`);
  }
});
