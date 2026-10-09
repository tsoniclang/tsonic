import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceErrorStorageDemandQuery, createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/subjects.js";
import { createSourceStorageUnresolvedQuery } from "../../packages/target-api/dist/target-analysis/source-storage/unresolved.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile, requiredNode } from "../fixtures/source-navigation.mjs";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

const globals = `
interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
interface Number {} interface String {} interface RegExp {} interface Array<T> { [index: number]: T; length: number; }
interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
`;
const element = Object.freeze([{ kind: "array-element" }]);
const slot = index => Object.freeze([{ kind: "tuple-element", index }]);

test("storage origins retain exact projected unknown types through parameters and returns", async () => {
  const { source, file, demands } = await checked("error-storage-exact-origin-types", `
export function forward(value: unknown): unknown { return value; }
export function forwardArray(values: unknown[]): unknown[] { return values; }
export function forwardTuple(values: [Stored, unknown]): [Stored, unknown] { return values; }
`);
  for (const [name, projection] of [["forward", []], ["forwardArray", element], ["forwardTuple", slot(1)]]) {
    const declaration = namedDeclaration(source.ast, file, name);
    const parameter = source.ast.parameters(declaration)[0];
    const origins = demands.storageOriginsFor(declaration, projection);
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
  const demands = createSourceErrorStorageDemandQuery(source,
    { fields: [field], constructors: [], stackCaptures: [], storageMutators: [], retention: () => ({ kind: "ordinary" }) },
    createSourceStorageQuery(source, source.navigation.sourceFiles));
  return { source, file, provider, demands, variable: name => namedVariable(source.ast, file, name) };
}

test("Error array storage transports exact element demand through aliases and cross-file parameters", async () => {
  const { source, demands, variable } = await checked("error-array-storage-components", `
const original = { message: "original" };
const untouched = { message: "untouched" };
const values: Stored[] = [original];
const alias = values;
mutate(alias);
`);
  assert.equal(demands.storageFor(variable("original")).kind, "writable");
  assert.equal(demands.storageFor(variable("untouched")).kind, "immutable");
  assert.equal(demands.storageFor(variable("values")).kind, "immutable", "container identity is not its element");
  assert.equal(demands.storageFor(variable("values"), element).kind, "writable");
  assert.equal(demands.storageFor(variable("alias"), element).kind, "writable");
  const origins = demands.storageOriginsFor(variable("alias"), element);
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
  const { demands, variable } = await checked("error-tuple-storage-components", `
const first = { message: "first" };
const second = { message: "second" };
const values: [Stored, Stored] = [first, second];
tuple(values);
const nestedOriginal = { message: "nested" };
const outer: Stored[][] = [[nestedOriginal]];
const result = nested(outer);
mutate(result);
`);
  assert.equal(demands.storageFor(variable("first")).kind, "immutable");
  assert.equal(demands.storageFor(variable("second")).kind, "writable");
  assert.equal(demands.storageFor(variable("values"), slot(0)).kind, "immutable");
  assert.equal(demands.storageFor(variable("values"), slot(1)).kind, "writable");
  assert.equal(demands.storageFor(variable("nestedOriginal")).kind, "writable");
  assert.equal(demands.storageFor(variable("outer"), [...element, ...element]).kind, "writable");
});

test("Error array destructuring retains scalar origin rather than treating the binding as opaque storage", async () => {
  const { demands, variable } = await checked("error-array-destructuring-components", `
const original = { message: "original" };
const untouched = { message: "untouched" };
const values: Stored[] = [original];
const [selected] = values;
selected.message = "changed";
`);
  assert.equal(demands.storageFor(variable("original")).kind, "writable");
  assert.equal(demands.storageFor(variable("untouched")).kind, "immutable");
  assert.equal(demands.storageFor(variable("values"), element).kind, "writable");
});

test("Error tuple-to-array transport and tuple spreads preserve every exact originating element", async () => {
  const { demands, variable } = await checked("error-tuple-array-component-transport", `
const first = { message: "first" };
const second = { message: "second" };
const untouched = { message: "untouched" };
const values: [Stored, Stored] = [first, second];
const array: Stored[] = values;
const spread: Stored[] = [...values];
mutate(array);
mutate(spread);
`);
  for (const name of ["first", "second"]) assert.equal(demands.storageFor(variable(name)).kind, "writable", name);
  assert.equal(demands.storageFor(variable("untouched")).kind, "immutable");
  assert.equal(demands.storageFor(variable("values"), slot(0)).kind, "writable");
  assert.equal(demands.storageFor(variable("values"), slot(1)).kind, "writable");
  for (const name of ["array", "spread"]) {
    const origins = demands.storageOriginsFor(variable(name), element);
    assert.equal(origins.kind, "resolved", name);
    assert.equal(origins.origins.length, 2, "both tuple positions, not a manufactured array element");
  }
});

test("Error writes through unproved scalar bindings remain unresolved without changing independent storage", async () => {
  const { source, file, demands, variable } = await checked("error-unproved-scalar-binding", `
const original: Stored = { message: "original" };
const container = { value: original };
const { value: selected } = container;
const untouched = { message: "untouched" };
selected.message = "changed";
`);
  const binding = requiredNode(source.ast, file, node => source.ast.is.IsBindingElement(node));
  assert.equal(demands.storageFor(binding).kind, "unresolved", "unproved binding is not writable evidence");
  assert.equal(demands.storageOriginsFor(binding).kind, "unresolved", "unproved binding is not exact origin evidence");
  assert.equal(demands.storageFor(variable("untouched")).kind, "immutable", "independent owner is unaffected");
});

test("Error unresolved storage propagates through exact component ancestry without contaminating independent owners", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const subject = createSourceStorageSubjects(budget.subject, () => assert.fail("unexpected subject rejection"));
  const root = {};
  const value = subject(root);
  const component = subject(root, "value", element);
  const alias = subject({}, "value", element);
  const independent = subject({}, "value", element);
  const incoming = new Map([[alias, new Set([component])]]);
  const unresolved = new Map([[value, "unproved tuple spread"]]);
  const reason = createSourceStorageUnresolvedQuery(budget, subject, selected => incoming.get(selected) ?? new Set(), unresolved);
  assert.equal(reason(component), "unproved tuple spread");
  assert.equal(reason(alias), "unproved tuple spread");
  assert.equal(reason(independent) === undefined, true, "independent storage is not rejected");
});

test("Error storage rejects malformed and incompatible component paths without inventing immutable evidence", async () => {
  const { demands, variable } = await checked("error-invalid-storage-components", `
const original = { message: "original" };
const values: [Stored, Stored] = [original, original];
`);
  for (const projection of [
    [{ kind: "array-element" }], slot(2), slot(-1), slot(0.5), slot(Infinity),
    [{ kind: "unknown" }], [null], Array.from({ length: 257 }, () => ({ kind: "array-element" })),
  ]) {
    assert.equal(demands.storageFor(variable("values"), projection).kind, "unresolved", "invalid exact component");
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
  const { source, file, demands, variable } = await checked("error-component-invalidation-bindings", `
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
