import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, createSourceErrorDeclarationQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { checkedSource, namedDeclaration, namedMember, namedVariable, projectSourceFile, requiredNode } from "../fixtures/source-navigation.mjs";
import { createSourceStorageStoredValues } from "../../packages/target-api/dist/target-analysis/source-storage/graph/stored-values.js";
import { createSourceStorageBudget } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

const globals = `
interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
interface Number {} interface String {} interface RegExp {}
interface Array<T> { [index: number]: T; length: number; }
interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
`;
const element = Object.freeze([{ kind: "array-element" }]);
const slot = index => Object.freeze([{ kind: "tuple-element", index }]);

test("removed indexed-value storage descriptors are rejected without erasing indexed type evidence", async () => {
  const current = await checked("source-storage-removed-indexed-value", `
interface Values { [key: string]: object | undefined; }
const values: Values = {};
`);
  const declaration = current.variable("values");
  const semantics = current.source.semantics.forNode(declaration);
  const type = semantics.declarations.declaredValueType(declaration);
  assert.equal(type !== undefined, true, "the original checked indexed type remains available");
  const index = semantics.types.indexInfos(type)[0];
  assert.equal(index !== undefined && index.keyType !== undefined && index.valueType !== undefined, true,
    "independent indexed type evidence is preserved");
  const selected = current.storage.storageSubjectFor(declaration, [{ kind: "indexed-value",
    sourceType: type, ownerType: type, index }]);
  assert.equal(selected.kind, "unresolved", "the removed storage descriptor has no compatibility admission path");
  assert.equal(selected.reason, "A source storage query has no exact checked subject.",
    "the removed form is refused at the public data boundary");
  assert.equal(current.storage.failureReason(), undefined,
    "unsupported external data cannot poison the retained storage graph");
});

test("array component transport follows exact inherited numeric indexes rather than interface arguments", async () => {
  const { source, storage, variable, initializer } = await checked("source-storage-array-facades", `
const firstToken = {};
const secondToken = {};
const replacement = {};
const tokens: object[] = [firstToken, secondToken];
const alias: MoreTokens = tokens;
tokens[0] = replacement;
const generic: Values<object> = alias;
const redirected: Redirect<string> = generic;
const nested: Values<MoreTokens> = [alias];
const selected = head(head(nested));
`, `
export interface Tokens extends ReadonlyArray<object> {}
export interface MoreTokens extends Tokens {}
export interface Values<T> extends ReadonlyArray<T> {}
export interface Redirect<Unused> extends ReadonlyArray<object> {}
export function head<T>(values: Values<T>): T { return values[0]; }
`, ["MoreTokens", "Values", "Redirect", "head"]);
  for (const name of ["alias", "generic", "redirected"]) {
    const subject = resolvedSubject(storage.storageSubjectFor(variable(name), element), name);
    const type = storage.typeFor(subject);
    assert.equal(type.kind === "resolved", true, `${name}: inherited index type`);
    assert.equal(source.semantics.forNode(variable(name)).types.isNonPrimitive(type.type), true,
      `${name}: exact object element, not the unrelated generic string argument`);
    const origins = storage.closedOriginsFor(subject);
    assert.equal(origins.kind === "complete", true, `${name}: closed shared backing`);
    for (const token of ["firstToken", "secondToken", "replacement"]) {
      assert.equal(origins.origins.some(origin => origin.subject.node === initializer(token)), true,
        `${name}: exact ${token} write origin`);
    }
  }
  const nested = resolvedSubject(storage.storageSubjectFor(variable("nested"), [...element, ...element]), "nested facade");
  const selected = resolvedSubject(storage.subjectFor(variable("selected")), "generic cross-file selected element");
  for (const subject of [nested, selected]) {
    const origins = storage.closedOriginsFor(subject);
    assert.equal(origins.kind === "complete", true, "generic facade preserves element completeness");
    assert.equal(origins.origins.every(origin => source.ast.is.IsObjectLiteralExpression(origin.subject.node)), true,
      "exact allocation nodes survive cross-file generic selection");
  }
  assert.equal(storage.failureReason() === undefined, true, "bounded query remains complete");
});

