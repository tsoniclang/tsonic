import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, createSourceErrorStorageDemandQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { checkedSource, namedDeclaration, namedMember, namedVariable, projectSourceFile, requiredNode } from "../fixtures/source-navigation.mjs";

const globals = `
interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
interface Number {} interface String {} interface RegExp {}
interface Array<T> { [index: number]: T; length: number; }
interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
`;
const element = Object.freeze([{ kind: "array-element" }]);
const slot = index => Object.freeze([{ kind: "tuple-element", index }]);

async function checked(name, body, provider = "", imports = []) {
  const result = await checkedSource(name, {
    "globals.d.ts": globals,
    "src/provider.ts": `
export interface Box<T> { value: T; }
export function identity<T>(value: T): T { return value; }
export function first<T>(values: T[]): T { return values[0]; }
export function second<T>(values: [T, T]): T { return values[1]; }
export function forward<T>(box: Box<T>): Box<T> { return box; }
export function throwValue<T>(value: T): never { throw value; }
export class Holder<T> {
  value: T;
  constructor(value: T) { this.value = value; }
  read(): T { return this.value; }
  get selected(): T { return this.value; }
  set selected(value: T) { this.value = value; }
}
${provider}
`,
    "src/index.ts": `import { Box, identity, first, second, forward, throwValue, Holder${imports.length === 0 ? "" : `, ${imports.join(", ")}`} } from "./provider.js"; ${body}`,
  });
  assert.equal(result.diagnostics.length, 0, formatDiagnostics(result.diagnostics, "/src"));
  const source = createTargetSourceProgram(result);
  const file = projectSourceFile(source, "src/index.ts");
  const providerFile = projectSourceFile(source, "src/provider.ts");
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
  assert.equal(storage.failureReason() === undefined, true, name);
  const variable = name => namedVariable(source.ast, file, name);
  const subject = name => resolvedSubject(storage.subjectFor(variable(name)), name);
  const initializer = name => source.ast.as.AsVariableDeclaration(variable(name)).Initializer;
  const call = name => requiredNode(source.ast, file, node => source.ast.is.IsCallExpression(node) &&
    source.ast.text(source.ast.as.AsCallExpression(node).Expression) === name);
  return { source, storage, file, provider: providerFile, variable, subject, initializer, call };
}

function resolvedSubject(selection, label) {
  assert.equal(selection.kind === "resolved", true, label);
  return selection.subject;
}

test("selected expressions retain only their contributing operand origins", async () => {
  const { source, storage, file, initializer } = await checked("source-storage-selected-operands", `
declare const condition: boolean;
declare const left: number | undefined;
declare const right: number;
const conditional = condition ? left : right;
const conjunction = left && right;
const disjunction = left || right;
const coalesced = left ?? right;
const comma = (identity(left), right);
`);
  const left = namedVariable(source.ast, file, "left");
  const right = namedVariable(source.ast, file, "right");
  const condition = namedVariable(source.ast, file, "condition");
  for (const name of ["conditional", "conjunction", "disjunction", "coalesced"]) {
    const subject = resolvedSubject(storage.storageSubjectFor(initializer(name)), name);
    const origins = storage.originSubjectsFor(subject);
    assert.equal(origins.kind, "resolved");
    assert.equal(origins.subjects.length, 2, `${name}: both possible selected operands`);
    assert.equal(origins.subjects.some(origin => origin.node === left), true, `${name}: exact left declaration`);
    assert.equal(origins.subjects.some(origin => origin.node === right), true, `${name}: exact right declaration`);
    assert.equal(origins.subjects.some(origin => origin.node === condition), false, `${name}: condition is not result storage`);
  }
  const origins = storage.originSubjectsFor(resolvedSubject(storage.storageSubjectFor(initializer("comma")), "comma"));
  assert.equal(origins.kind, "resolved");
  assert.equal(origins.subjects.length, 1, "comma has only its right result");
  assert.equal(origins.subjects[0].node === right, true);
});

