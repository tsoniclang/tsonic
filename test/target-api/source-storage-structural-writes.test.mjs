import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, sourceBindingWriteAtReference, sourceCallableValueParameters } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";

function fixture(body, extraFiles = {}, domain = "complete") {
  const files = { "/project/index.ts": body, ...extraFiles };
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/project",
    files,
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "source checking accepts the unmodified alias program");
  const source = createTargetSourceProgram(checked);
  const sourceFiles = Object.keys(files).map(name => checked.getSourceFile(name));
  const nodes = [];
  const pending = [...sourceFiles];
  while (pending.length !== 0) {
    const node = pending.pop();
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const storage = createSourceStorageQuery(source, sourceFiles);
  const named = (name, predicate) => nodes.find(node => predicate(node) && source.ast.text(source.ast.name(node)) === name);
  const original = named("original", source.ast.is.IsVariableDeclaration);
  const replacement = named("replacement", source.ast.is.IsVariableDeclaration);
  const owner = named("Value", source.ast.is.IsClassDeclaration);
  const member = source.ast.members(owner).find(node => source.ast.text(source.ast.name(node)) === "callback");
  const selected = source.ast.is.IsGetAccessorDeclaration(member) ? storage.subject(member, "return")
    : storage.storageSubjectFor(member);
  assert.equal(selected.kind, "resolved");
  const origins = storage.closedOriginsFor(selected.subject);
  assert.equal(origins.kind, domain, "no unseen external writer is erased");
  if (domain === "open") assert.equal(origins.boundaries.some(boundary => boundary.kind === "external-write"), true,
    "an exported writable class contract remains open");
  assert.equal(storage.failureReason() === undefined, true, "one finite graph accounts every direction");
  return { source, sourceFiles, storage, member, origins: origins.origins,
    original: source.ast.as.AsVariableDeclaration(original).Initializer,
    replacement: source.ast.as.AsVariableDeclaration(replacement).Initializer };
}

for (const access of ["view.callback", 'view["callback"]']) test(`checked structural write ${access} reaches the exact native member`, () => {
  const current = fixture(`
    const original = () => 1;
    const replacement = () => 2;
    class Value { callback: () => number = original; }
    const value = new Value();
    const view: { callback: () => number } = value;
    ${access} = replacement;
  `);
  assert.equal(current.origins.some(origin => origin.subject.node === current.original), true, "constructor contribution");
  assert.equal(current.origins.some(origin => origin.subject.node === current.replacement), true, "alias write contribution");
  assert.equal(Object.isFrozen(current.origins), true);
});

test("cross-file generic structural writes retain original checked member identity", () => {
  const current = fixture(`
    import { Value } from "./value.js";
    const original = (input: number): number => input + 1;
    const replacement = (input: number): number => input + 2;
    const value = new Value(original);
    const view: { callback: (input: number) => number } = value;
    view.callback = replacement;
  `, { "/project/value.ts": `
    export class Value<T> {
      callback: (input: T) => T;
      constructor(initial: (input: T) => T) { this.callback = initial; }
    }
  ` }, "open");
  assert.equal(current.origins.some(origin => origin.subject.node === current.original), true, "selected constructor input");
  assert.equal(current.origins.some(origin => origin.subject.node === current.replacement), true, "cross-file alias write");
  assert.equal(current.source.ast.getSourceFile(current.member) === current.sourceFiles[1], true, "original provider member identity");
});

test("readonly structural alias rebinding cannot replace the original object's member", () => {
  const current = fixture(`
    const original = () => 1;
    const replacement = () => 2;
    class Value { callback: () => number = original; }
    const value = new Value();
    let view: { readonly callback: () => number } = value;
    view = { callback: replacement };
  `);
  assert.equal(current.origins.some(origin => origin.subject.node === current.original), true);
  assert.equal(current.origins.some(origin => origin.subject.node === current.replacement), false, "rebinding is not a field write");
});

