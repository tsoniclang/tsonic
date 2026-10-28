import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Expression } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile, requiredNode } from "../fixtures/source-navigation.mjs";

const globals = `
interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
interface Number {} interface String {} interface RegExp {}
interface Array<T> { [index: number]: T; length: number; }
interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
`;

async function fixture(name, body, limits = defaultSourceStorageLimits) {
  const checked = await checkedSource(name, { "globals.d.ts": globals, "src/index.ts": `export {}; ${body}` });
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  assert.equal(checked.extensionDiagnostics.length === 0, true, "exact admitted source facts");
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, limits);
  const subject = node => {
    const selected = storage.subjectFor(node);
    assert.equal(selected.kind === "resolved", true, "exact owned subject");
    return selected.subject;
  };
  const variable = name => namedVariable(source.ast, file, name);
  const initializer = name => source.ast.as.AsVariableDeclaration(variable(name)).Initializer;
  const field = name => requiredNode(source.ast, file, node => source.ast.is.IsPropertyDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
  return { source, file, storage, subject, variable, initializer, field };
}

function producers(selected) {
  assert.equal(selected.kind === "complete", true,
    `complete exact storage producers; ${selected.kind}; ${selected.kind === "unresolved" ? selected.reason : ""}`);
  assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.producers) && selected.producers.every(Object.isFrozen), true);
  assert.equal(selected.producers.length > 0, true, "nonempty original producer evidence");
  return selected.producers;
}

function open(selected, kind) {
  assert.equal(selected.kind === "open" && selected.boundaries.some(boundary => boundary.kind === kind), true, kind);
}

for (const reverse of [false, true]) for (const mutate of [false, true]) {
  test(`opaque callback publication retains readonly-container descendant storage (${mutate}; ${reverse})`, async () => {
    const current = await fixture(`storage-producer-readonly-descendant-${mutate}-${reverse}`, `
      export function inspect(mutate: (holder: { readonly values: object[] }) => void): object {
        const original = {};
        const holder: { readonly values: object[] } = { values: [original] };
        ${mutate ? "mutate(holder);" : ""}
        const selected = holder.values[0];
        return selected;
      }
    `);
    const { ast } = current.source;
    const owner = namedDeclaration(ast, current.file, "inspect");
    const bindings = current.storage.bindingsForDeclaration(owner);
    assert.equal(bindings.kind === "resolved", true, "the actual enclosing declaration activation is retained");
    const inspectContainer = () => {
      const selected = current.storage.closedOriginsFor(current.subject(current.variable("holder")), bindings.bindings);
      assert.equal(selected.kind === "complete" && selected.origins.length === 1 &&
        selected.origins[0].subject.node === current.initializer("holder"), true,
      "a by-value callback cannot replace the original container binding");
    };
    const inspectElement = () => {
      const selected = current.storage.storageProducersFor(current.subject(current.initializer("selected")), bindings.bindings);
      assert.equal(selected.kind === (mutate ? "open" : "complete"), true,
        `the writable descendant keeps its actual publication status: ${selected.kind}`);
      assert.equal(selected.kind !== "unresolved" && selected.producers.some(producer =>
        producer.subject.node === current.initializer("original")), true, "the original element allocation remains a producer");
      if (mutate) {
        const call = requiredNode(ast, owner, node => ast.is.IsCallExpression(node) &&
          ast.is.IsIdentifier(ast.as.AsCallExpression(node).Expression) && ast.text(ast.as.AsCallExpression(node).Expression) === "mutate");
        assert.equal(selected.kind === "open" && selected.boundaries.some(boundary =>
          boundary.kind === "opaque-write" && boundary.exposure === call), true,
        "the original callback is the opaque writer of its writable array descendant");
      }
    };
    for (const inspect of reverse ? [inspectElement, inspectContainer] : [inspectContainer, inspectElement]) inspect();
    assert.equal(current.storage.failureReason() === undefined, true, "the exact descendant remains within the unchanged finite limits");
  });
}