function originSubjects(storage, subject, label) {
  const selected = storage.originSubjectsFor(subject);
  assert.equal(selected.kind === "resolved", true, label);
  return selected.subjects;
}

test("neutral source storage preserves directional cross-file argument, return, alias and reassignment evidence", async () => {
  const { source, storage, provider, variable, subject, initializer, call } = await checked("source-storage-alias-return", `
const original = 3;
const untouched = 7;
const result = identity(original);
let alias = result;
alias = original;
`);
  const result = subject("result");
  const incoming = storage.incomingFor(result);
  assert.equal(incoming.kind === "resolved", true);
  assert.equal(incoming.subjects.some(subject => subject.node === initializer("result")), true, "direction is invocation to storage");
  const origins = originSubjects(storage, subject("alias"), "reassigned alias");
  assert.equal(origins.some(subject => subject.node === initializer("original")), true, "exact original expression");
  assert.equal(origins.some(subject => subject.node === initializer("untouched")), false, "independent declaration excluded");
  const identity = namedDeclaration(source.ast, provider, "identity");
  const invocation = call("identity");
  const implementations = storage.invocationImplementationsFor(invocation);
  assert.equal(implementations.kind === "resolved", true);
  assert.equal(implementations.nodes.length === 1 && implementations.nodes[0] === identity, true, "exact cross-file implementation");
  const arguments_ = storage.argumentTransportsFor(invocation);
  assert.equal(arguments_.kind === "resolved", true);
  assert.equal(arguments_.arguments.length, 1);
  assert.equal(arguments_.arguments[0].formal.node === source.ast.parameters(identity)[0], true, "selected formal");
  assert.equal(arguments_.arguments[0].actual.node === variable("original"), true, "selected actual alias");
  const selectedCall = source.semantics.forNode(invocation).operations.call(invocation);
  assert.equal(arguments_.arguments[0].binding.selectedArgumentType === selectedCall.sourceArgumentBindings[0].selectedArgumentType, true);
  assert.equal(arguments_.arguments[0].binding.selectedParameterType === selectedCall.sourceArgumentBindings[0].selectedParameterType, true);
  const returns = storage.subject(identity, "return");
  assert.equal(returns.kind === "resolved", true);
  assert.equal(storage.subject(identity, "return").subject === returns.subject, true, "canonical return identity");
  assert.equal(returns.subject !== resolvedSubject(storage.subject(identity), "value"), true, "return and function value differ");
});

test("invocation substitutions preserve selected origins without conflating independent calls or exposing maps", async () => {
  const { source, storage, provider, initializer } = await checked("source-storage-invocation-substitutions", `
const left = 3;
const right = 7;
const leftResult = identity(left);
const rightResult = identity(right);
`);
  const declaration = namedDeclaration(source.ast, provider, "identity");
  const formal = resolvedSubject(storage.subject(source.ast.parameters(declaration)[0]), "formal");
  const invocation = name => initializer(name);
  const left = storage.bindingsForInvocation(declaration, invocation("leftResult"));
  const right = storage.bindingsForInvocation(declaration, invocation("rightResult"));
  assert.equal(left.kind === "resolved" && right.kind === "resolved", true);
  const original = storage.boundOriginsFor(formal, left.bindings);
  const other = storage.boundOriginsFor(formal, right.bindings);
  assert.equal(original.kind === "resolved" && other.kind === "resolved", true);
  assert.equal(original.subjects.length === 1 && original.subjects[0].node === initializer("left"), true);
  assert.equal(other.subjects.length === 1 && other.subjects[0].node === initializer("right"), true);
  assert.equal(left.bindings !== right.bindings, true, "distinct selected contexts");
  assert.equal(storage.bindingsForInvocation(declaration, invocation("leftResult")).bindings === left.bindings, true, "interned immutable substitution context");
  assert.equal(Object.isFrozen(left.bindings) && Object.isFrozen(left.bindings.substitutions) &&
    left.bindings.substitutions.every(binding => Object.isFrozen(binding) && Object.isFrozen(binding.actuals)), true);
  const forged = Object.freeze({ substitutions: left.bindings.substitutions });
  assert.equal(storage.boundOriginsFor(formal, forged).kind, "unresolved", "shape cannot forge query ownership");
  const unrelated = namedDeclaration(source.ast, provider, "first");
  assert.equal(storage.bindingsForInvocation(unrelated, invocation("leftResult")).kind, "unresolved", "wrong callable is not selected");
});

