import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceErrorDeclarationQuery, createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/model/subjects.js";
import { createSourceStorageUnresolvedQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph/unresolved.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile, requiredNode, requiredStorageSubject } from "../fixtures/source-navigation.mjs";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { sourceErrorDeclarations } from "../../packages/js-source-profile/dist/index.js";

const globals = `
interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
interface Number {} interface String {} interface RegExp {} interface Array<T> { [index: number]: T; length: number; }
interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
`;
const element = Object.freeze([{ kind: "array-element" }]);
const slot = index => Object.freeze([{ kind: "tuple-element", index }]);

test("storage origins retain exact projected unknown types through parameters and returns", async () => {
  const { source, file, demands, fieldWrites, storage } = await checked("error-storage-exact-origin-types", `
export function forward(value: unknown): unknown { return value; }
export function forwardArray(values: unknown[]): unknown[] { return values; }
export function forwardTuple(values: [Stored, unknown]): [Stored, unknown] { return values; }
`);
  for (const [name, projection] of [["forward", []], ["forwardArray", element], ["forwardTuple", slot(1)]]) {
    const declaration = namedDeclaration(source.ast, file, name);
    const parameter = source.ast.parameters(declaration)[0];
    const origins = storage.originsFor(requiredStorageSubject(storage, declaration, projection));
    assert.equal(origins.kind === "resolved", true, name);
    assert.equal(origins.origins.length, 1, name);
    assert.equal(origins.origins[0].subject.node === parameter, true, name);
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
  const demands = createSourceErrorDeclarationQuery(source, { fields: [{ declaration: field,
    component: { declaration: field, selectedType: source.semantics.forNode(field).declarations.declaredValueType(field) } }],
    constructors: [], scalarMutators: [] });
  const fieldWrites = source.navigation.nodes.filter(node => source.ast.getSourceFile(node) === file &&
    demands.mutationFor(node).kind === "resolved" && demands.mutationFor(node).value.some(mutation => mutation.kind === "field"));
  for (const name of ["mutate", "tuple"]) {
    const parameter = source.ast.parameters(namedDeclaration(source.ast, provider, name))[0];
    const selected = demands.parameterFor(parameter);
    assert.equal(selected.kind === "resolved" && selected.value.access === "writable", true,
      `${name}: the real current declaration retains its field mutation without consulting caller populations`);
    assert.equal(selected.value.parameter.node === parameter && selected.value.parameter.component.selectedType ===
      source.semantics.forNode(parameter).types.declarationSignatureInfo(namedDeclaration(source.ast, provider, name)).parameters[0].type,
    true, `${name}: the original checked scalar declaration/type identity is unchanged`);
  }
  return { source, file, provider, demands, fieldWrites, storage, variable: name => namedVariable(source.ast, file, name) };
}

test("Error demand distinguishes an initialized member from the constructor parameter binding", async () => {
  const { source, file, demands, fieldWrites, storage, variable } = await checked("error-parameter-property-demand", `
class Holder { constructor(public readonly value: Stored) {} }
class WritingHolder { constructor(public readonly value: Stored) { value.message = "during construction"; } }
function write(value: Stored): void { value.message = "later"; }
const original = { message: "original" };
const readOnlyAlias = original;
const holder = new Holder(original);
write(holder.value);
const direct = { message: "direct" };
const writing = new WritingHolder(direct);
`);
  const parameterFor = name => source.ast.parameters(source.ast.members(namedDeclaration(source.ast, file, name))
    .find(source.ast.is.IsConstructorDeclaration))[0];
  const parameter = parameterFor("Holder");
  const binding = requiredStorageSubject(storage, parameter);
  const member = storage.memberSubjectFor(parameter);
  assert.equal(member.kind === "resolved" && member.subject !== binding, true,
    "the original checked parameter has separate local and initialized member roles");
  assert.equal(storage.typeFor(member.subject).kind, "resolved", "the later field use retains its exact mutation");
  assert.equal(storage.typeFor(binding).kind, "resolved", "a shared referent is not a write through its sibling local binding");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("original"))).kind, "resolved",
    "the actual originating value still needs writable storage");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("readOnlyAlias"))).kind, "resolved",
    "the identical referent does not manufacture a mutation through another local binding");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, parameterFor("WritingHolder"))).kind, "resolved",
    "an actual constructor-parameter receiver remains writable");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("direct"))).kind, "resolved",
    "a direct parameter write keeps its exact caller origin");
});

