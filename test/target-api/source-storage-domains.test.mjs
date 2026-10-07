import assert from "node:assert/strict";
import test from "node:test";
import { argumentPassingFactKey, createCompilerSessionFromFiles, flowStateFactKey, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { jsSourceCallStorageEffect, sourceErrorDeclarations } from "../../packages/js-source-profile/dist/index.js";
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
    return { call(node, selected) {
      const declaration = source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature);
      if (!signatures.has(declaration)) return undefined;
      return jsSourceCallStorageEffect({ ownerName: "ErrorConstructor", memberName: source.ast.is.IsNewExpression(node) ? "constructor" : "call" }, selected);
    } };
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

test("recursive contextual transport terminates at its finite owner budget without inventing an original root", async () => {
  const current = await fixture("storage-domain-context-cycle", `
    function recurse<T>(value: T): T { return recurse(value); }
    const output = recurse({});
  `, { limits: { ...defaultSourceStorageLimits, maximumSteps: 2048 } });
  const result = current.selection("output");
  assert.equal(result.kind === "unresolved" && current.storage.failureReason() !== undefined, true, "context recursion is bounded and fail closed");
});