test("array facades do not turn external element writes or numeric records into closed array evidence", async () => {
  const { storage, variable } = await checked("source-storage-open-array-facades", `
const tokens: object[] = [{}];
export let exposed: MoreTokens = tokens;
const selected = exposed[0];
const indexed: { [index: number]: object } = { 0: {} };
`, `export interface MoreTokens extends ReadonlyArray<object> {}`, ["MoreTokens"]);
  const subject = resolvedSubject(storage.storageSubjectFor(variable("exposed"), element), "exposed elements");
  for (const selected of [storage.closedOriginsFor(subject),
    storage.closedOriginsFor(resolvedSubject(storage.subjectFor(variable("selected")), "selected exposed element"))]) {
    assert.equal(selected.kind === "open", true, "external element provenance remains open");
    assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-write"), true,
      "actual external writer is not discharged by a local array origin");
  }
  assert.equal(storage.storageSubjectFor(variable("indexed"), element).kind, "unresolved",
    "a numeric index alone is not checker-recognized array storage");
});

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

test("ordinary physical store readers preserve first and later producers through repeated enumeration", async () => {
  const current = await checked("source-storage-repeatable-ordinary-stores", `
const original = {}; const replacement = {};
let slot = original; slot = replacement;
`);
  const { source, file, variable, subject, initializer } = current;
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const inventory = createSourceStorageStoredValues(source.ast, budget, () => file, () => undefined, () => false);
  const slot = subject("slot"); const original = subject("original"); const replacement = subject("replacement");
  inventory.initialize(slot, initializer("slot"), original);
  const stores = inventory.storesFor(slot);
  const first = [...stores];
  assert.equal(first.length === 1 && first[0].value === original && first[0].storage === slot, true,
    "the only initialization retains its identical producer and binding");
  const repeated = [...stores];
  assert.equal(repeated.length === 1 && repeated[0] === first[0], true,
    "a stored iterable starts a new traversal without copying or reconstructing store records");
  const inputs = inventory.inputsFor(slot);
  for (let repetition = 0; repetition < 2; repetition += 1) {
    const values = [...inputs];
    assert.equal(values.length === 1 && values[0] === original, true,
      "physical destination discovery cannot consume the sole initialization producer");
  }
  assert.equal(inventory.unresolvedFor(slot) === undefined, true, "a valid first producer has no invented refusal");
  const assignment = requiredNode(source.ast, file, source.ast.is.IsBinaryExpression);
  const reference = source.ast.as.AsBinaryExpression(assignment).Left;
  inventory.recordWrite(slot, { reference, operation: assignment, kind: "mutation", value: replacement,
    values: [{ source: undefined, subjects: [replacement], reason: undefined }] });
  for (let repetition = 0; repetition < 2; repetition += 1) {
    const stored = [...stores];
    const values = [...inventory.inputsFor(slot)];
    assert.equal(stored.length === 2 && stored[0] === first[0] && stored[1].reference === reference &&
      stored[1].value === replacement, true, "repeated store queries retain initialization and mutation in checked insertion order");
    assert.equal(values.length === 2 && values[0] === original && values[1] === replacement, true,
      "physical input queries never drop or reorder the first of multiple real producers");
  }
  assert.equal(variable("slot") === slot.node && budget.failure() === undefined, true,
    "the original checked binding and finite guard remain authoritative");
});

test("ordinary physical store readers retain the first precise refusal through repeated queries", async () => {
  const current = await checked("source-storage-repeatable-ordinary-refusal", `const original = {}; let slot = original;`);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const inventory = createSourceStorageStoredValues(current.source.ast, budget, () => current.file, () => undefined, () => false);
  const slot = current.subject("slot");
  const reference = current.initializer("slot");
  const reason = "Source storage writes require their exact checked original value producer, iteration element and component projection.";
  inventory.recordWrite(slot, { reference, operation: slot.node, kind: "initialization",
    values: [{ source: undefined, subjects: [], reason }], reason });
  const stores = inventory.storesFor(slot);
  const first = [...stores];
  for (let repetition = 0; repetition < 2; repetition += 1) {
    const repeated = [...stores];
    assert.equal(repeated.length === 1 && repeated[0] === first[0] && repeated[0].reference === reference &&
      repeated[0].reason === reason, true, "the original failed store keeps its exact identity and refusal");
    assert.equal(inventory.unresolvedFor(slot), reason, "physical destination discovery cannot silently consume a first-store refusal");
    assert.equal([...inventory.inputsFor(slot)].length, 0, "a precise rejected producer is never fabricated as physical input");
  }
  assert.equal(budget.failure() === undefined, true, "a source refusal is not finite-budget exhaustion");
});

