// JS API storage effects (D18): the storage rows of the one JS API table (api/table.ts), published as
// facts.profile.callStorage over the Host call selection (SourceCallSelection). The Host storage analysis admits a
// published effect only through the runtime binding the effect names (target-analysis global-call-effects.ts).
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/host.js";
import { Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createJsSourceApiFacts, jsSourceSemanticsIdentity } from "../../packages/js-source-profile/dist/index.js";
import { jsSourceApiEntry } from "../../packages/js-source-profile/dist/api/table.js";
import { nativeStorageOperationCheckedSource, nativeStorageVirtualOperationSource } from "../fixtures/native-storage-operation-authority.mjs";
import { namedVariable } from "../fixtures/source-navigation.mjs";

const errorOwners = ["ErrorConstructor", "RangeErrorConstructor", "TypeErrorConstructor", "URIErrorConstructor"];

/**
 * A profile over declarations of one source-profile file (`owner`: the profile directory segment, "js" or another
 * target's). `declaration(owner, kind, name?)` is a signature or member of the top-level interface `owner`.
 */
function structuralProfile(profileOwner) {
  const file = Object.freeze({ fileName: `/project/.tsonic/source-profiles/${profileOwner}/globals.d.ts` });
  const named = text => Object.freeze({ kind: "KindIdentifier", text });
  const interfaces = new Map();
  const ownerNode = name => {
    const known = interfaces.get(name);
    if (known !== undefined) return known;
    const node = Object.freeze({ kind: "KindInterfaceDeclaration", file, nameNode: named(name) });
    interfaces.set(name, node);
    return node;
  };
  const declarations = new Map();
  const declaration = (declaringName, kind, name) => {
    const key = `${declaringName}.${kind}.${name}`;
    const known = declarations.get(key);
    if (known !== undefined) return known;
    const node = Object.freeze({ kind, file, parent: ownerNode(declaringName), ...(name === undefined ? {} : { nameNode: named(name) }) });
    declarations.set(key, node);
    return node;
  };
  const ast = Object.freeze({
    kindName: node => node.kind, getSourceFile: node => node.file, getFileName: sourceFile => sourceFile.fileName,
    parent: node => node.parent ?? (node.kind === "KindInterfaceDeclaration" ? Object.freeze({ kind: "KindSourceFile" }) : undefined),
    name: node => node.nameNode, text: node => node.text, is: Object.freeze({ IsComputedPropertyName: () => false }),
  });
  const profile = createJsSourceApiFacts({
    ast, sourceFacts: { getFact: () => undefined, getFacts: () => [], getVirtualDeclarationDocument: () => undefined },
    wellKnownSymbol: () => undefined, presentArms: type => [type], typeofCategory: () => undefined,
  });
  return {
    profile,
    member: (declaringName, name) => declaration(declaringName, "KindMethodSignature", name),
    construct: declaringName => declaration(declaringName, "KindConstructSignature"),
    call: declaringName => declaration(declaringName, "KindCallSignature"),
  };
}

function selectedCall(signature, extra = {}) {
  return {
    use: Object.freeze({}),
    kind: "call",
    signature,
    arguments: [
      { argument: Object.freeze({}), argumentIndex: 1, effectiveIndex: 0, parameterIndex: 0, mode: "positional", form: "value" },
    ],
    ...extra,
  };
}

test("the storage rows: owned Error construction allocates, Object.freeze aliases, nothing else", () => {
  for (const ownerName of errorOwners) {
    const binding = ownerName.slice(0, -"Constructor".length);
    assert.deepEqual(jsSourceApiEntry(ownerName, "constructor")?.storage, { kind: "allocation", binding, nativeConstructor: true });
    assert.deepEqual(jsSourceApiEntry(ownerName, "call")?.storage, { kind: "allocation", binding, nativeConstructor: false });
    assert.equal(Object.isFrozen(jsSourceApiEntry(ownerName, "constructor")?.storage), true);
  }
  assert.deepEqual(jsSourceApiEntry("ObjectConstructor", "freeze")?.storage, { kind: "argument-alias", binding: "Object" });
  for (const [ownerName, memberName] of [["OtherConstructor", "constructor"], ["ErrorConstructor", "captureStackTrace"],
    ["Global", "Error"], ["ObjectConstructor", "isFrozen"], ["Object", "freeze"], ["Other", "freeze"], ["ObjectConstructor", "replace"]]) {
    assert.equal(jsSourceApiEntry(ownerName, memberName)?.storage, undefined, `${ownerName}.${memberName}`);
  }
});