for (const reverse of [false, true]) test(`fixed authored callees retain separate outside argument domains (${reverse})`, async () => {
  const current = await fixture(`storage-producer-fixed-callee-${reverse}`, `
    declare const outside: object;
    function retain(value: object): object { return value; }
    const original = {}; const known = retain(original); const unknown = retain(outside);
  `);
  for (const name of reverse ? ["unknown", "known"] : ["known", "unknown"]) {
    const selected = current.storage.closedOriginsFor(current.subject(current.variable(name)));
    if (name === "unknown") {
      assert.equal(selected.kind === "open" && selected.boundaries.some(boundary => boundary.kind === "external-input"), true,
        "a fixed source body does not certify preservation of an outside argument");
    } else {
      assert.equal(selected.kind === "complete" && selected.origins.length === 1 &&
        selected.origins[0].subject.node === current.initializer("original"), true,
      "the exact direct source callee keeps its own caller allocation");
    }
  }
  assert.equal(current.storage.failureReason(), undefined, "exact callable identity needs no unbounded re-analysis");
});

test("a rewritten authored function binding cannot prove its later callee closed", async () => {
  const current = await fixture("storage-producer-rewritten-callee", `
    declare function native(value: object): object;
    let retain = function (value: object): object { return value; };
    retain = native;
    const original = {}; const selected = retain(original);
  `);
  const selected = current.storage.closedOriginsFor(current.subject(current.variable("selected")));
  assert.equal(selected.kind === "open" && selected.boundaries.some(boundary => boundary.kind === "opaque-result"), true,
    `a source declaration with a native write retains its actual opaque result; ${selected.reason ?? selected.kind}`);
  assert.equal(current.storage.failureReason(), undefined, "the actual native alternative remains bounded");
});

for (const assignment of ["retain = native;", "retain = choose ? retain : native;"]) {
  test(`native callee alternatives retain the actual opaque result (${assignment})`, async () => {
    const current = await fixture("storage-producer-native-alternative", `
      declare const choose: boolean;
      declare function native(value: object): object;
      let retain = function (value: object): object { return value; };
      ${assignment}
      const original = {}; const independent = {};
      const selected = retain(original);
    `);
    const selected = current.storage.closedOriginsFor(current.subject(current.variable("selected")));
    assert.equal(selected.kind === "open", true,
      `the actual native alternative stays opaque; ${selected.reason ?? selected.kind}`);
    const exposure = current.initializer("selected");
    assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-result" && boundary.exposure === exposure),
      true, "the exact invocation, not its stale source signature, owns the opaque result");
    const independent = current.storage.closedOriginsFor(current.subject(current.variable("independent")));
    assert.equal(independent.kind === "complete" && independent.origins.length === 1 &&
      independent.origins[0].subject.node === current.initializer("independent"), true,
    "native alternatives cannot poison an unrelated exact allocation");
    assert.equal(current.storage.failureReason() === undefined, true, "native alternative transport remains finite");
  });
}

test("stored invocation producers retain exact independent activation bindings", async () => {
  const current = await fixture("storage-producer-activation", `
    function retain(callback: () => {}): {} { return callback(); }
    export function inspect(left: () => {}, right: () => {}) {
      const first = retain(left); const second = retain(right); return second;
    }
  `);
  const { ast } = current.source;
  const inspect = namedDeclaration(ast, current.file, "inspect");
  const retain = namedDeclaration(ast, current.file, "retain");
  const bindings = current.storage.bindingsForDeclaration(inspect);
  assert.equal(bindings.kind, "resolved");
  const formal = current.storage.subject(ast.parameters(retain)[0], "input");
  assert.equal(formal.kind, "resolved");
  const origins = [];
  for (const [index, name] of ["first", "second"].entries()) {
    const selected = current.storage.storageProducersFor(current.subject(current.variable(name)), bindings.bindings);
    assert.equal(selected.kind !== "unresolved", true, selected.reason);
    const original = selected.producers.find(value => ast.is.IsCallExpression(value.subject.node) &&
      ast.text(Node_Expression(ast, value.subject.node)) === "callback");
    assert.equal(original !== undefined, true, "exact producer operation is retained");
    assert.equal(Object.isFrozen(original.bindings) && original.bindings.kind === "source-storage-bindings", true);
    const actual = current.storage.boundOriginsFor(formal.subject, original.bindings);
    assert.equal(actual.kind, "resolved");
    assert.equal(Object.isFrozen(actual.subjects) && actual.subjects.every(Object.isFrozen), true);
    assert.equal(actual.subjects.length, 1);
    assert.equal(actual.subjects[0].node === ast.parameters(inspect)[index], true, "caller input identity survives the return edge");
    assert.equal(current.storage.boundOriginsFor(formal.subject, { ...original.bindings }).kind, "unresolved",
      "copied activation views cannot mint ownership");
    origins.push(original);
  }
  assert.equal(origins[0].subject === origins[1].subject, true, "one source operation");
  assert.equal(origins[0].bindings === origins[1].bindings, false, "distinct selected invocation activation");
});