test("fresh storage allocations preserve exact expression types independently of declared bindings", async () => {
  const { source, storage, variable, initializer } = await checked("source-storage-fresh-allocation-types", `
const empty: { value?: number } = {};
const array: readonly number[] = [3];
const record = { value: 7 };
`);
  for (const name of ["empty", "array", "record"]) {
    const allocation = initializer(name);
    const semantics = source.semantics.forNode(allocation);
    const selected = resolvedSubject(storage.subject(allocation), `${name}: allocation`);
    assert.equal(selected.node === allocation, true, `${name}: exact allocation subject`);
    const type = storage.typeFor(selected);
    assert.equal(type.kind, "resolved", `${name}: exact allocation type`);
    assert.equal(semantics.types.isIdentical(type.type, semantics.types.expressionType(allocation)), true, `${name}: exact checker expression identity`);
    const binding = storage.typeFor(resolvedSubject(storage.subjectFor(variable(name)), `${name}: binding`));
    assert.equal(binding.kind, "resolved", `${name}: exact binding type`);
    assert.equal(semantics.types.isIdentical(binding.type, semantics.declarations.declaredValueType(variable(name))), true, `${name}: declared storage retained`);
    if (name === "empty") {
      assert.equal(semantics.types.propertyInfos(type.type).length, 0, "fresh empty producer has no invented contextual members");
      assert.equal(semantics.types.propertyInfos(binding.type).length, 1, "declared optional member belongs to binding only");
    }
    const origins = storage.originsFor(selected);
    assert.equal(origins.kind, "resolved", `${name}: allocation origin`);
    assert.equal(origins.origins.length, 1, `${name}: one producer`);
    assert.equal(origins.origins[0].subject.node === allocation, true, `${name}: exact producer node`);
    assert.equal(semantics.types.isIdentical(origins.origins[0].type, type.type), true, `${name}: exact checker origin identity`);
  }
});

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