test("structural writes invoke accessors without manufacturing writes to their return values", () => {
  const current = fixture(`
    const original = () => 1;
    const replacement = () => 2;
    class Value {
      get callback(): () => number { return original; }
      set callback(value: () => number) { }
    }
    const value = new Value();
    const view: { callback: () => number } = value;
    view.callback = replacement;
  `);
  assert.equal(current.origins.some(origin => origin.subject.node === current.original), true);
  assert.equal(current.origins.some(origin => origin.subject.node === current.replacement), false, "the setter does not return its argument");
});

function formalFixture(body, extraFiles = {}, limits = {}) {
  const files = { "/project/index.ts": `export {}; interface Reader { read(): number; } ${body}`, ...extraFiles };
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/project", files,
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/project"));
  const source = createTargetSourceProgram(checked);
  const sourceFiles = Object.keys(files).map(name => checked.getSourceFile(name));
  const nodes = [];
  const pending = [...sourceFiles];
  while (pending.length !== 0) {
    const node = pending.pop();
    assert.equal(node !== undefined, true, "every fixture node belongs to a checked source file");
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const storage = createSourceStorageQuery(source, sourceFiles, { ...defaultSourceStorageLimits, ...limits });
  const callable = name => {
    const declaration = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.body(node) !== undefined &&
      source.ast.text(source.ast.name(node)) === name);
    assert.equal(declaration !== undefined, true, `${name}: actual implementation declaration`);
    return declaration;
  };
  const parameter = (declaration, name) => {
    const parameters = sourceCallableValueParameters(source.ast, declaration, source.semantics.forNode(declaration), { kind: "declaration" });
    const selected = parameters?.find(node => source.ast.text(source.ast.name(node)) === name);
    assert.equal(selected !== undefined, true, `${name}: checked runtime value parameter`);
    return selected;
  };
  const query = (name, input = "owner") => {
    const declaration = callable(name);
    return storage.formalMemberWriteDemand(declaration, parameter(declaration, input));
  };
  const member = (name = "Reader") => {
    const owner = nodes.find(node => source.ast.is.IsInterfaceDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
    const selected = owner === undefined ? undefined : source.ast.members(owner).find(node => source.ast.text(source.ast.name(node)) === "read");
    assert.equal(selected !== undefined, true, `${name}: original checked read member`);
    return selected;
  };
  const complete = (name, expected, input = "owner") => {
    const selected = query(name, input);
    assert.equal(selected.kind, "complete", `${name}: completed formal write demand (${selected.reason ?? ""})`);
    assert.equal(selected.members.length, expected.length, `${name}: exact member count`);
    assert.equal(expected.every(node => selected.members.includes(node)), true, `${name}: exact original member identities`);
    assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.members), true, `${name}: immutable published summary`);
    return selected;
  };
  return { source, storage, nodes, callable, parameter, query, member, complete };
}

test("formal member demands separate readonly consumers from the actual writer and physical producers", () => {
  const current = formalFixture(`
    const fixed = { read() { return 1; } };
    const changed = { read() { return 2; } };
    function read(owner: Reader) { return owner.read(); }
    function replace(owner: Reader) { owner.read = () => 3; }
    read(fixed); replace(changed); read(changed);
  `);
  current.complete("read", []);
  const demand = current.complete("replace", [current.member()]);
  assert.equal(current.query("replace") === demand, true, "repeated reads return the identical prepublished result");
  for (const [name, count] of [["fixed", 0], ["changed", 1]]) {
    const declaration = current.nodes.find(node => current.source.ast.is.IsVariableDeclaration(node) &&
      current.source.ast.text(current.source.ast.name(node)) === name);
    const initializer = current.source.ast.as.AsVariableDeclaration(declaration).Initializer;
    const member = current.source.ast.properties(initializer).find(node => current.source.ast.text(current.source.ast.name(node)) === "read");
    const subject = current.storage.memberSubjectFor(member);
    assert.equal(subject.kind, "resolved", `${name}: actual authored physical slot`);
    const writers = current.storage.memberWritesFor(subject.subject);
    assert.equal(writers.kind, "complete", `${name}: closed physical writer inventory`);
    assert.equal(writers.writes.length, count, `${name}: destination-specific writes are not joined into all formal producers`);
  }
  assert.equal(current.storage.failureReason() === undefined, true, "formal summaries preserve all original finite storage evidence");
});