test("Error nested generic write demands retain initialized input identity without mutating sibling aliases", async () => {
  const { source, file, provider, demands, fieldWrites, variable, storage } = await checked("error-nested-generic-write-input", `
interface SourceBox<Value> { readonly value: Value; }
interface DestinationBox<Value> { readonly value: Value; }
function transport(value: SourceBox<SourceBox<Stored>>): DestinationBox<DestinationBox<Stored>> { return value; }
function write(value: DestinationBox<DestinationBox<Stored>>): void { value.value.value.message = "changed"; }
const original = { message: "original" };
const sibling = original;
const untouched = { message: "untouched" };
write(transport({ value: { value: original } }));
`);
  const write = fieldWrites.find(node => source.ast.getSourceFile(node) === file);
  assert.equal(write !== undefined, true, "one actual checked field write");
  const receiver = source.semantics.forNode(write).operations.propertyAccess(write)?.receiver.expression;
  assert.equal(receiver !== undefined, true, "the original checked write supplies its receiver");
  const frontier = storage.boundValueFrontierFor(requiredStorageSubject(storage, receiver), storage.emptyBindings, Object.freeze([]));
  assert.equal(frontier.kind, "resolved", frontier.kind === "unresolved" ? frontier.reason : "the actual generic write has its original producers");
  const original = source.ast.as.AsVariableDeclaration(variable("original")).Initializer;
  assert.equal(frontier.frontier.some(entry => entry.subject.node === original && entry.subject.kind === "value" &&
    entry.subject.projection.length === 0), true,
    "the nested generic write retains the exact original initialization, not merely its final field declaration");
  const field = source.ast.members(namedDeclaration(source.ast, provider, "Stored"))
    .find(node => source.ast.text(source.ast.name(node)) === "message");
  assert.equal(field !== undefined, true, "the original shared storage field");
  const repeated = createSourceErrorDeclarationQuery(source, { fields: [{ declaration: field, component: {
    declaration: field, selectedType: source.semantics.forNode(field).declarations.declaredValueType(field) } }], constructors: [], scalarMutators: [] });
  assert.equal(repeated.mutationFor(write).kind, "resolved",
    "the same producer query order cannot erase the original checked physical write");
  for (const [name, expected] of [["original", "resolved"], ["sibling", "resolved"], ["untouched", "resolved"]]) {
    assert.equal(storage.typeFor(requiredStorageSubject(storage, variable(name))).kind, expected, name);
  }
});

test("Error writes with an unresolved value frontier retain unresolved storage demand", async () => {
  const checked = await checkedSource("error-write-unresolved-value-frontier", {
    "globals.d.ts": `${globals}\n${sourceErrorDeclarations}`,
    "src/index.ts": `
      function pending(): Error { return pending(); }
      const waiting = pending();
      waiting.message = "changed";
    `,
  });
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const declarations = projectSourceFile(source, "globals.d.ts");
  const field = source.ast.members(namedDeclaration(source.ast, declarations, "Error"))
    .find(node => source.ast.text(source.ast.name(node)) === "message");
  assert.equal(field !== undefined, true, "the original checked Error.message declaration");
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
  const demands = createSourceErrorDeclarationQuery(source, { fields: [{ declaration: field, component: {
    declaration: field, selectedType: source.semantics.forNode(field).declarations.declaredValueType(field) } }], constructors: [], scalarMutators: [] });
  const fieldWrites = source.navigation.nodes.filter(node => source.ast.getSourceFile(node) !== declarations &&
    demands.mutationFor(node).kind === "resolved" && demands.mutationFor(node).value.some(mutation => mutation.kind === "field"));
  assert.equal(fieldWrites.length, 1, "one actual checked Error write");
  const write = fieldWrites[0];
  const receiver = source.semantics.forNode(write).operations.propertyAccess(write)?.receiver.expression;
  assert.equal(receiver !== undefined, true, "the real Error write supplies its original receiver");
  const subject = requiredStorageSubject(storage, receiver);
  const frontier = storage.boundValueFrontierFor(subject, storage.emptyBindings, Object.freeze([]));
  assert.equal(frontier.kind, "unresolved", "the recursive value has no completed original producer");
  assert.equal(storage.failureReason(), undefined, "a genuine unresolved value frontier is not a forced resource failure");
  assert.equal(storage.typeFor(subject).kind, "resolved", "the exact declared type does not depend on closing its value history");
  assert.equal(demands.mutationFor(write).kind, "resolved", "the original local write remains an actual checked mutation");
  assert.equal(storage.failureReason(), undefined, "the refusal remains the actual value-frontier uncertainty");
});

