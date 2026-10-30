import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceErrorDeclarationQuery, createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";

test("destructured Error formals retain their unique checked signature slot and actual field reads", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/error-bindings", files: {
    "/error-bindings/index.ts": `
      export function read({ message: renamed, stack = "absent" }: Error): string { return renamed + stack; }
      export function other(error: Error): string { return error.message; }
    `,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the original object parameter is checked without a source annotation workaround");
  const source = createTargetSourceProgram(checked);
  const declaration = source.navigation.nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "read");
  const other = source.navigation.nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "other");
  assert.equal(declaration !== undefined && other !== undefined, true, "both real callable declarations are present");
  const queries = source.semantics.forNode(declaration);
  const signature = queries.types.declarationSignatureInfo(declaration);
  const parameter = source.ast.parameters(declaration)[0];
  const slot = signature.parameters[0];
  const fields = queries.types.propertyInfos(slot.type).filter(member => ["message", "stack"].includes(member.name))
    .flatMap(member => queries.declarations.symbolDeclarations(member.symbol));
  const protocol = { fields: fields.map(declaration => ({ declaration, component: {
    declaration, selectedType: source.semantics.forNode(declaration).declarations.declaredValueType(declaration),
  } })), constructors: [], scalarMutators: [] };
  const selected = createSourceErrorDeclarationQuery(source, protocol).parameterFor(parameter);
  assert.equal(selected.kind === "resolved" && selected.value.access === "read-only", true,
    "an actual native readonly binding is selected from its original signature, not an Identifier-only query");
  assert.equal(selected.value.parameter.component.selectedType === slot.type && selected.value.parameter.component.declaration === parameter,
    true, "the original selected Type and parameter declaration remain identical");
  assert.equal(selected.value.uses.length === 2 && selected.value.uses.every(node => source.ast.is.IsBindingElement(node)), true,
    "the two real binding reads are recorded, not an empty manufactured readonly proof");
  const foreign = queries.types.declarationSignatureInfo(other).parameters[0].sourceSymbol;
  for (const [label, parameters] of [
    ["missing symbol", [{ ...slot, sourceSymbol: undefined }]],
    ["foreign symbol", [{ ...slot, sourceSymbol: foreign }]],
    ["duplicate declaration slot", [slot, slot]],
  ]) {
    const malformed = { ...source, semantics: { ...source.semantics, forNode(node) {
      const actual = source.semantics.forNode(node);
      return { ...actual, types: { ...actual.types, declarationSignatureInfo(owner) {
        const selected = actual.types.declarationSignatureInfo(owner);
        return owner === declaration ? { ...selected, parameters } : selected;
      } } };
    } } };
    assert.equal(createSourceErrorDeclarationQuery(malformed, protocol).parameterFor(parameter).kind, "unresolved",
      `${label}: no vacuous readonly contract or forged parameter identity`);
  }
});
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
  const provider = projectSourceFile(source, "src/provider.ts");
  const field = source.ast.members(namedDeclaration(source.ast, provider, "Stored"))[0];
  const component = declaration => ({ declaration, selectedType: declaration === undefined ? undefined
    : source.semantics.forNode(declaration).declarations.declaredValueType(declaration) });
  return createSourceErrorDeclarationQuery(source, {
    fields: [{ declaration: field, component: component(field) }], constructors: [],
    scalarMutators: storageMutators.map(({ signature, sourceParameterIndex }) => {
      const parameterDeclaration = source.ast.parameters(signature)[sourceParameterIndex];
      return { signatureDeclaration: signature, parameterDeclaration, parameterIndex: sourceParameterIndex,
        component: component(parameterDeclaration), fields: [field] };
    }),
  });
}