for (const [label, statements] of [
  ["direct", "owner.read = () => 3;"],
  ["constant-indexed", 'owner["read"] = () => 3;'],
  ["same-value", "owner.read = owner.read;"],
  ["const alias", "const alias = owner; alias.read = () => 3;"],
  ["transitive alias", "const first = owner; const alias = first; alias.read = () => 3;"],
  ["stable let", "let alias = owner; alias.read = () => 3;"],
  ["later reassignment", "let alias = owner; alias.read = () => 3; alias = other;"],
  ["captured parameter", "function apply() { owner.read = () => 3; } apply();"],
]) test(`formal member writes retain ${label} binding and declaration evidence`, () => {
  const current = formalFixture(`function replace(owner: Reader, other: Reader) { ${statements} }`);
  current.complete("replace", [current.member()]);
  current.complete("replace", [], "other");
});

for (const [label, declarations] of [
  ["direct forwarding", "function sink(owner: Reader) { owner.read = () => 3; } function forward(owner: Reader) { sink(owner); }"],
  ["recursive forwarding", `
    function sink(owner: Reader, depth: number) { owner.read = () => 3; if (depth > 0) forward(owner, depth - 1); }
    function forward(owner: Reader, depth: number) { if (depth > 0) sink(owner, depth - 1); }
  `],
  ["generic forwarding", `
    function sink<T extends Reader>(owner: T) { owner.read = () => 3; }
    function forward(owner: Reader) { sink(owner); }
  `],
  ["selected overload to implementation", `
    function sink(owner: Reader): void;
    function sink(owner: Reader, count = 0) { owner.read = () => count; }
    function forward(owner: Reader) { sink(owner); }
  `],
  ["defaulted input", "function forward(owner: Reader, fallback: Reader = owner) { fallback.read = () => 3; }"],
]) test(`formal member demand solves ${label} through exact checked inputs`, () => {
  const current = formalFixture(declarations);
  current.complete("forward", [current.member()]);
});

test("same-spelling interface members forward only by their original checked correspondence", () => {
  const current = formalFixture(`
    interface Other { read(): number; }
    function sink(owner: Other) { owner.read = () => 3; }
    function forward(owner: Reader) { sink(owner); }
  `);
  current.complete("sink", [current.member("Other")]);
  current.complete("forward", [current.member()]);
  assert.equal(current.member() !== current.member("Other"), true, "structurally corresponding declarations retain separate identities");
});

test("cross-file forwarding retains the implementation declaration rather than the signature's parameter", () => {
  const current = formalFixture(`
    import { sink } from "./sink.js";
    function forward(owner: Reader) { sink(owner); }
  `, { "/project/sink.ts": `
    interface RemoteReader { read(): number; }
    export function sink(value: RemoteReader): void;
    export function sink(actual: RemoteReader, count = 0) { actual.read = () => count; }
  ` });
  current.complete("forward", [current.member()]);
  const declaration = current.callable("sink");
  const parameter = current.parameter(declaration, "actual");
  const result = current.storage.formalMemberWriteDemand(declaration, parameter);
  assert.equal(result.kind, "complete", "the checked body parameter is the summary's sole input identity");
  assert.equal(result.members.length, 1, "one remote member is required");
});

test("a checked setter forwards its actual value input through the same canonical invocation mapping", () => {
  const current = formalFixture(`
    class Slot { set value(actual: Reader) { actual.read = () => 3; } }
    const slot = new Slot();
    function forward(owner: Reader) { slot.value = owner; }
  `);
  current.complete("forward", [current.member()]);
});

