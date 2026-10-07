import assert from "node:assert/strict";
import test from "node:test";
import { argumentPassingFactKey, createCompilerSessionFromFiles, flowStateFactKey, formatDiagnostics, providerVirtualDeclarationFactKey } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceGlobalCallStorageEffects, createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { selectJsSourceCallStorageEffect, sourceErrorDeclarations } from "../../packages/js-source-profile/dist/index.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile, requiredNode } from "../fixtures/source-navigation.mjs";

const globals = `
interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
interface Number {} interface String {} interface RegExp {}
interface Array<T> { [index: number]: T; length: number; }
interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
declare const Symbol: { readonly iterator: unique symbol };
interface Iterator<T> { next(): { value: T; done?: boolean }; }
`;

async function fixture(name, body, options = {}) {
  const checked = await checkedSource(name, { "globals.d.ts": `${globals}${options.profile ?? ""}`, "src/index.ts": `export {}; ${body}` },
    { sourceCore: options.sourceCore === true });
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  assert.equal(checked.extensionDiagnostics.length === 0, true, "exact source facts admitted");
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, options.limits ?? defaultSourceStorageLimits,
    options.effectsFactory === undefined ? options.effects : options.effectsFactory(source, file));
  const subject = node => {
    const selected = storage.subjectFor(node);
    assert.equal(selected.kind === "resolved", true, "exact graph-owned subject");
    return selected.subject;
  };
  const variable = name => namedVariable(source.ast, file, name);
  const initializer = name => source.ast.as.AsVariableDeclaration(variable(name)).Initializer;
  const selection = name => storage.closedOriginsFor(subject(variable(name)));
  return { source, file, storage, subject, variable, initializer, selection };
}

function complete(selected, label) {
  assert.equal(selected.kind === "complete", true, label);
  assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.origins) && selected.origins.every(Object.isFrozen), true);
  assert.equal(selected.origins.length > 0, true, "nonempty exact origin proof");
  return selected.origins;
}

function open(selected, kind, label) {
  assert.equal(selected.kind === "open", true, label);
  assert.equal(selected.boundaries.some(boundary => boundary.kind === kind), true, label);
  assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.boundaries) && selected.boundaries.every(Object.isFrozen), true);
}

test("complete domains preserve private arrows, immutable aliases and known private callback transport", async () => {
  const current = await fixture("storage-domain-private-callback", `
    const callback = (value: {}): {} => value;
    const alias = callback;
    function apply(fn: (value: {}) => {}): {} { return fn({}); }
    const direct = callback({});
    const indirect = apply(alias);
  `);
  const arrow = current.initializer("callback");
  complete(current.storage.closedOriginsFor(current.subject(current.source.ast.parameters(arrow)[0])), "closed private formal");
  complete(current.selection("direct"), "direct invocation");
  complete(current.selection("indirect"), "known callback implementation");
});

test("exported immutable value identity stays closed while exported mutable storage stays open", async () => {
  const current = await fixture("storage-domain-exported-storage", `
    const original = {};
    export const fixed: {} = original;
    export let writable: {} = original;
  `);
  complete(current.selection("original"), "publication does not replace the original identity");
  complete(current.selection("fixed"), "immutable exported binding");
  open(current.selection("writable"), "external-write", "unknown external slot writer");
});

test("observed origin contracts do not change when an external formal receives one known local input", async () => {
  const current = await fixture("storage-domain-observed-invariance", `
    export function accept(value: {}): {} { return value; }
    const input = {};
    const output = accept(input);
  `);
  const callable = namedDeclaration(current.source.ast, current.file, "accept");
  const formal = current.subject(current.source.ast.parameters(callable)[0]);
  const before = current.storage.originsFor(formal);
  assert.equal(before.kind === "resolved" && before.origins.length === 1, true);
  open(current.storage.closedOriginsFor(formal), "external-input", "external callers are additional possible inputs");
  const after = current.storage.originsFor(formal);
  assert.equal(after.kind === "resolved" && after.origins.length === before.origins.length &&
    after.origins.every((origin, index) => origin.subject === before.origins[index].subject), true, "unchanged observed roots");
  complete(current.selection("output"), "checked actual invocation closes its formal");
});

test("generic invocation bindings retain mutable actual provenance before identical root normalization", async () => {
  const current = await fixture("storage-domain-binding-provenance", `
    export function identity<T>(value: T): T { return value; }
    const original = {};
    export let exposed: {} = original;
    const good = identity(original);
    const bad = identity(exposed);
  `);
  const identity = namedDeclaration(current.source.ast, current.file, "identity");
  const formal = current.subject(current.source.ast.parameters(identity)[0]);
  const good = current.storage.bindingsForInvocation(identity, current.initializer("good"));
  const bad = current.storage.bindingsForInvocation(identity, current.initializer("bad"));
  assert.equal(good.kind === "resolved" && bad.kind === "resolved" && good.bindings !== bad.bindings, true, "provenance participates in interning");
  const observedGood = current.storage.boundOriginsFor(formal, good.bindings);
  const observedBad = current.storage.boundOriginsFor(formal, bad.bindings);
  assert.equal(observedGood.kind === "resolved" && observedBad.kind === "resolved" &&
    observedGood.subjects.length === 1 && observedBad.subjects[0] === observedGood.subjects[0], true, "same observed leaf, different completeness");
  complete(current.storage.closedOriginsFor(formal, good.bindings), "closed actual");
  open(current.storage.closedOriginsFor(formal, bad.bindings), "external-write", "actual exposure is not discharged by binding");
  complete(current.selection("good"), "automatic checked call context");
  open(current.selection("bad"), "external-write", "call result carries actual exposure");
});