test("recursive optional collection transport resolves only demanded exact component paths", async () => {
  const { storage, variable, initializer } = await checked("source-storage-recursive-components", `
type Children = readonly Children[] | null | undefined;
const original: Children = [[null]];
const alias: Children = original;
const independent: Children = [[undefined]];
`);
  const before = storage.subjects.length;
  assert.ok(before < 200, "recursive type does not expand an unbounded subject graph");
  for (const depth of [1, 2, 8, 64]) {
    const projection = Array.from({ length: depth }, () => ({ kind: "array-element" }));
    const selected = resolvedSubject(storage.storageSubjectFor(variable("alias"), projection), `depth ${depth}`);
    const parents = storage.incomingFor(selected);
    assert.equal(parents.kind, "resolved", `exact depth ${depth}`);
    const read = resolvedSubject(storage.storageSubjectFor(initializer("alias"), projection), `read depth ${depth}`);
    assert.equal(parents.subjects.length === 1 && parents.subjects[0] === read, true,
      `exact immediate alias read at depth ${depth}`);
    const declarations = storage.incomingFor(read);
    assert.equal(declarations.kind === "resolved" && declarations.subjects.length === 1 &&
      declarations.subjects[0].node === variable("original") && declarations.subjects[0].projection.length === depth, true,
    `exact read-to-declaration correspondence at depth ${depth}`);
    assert.equal(parents.subjects.some(parent => parent.node === variable("independent") || parent.node === initializer("independent")), false,
      "independent container is not an origin");
  }
  const exact = resolvedSubject(storage.storageSubjectFor(variable("alias"), [...element, ...element]), "exact nested origin");
  const origins = originSubjects(storage, exact, "recursive nested origins");
  assert.equal(origins.some(origin => origin.node === initializer("independent")), false);
  assert.equal(storage.failureReason() === undefined, true, "bounded recursive query succeeds");
});

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
  assert.equal(arguments_.arguments[0].actual.node === source.ast.arguments(invocation)[0], true, "selected actual read occurrence");
  const actualOrigins = storage.incomingFor(arguments_.arguments[0].actual);
  assert.equal(actualOrigins.kind === "resolved" && actualOrigins.subjects.length === 1 &&
    actualOrigins.subjects[0].node === variable("original"), true, "selected actual read retains its exact declaration");
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
  assert.equal(Object.isFrozen(left.bindings) && left.bindings.kind === "source-storage-bindings" &&
    Object.isFrozen(original.subjects) && Object.isFrozen(other.subjects) &&
    original.subjects.every(Object.isFrozen) && other.subjects.every(Object.isFrozen), true);
  const forged = Object.freeze({ kind: left.bindings.kind });
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
  let lengthReads = 0;
  const observed = new Proxy([...slot(0)], { get(target, key, receiver) {
    if (key === "length") { lengthReads += 1; throw new Error("projection length reads must not execute"); }
    return Reflect.get(target, key, receiver);
  } });
  const expected = storage.storageSubjectFor(variable("values"), slot(0));
  const selected = storage.storageSubjectFor(variable("values"), observed);
  assert.equal(expected.kind === "resolved" && selected.kind === "resolved" && selected.subject === expected.subject, true,
    "checked data-only entries retain the one canonical tuple location");
  assert.equal(lengthReads, 0, "the source boundary reads the owned length descriptor, never an ordinary property getter");
  let entryVisits = 0;
  const oversized = new Proxy(new Array(257), { getOwnPropertyDescriptor(target, key) {
    if (key !== "length") entryVisits += 1;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  assert.equal(storage.storageSubjectFor(variable("values"), oversized).kind, "unresolved",
    "the unchanged finite projection ceiling rejects oversized input before entry admission");
  assert.equal(entryVisits, 0, "a refused path causes no input-sized descriptor walk");
  assert.equal(storage.failureReason(), undefined, "rejected public evidence does not poison the checked graph");
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

test("dependency reconciliation discovers chained returned callables before propagating their exact thrown values", async () => {
  const { storage, subject, initializer } = await checked("source-storage-chained-callable-throws", `
const token = { value: 9 };
function leaf(): never { throw token; }
function middle(): () => never { return leaf; }
function outer(): () => never { return middle(); }
try { outer()(); } catch (caught) { const caughtAlias = caught; }
`);
  const origins = originSubjects(storage, subject("caughtAlias"), "chained returned callable");
  assert.equal(origins.some(origin => origin.node === initializer("token")), true,
    "a late discovered invocation implementation retains its original throw origin");
  assert.equal(storage.unresolvedFor(subject("caughtAlias")) === undefined, true);
  assert.equal(storage.failureReason() === undefined, true);
});

test("dependency reconciliation propagates both origins through mutually recursive thrown regions", async () => {
  const { storage, subject, initializer } = await checked("source-storage-recursive-region-throws", `
const firstToken = { value: 1 };
const secondToken = { value: 2 };
function left(stop: boolean): never { if (stop) throw firstToken; return right(true); }
function right(stop: boolean): never { if (stop) throw secondToken; return left(true); }
try { right(true); } catch (caught) { const caughtAlias = caught; }
`);
  const origins = originSubjects(storage, subject("caughtAlias"), "recursive thrown regions");
  for (const name of ["firstToken", "secondToken"]) assert.equal(origins.some(origin => origin.node === initializer(name)), true,
    `${name}: dynamic thrown facts cannot use an immutable candidate once gate`);
  assert.equal(storage.unresolvedFor(subject("caughtAlias")) === undefined, true);
  assert.equal(storage.failureReason() === undefined, true);
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
  const { source, storage, subject, call, provider, file } = await checked("source-storage-native-boundaries", `
const callback = (): number => 3;
declare const externalCallbacks: (() => number)[];
native(callback);
spread(callback);
spread(...externalCallbacks);
positional(...externalCallbacks);
try { throwRest({ value: 3 }); } catch (caught) { const unprovedCatch = caught; }
function forwardUnproved(): void { throwRest({ value: 7 }); }
try { forwardUnproved(); } catch (caught) { const forwardedUnprovedCatch = caught; }
`, `export declare function native(callback: () => number): void;
export declare function spread(...callbacks: (() => number)[]): void;
export declare function positional(callback?: () => number, ...callbacks: (() => number)[]): void;
export function throwRest(...values: Box<number>[]): never { throw values[0]; }`, ["native", "spread", "positional", "throwRest"]);
  const native = call("native");
  const declaration = namedDeclaration(source.ast, provider, "native");
  const boundary = storage.boundaries.find(boundary => boundary.invocation === native);
  assert.equal(boundary !== undefined && boundary.kind === "opaque-invocation" && boundary.declaration === declaration, true);
  const callbackRead = resolvedSubject(storage.subjectFor(source.ast.arguments(native)[0]), "callback read");
  assert.equal(boundary.subjects.some(value => value === callbackRead), true, "exact callback read transport subject");
  const callbackSource = storage.incomingFor(callbackRead);
  assert.equal(callbackSource.kind === "resolved" && callbackSource.subjects.length === 1 &&
    callbackSource.subjects[0] === subject("callback"), true, "callback read retains its exact source declaration");
  const formal = resolvedSubject(storage.subject(source.ast.parameters(declaration)[0], "input"), "native formal input");
  assert.equal(storage.incomingFor(formal).kind === "resolved" && storage.incomingFor(formal).subjects.includes(callbackRead), true);
  const rest = requiredNode(source.ast, file, node => source.ast.is.IsCallExpression(node) &&
    source.ast.text(source.ast.as.AsCallExpression(node).Expression) === "spread" &&
    !source.ast.is.IsSpreadElement(source.ast.arguments(node)[0]));
  const restActual = resolvedSubject(storage.subjectFor(source.ast.arguments(rest)[0]), "concrete rest actual");
  const arguments_ = storage.argumentTransportsFor(rest);
  assert.equal(arguments_.kind === "resolved" && arguments_.arguments.length === 1 &&
    arguments_.arguments[0].actual === restActual && arguments_.arguments[0].formal.projection.length === 1 &&
    arguments_.arguments[0].formal.projection[0].kind === "array-element", true,
  "the concrete checked argument retains its selected rest element slot");
  const restDeclaration = namedDeclaration(source.ast, provider, "spread");
  const restFormal = resolvedSubject(storage.subject(source.ast.parameters(restDeclaration)[0]), "rest formal");
  assert.equal(storage.bindingsForInvocation(restDeclaration, rest).kind, "resolved", "the concrete slot has an exact invocation context");
  const restOrigins = storage.invocationOriginsFor(restFormal, restDeclaration, rest);
  assert.equal(restOrigins.kind === "resolved" && restOrigins.subjects.length === 1 && restOrigins.subjects[0] === restFormal, true,
    "the unprojected rest container is not replaced with a scalar callback origin");
  assert.equal(storage.originSubjectsFor(subject("unprovedCatch")).kind, "unresolved", "unsupported throw argument transport is never guessed");
  assert.equal(storage.originSubjectsFor(subject("forwardedUnprovedCatch")).kind, "unresolved", "unproved throw transport survives callable forwarding");
  assert.equal(storage.boundaries.some(boundary => boundary.invocation === rest && boundary.kind === "opaque-invocation"), true);
  const unknownRest = requiredNode(source.ast, file, node => source.ast.is.IsCallExpression(node) &&
    source.ast.text(source.ast.as.AsCallExpression(node).Expression) === "spread" &&
    source.ast.is.IsSpreadElement(source.ast.arguments(node)[0]));
  const spreadArgument = source.ast.arguments(unknownRest)[0];
  const spreadActual = resolvedSubject(storage.subjectFor(source.ast.as.AsSpreadElement(spreadArgument).Expression), "spread source");
  const actualElements = resolvedSubject(storage.subject(spreadActual.node, spreadActual.kind,
    [...spreadActual.projection, ...element]), "spread source elements");
  const formalElements = resolvedSubject(storage.subject(restFormal.node, "input",
    [...restFormal.projection, ...element]), "spread formal elements");
  const checkedSpread = source.semantics.forNode(unknownRest).operations.call(unknownRest);
  assert.equal(checkedSpread.sourceArgumentBindings.length === 1 &&
    checkedSpread.sourceArgumentBindings[0].sourceForm === "spread-sequence" &&
    checkedSpread.sourceArgumentBindings[0].sourceParameterForm === "rest-sequence", true,
    "the checked unknown-length spread has aggregate rather than scalar correspondence");
  const spreadTransport = storage.argumentTransportsFor(unknownRest);
  assert.equal(spreadTransport.kind === "resolved" && spreadTransport.arguments.length === 1 &&
    spreadTransport.arguments[0].actual === actualElements && spreadTransport.arguments[0].formal === formalElements &&
    spreadTransport.arguments[0].selectedParameterDeclaration === restFormal.node, true,
    "unknown-length aggregate transport preserves the exact actual and formal element subjects; " + JSON.stringify({
      kind: spreadTransport.kind, reason: spreadTransport.reason,
      count: spreadTransport.arguments?.length,
      actual: spreadTransport.arguments?.[0]?.actual === actualElements,
      formal: spreadTransport.arguments?.[0]?.formal === formalElements,
      declaration: spreadTransport.arguments?.[0]?.selectedParameterDeclaration === restFormal.node,
    }));
  assert.equal(storage.bindingsForInvocation(restDeclaration, unknownRest).kind, "resolved", "checked aggregate invocation bindings");
  const aggregateOrigins = storage.invocationOriginsFor(restFormal, restDeclaration, unknownRest);
  assert.equal(aggregateOrigins.kind === "resolved" && aggregateOrigins.subjects.length === 1 &&
    aggregateOrigins.subjects[0] === restFormal, true, "aggregate elements never replace the fresh rest container");
  const implementations = storage.invocationImplementationsFor(unknownRest);
  assert.equal(implementations.kind === "resolved" && !implementations.exact &&
    implementations.nodes.every(node => source.ast.body(node) === undefined), true,
    "an ambient rest signature does not invent an original implementation");
  const externalElements = storage.closedOriginsFor(actualElements);
  assert.equal(externalElements.kind === "open" &&
    externalElements.boundaries.some(boundary => boundary.kind === "external-input"), true,
    "ambient callback elements retain their genuinely open input domain");
  assert.equal(storage.boundaries.some(boundary => boundary.invocation === unknownRest &&
    boundary.kind === "opaque-invocation"), true, "aggregate correspondence does not close an opaque consumer");
  const unknownPositional = call("positional");
  const positionalDeclaration = namedDeclaration(source.ast, provider, "positional");
  const positionalFormal = resolvedSubject(storage.subject(source.ast.parameters(positionalDeclaration)[0], "input"), "positional formal");
  const checkedPositional = source.semantics.forNode(unknownPositional).operations.call(unknownPositional);
  assert.equal(checkedPositional.sourceArgumentBindings.some(binding => binding.sourceForm === "spread-sequence" &&
    binding.sourceParameterForm !== "rest-sequence"), true,
    "the refused spread genuinely requires an unproved scalar position");
  const reason = "Source storage argument transport requires exact selected scalar formal and actual subjects.";
  for (const selected of [storage.argumentTransportsFor(unknownPositional),
    storage.bindingsForInvocation(positionalDeclaration, unknownPositional),
    storage.invocationOriginsFor(positionalFormal, positionalDeclaration, unknownPositional)]) {
    assert.equal(selected.kind === "unresolved" && selected.reason === reason, true,
      "an unknown scalar position retains its exact transport refusal");
  }
  assert.equal(storage.boundaries.some(boundary => boundary.invocation === unknownPositional &&
    boundary.kind === "unresolved-transport" && boundary.reason === reason), true);
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
  const protocol = { fields: [], constructors: [], scalarMutators: [] };
  const first = createSourceErrorDeclarationQuery(source, protocol);
  const second = createSourceErrorDeclarationQuery(source, protocol);
  assert.equal(first.mutationFor(selected.node).kind, "not-applicable", "a neutral binding is not an Error mutation declaration");
  assert.equal(storage.originsFor(selected).kind, "resolved", "the original independent storage query is still the origin owner");
  assert.equal(storage.subjectFor(variable("alias")).subject === selected, true, "shared subject is not rebuilt by Error consumers");
  const foreign = await checked("source-storage-foreign-query", `const original = 3;`);
  assert.equal(storage.incomingFor(foreign.subject("original")).kind, "unresolved", "foreign graph subject rejected");
  assert.equal(storage.subjectFor(foreign.variable("original")).kind, "unresolved", "foreign checker declaration rejected");
  const invalid = createSourceErrorDeclarationQuery(foreign.source, protocol);
  assert.equal(invalid.mutationFor(selected.node).kind, "unresolved", "Error requires the exact checked source owner");
  assert.equal(second.parameterFor(foreign.variable("original")).kind, "unresolved", "foreign declarations cannot publish a formal input");
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
    const errors = createSourceErrorDeclarationQuery(source, { fields: [], constructors: [], scalarMutators: [] });
    assert.equal(rejected.originsFor(selected).kind, "unresolved", "exhaustion cannot manufacture an original storage proof");
    assert.equal(errors.mutationFor(selected.node).kind, "not-applicable", "an unrelated exhausted graph does not decide native Error admission");
  }
});