for (const [label, statements] of [
  ["intervening reassignment", "let alias = owner; alias = other; alias.read = () => 3;"],
  ["branch reassignment", "let alias = owner; if (condition) alias = other; alias.read = () => 3;"],
  ["loop reassignment", "let alias = owner; while (condition) { alias = other; break; } alias.read = () => 3;"],
  ["captured reassignment", "let alias = owner; const change = () => { alias = other; }; change(); alias.read = () => 3;"],
  ["function-scoped var", "var alias = owner; alias.read = () => 3;"],
]) test(`formal write demand refuses unqualified ${label} instead of manufacturing an empty proof`, () => {
  const current = formalFixture(`function replace(owner: Reader, other: Reader, condition: boolean) { ${statements} }`);
  const selected = current.query("replace");
  assert.equal(selected.kind, "unresolved", `${label}: absence of qualification is not absence of writes`);
  assert.match(selected.reason, /alias|reassign|exposure|const\/let/u);
});

test("later parameter initializer effects cannot be ignored when qualifying a body input", () => {
  const current = formalFixture(`
    function replace(owner: Reader, other: Reader, applied: Reader = (owner = other)) { owner.read = () => 3; }
  `);
  assert.equal(current.query("replace").kind, "unresolved", "parameter evaluation precedes the body use and can rebind it");
});

for (const [label, body, input] of [
  ["array-element receiver", "function replace(owners: Reader[]) { owners[0].read = () => 3; }", "owners"],
  ["rest-element receiver", "function replace(...owners: Reader[]) { owners[0].read = () => 3; }", "owners"],
  ["nested member receiver", "function replace(owner: { value: Reader }) { owner.value.read = () => 3; }", "owner"],
  ["call-result receiver", `
    function identity(owner: Reader) { return owner; }
    function replace(owner: Reader) { identity(owner).read = () => 3; }
  `, "owner"],
]) test(`unsupported shared ${label} exposes the exact source refusal`, () => {
  const current = formalFixture(body);
  const selected = current.query("replace", input);
  assert.equal(selected.kind, "unresolved", `${label}: unqualified receivers do not admit a native writable destination`);
  assert.match(selected.reason, /parameter|alias|element|property|call result/u);
  const access = current.nodes.find(node => current.source.ast.is.IsPropertyAccessExpression(node) &&
    current.source.semantics.forNode(node).operations.propertyAccess(node)?.accessMode === "write");
  assert.equal(access !== undefined, true, `${label}: original source write access`);
  const write = current.storage.writeAt(access, current.storage.emptyBindings);
  assert.equal(write.kind, "resolved", `${label}: the exact original occurrence remains published`);
  assert.equal(typeof write.write.reason === "string", true, `${label}: target admission receives the original source-v1 refusal`);
});

for (const [label, declarations] of [
  ["external body", "declare function opaque(value: Reader): void; function forward(owner: Reader) { opaque(owner); }"],
  ["unknown callback", "function forward(owner: Reader, callback: (value: Reader) => void) { callback(owner); }"],
  ["opaque aggregate", "declare function opaque(value: { value: Reader }): void; function forward(owner: Reader) { opaque({ value: owner }); }"],
  ["opaque captured result", "declare function opaque(value: () => Reader): void; function forward(owner: Reader) { opaque(() => owner); }"],
  ["partially known callee", `
    declare function opaque(value: Reader): void;
    function sink(value: Reader) { value.read = () => 3; }
    function forward(owner: Reader, condition: boolean) { const invoke = condition ? sink : opaque; invoke(owner); }
  `],
]) test(`formal member demand preserves ${label} uncertainty`, () => {
  const current = formalFixture(declarations);
  const selected = current.query("forward");
  assert.equal(selected.kind, "unresolved", `${label}: unknown native/source effects never complete as empty`);
  assert.match(selected.reason, /callee|signature|transport|parameter|captured/u);
});