test("physical Error storage mutation follows its exact selected cross-file scalar parameter and alias", async () => {
  const { source, signature, original, untouched, provider, storage } = await checked("error-storage-selected-mutator");
  const demand = analyze(source, [{ signature, sourceParameterIndex: 1 }], storage);
  const invocation = source.navigation.nodes.find(node => source.ast.is.IsCallExpression(node) &&
    source.ast.getSourceFile(node) !== provider);
  const mutation = demand.mutationFor(invocation);
  assert.equal(mutation.kind === "resolved" && mutation.value.length === 1, true, "one exact selected scalar mutation");
  const selected = mutation.value[0];
  assert.equal(selected.kind === "scalar" && selected.scalar.slot.parameterIndex === 1, true, "only the second scalar slot is writable");
  const call = source.semantics.forNode(invocation).operations.call(invocation);
  assert.equal(selected.scalar.argument.node === call.sourceArguments[1].expression, true, "the selected argument is the original alias");
  assert.equal(selected.scalar.argument.node !== call.sourceArguments[0].expression, true, "the independent first argument is not selected");
  assert.equal(source.navigation.nodes.some(node => demand.mutationFor(node).kind === "resolved" &&
    demand.mutationFor(node).value.some(value => value.kind === "field")), false, "a scalar call is not a fabricated field write");
  assert.equal(Object.isFrozen(mutation) && Object.isFrozen(mutation.value) && Object.isFrozen(selected), true);
  assert.equal(storage.originsFor(original).kind, "resolved", "original identity remains at its actual independent storage owner");
  assert.equal(storage.originsFor(untouched).kind, "resolved", "the independent original storage still resolves");
  const unrelated = namedDeclaration(source.ast, provider, "unrelated");
  assert.equal(analyze(source, [{ signature: unrelated, sourceParameterIndex: 1 }], storage).mutationFor(invocation).kind,
    "not-applicable", "same-shaped foreign call identity is not the selected mutator");
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
    const invocation = source.navigation.nodes.find(node => source.ast.is.IsCallExpression(node) && source.ast.getSourceFile(node) !== provider);
    const selected = demand.mutationFor(invocation);
    assert.equal(selected.kind, "unresolved", "invalid selected mutation cannot manufacture writable evidence");
    assert.equal(Object.isFrozen(selected), true);
    assert.equal(demand.parameterFor(source.ast.parameters(signature)[1]).kind, "unresolved", "malformed protocol publishes no native formal");
    assert.equal(demand.fieldFor(invocation).kind, "unresolved", "malformed protocol cannot publish unrelated field evidence");
    assert.equal(query.originsFor(original).kind, "resolved", "a rejected Error protocol does not replace the independent original storage owner");
  }
});

test("Error carrier queries require the exact owning subject and reject removed Node signatures", async () => {
  const current = await checked("error-storage-canonical-subjects");
  const foreign = await checked("error-storage-canonical-foreign-subjects");
  const demand = analyze(current.source, [{ signature: current.signature, sourceParameterIndex: 1 }], current.storage);
  const invocation = current.source.navigation.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
    current.source.ast.getSourceFile(node) === current.file);
  const foreignInvocation = foreign.source.navigation.nodes.find(node => foreign.source.ast.is.IsCallExpression(node) &&
    foreign.source.ast.getSourceFile(node) === foreign.file);
  for (const subject of [foreignInvocation, foreign.original, { ...invocation }, undefined]) {
    for (const query of [demand.mutationFor, demand.fieldFor, demand.parameterFor]) {
      const selected = query(subject);
      assert.equal(selected.kind, "unresolved", "foreign or copied shapes cannot supply checked declaration ownership");
      assert.equal(Object.isFrozen(selected), true);
    }
  }
  assert.equal(demand.mutationFor(invocation).kind, "resolved", "rejected foreign subjects do not poison the exact checked selected call");
  assert.equal(demand.parameterFor(current.original.node).kind, "unresolved", "a storage binding cannot impersonate a formal slot");
  assert.equal(demand.mutationFor(current.untouched.node).kind, "not-applicable", "independent storage is not an invented mutation");
});