test("concrete field producers remain exact independently of unknown public readonly reads", async () => {
  const current = await fixture("storage-producer-public-read", `
    class Value { readonly recurse = (count: number): number => count === 0 ? 1 : this.recurse(count - 1); }
    export function reader() { const value = new Value(); return (input: typeof value): number => input.recurse(1); }
    export function inspect(input: Value) { const selected = input.recurse; return selected; }
  `);
  const field = current.field("recurse");
  const selected = current.storage.storageProducersFor(current.subject(field));
  const expected = current.source.ast.as.AsPropertyDeclaration(field).Initializer;
  assert.equal(producers(selected).length === 1 && selected.producers[0].subject.node === expected, true, "original authored creation");
  open(current.storage.closedOriginsFor(current.subject(field)), "external-input");
  const transported = producers(current.storage.storageProducersFor(current.subject(current.variable("selected"))));
  // RULINGS 2026-10-23: the exported reader's body is an entry, so its `new Value()` is one more activation of the same arrow.
  assert.equal(transported.length !== 0 && transported.every(producer => producer.subject.node === expected &&
    producer.subject.projection.length === 0), true, "the selected class field ABI survives value transport");
  open(current.storage.closedOriginsFor(current.subject(current.variable("selected"))), "external-input");
});

test("unknown constructor inputs and shallow readonly descendants do not become closed producers", async () => {
  const current = await fixture("storage-producer-unknown-input", `
    export class Value { readonly callback: () => number; constructor(input: () => number) { this.callback = input; } }
    export const nested: { readonly inner: { token: {} } } = { inner: { token: {} } };
    const selected = nested.inner.token;
  `);
  open(current.storage.storageProducersFor(current.subject(current.field("callback"))), "external-input");
  open(current.storage.storageProducersFor(current.subject(current.variable("selected"))), "external-write");
});

for (const reverse of [false, true]) {
  test(`an external constructor frontier never supplies a private executed producer (${reverse})`, async () => {
    const current = await fixture("storage-producer-external-frontier-order", `
      export class External {
        readonly callback: () => number;
        constructor(input: () => number) { this.callback = input; }
      }
      class Local {
        callback = (): number => 1;
        replace(input: () => number): void { this.callback = input; }
      }
      const local = new Local();
      const selected = local.callback;
    `);
    const { ast } = current.source;
    const external = namedDeclaration(ast, current.file, "External");
    const local = namedDeclaration(ast, current.file, "Local");
    const constructor = ast.members(external).find(member => ast.is.IsConstructorDeclaration(member));
    const externalField = ast.members(external).find(member => ast.is.IsPropertyDeclaration(member));
    const localField = ast.members(local).find(member => ast.is.IsPropertyDeclaration(member));
    assert.equal(constructor !== undefined && externalField !== undefined && localField !== undefined, true,
      "the exact original constructor and two field declarations exist");
    const formal = ast.parameters(constructor)[0];
    const original = ast.as.AsPropertyDeclaration(localField).Initializer;
    const checks = [() => {
      const selected = current.storage.storageProducersFor(current.subject(externalField));
      assert.equal(selected.kind === "open", true, "the unconstructed exported field remains open");
      assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-input" && boundary.subject.node === formal), true,
        "the frontier is the exact original external constructor formal");
      assert.equal(selected.producers.length === 0, true, "an external frontier never fabricates an executed producer");
    }, () => {
      const selected = current.storage.closedOriginsFor(current.subject(current.variable("selected")));
      assert.equal(selected.kind === "complete", true, "the actual private construction stays closed");
      assert.equal(selected.origins.length === 1 && selected.origins[0].subject.node === original, true,
        "only the original local field arrow executes; the replacement method was not called");
    }];
    for (const check of reverse ? checks.reverse() : checks) check();
    assert.equal(current.storage.failureReason() === undefined, true, "the independent query orders do not poison their owner");
  });
}