test("Error array storage transports exact element demand through aliases and cross-file parameters", async () => {
  const { source, provider, demands, fieldWrites, variable, storage } = await checked("error-array-storage-components", `
const original = { message: "original" };
const untouched = { message: "untouched" };
const values: Stored[] = [original];
const alias = values;
mutate(alias);
`);
  const receiver = requiredNode(source.ast, source.ast.body(namedDeclaration(source.ast, provider, "mutate")),
    node => source.ast.is.IsElementAccessExpression(node));
  const frontier = storage.boundValueFrontierFor(requiredStorageSubject(storage, receiver), storage.emptyBindings, Object.freeze([]));
  assert.equal(frontier.kind, "resolved", frontier.kind === "unresolved" ? frontier.reason : "source writes retain the known actual invocation frontier");
  const allocation = source.ast.as.AsVariableDeclaration(variable("original")).Initializer;
  assert.equal(frontier.frontier.some(entry => entry.subject.node === allocation && entry.subject.projection.length === 0), true,
    "an exported writer's value frontier includes its actual caller allocation without claiming the outside input is closed");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("original"))).kind, "resolved");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("untouched"))).kind, "resolved");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("values"))).kind, "resolved", "container identity is not its element");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("values"), element)).kind, "resolved");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("alias"), element)).kind, "resolved");
  const origins = storage.originsFor(requiredStorageSubject(storage, variable("alias"), element));
  assert.equal(origins.kind, "resolved");
  assert.equal(origins.origins.some(origin => origin.subject.node === source.ast.as.AsVariableDeclaration(variable("original")).Initializer), true, "exact original element");
  assert.equal(origins.origins.some(origin => origin.subject.node === source.ast.as.AsVariableDeclaration(variable("untouched")).Initializer), false, "independent value is excluded");
  assert.equal(origins.origins.every(origin => {
    const semantics = source.semantics.forNode(origin.subject.node);
    const selected = semantics.declarations.declaredValueType(origin.subject.node) ?? semantics.types.expressionType(origin.subject.node);
    return Object.isFrozen(origin) && selected !== undefined && semantics.types.isIdentical(origin.type, selected);
  }), true, "immutable exact checked origin type");
});

test("Error tuple storage keeps independently selected positions and nested returned aliases", async () => {
  const { demands, fieldWrites, variable, storage } = await checked("error-tuple-storage-components", `
const first = { message: "first" };
const second = { message: "second" };
const values: [Stored, Stored] = [first, second];
tuple(values);
const nestedOriginal = { message: "nested" };
const outer: Stored[][] = [[nestedOriginal]];
const result = nested(outer);
mutate(result);
`);
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("first"))).kind, "resolved");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("second"))).kind, "resolved");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("values"), slot(0))).kind, "resolved");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("values"), slot(1))).kind, "resolved");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("nestedOriginal"))).kind, "resolved");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("outer"), [...element, ...element])).kind, "resolved");
});

test("Error array destructuring retains scalar origin rather than treating the binding as opaque storage", async () => {
  const { demands, fieldWrites, variable, storage } = await checked("error-array-destructuring-components", `
const original = { message: "original" };
const untouched = { message: "untouched" };
const values: Stored[] = [original];
const [selected] = values;
selected.message = "changed";
`);
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("original"))).kind, "resolved");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("untouched"))).kind, "resolved");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("values"), element)).kind, "resolved");
});