test("ordinary concrete literal writes and closed read-only forwarding do not require a setter contract", () => {
  const current = formalFixture(`
    function inspect(owner: Reader) { return owner.read(); }
    function forward(owner: Reader) {
      const concrete = { read() { return 1; } };
      concrete.read = () => 2;
      return inspect(owner);
    }
  `);
  current.complete("inspect", []);
  current.complete("forward", []);
  assert.equal(current.storage.failureReason() === undefined, true, "concrete slots and genuine closed empty summaries stay supported");
});

test("exporting a constant concrete binding does not turn its field write into a formal alias refusal", () => {
  const current = formalFixture(`
    export const concrete: Reader = { read() { return 1; } };
    function forward(owner: Reader) { concrete.read = () => 2; return owner.read(); }
  `);
  current.complete("forward", []);
  const access = current.nodes.find(node => current.source.ast.is.IsPropertyAccessExpression(node) &&
    current.source.semantics.forNode(node).operations.propertyAccess(node)?.accessMode === "write");
  assert.equal(access !== undefined, true, "the concrete field retains its original write access");
  const selected = current.storage.writeAt(access, current.storage.emptyBindings);
  assert.equal(selected.kind, "resolved", "the exact original write remains published");
  assert.equal(selected.write.reason === undefined, true, "exporting const storage cannot rebind its object identity");
});

test("missing formal/member correspondence remains unresolved after a narrowed receiver write", () => {
  const current = formalFixture(`
    interface Other { value: number; }
    function replace(owner: Reader | Other) { if ("read" in owner) owner.read = () => 3; }
  `);
  const selected = current.query("replace");
  assert.equal(selected.kind, "unresolved", "a narrowed use cannot manufacture an all-input member identity");
  assert.match(selected.reason, /correspondence/u);
});

test("the receiver declaration is not a runtime value parameter", () => {
  const current = formalFixture("function inspect(this: Reader, owner: Reader) { return owner.read(); }");
  current.complete("inspect", []);
  const declaration = current.callable("inspect");
  const receiver = current.source.semantics.forNode(declaration).types.declarationSignatureInfo(declaration)?.thisParameter?.declaration;
  assert.equal(receiver !== undefined, true, "the original checked receiver contract is present");
  assert.equal(current.storage.formalMemberWriteDemand(declaration, receiver).kind, "unresolved",
    "explicit this never shifts or substitutes the canonical runtime parameter vector");
});

test("formal demand identity rejects a different declaration, foreign input and forged node", () => {
  const current = formalFixture("function replace(owner: Reader) { owner.read = () => 3; } function other(owner: Reader) { }");
  const foreign = formalFixture("function replace(owner: Reader) { owner.read = () => 3; }");
  const declaration = current.callable("replace");
  const wrong = current.parameter(current.callable("other"), "owner");
  const foreignParameter = foreign.parameter(foreign.callable("replace"), "owner");
  for (const parameter of [wrong, foreignParameter, Object.freeze({})]) {
    const selected = current.storage.formalMemberWriteDemand(declaration, parameter);
    assert.equal(selected.kind, "unresolved", "only the identical actual implementation input can select a demand");
    assert.match(selected.reason, /identical checked implementation/u);
  }
  assert.equal(current.storage.formalMemberWriteDemand(foreign.callable("replace"), foreignParameter).kind,
    "unresolved", "foreign declarations do not become local summaries by spelling");
});

for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }]) test(`formal write demand keeps finite refusal ${Object.keys(limits)[0]}`, () => {
  const current = formalFixture("function replace(owner: Reader) { owner.read = () => 3; }", {}, limits);
  const selected = current.query("replace");
  assert.equal(selected.kind, "unresolved", "incomplete finite source work never becomes an empty summary");
  assert.match(selected.reason, /budget/u);
});

