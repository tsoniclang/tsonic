import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceErrorStorageDemandQuery, createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/model/subjects.js";
import { createSourceStorageUnresolvedQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph/unresolved.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile, requiredNode, requiredStorageSubject } from "../fixtures/source-navigation.mjs";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

const globals = `
interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
interface Number {} interface String {} interface RegExp {} interface Array<T> { [index: number]: T; length: number; }
interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
`;
const element = Object.freeze([{ kind: "array-element" }]);
const slot = index => Object.freeze([{ kind: "tuple-element", index }]);

test("storage origins retain exact projected unknown types through parameters and returns", async () => {
  const { source, file, demands, storage } = await checked("error-storage-exact-origin-types", `
export function forward(value: unknown): unknown { return value; }
export function forwardArray(values: unknown[]): unknown[] { return values; }
export function forwardTuple(values: [Stored, unknown]): [Stored, unknown] { return values; }
`);
  for (const [name, projection] of [["forward", []], ["forwardArray", element], ["forwardTuple", slot(1)]]) {
    const declaration = namedDeclaration(source.ast, file, name);
    const parameter = source.ast.parameters(declaration)[0];
    const origins = demands.storageOriginsFor(requiredStorageSubject(storage, declaration, projection));
    assert.equal(origins.kind === "resolved", true, name);
    assert.equal(origins.origins.length, 1, name);
    assert.equal(origins.origins[0].node === parameter, true, name);
    assert.equal(source.semantics.forNode(parameter).types.isUnknown(origins.origins[0].type), true, name);
    assert.equal(Object.isFrozen(origins) && Object.isFrozen(origins.origins) &&
      Object.isFrozen(origins.origins[0]), true, name);
  }
});

async function checked(name, body) {
  const result = await checkedSource(name, {
    "globals.d.ts": globals,
    "src/values.ts": `
export interface Stored { message: string; }
export function mutate(values: Stored[]): void { values[0].message = "changed"; }
export function tuple(values: [Stored, Stored]): void { values[1].message = "changed"; }
export function nested(values: Stored[][]): Stored[] { return values[0]; }
`,
    "src/index.ts": `import { Stored, mutate, tuple, nested } from "./values.js"; ${body}`,
  });
  assert.equal(result.diagnostics.length, 0, formatDiagnostics(result.diagnostics, "/src"));
  const source = createTargetSourceProgram(result);
  const file = projectSourceFile(source, "src/index.ts");
  const provider = projectSourceFile(source, "src/values.ts");
  const declaration = namedDeclaration(source.ast, provider, "Stored");
  const field = source.ast.members(declaration).find(node => source.ast.text(source.ast.name(node)) === "message");
  assert.equal(field !== undefined, true, "checked storage field");
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
  const demands = createSourceErrorStorageDemandQuery(source,
    { fields: [field], constructors: [], stackCaptures: [], storageMutators: [], retention: () => ({ kind: "ordinary" }) },
    storage);
  return { source, file, provider, demands, storage, variable: name => namedVariable(source.ast, file, name) };
}

test("Error array storage transports exact element demand through aliases and cross-file parameters", async () => {
  const { source, demands, variable, storage } = await checked("error-array-storage-components", `
const original = { message: "original" };
const untouched = { message: "untouched" };
const values: Stored[] = [original];
const alias = values;
mutate(alias);
`);
  assert.equal(demands.storageFor(requiredStorageSubject(storage, variable("original"))).kind, "writable");
  assert.equal(demands.storageFor(requiredStorageSubject(storage, variable("untouched"))).kind, "immutable");
  assert.equal(demands.storageFor(requiredStorageSubject(storage, variable("values"))).kind, "immutable", "container identity is not its element");
  assert.equal(demands.storageFor(requiredStorageSubject(storage, variable("values"), element)).kind, "writable");
  assert.equal(demands.storageFor(requiredStorageSubject(storage, variable("alias"), element)).kind, "writable");
  const origins = demands.storageOriginsFor(requiredStorageSubject(storage, variable("alias"), element));
  assert.equal(origins.kind, "resolved");
  assert.equal(origins.origins.some(origin => origin.node === source.ast.as.AsVariableDeclaration(variable("original")).Initializer), true, "exact original element");
  assert.equal(origins.origins.some(origin => origin.node === source.ast.as.AsVariableDeclaration(variable("untouched")).Initializer), false, "independent value is excluded");
  assert.equal(origins.origins.every(origin => {
    const semantics = source.semantics.forNode(origin.node);
    const selected = semantics.declarations.declaredValueType(origin.node) ?? semantics.types.expressionType(origin.node);
    return Object.isFrozen(origin) && selected !== undefined && semantics.types.isIdentical(origin.type, selected);
  }), true, "immutable exact checked origin type");
});