test("private record and tuple projections retain exact origins through generic identity", async () => {
  const current = await fixture("storage-domain-container-projection", `
    export function identity<T>(value: T): T { return value; }
    const record = { token: {} };
    const local = record.token;
    const entries: [{}, {}] = [{}, {}];
    const returned = identity(entries);
    const selected = returned[0];
  `);
  complete(current.selection("local"), "private record component");
  const origins = complete(current.selection("selected"), "generic tuple projection");
  assert.equal(origins.every(origin => current.source.ast.is.IsObjectLiteralExpression(origin.subject.node)), true, "exact selected literal roots");
});

test("public identity returns do not expose private observed arguments or callbacks to external callers", async () => {
  const current = await fixture("storage-domain-private-identity-actual", `
    export function identity<T>(value: T): T { return value; }
    export function recordIdentity(value: { token: {} }): { token: {} } { return value; }
    const callback = (value: {}): {} => value;
    const privateAlias = identity(callback);
    const callbackResult = privateAlias({});
    const record = { token: {} };
    const alias = recordIdentity(record);
    const selected = record.token;
  `);
  const callback = current.initializer("callback");
  complete(current.storage.closedOriginsFor(current.subject(current.source.ast.parameters(callback)[0])), "private callback is not returned to other callers");
  complete(current.selection("callbackResult"), "closed exact selected callback invocation");
  complete(current.selection("selected"), "private actual record is not exposed by public identity return");
});

test("an actual stored into exported storage is exposed even when transferred through a public formal", async () => {
  const current = await fixture("storage-domain-public-slot-transfer", `
    export let slot: { token: {} } | null = null;
    export function store(value: { token: {} }): void { slot = value; }
    const record = { token: {} };
    store(record);
    const selected = record.token;
  `);
  open(current.selection("selected"), "external-write", "known actual is published through the public slot");
});

test("getter result domains require the selected receiver rather than only locally observed implementations", async () => {
  const current = await fixture("storage-domain-accessor-receiver", `
    class Base { get value(): {} { return {}; } }
    class Other extends Base { get value(): {} { return 3; } }
    export function read(owner: Base): {} { return owner.value; }
    const first = read(new Base());
    const second = read(new Other());
  `);
  const read = namedDeclaration(current.source.ast, current.file, "read");
  const returned = current.storage.subject(read, "return");
  assert.equal(returned.kind === "resolved", true);
  open(current.storage.closedOriginsFor(returned.subject), "external-input", "external receiver selects unknown override domain");
  const first = complete(current.selection("first"), "exact first receiver");
  const second = complete(current.selection("second"), "exact override receiver");
  assert.equal(first.every(origin => current.source.ast.is.IsObjectLiteralExpression(origin.subject.node)), true, "first receiver literal");
  assert.equal(second.every(origin => current.source.ast.is.IsNumericLiteral(origin.subject.node)), true, "override numeric literal");
});

test("exported and returned mutable container members remain open even through immutable aliases", async () => {
  const current = await fixture("storage-domain-escaped-members", `
    export const publicBox: { token: {} } = { token: {} };
    const publicAlias = publicBox;
    const publicValue = publicAlias.token;
    class Box { token: {} = {}; }
    const privateBox = new Box();
    export function expose(): Box { return privateBox; }
    const escaped = privateBox.token;
  `);
  complete(current.selection("publicBox"), "container identity is not replaced by member mutation");
  open(current.selection("publicValue"), "external-write", "exported container field");
  open(current.selection("escaped"), "external-write", "returned object field");
});

test("readonly storage is shallow and a readonly view cannot erase a writable producer", async () => {
  const current = await fixture("storage-domain-shallow-readonly", `
    class Fixed { readonly token: {} = {}; }
    export const fixed = new Fixed();
    const stable = fixed.token;
    export const nested: { readonly inner: { token: {} } } = { inner: { token: {} } };
    const mutableDescendant = nested.inner.token;
    const source = { token: {} };
    export const view: { readonly token: {} } = source;
    const erased = source.token;
  `);
  complete(current.selection("stable"), "genuine readonly field");
  open(current.selection("mutableDescendant"), "external-write", "readonly ancestor does not freeze descendant storage");
  open(current.selection("erased"), "external-write", "readonly projection does not remove producer mutability");
});

test("direct readonly allocation storage remains closed while independently mutable aliases reopen its slots", async () => {
  const current = await fixture("storage-domain-literal-storage-permissions", `
    export const fixed: { readonly token: {} } = { token: {} };
    const selected = fixed.token;
    const original: { readonly token: {} } = { token: {} };
    export const writable: { token: {} } = original;
    const exposed = original.token;
  `);
  complete(current.selection("selected"), "direct authored readonly storage is not an inferred mutable producer");
  open(current.selection("exposed"), "external-write", "independent mutable view still exposes the same allocation slot");
});