function optionalDemand(current, name, expected, input = "owner") {
  const declaration = current.callable(name);
  const parameter = current.parameter(declaration, input);
  const subject = current.storage.subject(parameter, "input");
  assert.equal(subject.kind, "resolved", `${name}.${input}: identical declared input`);
  const before = current.storage.typeFor(subject.subject);
  assert.equal(before.kind, "resolved", `${name}.${input}: original declared carrier`);
  const types = current.source.semantics.forNode(parameter).types;
  assert.equal(types.isUnion(before.type) && types.unionOrIntersectionTypes(before.type).some(type => types.isNullish(type)), true,
    `${name}.${input}: declared absence remains present in the raw carrier`);
  const result = current.complete(name, expected, input);
  const after = current.storage.typeFor(subject.subject);
  assert.equal(after.kind === "resolved" && after.type === before.type, true,
    `${name}.${input}: present-member selection never replaces the original optional type`);
  return result;
}

for (const [label, parameter, aliases, receiver] of [
  ["undefined union", "owner: Reader | undefined", "", "owner"],
  ["optional parameter", "owner?: Reader", "", "owner"],
  ["null union", "owner: Reader | null", "", "owner"],
  ["null and undefined union", "owner: Reader | null | undefined", "", "owner"],
  ["undefined default", "owner: Reader | undefined = undefined", "", "owner"],
  ["null default", "owner: Reader | null = null", "", "owner"],
  ["optional const alias", "owner?: Reader", "const alias = owner;", "alias"],
  ["optional stable let alias", "owner?: Reader", "let alias = owner;", "alias"],
]) test(`formal present-member demand preserves ${label} absence`, () => {
  const current = formalFixture(`function replace(${parameter}) { ${aliases} if (${receiver}) ${receiver}.read = () => 3; }`);
  optionalDemand(current, "replace", [current.member()]);
});

test("cross-file generic optional aliases retain the exact present member and raw generic binding", () => {
  const current = formalFixture(`
    import type { Maybe } from "./maybe.js";
    function replace(owner: Maybe<Reader>) { if (owner) owner.read = () => 3; }
  `, { "/project/maybe.ts": "export type Maybe<Value> = Value | null | undefined;" });
  optionalDemand(current, "replace", [current.member()]);
});

for (const [label, callerType, calleeType, invocation, optional] of [
  ["both operands", "Reader | undefined", "Reader | undefined", "sink(owner);", ["forward", "sink"]],
  ["upstream operand", "Reader | undefined", "Reader", "if (owner) sink(owner);", ["forward"]],
  ["downstream operand", "Reader", "Reader | undefined", "sink(owner);", ["sink"]],
]) test(`forwarded present-member demand normalizes ${label} without changing declared carriers`, () => {
  const current = formalFixture(`
    function sink(owner: ${calleeType}) { if (owner) owner.read = () => 3; }
    function forward(owner: ${callerType}) { ${invocation} }
  `);
  for (const name of ["sink", "forward"]) {
    if (optional.includes(name)) optionalDemand(current, name, [current.member()]);
    else current.complete(name, [current.member()]);
  }
});

test("an optional default alias forwards the present-member requirement without erasing either absence", () => {
  const current = formalFixture(`
    function replace(owner?: Reader, fallback: Reader | undefined = owner) { if (fallback) fallback.read = () => 3; }
  `);
  optionalDemand(current, "replace", [current.member()]);
  optionalDemand(current, "replace", [current.member()], "fallback");
});

test("readonly optional consumers and omitted/nullish defaults retain genuinely empty demands", () => {
  const current = formalFixture(`
    function inspect(owner: Reader | null | undefined = undefined) { return owner?.read(); }
    function forward(owner?: Reader) { inspect(); inspect(undefined); inspect(null); return inspect(owner); }
  `);
  optionalDemand(current, "inspect", []);
  optionalDemand(current, "forward", []);
});