test("checked array, tuple, nested and spread projections preserve exact source component origins", async () => {
  const { source, file, storage, subject, initializer, variable } = await checked("source-storage-container-projections", `
const left = { value: 3 };
const right = { value: 7 };
const values: [Box<number>, Box<number>] = [left, right];
const array: Box<number>[] = [...values];
const outer: Box<number>[][] = [array];
const selected = first(array);
const secondValue = second(values);
const [binding] = values;
`);
  const second = originSubjects(storage, subject("secondValue"), "second tuple position");
  assert.equal(second.some(subject => subject.node === initializer("right")), true);
  assert.equal(second.some(subject => subject.node === initializer("left")), false, "tuple positions stay independent");
  const binding = requiredNode(source.ast, file, node => source.ast.is.IsBindingElement(node) &&
    source.ast.text(source.ast.name(node)) === "binding");
  const first = originSubjects(storage, resolvedSubject(storage.subjectFor(binding), "array binding"), "array binding");
  assert.equal(first.some(subject => subject.node === initializer("left")), true);
  assert.equal(first.some(subject => subject.node === initializer("right")), false);
  const projected = resolvedSubject(storage.storageSubjectFor(variable("outer"), [...element, ...element]), "nested array element");
  const origins = originSubjects(storage, projected, "nested component");
  for (const name of ["left", "right"]) assert.equal(origins.some(subject => subject.node === initializer(name)), true, name);
  assert.equal(projected.projection.length, 2);
  assert.equal(storage.typeFor(projected).kind, "resolved");
  assert.equal(storage.storageSubjectFor(variable("values"), element).kind, "unresolved", "tuple is not a manufactured array element");
  assert.equal(storage.storageSubjectFor(variable("values"), slot(2)).kind, "unresolved", "tuple position must exist");
  const accessor = Object.defineProperty([], "0", { get: () => assert.fail("projection element getter executed") });
  assert.equal(storage.storageSubjectFor(variable("values"), accessor).kind, "unresolved", "owner projection validates before iteration");
  const component = Object.defineProperty({}, "kind", { get: () => assert.fail("projection component getter executed") });
  assert.equal(storage.storageSubjectFor(variable("values"), [component]).kind, "unresolved", "owner projection reads data-only components");
  assert.equal(storage.storageSubjectFor(variable("values"), null).kind, "unresolved", "null is not an omitted component path");
});

test("structural correspondence uses checked generic property identities rather than property-name matching", async () => {
  const { source, storage, provider, initializer, call } = await checked("source-storage-structural-generics", `
const original = { value: 3 };
const alias: Box<number> = original;
const returned = forward(alias);
const selected = returned.value;
`);
  const declaration = namedDeclaration(source.ast, provider, "Box");
  const destination = namedMember(source.ast, declaration, "value");
  const subject = resolvedSubject(storage.subject(destination), "selected generic member");
  const origins = originSubjects(storage, subject, "generic member origins");
  const original = source.ast.properties(initializer("original"))[0];
  const originalValue = source.ast.as.AsPropertyAssignment(original).Initializer;
  assert.equal(origins.some(subject => subject.node === originalValue), true, "source member's exact initializer survives");
  const selectedCall = source.semantics.forNode(call("forward")).operations.call(call("forward"));
  const transport = storage.argumentTransportsFor(call("forward"));
  assert.equal(transport.kind === "resolved", true);
  assert.equal(transport.arguments[0].binding.selectedParameterType === selectedCall.sourceArgumentBindings[0].selectedParameterType, true);
});