test("Error tuple storage keeps independently selected positions and nested returned aliases", async () => {
  const { demands, variable, storage } = await checked("error-tuple-storage-components", `
const first = { message: "first" };
const second = { message: "second" };
const values: [Stored, Stored] = [first, second];
tuple(values);
const nestedOriginal = { message: "nested" };
const outer: Stored[][] = [[nestedOriginal]];
const result = nested(outer);
mutate(result);
`);
  assert.equal(demands.storageFor(requiredStorageSubject(storage, variable("first"))).kind, "immutable");
  assert.equal(demands.storageFor(requiredStorageSubject(storage, variable("second"))).kind, "writable");
  assert.equal(demands.storageFor(requiredStorageSubject(storage, variable("values"), slot(0))).kind, "immutable");
  assert.equal(demands.storageFor(requiredStorageSubject(storage, variable("values"), slot(1))).kind, "writable");
  assert.equal(demands.storageFor(requiredStorageSubject(storage, variable("nestedOriginal"))).kind, "writable");
  assert.equal(demands.storageFor(requiredStorageSubject(storage, variable("outer"), [...element, ...element])).kind, "writable");
});

test("Error array destructuring retains scalar origin rather than treating the binding as opaque storage", async () => {
  const { demands, variable, storage } = await checked("error-array-destructuring-components", `
const original = { message: "original" };
const untouched = { message: "untouched" };
const values: Stored[] = [original];
const [selected] = values;
selected.message = "changed";
`);
  assert.equal(demands.storageFor(requiredStorageSubject(storage, variable("original"))).kind, "writable");
  assert.equal(demands.storageFor(requiredStorageSubject(storage, variable("untouched"))).kind, "immutable");
  assert.equal(demands.storageFor(requiredStorageSubject(storage, variable("values"), element)).kind, "writable");
});

test("Error tuple-to-array transport and tuple spreads preserve every exact originating element", async () => {
  const { demands, variable, storage } = await checked("error-tuple-array-component-transport", `
const first = { message: "first" };
const second = { message: "second" };
const untouched = { message: "untouched" };
const values: [Stored, Stored] = [first, second];
const array: Stored[] = values;
const spread: Stored[] = [...values];
mutate(array);
mutate(spread);
`);
  for (const name of ["first", "second"]) assert.equal(demands.storageFor(requiredStorageSubject(storage, variable(name))).kind, "writable", name);
  assert.equal(demands.storageFor(requiredStorageSubject(storage, variable("untouched"))).kind, "immutable");
  assert.equal(demands.storageFor(requiredStorageSubject(storage, variable("values"), slot(0))).kind, "writable");
  assert.equal(demands.storageFor(requiredStorageSubject(storage, variable("values"), slot(1))).kind, "writable");
  for (const name of ["array", "spread"]) {
    const origins = demands.storageOriginsFor(requiredStorageSubject(storage, variable(name), element));
    assert.equal(origins.kind, "resolved", name);
    assert.equal(origins.origins.length, 2, "both tuple positions, not a manufactured array element");
  }
});