async function declarationProtocol(name) {
  const checked = await checkedSource(name, {
    "globals.d.ts": profile,
    "src/provider.ts": `
      export interface Stored { message: string; stack: string; }
      export declare function write<Value extends Stored>(first: Value, second: Value): void;
      export declare function unrelated(first: Stored, second: Stored): void;
      export declare function spread(...values: Stored[]): void;
      export declare class External { constructor(value: Stored); }
    `,
    "src/index.ts": `
      import { Stored, External, write, unrelated } from "./provider.js";
      type Readonly<Value> = { readonly [Key in keyof Value]: Value[Key] };
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
      export function localEffects(owner: Stored): string {
        const view: Readonly<Stored> = owner;
        const read = view.message;
        owner.message = "changed through the mutable alias";
        new External(owner);
        const deferred = () => { owner.message = "later"; };
        return read;
      }
      class Holder {
        value: Stored;
        constructor(value: Stored) { this.value = value; }
        inspect(owner: Stored): string {
          const read = owner.message;
          this.value.message = "receiver write";
          return read;
        }
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
  invalid.push({ ...current.protocol, scalarMutators: [null] },
    { ...current.protocol, fields: [null] },
    { ...current.protocol, constructors: [null] },
    { ...current.protocol, scalarMutators: foreign.protocol.scalarMutators },
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
  const readNode = nodes.find(node => source.ast.is.IsPropertyAccessExpression(node) &&
    source.ast.text(source.ast.as.AsPropertyAccessExpression(node).Expression) === "owner" &&
    source.ast.text(source.ast.name(node)) === "message");
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

test("checked Error local read and effect pairs retain readonly alias, opaque construction and deferred receiver safety", async () => {
  const { source, file, protocol } = await declarationProtocol("error-declaration-read-effect-pairs");
  const query = createSourceErrorDeclarationQuery(source, protocol);
  const local = namedDeclaration(source.ast, file, "localEffects");
  const nodes = [];
  const visit = node => { nodes.push(node); source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); }); };
  visit(source.ast.body(local));
  const readonlyRead = nodes.find(node => source.ast.is.IsPropertyAccessExpression(node) &&
    source.ast.text(source.ast.as.AsPropertyAccessExpression(node).Expression) === "view");
  const read = query.fieldFor(readonlyRead);
  assert.equal(read.kind, "resolved", "the readonly mapped view retains the original checked member");
  const mutableWrite = nodes.find(node => source.ast.is.IsExpressionStatement(node) &&
    source.ast.is.IsBinaryExpression(source.ast.as.AsExpressionStatement(node).Expression));
  assert.equal(query.invalidationFor(read.value, mutableWrite).kind, "invalidated",
    "readonly access is not immutable storage when its original alias writes");
  const construction = nodes.find(node => source.ast.is.IsNewExpression(node));
  assert.equal(query.invalidationFor(read.value, construction).kind, "invalidated",
    "the exact external constructor signature does not establish purity or preserve a live read");
  const deferred = nodes.find(node => source.ast.is.IsArrowFunction(node));
  assert.equal(query.invalidationFor(read.value, deferred).kind, "preserved",
    "creating a deferred callable does not execute its later field write");
  const holder = namedDeclaration(source.ast, file, "Holder");
  const method = source.ast.members(holder).find(node => source.ast.is.IsMethodDeclaration(node));
  const methodNodes = [];
  const collect = node => { methodNodes.push(node); source.ast.forEachChild(node, child => { if (child !== undefined) collect(child); }); };
  collect(source.ast.body(method));
  const receiverRead = methodNodes.find(node => source.ast.is.IsPropertyAccessExpression(node) &&
    source.ast.is.IsIdentifier(source.ast.as.AsPropertyAccessExpression(node).Expression) &&
    source.ast.text(source.ast.as.AsPropertyAccessExpression(node).Expression) === "owner");
  const selected = query.fieldFor(receiverRead);
  assert.equal(selected.kind, "resolved", "the receiver test contains its real original checked read");
  const receiverWrite = methodNodes.find(node => source.ast.is.IsBinaryExpression(node));
  assert.equal(query.invalidationFor(selected.value, receiverWrite).kind, "invalidated",
    "a distinct receiver expression is not proof that it cannot alias the observed native object");
});