test("receiver and inherited accessor transport retain selected implementation and construction identities", async () => {
  const { source, storage, file, provider, initializer } = await checked("source-storage-accessor-receiver", `
const holder = new NumericHolder(3);
holder.selected = 7;
const selected = holder.selected;
const result = holder.read();
`, `export class NumericHolder extends Holder<number> {}`, ["NumericHolder"]);
  const holder = namedDeclaration(source.ast, provider, "Holder");
  const accessor = source.ast.members(holder).find(node => source.ast.is.IsGetAccessorDeclaration(node));
  const access = requiredNode(source.ast, file, node => source.ast.is.IsPropertyAccessExpression(node) &&
    source.ast.parent(node) === namedVariable(source.ast, file, "selected"));
  const implementations = storage.invocationImplementationsFor(access);
  assert.equal(implementations.kind === "resolved", true);
  assert.equal(implementations.nodes.length === 1 && implementations.nodes[0] === accessor, true, "exact inherited getter");
  const receiver = resolvedSubject(storage.subject(accessor, "receiver"), "getter receiver");
  const selected = storage.bindingsForInvocation(accessor, access);
  assert.equal(selected.kind === "resolved", true);
  const origins = storage.boundOriginsFor(receiver, selected.bindings);
  assert.equal(origins.kind === "resolved", true);
  assert.equal(origins.subjects.length === 1 && origins.subjects[0].node === initializer("holder"), true, "current instance root");
  const setter = source.ast.members(holder).find(node => source.ast.is.IsSetAccessorDeclaration(node));
  const write = requiredNode(source.ast, file, node => source.ast.is.IsPropertyAccessExpression(node) &&
    source.semantics.forNode(node).operations.propertyAccess(node)?.accessMode === "write");
  const formal = resolvedSubject(storage.subject(source.ast.parameters(setter)[0]), "setter value");
  const substitution = storage.invocationOriginsFor(formal, setter, write);
  assert.equal(substitution.kind === "resolved", true);
  assert.equal(substitution.subjects.length === 1 && source.ast.text(substitution.subjects[0].node) === "7", true, "setter assignment RHS");
});

test("implicit class construction is closed transport and preserves initializer throws", async () => {
  const { source, storage, provider, subject } = await checked("source-storage-implicit-construction", `
const EmptyAlias = Empty;
try { new EmptyAlias(); throwValue(11); } catch (caught) { const emptyCatch = caught; }
try { new Derived(); } catch (caught) { const inheritedCatch = caught; }
try { new Forwarded(17); } catch (caught) { const forwardedCatch = caught; }
`, `
export class Empty {}
export class Initialized { readonly value = throwValue(13); }
export class Derived extends Initialized {}
export class Base { constructor(value: number) { throw value; } }
export class Forwarded extends Base {}
`, ["Empty", "Derived", "Forwarded"]);
  for (const [name, value] of [["emptyCatch", "11"], ["inheritedCatch", "13"], ["forwardedCatch", "17"]]) {
    const selected = subject(name);
    assert.equal(storage.unresolvedFor(selected) === undefined, true, name);
    const origins = originSubjects(storage, selected, name);
    assert.equal(origins.some(origin => source.ast.text(origin.node) === value), true, `${name}: exact thrown origin`);
  }
  const implicit = storage.invocations.filter(invocation => source.ast.is.IsNewExpression(invocation) &&
    source.semantics.forNode(invocation).declarations.signatureDeclaration(
      source.semantics.forNode(invocation).operations.call(invocation).selectedSignature) === undefined);
  assert.equal(implicit.length >= 2, true, "implicit signatures genuinely lack authored declarations");
  assert.equal(storage.boundaries.some(boundary => implicit.includes(boundary.invocation)), false,
    "owned implicit construction is not an opaque native boundary");
  const initialized = namedDeclaration(source.ast, provider, "Initialized");
  assert.equal(source.navigation.classConstructors(initialized).implicit, true);
});