test("external array element writes reach the original tuple storage through a public array view", async () => {
  const current = await fixture("storage-domain-public-array", `
    const tuple: [{}, {}] = [{}, {}];
    export const publicView: {}[] = tuple;
    const selected = tuple[0];
  `);
  open(current.selection("selected"), "external-write", "array publication exposes tuple elements");
});

test("unknown callback dispatch stays open globally but closes under the selected private invocation", async () => {
  const current = await fixture("storage-domain-dynamic-callee", `
    export function run(callback: () => {}): {} { return callback(); }
    const local = run(() => ({}));
  `);
  const run = namedDeclaration(current.source.ast, current.file, "run");
  const result = current.storage.subject(run, "return");
  assert.equal(result.kind === "resolved", true);
  open(current.storage.closedOriginsFor(result.subject), "external-input", "unknown external callback implementations");
  complete(current.selection("local"), "actual selected callback");
});

test("opaque calls open writable contained storage without replacing the original immutable identity", async () => {
  const current = await fixture("storage-domain-opaque-write", `
    declare function outside(value: { token: {} }): void;
    const value = { token: {} };
    outside(value);
    const selected = value.token;
  `);
  complete(current.selection("value"), "by-value input cannot replace caller binding");
  open(current.selection("selected"), "opaque-write", "unobserved contained mutation");
});

test("opaque mutable borrows preserve the exact fact-owned original storage location", async () => {
  const current = await fixture("storage-domain-opaque-borrow", `
    import { mutableborrow } from "@tsonic/core/lang.js";
    declare function outside(value: {}): void;
    let token: {} = {};
    outside(mutableborrow(token));
  `, { sourceCore: true });
  const borrow = requiredNode(current.source.ast, current.file, node => current.source.ast.is.IsCallExpression(node) &&
    current.source.ast.text(current.source.ast.as.AsCallExpression(node).Expression) === "mutableborrow");
  assert.equal(current.source.sourceFacts.getFact(current.source.ast.arguments(borrow)[0], flowStateFactKey)?.state === "borrowed-mut", true,
    "real mutable borrow evidence on the exact underlying source input");
  open(current.selection("token"), "opaque-write", "exact borrowed storage, not only wrapper result");
});

test("opaque byref writes use the exact fact-owned source storage without expression reconstruction", async () => {
  const current = await fixture("storage-domain-opaque-byref", `
    import { readwriteref } from "@tsonic/core/lang.js";
    declare function outside(value: {}): void;
    let token: {} = {};
    outside(readwriteref(token));
  `, { sourceCore: true });
  const passing = requiredNode(current.source.ast, current.file, node => current.source.ast.is.IsCallExpression(node) &&
    current.source.ast.text(current.source.ast.as.AsCallExpression(node).Expression) === "readwriteref");
  assert.equal(current.source.sourceFacts.getFact(passing, argumentPassingFactKey)?.storageExpression !== undefined, true, "genuine exact checked byref storage fact");
  open(current.selection("token"), "opaque-write", "underlying byref storage remains externally writable");
});

test("checked construction result closure is separate from fresh allocation, opaque calls and constructor dispatch", async () => {
  const current = await fixture("storage-domain-native-construction", `
    declare class Native { constructor(); readonly token: {}; }
    declare class Other { constructor(); readonly token: {}; }
    declare function allocate(): Native;
    declare function outside(): Native;
    export function construct(factory: new () => Native): Native { return new factory(); }
    export let mutableConstructor: new () => Native = Native;
    const direct = new Native();
    const allocatedCall = allocate();
    const arbitraryNative = new Other();
    const opaqueResult = outside();
    const dynamic = new mutableConstructor();
    const selected = construct(Native);
  `, { effectsFactory(source, file) {
    const native = namedDeclaration(source.ast, file, "Native");
    const constructor = source.ast.members(native).find(node => source.ast.is.IsConstructorDeclaration(node));
    const allocation = namedDeclaration(source.ast, file, "allocate");
    return { call(node, selected) {
      const declaration = source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature);
      return declaration === constructor || declaration === allocation ? { resultAllocation: selected.call } : undefined;
    } };
  } });
  const direct = complete(current.selection("direct"), "explicit native allocation contribution");
  assert.equal(direct.length === 1 && current.source.ast.is.IsNewExpression(direct[0].subject.node), true, "exact contribution-owned construction occurrence");
  complete(current.selection("allocatedCall"), "certified native call-form allocation");
  open(current.selection("arbitraryNative"), "opaque-result", "arbitrary native constructor may reuse an aliased result");
  open(current.selection("opaqueResult"), "opaque-result", "ordinary opaque function does not prove result origin");
  open(current.selection("dynamic"), "external-write", "unknown constructor slot selections");
  const construct = namedDeclaration(current.source.ast, current.file, "construct");
  const returned = current.storage.subject(construct, "return");
  assert.equal(returned.kind === "resolved", true);
  open(current.storage.closedOriginsFor(returned.subject), "external-input", "unknown external constructor formal");
  open(current.selection("selected"), "opaque-result", "a bound native constructor does not invent an allocation effect");
});

