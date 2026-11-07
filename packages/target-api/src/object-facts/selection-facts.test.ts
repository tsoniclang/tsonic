// Host fact tests for the selection records C# reads (R-B4-9, D1 §15, Q2, R-B4-3, R-B4-7) and the eager selection
// refusals in facts.refusals(). Real TypeScript programs; published facts only.
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createHostSourceProgramFixture } from "../source-semantics/host-program-fixtures.js";
import { sourceTypeDescriptorStructure } from "../source-semantics/local-type-flow/terms.js";
import { sourceBindingScope } from "../source-navigation/lexical-captures.js";

function fixture(body: string, target = "es2022") {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `export {};\n${body}` },
    compilerOptions: { strict: true, target, module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(issue => issue !== undefined)));
  const host = createHostSourceProgramFixture(checked);
  const { ast } = host;
  const nodes: Node[] = [];
  const visit = (node: Node): void => { nodes.push(node); ast.forEachChild(node, child => { if (child !== undefined) visit(child); }); };
  visit(checked.getSourceFile("/src/index.ts")!);
  const all = (predicate: (node: Node) => boolean): readonly Node[] => nodes.filter(predicate);
  const find = (predicate: (node: Node) => boolean, label: string): Node => {
    const found = nodes.find(predicate);
    assert.equal(found !== undefined, true, label);
    return found!;
  };
  const named = (kind: string, name: string): Node => find(node => ast.kindName(node) === kind &&
    ast.name(node) !== undefined && ast.text(ast.name(node)!) === name, `${kind} ${name}`);
  return { host, ast, facts: host.facts, all, find, named };
}

const selectedCall = (facts: ReturnType<typeof fixture>["facts"], call: Node) => {
  const selection = facts.selections.call(call);
  assert.equal(selection !== undefined && selection.kind !== "refused", true, "a call selection");
  return selection as Exclude<typeof selection, undefined | { readonly kind: "refused" }>;
};

test("the completion selection carries the reachability witness (R-B4-9)", () => {
  const { facts, named } = fixture(`
function maybe(flag: boolean): number | undefined { if (flag) return 1; return undefined; }
function partial(flag: boolean) { if (flag) return 1; }
function forever(): never { while (true) {} }`);
  assert.equal(facts.selections.completion(named("KindFunctionDeclaration", "maybe"))?.canFallThrough, false);
  assert.equal(facts.selections.completion(named("KindFunctionDeclaration", "partial"))?.canFallThrough, true);
  assert.equal(facts.selections.completion(named("KindFunctionDeclaration", "forever"))?.canFallThrough, false);
});

test("call selections publish signature slots, instantiated parameters and every effective argument binding", () => {
  const { ast, facts, find, named } = fixture(`
function pair(first: number, second?: string, ...rest: boolean[]): number { return first + rest.length + (second?.length ?? 0); }
const tuple: [string, boolean] = ["a", true];
pair(1, ...tuple);
pair(2, "b", true, false);`);
  const [spreadCall, restCall] = [0, 1].map(index =>
    find(node => ast.is.IsCallExpression(node) && ast.text(node).startsWith(`pair(${index + 1}`), `call ${index}`));
  const spread = selectedCall(facts, spreadCall!);
  assert.deepEqual(spread.signatureParameters.map(slot => slot.kind), ["required", "optional", "rest"]);
  assert.equal(spread.signatureParameters[0]!.declaration, named("KindParameter", "first"));
  assert.deepEqual(spread.parameters.map(parameter => [parameter.name, parameter.kind]),
    [["first", "required"], ["second", "optional"], ["rest", "rest"]]);
  assert.deepEqual(spread.parameters.slice(1).map(parameter => sourceTypeDescriptorStructure(parameter.type).kind), ["optional", "array"],
    "the optional slot admits absence; the rest slot is the array");
  assert.deepEqual(spread.arguments.map(binding => [binding.argumentIndex, binding.effectiveIndex, binding.form, binding.spreadElement]),
    [[0, 0, "value", undefined], [1, 1, "spread-element", 0], [1, 2, "spread-element", 1]],
    "a tuple spread binds one entry per element, not one per authored argument");
  const rest = selectedCall(facts, restCall!);
  assert.deepEqual(rest.arguments.map(binding => [binding.parameterIndex, binding.mode, binding.form]),
    [[0, "positional", "value"], [1, "positional", "value"], [2, "rest-element", "value"], [2, "rest-element", "value"]]);
  assert.equal(Object.isFrozen(rest.parameters) && Object.isFrozen(rest.signatureParameters), true);
});