test("generic thrown-value and catch transport belongs to neutral source storage", async () => {
  const { storage, subject, initializer } = await checked("source-storage-generic-catch", `
const original = { value: 3 };
try { throwValue(original); } catch (caught) { const caughtAlias = caught; }
`);
  const origins = originSubjects(storage, subject("caughtAlias"), "generic catch value");
  assert.equal(origins.some(subject => subject.node === initializer("original")), true, "selected throw argument reaches catch");
  const types = storage.originsFor(subject("caughtAlias"));
  assert.equal(types.kind === "resolved", true);
  assert.equal(types.origins.every(origin => Object.isFrozen(origin) && origin.subject.kind === "value"), true);
});

test("early callback storage retains origins and mutable field transport without any target ABI facts", async () => {
  const { source, storage, file } = await checked("source-storage-early-callables", `
export function make(): (value: number) => number {
  let selected: (value: number) => number;
  const original = (value: number): number => value === 0 ? 1 : selected(value - 1);
  const replacement = (value: number): number => value === 0 ? 2 : selected(value - 1);
  selected = original;
  selected = replacement;
  return original;
}
`);
  const original = namedVariable(source.ast, file, "original");
  const replacement = namedVariable(source.ast, file, "replacement");
  const selected = resolvedSubject(storage.subjectFor(namedVariable(source.ast, file, "selected")), "mutable callback slot");
  const roots = originSubjects(storage, selected, "mutable callback origins");
  for (const declaration of [original, replacement]) {
    assert.equal(roots.some(subject => subject.node === source.ast.as.AsVariableDeclaration(declaration).Initializer), true, "authored arrow identity");
  }
  assert.equal(storage.subjects.includes(selected), true, "storage identity is present in sealed graph inventory");
  const incoming = storage.incomingFor(selected);
  assert.equal(incoming.kind === "resolved" && incoming.subjects.length >= 2, true, "real directional slot edges");
});

test("opaque and unproved argument boundaries expose exact nodes without inventing an implementation", async () => {
  const { source, storage, subject, call, provider } = await checked("source-storage-native-boundaries", `
const callback = (): number => 3;
native(callback);
spread(callback);
try { throwRest({ value: 3 }); } catch (caught) { const unprovedCatch = caught; }
function forwardUnproved(): void { throwRest({ value: 7 }); }
try { forwardUnproved(); } catch (caught) { const forwardedUnprovedCatch = caught; }
`, `export declare function native(callback: () => number): void;
export declare function spread(...callbacks: (() => number)[]): void;
export function throwRest(...values: Box<number>[]): never { throw values[0]; }`, ["native", "spread", "throwRest"]);
  const native = call("native");
  const declaration = namedDeclaration(source.ast, provider, "native");
  const boundary = storage.boundaries.find(boundary => boundary.invocation === native);
  assert.equal(boundary !== undefined && boundary.kind === "opaque-invocation" && boundary.declaration === declaration, true);
  assert.equal(boundary.subjects.some(value => value === subject("callback")), true, "exact callback transport subject");
  const formal = resolvedSubject(storage.subject(source.ast.parameters(declaration)[0]), "native formal");
  assert.equal(storage.incomingFor(formal).kind === "resolved" && storage.incomingFor(formal).subjects.includes(subject("callback")), true);
  const rest = call("spread");
  assert.equal(storage.argumentTransportsFor(rest).kind, "unresolved", "unsupported rest transport is explicit, never guessed");
  const restDeclaration = namedDeclaration(source.ast, provider, "spread");
  const restFormal = resolvedSubject(storage.subject(source.ast.parameters(restDeclaration)[0]), "rest formal");
  assert.equal(storage.bindingsForInvocation(restDeclaration, rest).kind, "unresolved", "unsupported bindings cannot manufacture an exact context");
  assert.equal(storage.invocationOriginsFor(restFormal, restDeclaration, rest).kind, "unresolved", "unsupported bindings cannot manufacture scalar origins");
  assert.equal(storage.originSubjectsFor(subject("unprovedCatch")).kind, "unresolved", "unsupported throw argument transport is never guessed");
  assert.equal(storage.originSubjectsFor(subject("forwardedUnprovedCatch")).kind, "unresolved", "unproved throw transport survives callable forwarding");
  assert.equal(storage.boundaries.some(boundary => boundary.invocation === rest && boundary.kind === "unresolved-transport"), true);
  assert.equal(storage.failureReason() === undefined, true, "local boundary does not contaminate independent graph ownership");
});