for (const profileOwner of ["js", "native"]) test(`owned native Error construction publishes one exact fresh result (${profileOwner} profile)`, () => {
  const current = structuralProfile(profileOwner);
  for (const ownerName of errorOwners) {
    for (const [form, signature] of [["construct", current.construct(ownerName)], ["call", current.call(ownerName)]]) {
      const call = selectedCall(signature);
      const selected = current.profile.callStorage(call);
      assert.equal(selected?.declaration === signature, true, `${ownerName} ${form}: the selected signature`);
      assert.equal(selected.form, "value", `${ownerName} ${form}: the operation is the binding's own value`);
      assert.equal(selected.effect.resultAllocation === call.use, true, `${ownerName} ${form}: fresh result`);
      assert.equal(selected.effect.resultAlias === undefined, true);
      assert.equal(Object.hasOwn(selected.effect, "preservedInputs"), false, "allocation is not a native preservation assertion");
      assert.deepEqual(selected.binding, { name: ownerName.slice(0, -"Constructor".length), providerId: jsSourceSemanticsIdentity.providerId });
      assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.effect) && Object.isFrozen(selected.binding), true);
    }
    assert.equal(current.profile.callStorage(selectedCall(current.member(ownerName, "captureStackTrace"))), undefined);
  }
  assert.equal(current.profile.callStorage(selectedCall(current.construct("OtherConstructor"))), undefined,
    "no constructor behavior by spelling alone");
  const constructor = current.profile.nativeConstructorStorage(current.construct("ErrorConstructor"));
  assert.deepEqual(constructor?.binding, { name: "Error", providerId: jsSourceSemanticsIdentity.providerId });
  assert.equal(current.profile.nativeConstructorStorage(current.call("ErrorConstructor")), undefined, "a call signature does not construct");
});

test("owned freeze aliases its argument in the JS profile and asserts no native input preservation", () => {
  const current = structuralProfile("js");
  const call = selectedCall(current.member("ObjectConstructor", "freeze"));
  const freeze = current.profile.callStorage(call);
  assert.equal(freeze?.effect.resultAlias === call.arguments[0].argument, true);
  assert.equal(freeze.form, "member");
  assert.equal(freeze.declaration === call.signature, true);
  assert.deepEqual(freeze.binding, { name: "Object", providerId: jsSourceSemanticsIdentity.providerId });
  assert.equal(Object.hasOwn(freeze.effect, "preservedInputs"), false, "a source identity is not compiler-native mutability evidence");
  assert.equal(Object.isFrozen(freeze) && Object.isFrozen(freeze.effect), true);
  for (const [ownerName, memberName] of [["ObjectConstructor", "isFrozen"], ["Object", "freeze"], ["Other", "freeze"],
    ["ObjectConstructor", "replace"]]) {
    assert.equal(current.profile.callStorage(selectedCall(current.member(ownerName, memberName))), undefined, `${ownerName}.${memberName}`);
  }
  const native = structuralProfile("native");
  assert.equal(native.profile.callStorage(selectedCall(native.member("ObjectConstructor", "freeze"))), undefined,
    "another target's profile names a storage operation only for constructor and call signatures and native operations");
});

test("source effects require one positional value argument for their actual parameter", () => {
  const current = structuralProfile("js");
  const call = selectedCall(current.member("ObjectConstructor", "freeze"));
  const binding = call.arguments[0];
  for (const [label, selection] of [
    ["missing", { ...call, arguments: [] }],
    ["duplicate", { ...call, arguments: [binding, { ...binding, effectiveIndex: 1 }] }],
    ["other parameter", { ...call, arguments: [{ ...binding, parameterIndex: 1 }] }],
    ["spread sequence", { ...call, arguments: [{ ...binding, mode: "spread", form: "spread-sequence" }] }],
    ["spread element", { ...call, arguments: [{ ...binding, form: "spread-element", spreadElement: 0 }] }],
    ["rest", { ...call, arguments: [{ ...binding, mode: "rest-element" }] }],
  ]) {
    assert.equal(current.profile.callStorage(selection), undefined, label);
  }
});