test("source constructor returns retain contextual result transport and opaque input mutation", async () => {
  const current = await fixture("storage-domain-constructor-return", `
    const existing = {};
    class Reuse { constructor() { return existing; } }
    const reused = new Reuse();
    declare class Opaque { constructor(value: { token: {} }); }
    const container = { token: {} };
    const native = new Opaque(container);
    const selected = container.token;
  `);
  const reused = complete(current.selection("reused"), "checked constructor body result transport");
  assert.equal(reused.some(origin => current.source.ast.is.IsObjectLiteralExpression(origin.subject.node)), true,
    "constructor occurrence alone cannot justify universal physical allocation roots");
  open(current.selection("native"), "opaque-result", "uncertified opaque constructor result");
  open(current.selection("selected"), "opaque-write", "construction does not certify argument preservation");
});

test("owned native Error call and constructor allocations do not certify external values with the same signatures", async () => {
  const current = await fixture("storage-domain-owned-constructor-authority", `
    declare const external: typeof Error;
    const alias = Error;
    const direct = new Error("direct");
    const call = Error("call");
    const aliased = new alias("alias");
    const aliasedCall = alias("alias-call");
    const unknown = new external("unknown");
    export function fromType(factory: typeof Error): Error { return new factory("external"); }
    export function fromInterface(factory: ErrorConstructor): Error { return factory("external-call"); }
  `, { profile: sourceErrorDeclarations, effectsFactory(source) {
    const profile = projectSourceFile(source, "globals.d.ts");
    const owner = namedDeclaration(source.ast, profile, "ErrorConstructor");
    const signatures = new Set(source.ast.members(owner));
    return createSourceGlobalCallStorageEffects(source, (node, selected) => {
      const declaration = source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature);
      if (!signatures.has(declaration)) return undefined;
      return selectJsSourceCallStorageEffect({ ownerName: "ErrorConstructor", memberName: source.ast.is.IsNewExpression(node) ? "constructor" : "call", declaration }, selected);
    });
  } });
  for (const name of ["direct", "call", "aliased", "aliasedCall"]) complete(current.selection(name), `owned global native allocation: ${name}`);
  open(current.selection("unknown"), "external-input", "an ambient external value is not the owned native constructor");
  for (const name of ["fromType", "fromInterface"]) {
    const callable = namedDeclaration(current.source.ast, current.file, name);
    const returned = current.storage.subject(callable, "return");
    assert.equal(returned.kind === "resolved", true);
    open(current.storage.closedOriginsFor(returned.subject), "external-input", `unknown caller constructor value: ${name}`);
  }
});

test("call result aliases and input preservation remain independent semantic proofs", async () => {
  for (const mode of ["alias", "preserve", "both"]) {
    const current = await fixture(`storage-domain-effects-${mode}`, `
      declare function operation(value: { token: {} }): { token: {} };
      const value = { token: {} };
      const result = operation(value);
      const selected = value.token;
    `, { effects: { call: (_node, selected) => ({
      ...(mode === "preserve" ? {} : { resultAlias: selected.sourceArguments[0].expression }),
      ...(mode === "alias" ? {} : { preservedInputs: [selected.sourceArguments[0].expression] }),
    }) } });
    if (mode === "preserve") open(current.selection("result"), "opaque-result", "preservation does not prove result identity");
    else complete(current.selection("result"), "checked exact alias");
    if (mode === "alias") open(current.selection("selected"), "opaque-write", "alias does not prove preservation");
    else complete(current.selection("selected"), "exact input preservation");
  }
});

test("owned native global members require their actual immutable receiver and selected declaration", async () => {
  const profile = `
    interface ObjectConstructor { freeze<T>(value: T): T; isFrozen(value: {}): boolean; }
    declare var Object: ObjectConstructor;
  `;
  const selectEffects = source => {
    const owner = namedDeclaration(source.ast, projectSourceFile(source, "globals.d.ts"), "ObjectConstructor");
    const members = new Set(source.ast.members(owner));
    return createSourceGlobalCallStorageEffects(source, (node, selected) => {
      const declaration = source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature);
      return !members.has(declaration) ? undefined : selectJsSourceCallStorageEffect({ ownerName: "ObjectConstructor",
        memberName: source.ast.text(source.ast.name(declaration)), declaration }, selected);
    });
  };
  const current = await fixture("storage-domain-global-members", `
    declare const external: ObjectConstructor;
    const owner = Object;
    const freeze = owner.freeze;
    const token = {};
    const direct = Object.freeze(token);
    const aliased = owner.freeze(token);
    const method = freeze(token);
    const indexed = Object["freeze"](token);
    const unknown = external.freeze({});
  `, { profile, effectsFactory: selectEffects });
  for (const name of ["direct", "aliased", "method", "indexed"])
    complete(current.selection(name), `exact global member identity: ${name}`);
  open(current.selection("unknown"), "opaque-result", "matching member signature does not prove the global receiver");
  const changed = await fixture("storage-domain-global-members-mutated", `
    declare const external: ObjectConstructor;
    const owner = Object;
    owner.freeze = external.freeze;
    const selected = Object.freeze({});
  `, { profile, effectsFactory: selectEffects });
  open(changed.selection("selected"), "opaque-result", "mutated receiver is not a native-operation guarantee");
});