test("neutral graph results are immutable and Error consumes the identical graph rather than constructing another", async () => {
  const { source, storage, subject, variable } = await checked("source-storage-immutable-shared-owner", `const original = 3; const alias = original;`);
  const selected = subject("alias");
  for (const values of [storage.nodes, storage.subjects, storage.invocations, storage.accessorInvocations, storage.boundaries]) {
    assert.equal(Object.isFrozen(values), true);
  }
  assert.equal(Object.isFrozen(storage) && Object.isFrozen(selected) && Object.isFrozen(selected.projection), true);
  const incoming = storage.incomingFor(selected);
  assert.equal(incoming.kind === "resolved" && Object.isFrozen(incoming) && Object.isFrozen(incoming.subjects), true);
  assert.throws(() => incoming.subjects.push(selected), TypeError);
  const protocol = { fields: [], constructors: [], stackCaptures: [], storageMutators: [], retention: () => ({ kind: "ordinary" }) };
  const first = createSourceErrorStorageDemandQuery(source, protocol, storage);
  const second = createSourceErrorStorageDemandQuery(source, protocol, storage);
  assert.equal(first.storageFor(variable("alias")).kind, "immutable");
  assert.equal(second.storageOriginsFor(variable("alias")).kind, "resolved");
  assert.equal(storage.subjectFor(variable("alias")).subject === selected, true, "shared subject is not rebuilt by Error consumers");
  const foreign = await checked("source-storage-foreign-query", `const original = 3;`);
  assert.equal(storage.incomingFor(foreign.subject("original")).kind, "unresolved", "foreign graph subject rejected");
  assert.equal(storage.subjectFor(foreign.variable("original")).kind, "unresolved", "foreign checker declaration rejected");
  const invalid = createSourceErrorStorageDemandQuery(source, protocol, foreign.storage);
  assert.equal(invalid.storageFor(variable("original")).kind, "unresolved", "Error requires exact source owner");
});

test("the same checked source resolves with adequate limits and rejects every independently tightened graph budget", async () => {
  const { source, variable } = await checked("source-storage-public-finite-limits", `
const original = 3;
const other = 7;
const firstResult = identity(original);
const secondResult = identity(other);
`);
  const admitted = createSourceStorageQuery(source, source.navigation.sourceFiles, defaultSourceStorageLimits);
  const selected = resolvedSubject(admitted.subjectFor(variable("firstResult")), "adequate budget");
  assert.equal(admitted.originsFor(selected).kind, "resolved");
  for (const key of Object.keys(defaultSourceStorageLimits)) {
    const rejected = createSourceStorageQuery(source, source.navigation.sourceFiles, { ...defaultSourceStorageLimits, [key]: 1 });
    assert.equal(rejected.failureReason() !== undefined, true, key);
    assert.equal(rejected.subjectFor(variable("firstResult")).kind, "unresolved", key);
    const errors = createSourceErrorStorageDemandQuery(source,
      { fields: [], constructors: [], stackCaptures: [], storageMutators: [], retention: () => ({ kind: "ordinary" }) }, rejected);
    assert.equal(errors.storageFor(variable("firstResult")).kind, "unresolved", "exhaustion cannot manufacture Error immutability");
  }
});