test("Error tuple-to-array transport and tuple spreads preserve every exact originating element", async () => {
  const { demands, fieldWrites, variable, storage } = await checked("error-tuple-array-component-transport", `
const first = { message: "first" };
const second = { message: "second" };
const untouched = { message: "untouched" };
const values: [Stored, Stored] = [first, second];
const array: Stored[] = values;
const spread: Stored[] = [...values];
mutate(array);
mutate(spread);
`);
  for (const name of ["first", "second"]) assert.equal(storage.typeFor(requiredStorageSubject(storage, variable(name))).kind, "resolved", name);
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("untouched"))).kind, "resolved");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("values"), slot(0))).kind, "resolved");
  assert.equal(storage.typeFor(requiredStorageSubject(storage, variable("values"), slot(1))).kind, "resolved");
  for (const name of ["array", "spread"]) {
    const origins = storage.originsFor(requiredStorageSubject(storage, variable(name), element));
    assert.equal(origins.kind, "resolved", name);
    assert.equal(origins.origins.length, 2, "both tuple positions, not a manufactured array element");
  }
});

test("Error writes through proven scalar bindings retain writable demand and exact closed origins without changing independent storage", async () => {
  const { source, file, demands, fieldWrites, variable, storage } = await checked("error-unproved-scalar-binding", `
const original: Stored = { message: "original" };
const container = { value: original };
const { value: selected } = container;
const untouched = { message: "untouched" };
selected.message = "changed";
`);
  const binding = requiredNode(source.ast, file, node => source.ast.is.IsBindingElement(node));
  const selected = requiredStorageSubject(storage, binding);
  assert.equal(storage.typeFor(selected).kind, "resolved", "the proven binding retains its actual mutation demand");
  const origins = storage.closedOriginsFor(selected);
  const original = source.ast.as.AsVariableDeclaration(variable("original")).Initializer;
  assert.equal(origins.kind, "complete", "the proven binding has closed physical-origin evidence");
  assert.equal(origins.origins.length, 1, "exactly the original object allocation");
  assert.equal(origins.origins[0].subject.node === original, true, "the exact original object identity");
  assert.equal(origins.origins[0].subject.projection.length, 0, "the complete original allocation has no projection");
  const independent = storage.typeFor(requiredStorageSubject(storage, variable("untouched")));
  assert.equal(independent.kind, "resolved", independent.kind === "unresolved" ? independent.reason : "independent owner is unaffected");
});