test("physical producers preserve external and opaque writes instead of treating readonly views as closure", async () => {
  const current = await fixture("storage-producer-writer-boundaries", `
    export class Mutable { externalCallback = (): number => 1; }
    class Local { opaqueCallback = (): number => 2; }
    declare function outside(input: Local): void;
    const local = new Local();
    outside(local);
    const callback = (): number => 3;
    export let writable: () => number = callback;
  `);
  open(current.storage.storageProducersFor(current.subject(current.field("externalCallback"))), "external-write");
  open(current.storage.storageProducersFor(current.subject(current.field("opaqueCallback"))), "opaque-write");
  open(current.storage.storageProducersFor(current.subject(current.variable("writable"))), "external-write");
});

test("direct and computed structural writes preserve exact original callback producer identities", async () => {
  const current = await fixture("storage-producer-structural-writes", `
    class Value { callback = (): number => 1; }
    const value = new Value();
    const first = (): number => 2;
    const second = (): number => 3;
    value.callback = first;
    const alias: { callback: () => number } = value;
    alias["callback"] = second;
  `);
  const selected = current.storage.storageProducersFor(current.subject(current.field("callback")));
  const expected = [current.source.ast.as.AsPropertyDeclaration(current.field("callback")).Initializer,
    current.initializer("first"), current.initializer("second")];
  const actual = producers(selected);
  assert.equal(actual.length === expected.length && expected.every(node => actual.some(producer => producer.subject.node === node)), true,
    "no declaration-shape substitute or unrelated writer");
});

test("numeric updates and compound writes retain the operation result while logical writes retain their selected operand", async () => {
  const current = await fixture("storage-producer-compound-writes", `
    let value = 1;
    value += 3;
    value++;
    let callback: (() => number) | null = null;
    const replacement = (): number => 7;
    callback ??= replacement;
    const box = { amount: 2 };
    const alias: { amount: number } = box;
    alias["amount"] *= 2;
  `);
  const values = producers(current.storage.storageProducersFor(current.subject(current.variable("value"))));
  assert.equal(values.length === 3 && values.some(producer => current.source.ast.is.IsBinaryExpression(producer.subject.node)) &&
    values.some(producer => current.source.ast.is.IsPostfixUnaryExpression(producer.subject.node)), true, "exact computed values, not just RHS literals");
  const callbacks = producers(current.storage.storageProducersFor(current.subject(current.variable("callback"))));
  assert.equal(callbacks.length === 2 && callbacks.some(producer => producer.subject.node === current.initializer("replacement")), true);
  const property = requiredNode(current.source.ast, current.file, node => current.source.ast.is.IsPropertyAssignment(node));
  const members = producers(current.storage.storageProducersFor(current.subject(property)));
  assert.equal(members.length === 2 && members.some(producer => current.source.ast.is.IsBinaryExpression(producer.subject.node)), true);
});