test("native global effects reject foreign provider artifacts and operation declarations independently", async () => {
  const current = await fixture("storage-domain-global-provider-authority", `const selected = new Error("message");`,
    { profile: sourceErrorDeclarations });
  const { source } = current;
  const node = current.initializer("selected");
  const call = source.semantics.forNode(node).operations.call(node);
  assert.equal(call !== undefined, true);
  const declaration = source.semantics.forNode(node).declarations.signatureDeclaration(call.selectedSignature);
  const binding = namedVariable(source.ast, projectSourceFile(source, "globals.d.ts"), "Error");
  const artifact = { providerId: "selected-profile", providerVersion: "1", providerModuleId: "globals",
    moduleSpecifier: "@profile/globals", artifactFileName: "/virtual/globals.d.ts" };
  const operation = { ...artifact, exportName: "ErrorConstructor", memberName: "new", signatureId: "selected" };
  const global = { ...artifact, exportName: "Error" };
  const effects = (globalFact, operationDeclaration = declaration) => createSourceGlobalCallStorageEffects({ ...source,
    sourceFacts: { ...source.sourceFacts, getFact(subject, key) {
      if (key !== providerVirtualDeclarationFactKey) return source.sourceFacts.getFact(subject, key);
      return subject === declaration ? operation : subject === binding ? globalFact : undefined;
    } },
  }, () => ({ declaration: operationDeclaration, binding: { name: "Error", providerId: artifact.providerId },
    form: "value", effect: { resultAllocation: node } }));
  assert.equal(effects(global).call(node, call).resultAllocation === node, true);
  assert.equal(effects(global, binding).call(node, call) === undefined, true, "the selected operation declaration is authoritative");
  for (const field of ["providerId", "providerVersion", "providerModuleId", "moduleSpecifier", "artifactFileName", "exportName"])
    assert.equal(effects({ ...global, [field]: "different" }).call(node, call) === undefined, true, field);
  for (const field of ["memberName", "memberKey", "memberId", "signatureId"])
    assert.equal(effects({ ...global, [field]: "member" }).call(node, call) === undefined, true, field);
  assert.equal(effects(undefined).call(node, call) === undefined, true, "missing owned global fact");
});

test("one preserved input does not suppress a second unpreserved alias", async () => {
  const current = await fixture("storage-domain-effects-other-alias", `
    declare function operation(first: { token: {} }, second: { token: {} }): {};
    const value = { token: {} };
    operation(value, value);
    const selected = value.token;
  `, { effects: { call: (_node, selected) => ({ preservedInputs: [selected.sourceArguments[0].expression] }) } });
  open(current.selection("selected"), "opaque-write", "other occurrence retains independent exposure");
});

test("external readonly member inputs remain unknown independently of member write permissions", async () => {
  const current = await fixture("storage-domain-readonly-external-formal", `
    export function inspect(owner: { readonly token: {} }): {} { return owner.token; }
    const original = { token: {} };
    export let slot: { readonly token: {} } = { token: {} };
    const direct = inspect(original);
    const exposed = inspect(slot);
  `);
  const inspect = namedDeclaration(current.source.ast, current.file, "inspect");
  const returned = current.storage.subject(inspect, "return");
  assert.equal(returned.kind === "resolved", true);
  open(current.storage.closedOriginsFor(returned.subject), "external-input", "readonly does not determine external caller's member value");
  complete(current.selection("direct"), "checked private actual discharges external-input through its owning formal");
  open(current.selection("exposed"), "external-write", "bound member closure retains raw actual storage provenance");
});

test("allocation effects do not certify unknown external callable dispatch or argument mutation", async () => {
  const current = await fixture("storage-domain-allocation-independent-boundaries", `
    declare function allocate(value: { token: {} }): {};
    export function run(factory: () => {}): {} { return factory(); }
    const value = { token: {} };
    const allocated = allocate(value);
    const selected = value.token;
  `, { effects: { call: (_node, selected) => ({ resultAllocation: selected.call }) } });
  complete(current.selection("allocated"), "known contributed allocation result");
  open(current.selection("selected"), "opaque-write", "allocation does not preserve argument contents");
  const run = namedDeclaration(current.source.ast, current.file, "run");
  const returned = current.storage.subject(run, "return");
  assert.equal(returned.kind === "resolved", true);
  open(current.storage.closedOriginsFor(returned.subject), "external-input", "allocation contribution does not close callable dispatch");
});

test("nested readonly member correspondence carries the exact bound formal and actual provenance", async () => {
  const current = await fixture("storage-domain-nested-member-provenance", `
    export function read(owner: { readonly inner: { readonly token: {} } }): {} { return owner.inner.token; }
    const original = { inner: { token: {} } };
    export let slot: { readonly inner: { readonly token: {} } } = { inner: { token: {} } };
    const direct = read(original);
    const exposed = read(slot);
  `);
  const read = namedDeclaration(current.source.ast, current.file, "read");
  const returned = current.storage.subject(read, "return");
  assert.equal(returned.kind === "resolved", true);
  open(current.storage.closedOriginsFor(returned.subject), "external-input", "nested readonly does not prove an external input domain");
  complete(current.selection("direct"), "exact checked nested member relationship");
  open(current.selection("exposed"), "external-write", "nested raw actual preserves its external storage boundary");
});