for (const type of ["Reader | Other | undefined", "Reader | Other | null | undefined"])
  test(`present-member selection cannot erase non-nullish alternatives from ${type}`, () => {
    const current = formalFixture(`
      interface Other { value: number; }
      function replace(owner: ${type}) { if (owner && "read" in owner) owner.read = () => 3; }
    `);
    const selected = current.query("replace");
    assert.equal(selected.kind, "unresolved", "removing absence never removes the distinct Other carrier");
    assert.match(selected.reason, /correspondence/u);
  });

for (const type of ["unknown", "any", "null", "undefined", "null | undefined"])
  test(`present-member selection never fabricates a Reader from ${type}`, () => {
    const current = formalFixture(`function replace(owner: ${type}) { (owner as unknown as Reader).read = () => 3; }`);
    const selected = current.query("replace");
    assert.equal(selected.kind, "unresolved", "a checked cast does not invent a present formal/member correspondence");
    assert.match(selected.reason, /correspondence/u);
  });

test("optional present-member summaries still reject foreign, missing and wrong-owner parameter identities", () => {
  const current = formalFixture("function replace(owner?: Reader) { if (owner) owner.read = () => 3; } function other(owner?: Reader) { }");
  const foreign = formalFixture("function replace(owner?: Reader) { if (owner) owner.read = () => 3; }");
  const declaration = current.callable("replace");
  for (const parameter of [current.parameter(current.callable("other"), "owner"),
    foreign.parameter(foreign.callable("replace"), "owner"), Object.freeze({})]) {
    const selected = current.storage.formalMemberWriteDemand(declaration, parameter);
    assert.equal(selected.kind, "unresolved", "normalizing types never normalizes foreign source identity");
    assert.match(selected.reason, /identical checked implementation/u);
  }
});

for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }])
  test(`optional member demands retain exact finite refusal ${Object.keys(limits)[0]}`, () => {
    const current = formalFixture("function replace(owner?: Reader) { if (owner) owner.read = () => 3; }", {}, limits);
    const selected = current.query("replace");
    assert.equal(selected.kind, "unresolved", "present-type normalization never turns finite failure into completed empty proof");
    assert.match(selected.reason, /budget/u);
  });

for (const [label, body, access] of [
  ["named optional property", "const values: { entry?: number } = { entry: 1 }; delete values.entry;", "values.entry"],
  ["string property key", "const values: { entry?: number } = { entry: 1 }; delete values['entry'];", "values['entry']"],
  ["constant property key", "const key = 'entry'; const values: { entry?: number } = { entry: 1 }; delete values[key];", "values[key]"],
  ["numeric array element", "const values = [1, 2]; delete values[0];", "values[0]"],
  ["string array element", "const values = [1, 2]; delete values['0'];", "values['0']"],
  ["dictionary element", "const values: { [key: string]: number } = { entry: 1 }; delete values['entry'];", "values['entry']"],
  ["transparent property operand", "const values: { entry?: number } = { entry: 1 }; delete ((values.entry));", "values.entry"],
  ["transparent element operand", "const values = [1, 2]; delete ((values[0]));", "values[0]"],
  ["nullish optional storage", "const values: { entry?: number | null } = { entry: null }; delete values.entry;", "values.entry"],
  ["optional callable slot", "const values: { read?: () => number } = { read() { return 1; } }; delete values.read;", "values.read"],
]) test(`canonical deletion retains a valueless mutation for ${label}`, () => {
  const current = formalFixture(body);
  const { ast } = current.source;
  const references = current.nodes.filter(node => ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node));
  assert.equal(references.length, 1, `${label}: the complete program has one exact ${access} operand`);
  const reference = references[0];
  const operation = current.nodes.find(ast.is.IsDeleteExpression);
  assert.equal(reference !== undefined && operation !== undefined, true, `${label}: original checked access and operation`);
  const classified = sourceBindingWriteAtReference(ast, reference);
  assert.equal(classified?.kind, "deletion", `${label}: canonical source-write kind`);
  assert.equal(classified.reference === reference && classified.operation === operation, true, `${label}: exact original identities`);
  assert.equal(classified.values.length, 0, `${label}: deletion has no stored RHS`);
  assert.equal(Object.isFrozen(classified) && Object.isFrozen(classified.values), true, `${label}: immutable source evidence`);
  assert.equal(sourceBindingWriteAtReference(ast, operation), undefined, `${label}: the Boolean result is not a stored value`);
  const selected = current.storage.writeAt(reference, current.storage.emptyBindings);
  assert.equal(selected.kind, "resolved", `${label}: actual mutation occurrence (${selected.reason ?? ""})`);
  assert.equal(selected.write.reference === reference && selected.write.operation === operation, true, `${label}: published original identities`);
  assert.equal(selected.write.kind, "mutation", `${label}: deleting is not initialization`);
  assert.equal(selected.write.value, undefined, `${label}: no invented Boolean or absence producer`);
  assert.equal(selected.write.values.length, 0, `${label}: no manufactured null/undefined tag or value edge`);
  assert.equal(selected.write.reason, undefined, `${label}: no missing-RHS refusal on a genuine valueless operation`);
  assert.equal(selected.write.receiver !== undefined && selected.write.destinations.length > 0, true,
    `${label}: the actual receiver and writable destination survive`);
  assert.equal(current.storage.failureReason(), undefined, `${label}: all actual source relations stay finite`);
});