for (const [name, statements] of [
  ["named property", `const container = { value: original }; const { value: selected } = container;`],
  ["shorthand property", `const container = { original }; const { original: selected } = container;`],
  ["nested properties", `const container = { outer: { value: original } }; const { outer: { value: selected } } = container;`],
  ["spread outer container", `const source = { value: original }; const container = { ...source }; const { value: selected } = container;`],
  ["spread replaced by authored property", `const source = { value: untouched }; const container = { ...source, value: original }; const { value: selected } = container;`],
  ["authored property replaced by spread", `const source = { value: original }; const fallback = { value: untouched }; const container = { ...fallback, ...source }; const { value: selected } = container;`],
  ["optional spread retains authored fallback", `const source: { value?: Stored } = {}; const container = { value: original, ...source }; const { value: selected } = container;`],
  ["optional spread supplies its present value", `const source: { value?: Stored } = { value: original }; const container = { value: untouched, ...source }; const { value: selected } = container;`],
  ["rest outer container", `const source = { omitted: 0, value: original }; const { omitted, ...container } = source; const { value: selected } = container;`],
  ["separate factory activations", `function box(value: Stored) { return { value }; } const independent = box(untouched); const container = box(original); const { value: selected } = container;`],
]) {
  test(`Error literal-member mutation reaches the original physical allocation through ${name}`, async () => {
    const { source, file, provider, demands, fieldWrites, variable, storage } = await checked(`error-literal-member-${name}`, `
const original: Stored = { message: "original" };
const untouched = { message: "untouched" };
${statements}
selected.message = "changed";
`);
    const binding = requiredNode(source.ast, file, node => source.ast.is.IsBindingElement(node) &&
      source.ast.is.IsIdentifier(source.ast.name(node)) && source.ast.text(source.ast.name(node)) === "selected");
    const selectedSubject = requiredStorageSubject(storage, binding);
    const selected = storage.typeFor(selectedSubject);
    assert.equal(selected.kind, "resolved", `${name}: selected storage is writable`);
    const container = requiredNode(source.ast, file, node =>
      (source.ast.is.IsVariableDeclaration(node) || source.ast.is.IsBindingElement(node)) &&
      source.ast.is.IsIdentifier(source.ast.name(node)) && source.ast.text(source.ast.name(node)) === "container");
    assert.equal(storage.typeFor(requiredStorageSubject(storage, container)).kind, "resolved",
      `${name}: mutating a nested value does not mutate or copy the outer container's storage`);
    assert.equal(fieldWrites.length, 1, `${name}: one exact write`);
    const original = source.ast.as.AsVariableDeclaration(variable("original")).Initializer;
    assert.equal(original !== undefined && source.ast.is.IsObjectLiteralExpression(original), true, `${name}: checked original allocation`);
    const origins = storage.closedOriginsFor(selectedSubject);
    assert.equal(origins.kind, "complete", `${name}: selected origin is closed${origins.kind === "unresolved" ? `: ${origins.reason}` : ""}`);
    assert.equal(origins.origins.length, 1, `${name}: one original allocation`);
    assert.equal(origins.origins[0].subject.node === original, true, `${name}: exact original allocation identity`);
    assert.equal(origins.origins[0].subject.projection.length, 0, `${name}: the origin is the allocation itself`);
    for (const node of [variable("original"), original]) {
      const physical = storage.typeFor(requiredStorageSubject(storage, node));
      assert.equal(physical.kind, "resolved", `${name}: original ${source.ast.kindName(node)} storage is writable`);
      assert.equal(fieldWrites.length, 1, `${name}: original storage receives one write`);
      assert.equal(demands.fieldFor(fieldWrites[0]).value.node === fieldWrites[0], true, `${name}: original receives the identical mutation`);
    }
    const field = source.ast.members(namedDeclaration(source.ast, provider, "Stored"))[0];
    assert.equal(field !== undefined, true, `${name}: checked Stored.message declaration`);
    const component = storage.closedOriginsFor(requiredStorageSubject(storage, binding, [{ kind: "member", declaration: field }]));
    const originalMessage = requiredNode(source.ast, original, node => source.ast.is.IsStringLiteral(node));
    const writeOperation = source.ast.parent(fieldWrites[0]);
    assert.equal(writeOperation !== undefined && source.ast.is.IsBinaryExpression(writeOperation), true, `${name}: actual checked assignment`);
    const writtenMessage = source.ast.as.AsBinaryExpression(writeOperation).Right;
    assert.equal(writtenMessage !== undefined && source.ast.is.IsStringLiteral(writtenMessage), true, `${name}: actual checked assignment RHS`);
    assert.equal(writtenMessage === originalMessage, false, `${name}: initializer and assignment have distinct checked identities`);
    assert.equal(component.kind, "complete", `${name}: selected message origin is closed`);
    assert.equal(component.origins.length, 2, `${name}: exactly the initializer and assigned message values`);
    assert.equal(component.origins.some(origin => origin.subject.node === originalMessage), true, `${name}: exact original message initializer identity`);
    assert.equal(component.origins.some(origin => origin.subject.node === writtenMessage), true, `${name}: exact assignment RHS identity`);
    assert.equal(component.origins.every(origin => origin.subject.projection.length === 0), true, `${name}: message values have no remaining projection`);
    const independent = storage.typeFor(requiredStorageSubject(storage, variable("untouched")));
    assert.equal(independent.kind, "resolved", independent.kind === "unresolved" ? independent.reason : "independent owner is unaffected");
    assert.equal(demands.constructorFor(selectedSubject.node).kind, "not-applicable", `${name}: ordinary allocation is not a native constructor`);
    assert.equal(source.navigation.nodes.filter(node => demands.constructorFor(node).kind === "resolved").length, 0, `${name}: no manufactured native constructor`);
  });
}