for (const profileOwner of ["js", "native"]) test(`generator resume effects need the selected receiver (${profileOwner} profile)`, () => {
  const current = structuralProfile(profileOwner);
  for (const ownerName of ["Generator", "AsyncGenerator"]) {
    for (const memberName of ["next", "return"]) {
      const signature = current.member(ownerName, memberName);
      const resumed = current.profile.callStorage(selectedCall(signature, { receiver: Object.freeze({}) }));
      assert.equal(resumed?.form, "receiver", `${ownerName}.${memberName}`);
      assert.equal(resumed.effect.resumeReceiver, true);
      assert.equal(resumed.declaration === signature, true);
      assert.equal(current.profile.callStorage(selectedCall(signature)), undefined, "no receiver, no resumed receiver");
    }
    assert.equal(current.profile.callStorage(selectedCall(current.member(ownerName, "throw"), { receiver: Object.freeze({}) })),
      undefined, `${ownerName}.throw resumes nothing (it is a Host refusal)`);
  }
});

// Moved from tsonic-csharp test/policy/operations/source-storage-effects.test.mjs (FX-HS W2-B): the provider-binding
// authority of a virtual JS API operation is a Host fact. facts.profile identifies the operation by its provider
// declaration fact and names the binding it requires; the Host storage analysis admits the effect only when the call's
// receiver binding carries the matching provider global fact.
test("virtual native operation authority requires its matching provider-owned runtime binding", () => {
  const options = { profile: createJsSourceApiFacts, platform: { kind: "known", nativeIntegerBits: 64, basis: "js-source-profile test" } };
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export {};\n${nativeStorageVirtualOperationSource}`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the source fixture remains checked");
  const control = createTargetSourceProgram(checked, options);
  const file = control.sourceFiles.find(sourceFile => control.syntax.getFileName(sourceFile) === "/src/index.ts");
  assert.equal(file !== undefined, true);
  const frozen = Node_Initializer(control.syntax, namedVariable(control.syntax, file, "frozen"));
  const original = Node_Initializer(control.syntax, namedVariable(control.syntax, file, "original"));
  const selected = control.facts.selections.call(frozen);
  assert.equal(selected !== undefined && selected.kind !== "refused" && selected.receiver !== undefined, true,
    "exact checked virtual operation");
  const nodes = { signature: selected.signature, binding: control.facts.navigation.identity.target(selected.receiver)?.declaration };
  assert.equal(control.facts.profile.callStorage(selected), undefined, "without provider facts the declaration is no JS operation");

  const identity = { providerId: jsSourceSemanticsIdentity.providerId, providerVersion: "1",
    providerModuleId: "test.selected-js", moduleSpecifier: "@test/selected-js", artifactFileName: "/src/selected-js.d.ts",
    exportName: "ObjectConstructor", memberName: "freeze", memberKey: { kind: "property-key", name: "freeze" } };
  const global = { ...identity, exportName: "Object", memberName: undefined, memberKey: undefined };
  const authority = (operation, binding) => {
    const program = createTargetSourceProgram(nativeStorageOperationCheckedSource(checked, nodes, operation, binding), options);
    const call = program.facts.selections.call(frozen);
    assert.equal(call !== undefined && call.kind !== "refused", true);
    const storage = program.facts.analyses.storage({ sourceFiles: [file] });
    const subject = storage.subjectFor(frozen);
    assert.equal(subject.kind, "resolved", "the call result has its exact storage subject");
    const domain = storage.closedOriginsFor(subject.subject);
    assert.equal(storage.failureReason(), undefined, "one finite proof graph");
    return { call, published: program.facts.profile.callStorage(call), domain };
  };
  const requiresObjectBinding = (published, call, label) => {
    assert.equal(published?.effect.resultAlias === call.arguments[0].argument, true, `${label}: the operation aliases its argument`);
    assert.equal(published.form, "member", label);
    assert.equal(published.declaration === nodes.signature, true, label);
    assert.deepEqual(published.binding, { name: "Object", providerId: jsSourceSemanticsIdentity.providerId },
      `${label}: the profile names the runtime binding the effect requires`);
  };
  for (const operation of [identity, { ...identity, memberName: undefined }, { ...identity, memberKey: undefined },
    { ...identity, memberName: "assign" }]) {
    const { call, published, domain } = authority(operation, global);
    requiresObjectBinding(published, call, "matching binding");
    assert.equal(domain.kind === "complete" && domain.origins.length === 1 && domain.origins[0].subject.node === original &&
      domain.origins[0].subject.projection.length === 0, true,
    "exact selected provider member and actual binding jointly supply native authority");
  }
  for (const binding of [undefined, { ...global, exportName: "Other" }, { ...global, providerId: "foreign-provider" },
    { ...global, providerModuleId: "other-module" }, { ...global, signatureId: "not-a-global" }]) {
    const { call, published, domain } = authority(identity, binding);
    requiresObjectBinding(published, call, "foreign binding");
    assert.equal(domain.kind, "open", "a selected virtual signature cannot certify a foreign binding");
  }
});
