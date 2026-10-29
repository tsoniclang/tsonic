import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceErrorDeclarationQuery, createSourceErrorStorageDemandQuery, createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile, requiredStorageSubject } from "../fixtures/source-navigation.mjs";

const profile = `
interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
interface Number {} interface String {} interface RegExp {} interface Array<T> { [index: number]: T; }
`;

async function checked(name) {
  const result = await checkedSource(name, {
    "globals.d.ts": profile,
    "src/provider.ts": `
      export interface Stored { message: string; }
      export declare function write(first: Stored, second: Stored): void;
      export declare function unrelated(first: Stored, second: Stored): void;
      export declare function spread(...values: Stored[]): void;
    `,
    "src/index.ts": `
      import { write } from "./provider.js";
      const original = { message: "original" };
      const alias = original;
      const untouched = { message: "untouched" };
      write(untouched, alias);
    `,
  });
  assert.equal(result.diagnostics.length, 0, formatDiagnostics(result.diagnostics, "/src"));
  const source = createTargetSourceProgram(result);
  const file = projectSourceFile(source, "src/index.ts");
  const provider = projectSourceFile(source, "src/provider.ts");
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
  return { source, file, provider, storage, original: requiredStorageSubject(storage, namedVariable(source.ast, file, "original")),
    untouched: requiredStorageSubject(storage, namedVariable(source.ast, file, "untouched")), signature: namedDeclaration(source.ast, provider, "write") };
}

function analyze(source, storageMutators, storage) {
  return createSourceErrorStorageDemandQuery(source, { fields: [], constructors: [], stackCaptures: [], storageMutators,
    retention: () => ({ kind: "ordinary" }) }, storage);
}

test("physical Error storage mutation follows its exact selected cross-file scalar parameter and alias", async () => {
  const { source, signature, original, untouched, provider, storage } = await checked("error-storage-selected-mutator");
  const demand = analyze(source, [{ signature, sourceParameterIndex: 1 }], storage);
  assert.equal(demand.storageFor(original).kind, "writable");
  assert.equal(demand.storageFor(untouched).kind, "immutable");
  assert.equal(demand.fieldWrites.length, 0);
  assert.equal(demand.storageFor(original).writes.length, 1);
  assert.equal(Object.isFrozen(demand.storageFor(original).writes), true);
  const unrelated = namedDeclaration(source.ast, provider, "unrelated");
  assert.equal(analyze(source, [{ signature: unrelated, sourceParameterIndex: 1 }], storage).storageFor(original).kind, "immutable");
});

test("physical Error storage protocol rejects malformed, foreign, duplicate and nonscalar selections", async () => {
  const { source, signature, original, provider, storage: query } = await checked("error-storage-invalid-mutator");
  const foreign = await checked("error-storage-foreign-mutator");
  const spread = namedDeclaration(source.ast, provider, "spread");
  const selections = [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, 2].map(sourceParameterIndex => [{ signature, sourceParameterIndex }]);
  selections.push([{ signature: foreign.signature, sourceParameterIndex: 1 }],
    [{ signature: spread, sourceParameterIndex: 0 }],
    [{ signature, sourceParameterIndex: 1 }, { signature, sourceParameterIndex: 1 }]);
  for (const selection of selections) {
    const demand = analyze(source, selection, query);
    const storage = demand.storageFor(original);
    assert.equal(storage.kind, "unresolved", "invalid selected mutation cannot manufacture writable evidence");
    assert.equal(Object.isFrozen(storage), true);
    assert.equal(demand.storageOriginsFor(original).kind, "unresolved");
    assert.equal(demand.closedStorageOriginsFor(original).kind, "unresolved", "malformed protocol never publishes a closed origin proof");
    assert.equal(demand.receivesWritableNative(original), false);
  }
});