test("valueless deletion retains absence and original producers while unsupported iteration keys reject", async () => {
  const current = await fixture("storage-producer-unresolved-writes", `
    const box: { amount?: number } = { amount: 1 };
    delete box.amount;
    const fallback = 5;
    const { amount: observed = fallback } = box;
    let value = "";
    for (value in { item: 1 }) {}
  `);
  const property = requiredNode(current.source.ast, current.file, node => current.source.ast.is.IsPropertyAssignment(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "amount");
  const original = current.source.ast.as.AsPropertyAssignment(property).Initializer;
  const values = producers(current.storage.storageProducersFor(current.subject(property)));
  assert.equal(values.length === 1 && values[0].subject.node === original, true, "deletion never invents an RHS or Boolean producer");
  const observed = requiredNode(current.source.ast, current.file, node => current.source.ast.is.IsBindingElement(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "observed");
  const readings = producers(current.storage.storageProducersFor(current.subject(observed)));
  assert.equal(readings.length === 2 && readings.some(value => value.subject.node === original) &&
    readings.some(value => value.subject.node === current.initializer("fallback")), true,
    "the same exact producer domain also retains deletion's absence and real default");
  const selected = current.storage.storageProducersFor(current.subject(current.variable("value")));
  assert.equal(selected.kind === "unresolved" && selected.reason.includes("producer"), true, "no partial iteration-key producer claim");
  assert.equal(current.storage.storageProducersFor(current.subject(current.variable("value"))).reason,
    "Source storage writes require their exact checked original value producer, iteration element and component projection.",
    "iteration keys keep their precise unresolved producer");
});

for (const [label, erase] of [
  ["direct member", "delete first.amount;"],
  ["aliased member", "const alias = first; delete alias.amount;"],
  ["forwarded input", "function erase(owner: Box) { delete owner.amount; } erase(first);"],
  ["stable input alias", "function erase(owner: Box) { const alias = owner; delete alias.amount; } erase(first);"],
]) test(`deletion absence preserves the actual instance and original default through ${label}`, async () => {
  const current = await fixture(`storage-delete-${label.replaceAll(" ", "-")}`, `
    class Box { amount?: object; constructor(value: object) { this.amount = value; } }
    const original = {}; const independent = {}; const fallback = {};
    const first = new Box(original); const second = new Box(independent);
    ${erase}
    const { amount: observed = fallback } = first;
    const { amount: unchanged = fallback } = second;
  `);
  const binding = name => requiredNode(current.source.ast, current.file, node => current.source.ast.is.IsBindingElement(node) &&
    current.source.ast.text(current.source.ast.name(node)) === name);
  const changed = producers(current.storage.storageProducersFor(current.subject(binding("observed"))));
  assert.equal(changed.length === 2 && changed.some(value => value.subject.node === current.initializer("original")) &&
    changed.some(value => value.subject.node === current.initializer("fallback")), true,
    `${label}: an executed deletion adds the single absence/default, not a synthesized stored value`);
  const unchanged = producers(current.storage.storageProducersFor(current.subject(binding("unchanged"))));
  assert.equal(unchanged.length === 1 && unchanged[0].subject.node === current.initializer("independent"), true,
    `${label}: matching a source member declaration never imports a different receiver's deletion`);
  assert.equal(current.storage.failureReason(), undefined, `${label}: exact finite instance/effect correlation`);
});

test("array iteration producers retain actual elements rather than the collection or a synthetic value", async () => {
  const current = await fixture("storage-producer-array-iteration", `
    const first = { value: 1 }; const second = { value: 2 };
    const rows = [first, second];
    let selected = first;
    for (selected of rows) {}
  `);
  const values = producers(current.storage.storageProducersFor(current.subject(current.variable("selected"))));
  const expected = [current.initializer("first"), current.initializer("second")];
  assert.equal(values.length === expected.length && expected.every(node => values.some(value => value.subject.node === node)), true,
    "only the exact original initializer and actual iteration elements are producers");
  assert.equal(values.some(value => value.subject.node === current.initializer("rows")), false,
    "the collection itself is never substituted for its selected element");
});

test("provider-only declarations and external formal members never acquire an authored producer inventory", async () => {
  const current = await fixture("storage-producer-ambient-member", `
    declare class Native { readonly callback: () => number; }
    export function inspect(input: Native) { const selected = input.callback; return selected; }
    export function structural(input: { readonly callback: () => number }) { const other = input.callback; return other; }
  `);
  open(current.storage.storageProducersFor(current.subject(current.variable("selected"))), "external-input");
  open(current.storage.storageProducersFor(current.subject(current.variable("other"))), "external-input");
  open(current.storage.storageProducersFor(current.subject(current.field("callback"))), "external-input");
});

test("producer queries reject forged and foreign subjects and bindings using the same storage owner", async () => {
  const first = await fixture("storage-producer-first-owner", `function identity<T>(value: T): T { return value; } const value = identity({});`);
  const second = await fixture("storage-producer-second-owner", `function identity<T>(value: T): T { return value; } const value = identity({});`);
  const identity = namedDeclaration(first.source.ast, first.file, "identity");
  const binding = first.storage.bindingsForInvocation(identity, first.initializer("value"));
  assert.equal(binding.kind === "resolved", true);
  const formal = first.subject(first.source.ast.parameters(identity)[0]);
  assert.equal(first.storage.storageProducersFor(formal, Object.freeze({ kind: binding.bindings.kind })).kind === "unresolved", true);
  assert.equal(second.storage.storageProducersFor(second.subject(second.variable("value")), binding.bindings).kind === "unresolved", true);
  assert.equal(first.storage.storageProducersFor(second.subject(second.variable("value"))).kind === "unresolved", true);
  assert.equal(first.storage.storageProducersFor(Object.freeze({ ...formal })).kind === "unresolved", true);
});

for (const reverse of [false, true]) for (const mode of ["source", "native", "mixed"]) {
  test(`nested native callback payloads preserve actual mixed dispatch effects (${mode}; ${reverse})`, async () => {
    const current = await fixture(`storage-producer-nested-payload-${mode}-${reverse}`, `
      declare const choose: boolean;
      declare function nativeWrap(value: object): object;
      declare function nativeDeliver(value: object, callback: (actual: () => void) => void): void;
      const initial = {}; const changed = {};
      let selected = initial;
      const retained = (): void => { selected = changed; };
      const input = { retained };
      let wrap = function (_value: object): object { return {}; };
      ${mode === "source" ? "" : `wrap = ${mode === "mixed" ? "choose ? wrap : nativeWrap" : "nativeWrap"};`}
      const wrapped = wrap(input);
      nativeDeliver(wrapped, actual => { actual(); });
      const observed = selected;
    `);
    const { ast } = current.source;
    const delivery = requiredNode(ast, current.file, node => ast.is.IsCallExpression(node) &&
      ast.is.IsIdentifier(ast.as.AsCallExpression(node).Expression) &&
      ast.text(ast.as.AsCallExpression(node).Expression) === "nativeDeliver");
    const inspectCapture = () => {
      const selected = current.storage.storageProducersFor(current.subject(current.variable("observed")));
      assert.equal(selected.kind === "complete" || selected.kind === "open", true,
        `actual captured storage is represented, not an unresolved or empty success; ${selected.reason ?? selected.kind}`);
      assert.equal(selected.producers.some(value => value.subject.node === current.initializer("initial")), true,
        "possible native execution never removes the original stored value");
      const hasWrite = selected.producers.some(value => value.subject.node === current.initializer("changed"));
      if (mode === "source") assert.equal(hasWrite, false, "a source wrapper returning an empty object cannot deliver its input's callback");
      else assert.equal(hasWrite || selected.kind === "open" && selected.boundaries.some(boundary => boundary.exposure === delivery ||
        boundary.exposure === current.initializer("wrapped")), true,
      "a native alternative retains the actual captured write or its exact opaque uncertainty, never initial-only completeness");
    };
    const inspectResult = () => {
      const selected = current.storage.closedOriginsFor(current.subject(current.variable("wrapped")));
      if (mode === "source") assert.equal(selected.kind === "complete" && selected.origins.length === 1 &&
        ast.is.IsObjectLiteralExpression(selected.origins[0].subject.node), true, "the source-only wrapper retains its actual empty result");
      else assert.equal(selected.kind === "open" && selected.boundaries.some(boundary => boundary.kind === "opaque-result" &&
        boundary.exposure === current.initializer("wrapped")), true, "the native branch's result remains explicitly opaque");
    };
    for (const inspect of reverse ? [inspectResult, inspectCapture] : [inspectCapture, inspectResult]) inspect();
    assert.equal(current.storage.failureReason(), undefined, "payload and capture discovery stay within the unchanged finite limits");
  });
}

for (const reverse of [false, true]) for (const native of [false, true]) {
  test(`transparent payload aliases retain native inputs without inventing source-only delivery (${native}; ${reverse})`, async () => {
    const current = await fixture(`storage-producer-transparent-payload-${native}-${reverse}`, `
      declare function nativeWrap(value: object): object;
      declare function nativeDeliver(value: object, callback: (actual: () => void) => void): void;
      const initial = {}; const changed = {};
      let selected = initial;
      const retained = (): void => { selected = changed; };
      const input = { retained };
      const wrap = ${native ? "nativeWrap" : "(_value: object): object => ({})"};
      const raw = wrap(input);
      const wrapped = raw as object;
      const alias = wrapped;
      nativeDeliver(alias, actual => { actual(); });
      const observed = selected;
    `);
    const { ast } = current.source;
    const delivery = requiredNode(ast, current.file, node => ast.is.IsCallExpression(node) &&
      ast.is.IsIdentifier(ast.as.AsCallExpression(node).Expression) &&
      ast.text(ast.as.AsCallExpression(node).Expression) === "nativeDeliver");
    const inspectCapture = () => {
      const selected = current.storage.storageProducersFor(current.subject(current.variable("observed")));
      assert.equal(selected.kind === "complete" || selected.kind === "open", true, selected.reason ?? selected.kind);
      assert.equal(selected.producers.some(value => value.subject.node === current.initializer("initial")), true,
        "the exact original producer is retained");
      const hasWrite = selected.producers.some(value => value.subject.node === current.initializer("changed"));
      assert.equal(native ? hasWrite || selected.kind === "open" && selected.boundaries.some(boundary =>
        boundary.exposure === delivery || boundary.exposure === current.initializer("raw")) : !hasWrite, true,
      "only the native alternative can deliver or retain uncertainty about the nested source callback");
    };
    const inspectAlias = () => {
      const result = current.storage.closedOriginsFor(current.subject(current.variable("alias")));
      assert.equal(native ? result.kind === "open" && result.boundaries.some(boundary =>
        boundary.kind === "opaque-result" && boundary.exposure === current.initializer("raw")) :
        result.kind === "complete" && result.origins.length === 1 && ast.is.IsObjectLiteralExpression(result.origins[0].subject.node),
      true, "aliases preserve the actual result producer and native boundary");
    };
    for (const inspect of reverse ? [inspectAlias, inspectCapture] : [inspectCapture, inspectAlias]) inspect();
    assert.equal(current.storage.failureReason() === undefined, true, "all original finite limits remain unchanged");
  });
}

test("native uncertainty on a callable binding cannot certify its later invocation as source-only", async () => {
  const current = await fixture("storage-producer-native-callee-write", `
    declare function nativeWrap(value: object): object;
    declare function nativeDeliver(value: object, callback: (actual: () => void) => void): void;
    declare function foreign(value: object): object;
    let retain = function (value: object): object { return value; };
    const retained = (): void => { retain = foreign; };
    const input = { retained };
    const wrapped = nativeWrap(input);
    nativeDeliver(wrapped, actual => { actual(); });
    function identity(value: object): object { return value; }
    const original = {};
    const selected = retain(original);
    const independent = identity(original);
  `);
  const selected = current.storage.closedOriginsFor(current.subject(current.variable("selected")));
  assert.equal(selected.kind === "open", true,
    `an actual possible native callee replacement cannot be certified closed: ${selected.reason ?? selected.kind}`);
  const invocation = current.initializer("selected");
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-result" && boundary.exposure === invocation ||
    boundary.kind === "opaque-write" && current.source.ast.is.IsCallExpression(boundary.exposure)), true,
  "the original native execution or uncertain invocation retains its exact opacity witness");
  const independent = current.storage.closedOriginsFor(current.subject(current.variable("independent")));
  assert.equal(independent.kind === "complete" && independent.origins.length === 1 &&
    independent.origins[0].subject.node === current.initializer("original"), true,
  "an unrelated wholly-source invocation retains its exact closed original producer");
  assert.equal(current.storage.failureReason() === undefined, true, "native uncertainty is not a global resource failure");
});