test("call selections publish super-call kind, overload position and the untyped-callee refusal (Q2)", () => {
  const { ast, facts, find } = fixture(`
class Base { constructor(readonly value: number) {} }
class Derived extends Base { constructor() { super(1); } }
function pick(value: string): string;
function pick(value: number): number;
function pick(value: string | number): string | number { return value; }
declare const dynamic: any;
pick(1);
dynamic(1);
void Derived;`);
  const superCall = find(node => ast.is.IsCallExpression(node) && ast.text(node).startsWith("super("), "super call");
  assert.equal(selectedCall(facts, superCall).kind, "super-call");
  const overloaded = find(node => ast.is.IsCallExpression(node) && ast.text(node) === "pick(1)", "pick(1)");
  assert.equal(selectedCall(facts, overloaded).overloadIndex, 1, "the second authored overload");
  const untyped = find(node => ast.is.IsCallExpression(node) && ast.text(node) === "dynamic(1)", "dynamic(1)");
  assert.equal(facts.selections.call(untyped)?.kind, "refused");
  assert.equal(facts.refusals().some(refusal => refusal.code === "TSONIC_SOURCE_CALL_UNTYPED" && refusal.site === untyped), true,
    "the untyped-callee refusal is in refusals() before any selection is requested by a target");
});

test("Pick members keep their original property declaration (Q2)", () => {
  const { facts, named } = fixture(`
interface Full { readonly value: number; readonly other: string }
type Part = Pick<Full, "value">;
declare const part: Part;
void part;`);
  const part = named("KindVariableDeclaration", "part");
  const type = facts.values.type(part);
  assert.equal(type.kind, "resolved");
  if (type.kind !== "resolved") return;
  const members = facts.objects.members(type.type);
  assert.equal(Array.isArray(members), true);
  const value = (members as Exclude<typeof members, { readonly kind: "refused" }>).find(member => member.name === "value");
  assert.deepEqual(value?.declarations, [named("KindPropertySignature", "value")]);
});

test("heritage applies type-parameter defaults (R-B4-3)", () => {
  const { facts, named } = fixture(`
class Base<T = string, U = T[]> { value?: T; values?: U; }
class Derived extends Base {}
class Bound extends Base<number> {}
void Derived; void Bound;`);
  const kinds = (name: string) => {
    const edges = facts.objects.heritage(named("KindClassDeclaration", name));
    assert.equal(Array.isArray(edges), true, name);
    return (edges as Exclude<typeof edges, { readonly kind: "refused" }>)[0]!.typeArguments
      .map(argument => sourceTypeDescriptorStructure(argument).kind);
  };
  assert.deepEqual(kinds("Derived"), ["string", "array"], "T defaults to string; U defaults to T[] with T bound");
  assert.deepEqual(kinds("Bound"), ["primitive", "array"], "an authored argument binds the later default");
});

test("element access records carry the optional-chain flag", () => {
  const { ast, facts, all } = fixture(`
function read(values: number[] | undefined, fixed: number[]) { return (values?.[0] ?? 0) + fixed[0]!; }`);
  const accesses = all(node => ast.is.IsElementAccessExpression(node));
  assert.deepEqual(accesses.map(access => facts.values.elementAccess(access).optionalChain), [true, false]);
});

test("value inputs and construct inputs publish their slots", () => {
  const { ast, facts, find } = fixture(`
declare const flag: boolean;
const chosen = flag ? 1 : 2;
void chosen;`);
  const conditional = find(node => ast.is.IsConditionalExpression(node), "conditional");
  const inputs = facts.navigation.expressions.valueInputs(conditional);
  assert.deepEqual(inputs?.map(input => input.slot.kind), ["condition", "branch", "branch"]);
  const literal = find(node => ast.is.IsNumericLiteral(node), "leaf");
  assert.equal(facts.navigation.expressions.valueInputs(literal), undefined, "a leaf is not an evaluation owner");
  const declaration = find(node => ast.is.IsVariableDeclaration(node) && ast.text(ast.name(node)!) === "chosen", "declaration");
  assert.deepEqual(facts.navigation.expressions.constructInputs(declaration).map(input => input.slot.kind), ["initializer"]);
});

test("yield selections name their generator and a delegated protocol", () => {
  const { ast, facts, all, named } = fixture(`
function* inner(): Generator<number, void, unknown> { yield 1; }
function* outer(): Generator<number, void, unknown> { yield 0; yield* inner(); }
void outer;`);
  const yields = all(node => ast.is.IsYieldExpression(node));
  const outer = named("KindFunctionDeclaration", "outer");
  const selections = yields.map(node => facts.selections.yield(node));
  const outerYields = selections.filter(selection => selection !== undefined && !("code" in selection) && selection.generator === outer);
  assert.deepEqual(outerYields.map(selection => (selection as { readonly kind: string }).kind), ["value", "delegate"]);
  const delegated = outerYields[1] as { readonly delegation?: { readonly protocol: string } };
  assert.equal(delegated.delegation?.protocol, "iterator");
});