// RULINGS 2026-10-23: exported function bodies are entry points for source-storage reachability, so their writes count.
test("Error open-formal mutation is raw writable and its message origin includes the exported body's write", async () => {
  const { source, file, provider, demands, fieldWrites, variable, storage } = await checked("error-open-formal-storage-questions", `
export function write(container: { value: Stored }): void {
  const { value: selected } = container;
  selected.message = "changed";
}
const untouched = { message: "untouched" };
`);
  const binding = requiredNode(source.ast, file, node => source.ast.is.IsBindingElement(node));
  const selectedSubject = requiredStorageSubject(storage, binding);
  const frontier = storage.boundValueFrontierFor(selectedSubject, storage.emptyBindings, Object.freeze([]));
  assert.equal(frontier.kind, "resolved", frontier.kind === "unresolved" ? frontier.reason : "a source write retains its symbolic outside input");
  const formal = source.ast.parameters(namedDeclaration(source.ast, file, "write"))[0];
  assert.equal(frontier.frontier.some(entry => entry.subject.node === formal && entry.subject.projection.length === 1), true,
    "the outside caller remains an exact projected formal, not an executed allocation or empty source-write domain");
  const selected = storage.typeFor(selectedSubject);
  assert.equal(selected.kind, "resolved", "the formal's selected storage receives its actual mutation demand");
  assert.equal(fieldWrites.length, 1, "the formal receives one exact write");
  const origins = storage.closedOriginsFor(selectedSubject);
  assert.equal(origins.kind, "open", "an external formal is not a closed physical allocation");
  assert.equal(origins.boundaries.length, 2, "exact formal and member input boundaries");
  assert.equal(origins.boundaries.every(boundary => boundary.kind === "external-input"), true, "only actual external-input boundaries");
  const field = source.ast.members(namedDeclaration(source.ast, provider, "Stored"))[0];
  assert.equal(field !== undefined, true, "checked Stored.message declaration");
  const component = storage.closedOriginsFor(requiredStorageSubject(storage, binding, [{ kind: "member", declaration: field }]));
  assert.equal(component.kind, "open", component.kind === "unresolved" ? component.reason : "an unknown formal keeps its message open");
  const written = requiredNode(source.ast, file, node => source.ast.is.IsStringLiteral(node) && source.ast.text(node) === "changed");
  assert.equal(component.origins.some(origin => origin.subject.node === written && origin.subject.projection.length === 0), true,
    "the exported body's assigned message is an origin");
  assert.equal(component.boundaries.some(boundary => boundary.kind === "external-input" && boundary.subject.node === source.ast.parameters(namedDeclaration(source.ast, file, "write"))[0]), true,
    "the outside caller's container stays an external input");
  assert.equal(component.boundaries.every(boundary => boundary.kind === "external-input" || boundary.kind === "external-write"), true,
    "only the outside caller's values and writes stay open");
  assert.equal(demands.constructorFor(selectedSubject.node).kind, "not-applicable", "an unbound formal is not a native constructor");
  assert.equal(source.navigation.nodes.filter(node => demands.constructorFor(node).kind === "resolved").length, 0, "no manufactured native constructor");
  const independent = storage.typeFor(requiredStorageSubject(storage, variable("untouched")));
  assert.equal(independent.kind, "resolved", independent.kind === "unresolved" ? independent.reason : "independent owner is unaffected");
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
  const { demands, fieldWrites, variable, storage } = await checked("error-invalid-storage-components", `
const original = { message: "original" };
const values: [Stored, Stored] = [original, original];
`);
  for (const projection of [
    [{ kind: "array-element" }], slot(2), slot(-1), slot(0.5), slot(Infinity),
    [{ kind: "unknown" }], [null], Array.from({ length: 257 }, () => ({ kind: "array-element" })),
  ]) {
    const selected = storage.storageSubjectFor(variable("values"), projection);
    const demand = selected.kind === "unresolved" ? selected : storage.typeFor(selected.subject);
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
  const { source, file, demands, fieldWrites, variable, storage } = await checked("error-component-invalidation-bindings", `
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
  assert.equal(demands.invalidationFor(variable("original"), left).kind, "unresolved");
  assert.equal(demands.invalidationFor(variable("original"), right).kind, "unresolved");
  assert.equal(demands.invalidationFor(variable("other"), right).kind, "unresolved");
  assert.equal(demands.invalidationFor(variable("other"), left).kind, "unresolved");
  for (const [invocation, name] of [[left, "left"], [right, "right"]]) {
    const selected = source.semantics.forNode(invocation).operations.call(invocation);
    assert.equal(selected.sourceSelectedSignatureParameters[0].parameterDeclaration ===
      source.ast.parameters(namedDeclaration(source.ast, projectSourceFile(source, "src/values.ts"), "mutate"))[0], true,
      "both original invocations use the same checked declaration slot");
    assert.equal(source.navigation.sourceReferenceFor(selected.sourceArguments[0].expression)?.declaration === variable(name), true,
      "the actual selected argument keeps its independent original component");
  }
});