test("Error carrier queries require the exact owning subject and reject removed Node signatures", async () => {
  const current = await checked("error-storage-canonical-subjects");
  const foreign = await checked("error-storage-canonical-foreign-subjects");
  const demand = analyze(current.source, [{ signature: current.signature, sourceParameterIndex: 1 }], current.storage);
  for (const subject of [current.original.node, foreign.original, { ...current.original }, undefined]) {
    for (const query of [demand.storageFor, demand.storageOriginsFor, demand.closedStorageOriginsFor]) {
      const selected = query(subject);
      assert.equal(selected.kind, "unresolved", "a Node or matching shape cannot supply canonical graph ownership");
      assert.equal(Object.isFrozen(selected), true);
    }
    assert.equal(demand.receivesWritableNative(subject), false);
  }
  assert.equal(demand.storageFor(current.original).kind, "writable", "rejected foreign subjects do not poison admitted storage");
  assert.equal(demand.storageFor(current.untouched).kind, "immutable");
});

async function declarationProtocol(name) {
  const checked = await checkedSource(name, {
    "globals.d.ts": profile,
    "src/provider.ts": `
      export interface Stored { message: string; stack: string; }
      export declare function write<Value extends Stored>(first: Value, second: Value): void;
      export declare function unrelated(first: Stored, second: Stored): void;
      export declare function spread(...values: Stored[]): void;
    `,
    "src/index.ts": `
      import { Stored, write, unrelated } from "./provider.js";
      const original = { message: "original", stack: "original" };
      const alias = original;
      const untouched = { message: "untouched", stack: "untouched" };
      write(untouched, alias);
      unrelated(untouched, alias);
      export function observe(value: Stored): string { const local = value; return local.message; }
      export function mutate(value: Stored): void { value.message = "changed"; }
      export function escape(value: Stored): Stored { return value; }
      export function capture(value: Stored): () => string { return () => value.message; }
      export function inspect(owner: Stored, other: Stored): string {
        const read = owner.message;
        other.message = "changed";
        unrelated(other, owner);
        return read;
      }
    `,
  });
  assert.equal(checked.diagnostics.length, 0, `${name}: checked declarations`);
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const provider = projectSourceFile(source, "src/provider.ts");
  const stored = namedDeclaration(source.ast, provider, "Stored");
  const field = source.ast.members(stored)[0];
  const signatureDeclaration = namedDeclaration(source.ast, provider, "write");
  const parameterDeclaration = source.ast.parameters(signatureDeclaration)[1];
  const component = declaration => ({ declaration,
    selectedType: source.semantics.forNode(declaration).declarations.declaredValueType(declaration) });
  const protocol = { fields: [{ declaration: field, component: component(field) }], constructors: [],
    scalarMutators: [{ signatureDeclaration, parameterDeclaration, parameterIndex: 1,
      component: component(parameterDeclaration), fields: [field] }] };
  const calls = source.navigation.nodes.filter(node => source.ast.is.IsCallExpression(node) &&
    source.ast.getSourceFile(node) === file);
  return { source, file, provider, field, protocol, component, calls };
}

test("checked Error declarations select the exact instantiated generic scalar argument without storage histories", async () => {
  const { source, file, field, protocol, calls } = await declarationProtocol("error-declaration-generic-slot");
  const query = createSourceErrorDeclarationQuery(source, protocol);
  const selected = query.mutationFor(calls[0]);
  assert.equal(selected.kind, "resolved", "the selected generic signature is the registered mutation owner");
  assert.equal(selected.value.length, 1, "one scalar parameter publishes one mutation");
  assert.equal(query.mutationFor(calls[0]) === selected, true, "later readers consume the one published selected mutation");
  const mutation = selected.value[0].scalar;
  const call = source.semantics.forNode(calls[0]).operations.call(calls[0]);
  assert.equal(mutation.selection === call, true, "retain the original selected checked call");
  assert.equal(mutation.argument.node === call.sourceArguments[1].expression, true, "only parameter one selects alias, not the first argument");
  assert.equal(mutation.argument.component.selectedType === source.semantics.forNode(mutation.argument.node).types.expressionType(mutation.argument.node),
    true, "the argument retains its exact instantiated expression type");
  assert.equal(mutation.slot.component.selectedType === call.sourceSelectedSignatureParameters[1].selectedType,
    true, "generic parameter evidence is the actual instantiated selected slot");
  assert.equal(mutation.slot.fields[0] === field, true, "the exact native field declaration remains selected");
  assert.equal(query.mutationFor(calls[1]).kind, "not-applicable", "a different same-shaped declaration is not the mutator");
  const formal = name => source.ast.parameters(namedDeclaration(source.ast, file, name))[0];
  for (const [name, expected] of [["observe", "read-only"], ["mutate", "writable"], ["escape", "writable"], ["capture", "writable"]]) {
    const selected = query.parameterFor(formal(name));
    assert.equal(selected.kind, "resolved", `${name}: checked current declaration`);
    assert.equal(selected.value.access, expected, `${name}: declaration-local native parameter requirement`);
    assert.equal(query.parameterFor(formal(name)).value === selected.value, true, `${name}: one immutable published parameter selection`);
  }
  assert.equal(Object.isFrozen(query) && Object.isFrozen(mutation.slot) && Object.isFrozen(mutation.argument.component),
    true, "published checked selections are immutable");
});