test("carrier completeness does not claim that heterogeneous origins all use EmptyObject", async () => {
  const current = await fixture("storage-domain-heterogeneous", `
    const values: {}[] = [{}, 3];
    const selected = values[0];
  `);
  const origins = complete(current.selection("selected"), "closed finite domain");
  assert.equal(origins.length === 2 && origins.some(origin => !current.source.ast.is.IsObjectLiteralExpression(origin.subject.node)), true,
    "consumer must still check every exact native carrier");
});

test("complete-domain ownership rejects forged and foreign binding or subject selections", async () => {
  const first = await fixture("storage-domain-first-owner", `function identity<T>(value: T): T { return value; } const value = identity({});`);
  const second = await fixture("storage-domain-second-owner", `function identity<T>(value: T): T { return value; } const value = identity({});`);
  const identity = namedDeclaration(first.source.ast, first.file, "identity");
  const selected = first.storage.bindingsForInvocation(identity, first.initializer("value"));
  assert.equal(selected.kind === "resolved", true);
  const formal = first.subject(first.source.ast.parameters(identity)[0]);
  assert.equal(first.storage.closedOriginsFor(formal, Object.freeze({ substitutions: selected.bindings.substitutions })).kind === "unresolved", true);
  assert.equal(second.storage.closedOriginsFor(second.subject(second.variable("value")), selected.bindings).kind === "unresolved", true);
  assert.equal(first.storage.closedOriginsFor(second.subject(second.variable("value"))).kind === "unresolved", true);
  assert.equal(first.storage.closedOriginsFor(Object.freeze({ ...formal })).kind === "unresolved", true);
});

test("complete domains retain finite budget rejection and malformed limit selection rejection", async () => {
  for (const limits of [
    { ...defaultSourceStorageLimits, maximumSteps: 1 },
    { ...defaultSourceStorageLimits, maximumTransportRows: 1 },
    { ...defaultSourceStorageLimits, maximumSteps: Infinity },
    { ...defaultSourceStorageLimits, maximumNodes: 0 },
  ]) {
    const current = await fixture("storage-domain-bounded-selection", "const token = {};", { limits });
    const selected = current.storage.subjectFor(current.variable("token"));
    const result = selected.kind === "unresolved" ? selected : current.storage.closedOriginsFor(selected.subject);
    assert.equal(result.kind === "unresolved" && current.storage.failureReason() !== undefined, true, "graph and query accounting both fail closed");
  }
});

test("complete domains distinguish exported readonly class values from externally writable class slots", async () => {
  const current = await fixture("storage-domain-exported-classes", `
    export class Holder { readonly value: {} = {}; }
    export class Mutable { value: {} = {}; }
    const holder = new Holder();
    const mutable = new Mutable();
    const fixed = holder.value;
    const exposed = mutable.value;
  `);
  complete(current.selection("fixed"), "exported readonly member keeps its exact source initializer");
  open(current.selection("exposed"), "external-write", "exported writable class slot accepts external replacement");
});

test("default-library recursive callback publication stays finite without poisoning observed origins", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    export function escaped(seed: number): (count: number) => number {
      let selected = (count: number): number => count === 0 ? seed : selected(count - 1);
      const before = selected;
      selected = (count: number): number => count === 0 ? 2 : selected(count - 1);
      return before;
    }
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "unchanged recursive callback source is checked");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, [file]);
  const selection = storage.storageSubjectFor(namedVariable(source.ast, file, "selected"));
  assert.equal(selection.kind === "resolved", true);
  complete(storage.closedOriginsFor(selection.subject), "recursive callback identity has a finite complete domain");
  assert.equal(storage.originsFor(selection.subject).kind === "resolved" && storage.failureReason() === undefined, true,
    "complete query leaves observed origins and default finite accounting valid");
});

test("recursive contextual transport converges without inventing an original root or exhausting the graph", async () => {
  const current = await fixture("storage-domain-context-cycle", `
    function recurse<T>(value: T): T { return recurse(value); }
    const output = recurse({});
  `, { limits: { ...defaultSourceStorageLimits, maximumSteps: 2048 } });
  const result = current.selection("output");
  assert.equal(result.kind === "unresolved" && current.storage.failureReason() === undefined, true, "a converged rootless cycle fails closed without poisoning the graph");
  assert.equal(current.storage.subjectFor(current.initializer("output")).kind === "resolved", true, "other graph queries remain usable");
});

test("recursive and mutually recursive invocation contexts retain exact actual locations and source roots", async () => {
  const current = await fixture("storage-domain-recursive-actual-context", `
    function recurse<T>(value: T, count: number): T { return count === 0 ? value : recurse(value, count - 1); }
    function first<T>(value: T, again: boolean): T { return again ? second(value, false) : value; }
    function second<T>(value: T, again: boolean): T { return again ? first(value, false) : value; }
    const original = {};
    export let exposed: {} = original;
    const direct = recurse(original, 3);
    const mutual = first(original, true);
    const external = first(exposed, true);
  `);
  const origin = current.subject(current.initializer("original"));
  for (const name of ["direct", "mutual"]) {
    const selected = complete(current.selection(name), `finite exact recursive domain: ${name}`);
    assert.equal(selected.length === 1 && selected[0].subject === origin, true, "only the checked invocation's source root");
  }
  open(current.selection("external"), "external-write", "recursive forwarding cannot erase raw external storage provenance");
  assert.equal(current.storage.failureReason() === undefined, true, "finite context fixed point keeps independent accounting valid");
});

