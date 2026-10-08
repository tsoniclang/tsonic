import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
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
  assert.equal(selected.kind === "complete", true, "complete exact storage producers");
  assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.producers) && selected.producers.every(Object.isFrozen), true);
  assert.equal(selected.producers.length > 0, true, "nonempty original producer evidence");
  return selected.producers;
}

function open(selected, kind) {
  assert.equal(selected.kind === "open" && selected.boundaries.some(boundary => boundary.kind === kind), true, kind);
}

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
  assert.equal(transported.length === 1 && transported[0].subject.node === expected, true, "the selected class field ABI survives value transport");
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

test("unsupported delete and iteration producer evidence rejects rather than inventing a value", async () => {
  const current = await fixture("storage-producer-unresolved-writes", `
    const box: { amount?: number } = { amount: 1 };
    delete box.amount;
    let value = 0;
    for (value of [1, 2]) {}
  `);
  const property = requiredNode(current.source.ast, current.file, node => current.source.ast.is.IsPropertyAssignment(node));
  for (const declaration of [property, current.variable("value")]) {
    const selected = current.storage.storageProducersFor(current.subject(declaration));
    assert.equal(selected.kind === "unresolved" && selected.reason.includes("producer"), true, "no partial producer claim");
  }
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
  assert.equal(first.storage.storageProducersFor(formal, Object.freeze({ substitutions: binding.bindings.substitutions })).kind === "unresolved", true);
  assert.equal(second.storage.storageProducersFor(second.subject(second.variable("value")), binding.bindings).kind === "unresolved", true);
  assert.equal(first.storage.storageProducersFor(second.subject(second.variable("value"))).kind === "unresolved", true);
  assert.equal(first.storage.storageProducersFor(Object.freeze({ ...formal })).kind === "unresolved", true);
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