test("checked Error protocols reject malformed, foreign, duplicate, missing and nonscalar slots", async () => {
  const current = await declarationProtocol("error-declaration-invalid-slots");
  const foreign = await declarationProtocol("error-declaration-foreign-slots");
  const slot = current.protocol.scalarMutators[0];
  const spread = namedDeclaration(current.source.ast, current.provider, "spread");
  const spreadParameter = current.source.ast.parameters(spread)[0];
  const invalid = [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, 2].map(parameterIndex =>
    ({ ...current.protocol, scalarMutators: [{ ...slot, parameterIndex }] }));
  invalid.push({ ...current.protocol, scalarMutators: foreign.protocol.scalarMutators },
    { ...current.protocol, scalarMutators: [slot, slot] },
    { ...current.protocol, scalarMutators: [{ ...slot, signatureDeclaration: spread,
      parameterDeclaration: spreadParameter, parameterIndex: 0, component: current.component(spreadParameter) }] },
    { ...current.protocol, scalarMutators: [{ ...slot, component: { ...slot.component, selectedType: undefined } }] },
    { ...current.protocol, fields: [current.protocol.fields[0], current.protocol.fields[0]] },
    { ...current.protocol, fields: foreign.protocol.fields });
  for (const [index, protocol] of invalid.entries()) {
    const selected = createSourceErrorDeclarationQuery(current.source, protocol).mutationFor(current.calls[0]);
    assert.equal(selected.kind, "unresolved", `invalid slot ${index}: missing checked input is not empty success`);
    assert.equal(Object.isFrozen(selected), true, `invalid slot ${index}: immutable failure`);
  }
  const query = createSourceErrorDeclarationQuery(current.source, current.protocol);
  assert.equal(query.mutationFor(foreign.calls[0]).kind, "unresolved", "an equal-looking foreign call cannot acquire ownership");
  assert.equal(query.mutationFor({}).kind, "unresolved", "a reconstructed node cannot acquire checked ownership");
  assert.equal(query.mutationFor(current.calls[0]).kind, "resolved", "invalid foreign requests do not poison valid selections");
});

test("checked Error invalidation stays in the current body and never infers disjointness or call purity", async () => {
  const { source, file, protocol } = await declarationProtocol("error-declaration-local-effects");
  const query = createSourceErrorDeclarationQuery(source, protocol);
  const inspect = namedDeclaration(source.ast, file, "inspect");
  const body = source.ast.body(inspect);
  const nodes = [];
  const visit = node => { nodes.push(node); source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); }); };
  visit(body);
  const readNode = nodes.find(node => source.ast.is.IsPropertyAccessExpression(node) && source.ast.text(node) === "owner.message");
  const selected = query.fieldFor(readNode);
  assert.equal(selected.kind, "resolved", "the exact field read has checked receiver and member identity");
  const write = nodes.find(node => source.ast.is.IsBinaryExpression(node));
  const call = nodes.find(node => source.ast.is.IsCallExpression(node));
  assert.equal(query.invalidationFor(selected.value, write).kind, "invalidated",
    "different parameters are not proof of distinct physical native Error owners");
  assert.equal(query.invalidationFor(selected.value, call).kind, "invalidated",
    "an unregistered selected call is not proven pure by a readonly-looking signature");
  const foreignBody = source.ast.body(namedDeclaration(source.ast, file, "observe"));
  assert.equal(query.invalidationFor(selected.value, foreignBody).kind, "unresolved",
    "the owner never replays another callable's execution");
  assert.equal(query.invalidationFor({ ...selected.value }, call).kind, "unresolved",
    "an equal-looking reconstructed read cannot replace the canonical checked read");
});