test("recursive formal forwarding preserves opaque location writes and captured container input context", async () => {
  const current = await fixture("storage-domain-recursive-forwarded-location", `
    import { mutableborrow } from "@tsonic/core/lang.js";
    declare function outside(value: {}): void;
    function recurse(value: {}, again: boolean): {} {
      outside(mutableborrow(value));
      return again ? recurse(value, false) : value;
    }
    function boxed<T>(value: T): { readonly token: T } { return { token: value }; }
    function nested<T>(value: T): () => T { return () => value; }
    const original = {};
    export let exposed: {} = original;
    const changed = recurse(original, true);
    const container = boxed(exposed);
    const contained = container.token;
    const callback = nested(exposed);
    const captured = callback();
  `, { sourceCore: true });
  open(current.selection("changed"), "opaque-write", "forwarded formal storage still has its exact opaque mutable boundary");
  open(current.selection("contained"), "external-write", "allocation member input retains parent invocation context");
  open(current.selection("captured"), "external-write", "returned callable capture retains exact external actual");
  assert.equal(current.storage.failureReason() === undefined, true, "all independent proofs stay bounded");
});

test("selected invocation receivers exclude unrelated overrides while preserving each generic actual receiver", async () => {
  const current = await fixture("storage-domain-invocation-receiver-identity", `
    function run(): void {
      class Base { value(): number { return 1; } }
      class Derived extends Base { override value(): number { return 2; } }
      function invoke<T extends Base>(owner: T): number { return owner.value(); }
      const owner: Base = new Base();
      const other: Base = new Derived();
      const direct = owner.value();
      const different = other.value();
      const first = invoke(new Base());
      const second = invoke(new Derived());
    }
  `);
  const base = namedDeclaration(current.source.ast, current.file, "Base");
  const derived = namedDeclaration(current.source.ast, current.file, "Derived");
  const method = declaration => current.source.ast.members(declaration).find(node => current.source.ast.is.IsMethodDeclaration(node));
  for (const [name, expected] of [["direct", base], ["different", derived]]) {
    const selected = current.storage.invocationImplementationsFor(current.initializer(name), current.storage.emptyBindings);
    assert.equal(selected.kind === "resolved" && selected.nodes.length === 1 && selected.nodes[0] === method(expected), true,
      `exact concrete receiver: ${name}`);
  }
  const invoke = namedDeclaration(current.source.ast, current.file, "invoke");
  const nested = requiredNode(current.source.ast, invoke, node => current.source.ast.is.IsCallExpression(node));
  for (const [name, expected] of [["first", base], ["second", derived]]) {
    const bindings = current.storage.bindingsForInvocation(invoke, current.initializer(name));
    assert.equal(bindings.kind === "resolved", true, "exact generic invocation bindings");
    const selected = current.storage.invocationImplementationsFor(nested, bindings.bindings);
    assert.equal(selected.kind === "resolved" && selected.nodes.length === 1 && selected.nodes[0] === method(expected), true,
      `exact bound generic receiver: ${name}`);
  }
});

test("native method definitions remain original values through reciprocal checked structural transport", async () => {
  const current = await fixture("storage-domain-method-definition-origin", `
    class Base {
      choose(other: Base): this { return other as this; }
      echo(value: number): number { return value; }
    }
    class Derived extends Base {
      choose(other: Base): this { return other as this; }
      echo(value: number): number { return value + 1; }
    }
    const first = new Derived();
    const second = new Derived();
    const selected = first.choose(second);
    const base: Base = first;
    base.choose(second);
    const alias = first.echo;
    const result = alias(3);
  `);
  const methods = ["Base", "Derived"].map(name => current.source.ast.members(namedDeclaration(current.source.ast, current.file, name))
    .find(node => current.source.ast.is.IsMethodDeclaration(node) && current.source.ast.text(current.source.ast.name(node)) === "echo"));
  const subject = current.subject(current.variable("alias"));
  for (const selected of [current.storage.originSubjectsFor(subject), current.storage.boundOriginsFor(subject, current.storage.emptyBindings)]) {
    assert.equal(selected.kind === "resolved", true, "authored callable body supplies a real origin");
    assert.equal(methods.every(method => selected.subjects.some(origin => origin.kind === "value" && origin.node === method)), true,
      "all contributing native definitions survive the structural cycle");
    assert.equal(selected.subjects.every(origin => origin.kind === "value" && methods.includes(origin.node)), true,
      "no invented receiver, call result or signature origin");
  }
  const origins = complete(current.storage.closedOriginsFor(subject), "closed checked method definition origins");
  assert.equal(origins.every(origin => methods.includes(origin.subject.node)), true);
  assert.equal(methods.every(method => origins.some(origin => origin.subject.node === method)), true);
  assert.equal(current.storage.failureReason(), undefined);
});