test("producer queries retain every finite accounting limit and malformed-selection rejection", async () => {
  for (const key of Object.keys(defaultSourceStorageLimits)) {
    for (const value of [1, 0, Infinity, defaultSourceStorageLimits[key] + 1]) {
      const current = await fixture("storage-producer-resource-bound", "const original = {}; const alias = original; const token = alias;",
        { ...defaultSourceStorageLimits, [key]: value });
      const selected = current.storage.subjectFor(current.variable("token"));
      const result = selected.kind === "unresolved" ? selected : current.storage.storageProducersFor(selected.subject);
      assert.equal(result.kind === "unresolved" && current.storage.failureReason() !== undefined, true, key);
    }
  }
});

test("late producer-query budget exhaustion cannot publish a partial complete result", async () => {
  const current = await fixture("storage-producer-late-resource-bound", "const original = {}; const alias = original; const token = alias;",
    { ...defaultSourceStorageLimits, maximumSteps: 256 });
  const subject = current.subject(current.variable("token"));
  producers(current.storage.storageProducersFor(subject));
  let selected;
  for (let attempt = 0; attempt < 256; attempt++) {
    selected = current.storage.storageProducersFor(subject);
    if (selected.kind === "unresolved") break;
  }
  assert.equal(selected.kind === "unresolved" && current.storage.failureReason() !== undefined, true, "no truncated producer certificate");
  assert.equal(current.storage.storageProducersFor(subject).kind === "unresolved", true, "failed owner remains failed");
});