test("Error writes through proven scalar bindings retain writable demand and exact closed origins without changing independent storage", async () => {
  const { source, file, demands, variable, storage } = await checked("error-unproved-scalar-binding", `
const original: Stored = { message: "original" };
const container = { value: original };
const { value: selected } = container;
const untouched = { message: "untouched" };
selected.message = "changed";
`);
  const binding = requiredNode(source.ast, file, node => source.ast.is.IsBindingElement(node));
  const selected = requiredStorageSubject(storage, binding);
  assert.equal(demands.storageFor(selected).kind, "writable", "the proven binding retains its actual mutation demand");
  const origins = demands.closedStorageOriginsFor(selected);
  const original = source.ast.as.AsVariableDeclaration(variable("original")).Initializer;
  assert.equal(origins.kind, "complete", "the proven binding has closed physical-origin evidence");
  assert.equal(origins.origins.length, 1, "exactly the original object allocation");
  assert.equal(origins.origins[0].subject.node === original, true, "the exact original object identity");
  assert.equal(origins.origins[0].subject.projection.length, 0, "the complete original allocation has no projection");
  const independent = demands.storageFor(requiredStorageSubject(storage, variable("untouched")));
  assert.equal(independent.kind, "immutable", independent.kind === "unresolved" ? independent.reason : "independent owner is unaffected");
});

for (const [name, statements] of [
  ["named property", `const container = { value: original }; const { value: selected } = container;`],
  ["shorthand property", `const container = { original }; const { original: selected } = container;`],
  ["nested properties", `const container = { outer: { value: original } }; const { outer: { value: selected } } = container;`],
]) {
  test(`Error literal-member mutation reaches the original physical allocation through ${name}`, async () => {
    const { source, file, provider, demands, variable, storage } = await checked(`error-literal-member-${name}`, `
const original: Stored = { message: "original" };
${statements}
const untouched = { message: "untouched" };
selected.message = "changed";
`);
    const binding = requiredNode(source.ast, file, node => source.ast.is.IsBindingElement(node) &&
      source.ast.is.IsIdentifier(source.ast.name(node)) && source.ast.text(source.ast.name(node)) === "selected");
    const selectedSubject = requiredStorageSubject(storage, binding);
    const selected = demands.storageFor(selectedSubject);
    assert.equal(selected.kind, "writable", `${name}: selected storage is writable`);
    assert.equal(selected.writes.length, 1, `${name}: one exact write`);
    const original = source.ast.as.AsVariableDeclaration(variable("original")).Initializer;
    assert.equal(original !== undefined && source.ast.is.IsObjectLiteralExpression(original), true, `${name}: checked original allocation`);
    for (const node of [variable("original"), original]) {
      const physical = demands.storageFor(requiredStorageSubject(storage, node));
      assert.equal(physical.kind, "writable", `${name}: original ${source.ast.kindName(node)} storage is writable`);
      assert.equal(physical.writes.length, 1, `${name}: original storage receives one write`);
      assert.equal(physical.writes[0] === selected.writes[0], true, `${name}: original receives the identical mutation`);
    }
    const origins = demands.closedStorageOriginsFor(selectedSubject);
    assert.equal(origins.kind, "complete", `${name}: selected origin is closed`);
    assert.equal(origins.origins.length, 1, `${name}: one original allocation`);
    assert.equal(origins.origins[0].subject.node === original, true, `${name}: exact original allocation identity`);
    assert.equal(origins.origins[0].subject.projection.length, 0, `${name}: the origin is the allocation itself`);
    const field = source.ast.members(namedDeclaration(source.ast, provider, "Stored"))[0];
    assert.equal(field !== undefined, true, `${name}: checked Stored.message declaration`);
    const component = demands.closedStorageOriginsFor(requiredStorageSubject(storage, binding, [{ kind: "member", declaration: field }]));
    const originalMessage = requiredNode(source.ast, original, node => source.ast.is.IsStringLiteral(node));
    const writeOperation = source.ast.parent(selected.writes[0]);
    assert.equal(writeOperation !== undefined && source.ast.is.IsBinaryExpression(writeOperation), true, `${name}: actual checked assignment`);
    const writtenMessage = source.ast.as.AsBinaryExpression(writeOperation).Right;
    assert.equal(writtenMessage !== undefined && source.ast.is.IsStringLiteral(writtenMessage), true, `${name}: actual checked assignment RHS`);
    assert.equal(writtenMessage === originalMessage, false, `${name}: initializer and assignment have distinct checked identities`);
    assert.equal(component.kind, "complete", `${name}: selected message origin is closed`);
    assert.equal(component.origins.length, 2, `${name}: exactly the initializer and assigned message values`);
    assert.equal(component.origins.some(origin => origin.subject.node === originalMessage), true, `${name}: exact original message initializer identity`);
    assert.equal(component.origins.some(origin => origin.subject.node === writtenMessage), true, `${name}: exact assignment RHS identity`);
    assert.equal(component.origins.every(origin => origin.subject.projection.length === 0), true, `${name}: message values have no remaining projection`);
    const independent = demands.storageFor(requiredStorageSubject(storage, variable("untouched")));
    assert.equal(independent.kind, "immutable", independent.kind === "unresolved" ? independent.reason : "independent owner is unaffected");
    assert.equal(demands.receivesWritableNative(selectedSubject), false, `${name}: ordinary allocation is not a native constructor`);
    assert.equal(demands.nativeConstructors.length, 0, `${name}: no manufactured native constructor`);
  });
}