for (const [label, body, access, kind] of [
  ["assignment", "const values = { entry: 1 }; values.entry = 2;", "values.entry", "assignment"],
  ["compound assignment", "const values = { entry: 1 }; values.entry += 2;", "values.entry", "assignment"],
  ["prefix update", "const values = { entry: 1 }; ++values.entry;", "values.entry", "update"],
  ["postfix update", "const values = [1]; values[0]++;", "values[0]", "update"],
]) test(`valueless deletion never erases the original producer of ${label}`, () => {
  const current = formalFixture(body);
  const { ast } = current.source;
  const references = current.nodes.filter(node => ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node));
  assert.equal(references.length, 1, `${label}: the complete program has one exact ${access} operand`);
  const reference = references[0];
  assert.equal(reference !== undefined, true, `${label}: original checked access`);
  const classified = sourceBindingWriteAtReference(ast, reference);
  assert.equal(classified?.kind, kind, `${label}: unchanged source-write classification`);
  assert.equal(classified.reference === reference && classified.values.length === 1, true, `${label}: exact nonempty value producer`);
  const selected = current.storage.writeAt(reference, current.storage.emptyBindings);
  assert.equal(selected.kind, "resolved", `${label}: original occurrence remains selected`);
  assert.equal(selected.write.reason, undefined, `${label}: original producer remains proved`);
  assert.equal(selected.write.values.length, 1, `${label}: ordinary writes never become deletions`);
});

test("a read operand beside a deletion is not itself a mutation", () => {
  const current = formalFixture("const values: { entry?: number } = { entry: 1 }; const observed = values.entry; delete values.entry;");
  const { ast } = current.source;
  const read = current.nodes.find(node => ast.is.IsPropertyAccessExpression(node) && ast.is.IsVariableDeclaration(ast.parent(node)));
  assert.equal(read !== undefined, true, "the checked initializer contains the independent read operand");
  assert.equal(sourceBindingWriteAtReference(ast, read), undefined, "only the exact delete operand is a deletion");
});

for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }])
  test(`valueless deletion preserves finite refusal ${Object.keys(limits)[0]}`, () => {
    const current = formalFixture("const values: { entry?: number } = { entry: 1 }; delete values.entry;", {}, limits);
    const reference = current.nodes.find(current.source.ast.is.IsPropertyAccessExpression);
    const selected = current.storage.writeAt(reference, current.storage.emptyBindings);
    assert.equal(selected.kind, "unresolved", "finite failure is never published as a completed empty write");
    assert.equal(typeof selected.reason === "string" && selected.reason.length > 0, true, "the real finite failure reason is retained");
    assert.equal(typeof current.storage.failureReason() === "string", true, "the original rejected budget remains authoritative");
  });