test("using declarations publish one disposal alternative per arm; await using is async (R-B4-7)", () => {
  const { facts, named } = fixture(`
class Resource { [Symbol.dispose](): void {} }
class AsyncResource { async [Symbol.asyncDispose](): Promise<void> {} }
async function run(): Promise<void> {
  using sync = new Resource();
  await using later = new AsyncResource();
  void sync; void later;
}
void run;`, "esnext");
  const sync = facts.selections.resource(named("KindVariableDeclaration", "sync"));
  const later = facts.selections.resource(named("KindVariableDeclaration", "later"));
  assert.equal(sync !== undefined && !("code" in sync) && !sync.async && sync.alternatives.length === 1 &&
    sync.alternatives[0]!.kind === "sync", true);
  assert.equal(later !== undefined && !("code" in later) && later.async && later.alternatives[0]!.kind === "async", true);
});

test("a var in a class static block is scoped to the block (F2-1)", () => {
  const { ast, named, find } = fixture(`
class Holder { static { var local = 1; void local; } }
function host() { var inner = 1; void inner; }
void Holder; void host;`);
  const block = find(node => ast.kindName(node) === "KindClassStaticBlockDeclaration", "static block");
  assert.equal(sourceBindingScope(named("KindVariableDeclaration", "local"), ast), ast.body(block) ?? block,
    "the static block (an execution barrier) owns its var");
  assert.equal(sourceBindingScope(named("KindVariableDeclaration", "inner"), ast), ast.body(named("KindFunctionDeclaration", "host")));
});

test("selection refusals are in refusals() before a target asks: for-await over an untyped value", () => {
  const { ast, facts, find } = fixture(`
declare const values: any;
async function run(): Promise<void> { for await (const value of values) void value; }
void run;`);
  const loop = find(node => ast.is.IsForOfStatement(node), "for await");
  const refusal = facts.refusals().find(entry => entry.site === loop);
  assert.equal(refusal?.code, "TSONIC_SOURCE_FOR_AWAIT_UNTYPED");
});

// R2 #17: the contextual tuple of an array literal is a Host selection with the baseline rules.
test("tuple-literal selection: trailing optional omissions only, from the literal's Host destination (R2 #17)", () => {
  const { ast, facts, all } = fixture(`
const trailing: [number, string?, boolean?] = [1];
const full: [number, string?] = [1, "a"];
const rest: [number, ...string[]] = [1];
const extra: [number] | number[] = [1, 2];
const untyped = [1, 2];`);
  const literals = all(node => ast.is.IsArrayLiteralExpression(node));
  const selected = literals.map(literal => facts.selections.tupleLiteral(literal));
  assert.deepEqual(selected.map(entry => entry.kind), ["selected", "selected", "unavailable", "unavailable", "unavailable"]);
  const [trailing, full] = selected as Extract<(typeof selected)[number], { readonly kind: "selected" }>[];
  assert.deepEqual(trailing!.omittedOptionalElementIndexes, [1, 2]);
  assert.deepEqual(full!.omittedOptionalElementIndexes, []);
});

// R2 #28 / #41: a spread element is not a value node; the census asks only its protocol witness, and every program with
// `...xs` reaches refusals() without an invariant failure.
test("the eager census reads spreads through the protocol witness only (R2 #28)", () => {
  const { facts } = fixture(`
const xs = [1, 2, 3];
const copy = [...xs];
function sum(...values: number[]): number { return values.length; }
sum(...xs);`);
  assert.deepEqual(facts.refusals().map(refusal => refusal.code), []);
});

// R2 #29 / #36 / #41: generator protocol types by binder identity (aliases, defaults), and iteration elements from the
// iterable (for-of over an existing binding, spreads).
test("generator selections read the library protocol binders through aliases and defaults (R2 #29)", () => {
  const { facts, named } = fixture(`
type Numbers = Generator<number, string, boolean>;
function* aliased(): Numbers { const sent: boolean = yield 1; return sent ? "a" : "b"; }
function* defaulted(): Generator<number> { yield 1; }`);
  const aliased = facts.selections.generator(named("KindFunctionDeclaration", "aliased"));
  assert.deepEqual([aliased?.yieldType, aliased?.returnType, aliased?.nextType].map(type => type === undefined ? undefined :
    sourceTypeDescriptorStructure(type).kind), ["primitive", "string", "primitive"]);
  const defaulted = facts.selections.generator(named("KindFunctionDeclaration", "defaulted"));
  assert.equal(defaulted !== undefined, true, "a defaulted Generator<number> has a selection");
  assert.equal(sourceTypeDescriptorStructure(defaulted!.yieldType).kind, "primitive");
});

test("a for-of over an existing binding takes the iterable's element, not the binding's declared type (R2 #36)", () => {
  const { ast, facts, all } = fixture(`
const nums: number[] = [1, 2];
let x: number | string = "";
for (x of nums) {}`);
  const [statement] = all(node => ast.is.IsForOfStatement(node));
  const selection = facts.selections.iteration(statement!);
  assert.equal(selection !== undefined && !("code" in selection), true);
  assert.equal(sourceTypeDescriptorStructure((selection as Extract<typeof selection, { readonly element: unknown }>).element).kind,
    "primitive");
});