// RULINGS 2026-10-23: exported function bodies are entry points for source-storage reachability, so their writes count.
test("Error open-formal mutation is raw writable and its message origin includes the exported body's write", async () => {
  const { source, file, provider, demands, variable, storage } = await checked("error-open-formal-storage-questions", `
export function write(container: { value: Stored }): void {
  const { value: selected } = container;
  selected.message = "changed";
}
const untouched = { message: "untouched" };
`);
  const binding = requiredNode(source.ast, file, node => source.ast.is.IsBindingElement(node));
  const selectedSubject = requiredStorageSubject(storage, binding);
  const selected = demands.storageFor(selectedSubject);
  assert.equal(selected.kind, "writable", "the formal's selected storage receives its actual mutation demand");
  assert.equal(selected.writes.length, 1, "the formal receives one exact write");
  const origins = demands.closedStorageOriginsFor(selectedSubject);
  assert.equal(origins.kind, "open", "an external formal is not a closed physical allocation");
  assert.equal(origins.boundaries.length, 2, "exact formal and member input boundaries");
  assert.equal(origins.boundaries.every(boundary => boundary.kind === "external-input"), true, "only actual external-input boundaries");
  const field = source.ast.members(namedDeclaration(source.ast, provider, "Stored"))[0];
  assert.equal(field !== undefined, true, "checked Stored.message declaration");
  const component = demands.closedStorageOriginsFor(requiredStorageSubject(storage, binding, [{ kind: "member", declaration: field }]));
  assert.equal(component.kind, "open", component.kind === "unresolved" ? component.reason : "an unknown formal keeps its message open");
  const written = requiredNode(source.ast, file, node => source.ast.is.IsStringLiteral(node) && source.ast.text(node) === "changed");
  assert.equal(component.origins.some(origin => origin.subject.node === written && origin.subject.projection.length === 0), true,
    "the exported body's assigned message is an origin");
  assert.equal(component.boundaries.some(boundary => boundary.kind === "external-input" && boundary.subject.node === source.ast.parameters(namedDeclaration(source.ast, file, "write"))[0]), true,
    "the outside caller's container stays an external input");
  assert.equal(component.boundaries.every(boundary => boundary.kind === "external-input" || boundary.kind === "external-write"), true,
    "only the outside caller's values and writes stay open");
  assert.equal(demands.receivesWritableNative(selectedSubject), false, "an unbound formal is not a native constructor");
  assert.equal(demands.nativeConstructors.length, 0, "no manufactured native constructor");
  const independent = demands.storageFor(requiredStorageSubject(storage, variable("untouched")));
  assert.equal(independent.kind, "immutable", independent.kind === "unresolved" ? independent.reason : "independent owner is unaffected");
});