test("checked method signatures retain structural record callable implementations and replacement origins", async () => {
  const current = await fixture("storage-domain-structural-method-callable", `
    interface Operation { run(): number; }
    class Native implements Operation { run(): number { return 3; } }
    const first = () => 1;
    const second = () => 2;
    const record: Operation = { run: first };
    record.run = second;
    const selected = record.run();
    const literal: Operation = { run(): number { return 4; } };
    const direct = literal.run();
    const native: Operation = new Native();
    const concrete = native.run();
  `);
  const selected = current.storage.invocationImplementationsFor(current.initializer("selected"), current.storage.emptyBindings);
  assert.equal(selected.kind === "resolved" && selected.nodes.length === 2 &&
    selected.nodes.includes(current.initializer("first")) && selected.nodes.includes(current.initializer("second")), true,
    "a structural method-shaped contract does not erase stored callable implementations");
  const original = current.source.ast.properties(current.initializer("literal"))[0];
  const direct = current.storage.invocationImplementationsFor(current.initializer("direct"), current.storage.emptyBindings);
  assert.equal(direct.kind === "resolved" && direct.nodes.length === 1 && direct.nodes[0] === original, true,
    "an object literal's authored method remains the exact stored implementation");
  const native = namedDeclaration(current.source.ast, current.file, "Native");
  const method = current.source.ast.members(native).find(node => current.source.ast.is.IsMethodDeclaration(node));
  const concrete = current.storage.invocationImplementationsFor(current.initializer("concrete"), current.storage.emptyBindings);
  assert.equal(concrete.kind === "resolved" && concrete.nodes.length === 1 && concrete.nodes[0] === method, true,
    "a native instance selects its exact implementation through the checked interface contract");
});

test("exact record slots keep independent writes, immutable aliases and generic invocation results distinct", async () => {
  const current = await fixture("storage-domain-physical-record-callables", `
    interface Operation { run(): {}; }
    class Native implements Operation { run(): {} { return { native: 1 }; } }
    function invoke<T extends Operation>(owner: T): {} { return owner.run(); }
    export function external(owner: Operation): {} { return owner.run(); }
    const original = {};
    const changed = {};
    const unrelated = {};
    const first = () => original;
    const second = () => changed;
    const third = () => unrelated;
    const record: Operation = { run: first };
    const other: Operation = { run: third };
    record.run = second;
    const alias = record;
    const direct = record.run();
    const aliased = alias.run();
    const contextual = invoke(alias);
    const different = other.run();
    const native = new Native().run();
  `);
  const originals = ["original", "changed"].map(name => current.subject(current.initializer(name)));
  for (const name of ["direct", "aliased", "contextual"]) {
    const selected = complete(current.selection(name), `closed actual physical callback slot: ${name}`);
    assert.equal(selected.length === 2 && originals.every(original => selected.some(value => value.subject === original)), true,
      "only writes to the exact record's callable slot contribute result origins");
  }
  const unrelated = current.subject(current.initializer("unrelated"));
  const different = complete(current.selection("different"), "a separate record's slot remains independent");
  assert.equal(different.length === 1 && different[0].subject === unrelated, true);
  const native = complete(current.selection("native"), "native interface implementations remain separate from record slots");
  assert.equal(native.length === 1 && !originals.includes(native[0].subject) && native[0].subject !== unrelated, true);
  const owner = namedDeclaration(current.source.ast, current.file, "external");
  const returned = current.storage.subject(owner, "return");
  assert.equal(returned.kind === "resolved", true);
  open(current.storage.closedOriginsFor(returned.subject), "external-input", "observed private record calls do not close an unknown external receiver");
});

test("abstract external receivers remain open while selected concrete overrides and native method aliases retain their contracts", async () => {
  const current = await fixture("storage-domain-abstract-receiver-and-method-alias", `
    abstract class Base { abstract value(): number; }
    class First extends Base { override value(): number { return 1; } }
    class Second extends Base { override value(): number { return 2; } }
    export function read(owner: Base): number { return owner.value(); }
    const first = read(new First());
    const second = read(new Second());
    const owner: Base = new First();
    const alias = owner.value;
    const aliased = alias();
  `);
  const read = namedDeclaration(current.source.ast, current.file, "read");
  const returned = current.storage.subject(read, "return");
  assert.equal(returned.kind === "resolved", true);
  open(current.storage.closedOriginsFor(returned.subject), "external-input", "an external abstract receiver is not a known concrete implementation");
  const nested = requiredNode(current.source.ast, read, node => current.source.ast.is.IsCallExpression(node));
  const methods = ["First", "Second"].map(name => current.source.ast.members(namedDeclaration(current.source.ast, current.file, name))
    .find(node => current.source.ast.is.IsMethodDeclaration(node)));
  for (const [index, name] of ["first", "second"].entries()) {
    const bindings = current.storage.bindingsForInvocation(read, current.initializer(name));
    assert.equal(bindings.kind === "resolved", true);
    const selected = current.storage.invocationImplementationsFor(nested, bindings.bindings);
    assert.equal(selected.kind === "resolved" && selected.nodes.length === 1 && selected.nodes[0] === methods[index], true,
      "the checked concrete invocation selects only its exact override");
  }
  const alias = current.storage.invocationImplementationsFor(current.initializer("aliased"), current.storage.emptyBindings);
  assert.equal(alias.kind === "resolved" && alias.nodes.length === 2 && methods.every(method => alias.nodes.includes(method)), true,
    "a receiver-unbound alias conservatively retains both observed native contracts, never just the last structural source");
});