test("Error unresolved storage propagates through exact component ancestry without contaminating independent owners", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const subject = createSourceStorageSubjects(budget.subject, () => assert.fail("unexpected subject rejection"));
  const root = {};
  const value = subject(root);
  const component = subject(root, "value", element);
  const alias = subject({}, "value", element);
  const independent = subject({}, "value", element);
  const unresolved = new Map([[value, "unproved tuple spread"]]);
  const { ancestryFor: reason } = createSourceStorageUnresolvedQueries(budget, subject,
    selected => ({ subjects: (selected === alias ? [component] : [selected]).map(subject => ({ subject })) }), unresolved);
  assert.equal(reason(component), "unproved tuple spread");
  assert.equal(reason(alias), "unproved tuple spread");
  assert.equal(reason(independent) === undefined, true, "independent storage is not rejected");
});

test("Error storage rejects malformed and incompatible component paths without inventing immutable evidence", async () => {
  const { demands, variable, storage } = await checked("error-invalid-storage-components", `
const original = { message: "original" };
const values: [Stored, Stored] = [original, original];
`);
  for (const projection of [
    [{ kind: "array-element" }], slot(2), slot(-1), slot(0.5), slot(Infinity),
    [{ kind: "unknown" }], [null], Array.from({ length: 257 }, () => ({ kind: "array-element" })),
  ]) {
    const selected = storage.storageSubjectFor(variable("values"), projection);
    const demand = selected.kind === "unresolved" ? selected : demands.storageFor(selected.subject);
    assert.equal(demand.kind, "unresolved", "invalid exact component");
  }
});

test("Error component identities are immutable, interned, dense, data-only and independently bounded", () => {
  let rows = 0;
  let rejected = 0;
  const subject = createSourceStorageSubjects(cost => (rows += cost) <= 5, () => { rejected += 1; });
  const root = {};
  const first = subject(root, "value", slot(0));
  assert.equal(first !== undefined, true);
  assert.equal(subject(root, "value", slot(0)) === first, true, "same exact component identity");
  assert.equal(rows, 2, "interning consumes the bounded row budget once");
  assert.equal(Object.isFrozen(first.projection), true);
  assert.equal(Object.isFrozen(first.projection[0]), true);
  assert.equal(subject(root, "value", slot(1)) !== first, true, "different tuple positions");
  assert.equal(subject(root, "value", slot(2)) === undefined, true, "independent selected row ceiling");
  const accessor = Object.defineProperty({}, "kind", { get: () => assert.fail("projection getter executed") });
  assert.equal(subject(root, "value", [accessor]) === undefined, true);
  assert.equal(subject(root, "value", new Array(1)) === undefined, true, "a hole cannot alias the root identity");
  assert.equal(rejected, 2);
});

test("Error invalidation substitutes selected array components for the current invocation only", async () => {
  const { source, file, demands, variable, storage } = await checked("error-component-invalidation-bindings", `
const original = { message: "original" };
const other = { message: "other" };
const left: Stored[] = [original];
const right: Stored[] = [other];
mutate(left);
mutate(right);
`);
  const calls = [];
  const pending = [file];
  while (pending.length !== 0) {
    const node = pending.pop();
    if (source.ast.is.IsCallExpression(node)) calls.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const selected = name => calls.find(call => source.ast.text(source.ast.arguments(call)[0]) === name);
  const left = selected("left");
  const right = selected("right");
  assert.equal(left !== undefined && right !== undefined, true, "checked current invocations");
  assert.equal(demands.invalidationFor(variable("original"), left, new Set()).kind, "invalidated");
  assert.equal(demands.invalidationFor(variable("original"), right, new Set()).kind, "preserved");
  assert.equal(demands.invalidationFor(variable("other"), right, new Set()).kind, "invalidated");
  assert.equal(demands.invalidationFor(variable("other"), left, new Set()).kind, "preserved");
});
