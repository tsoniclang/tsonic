// Host fact tests: per-arm components and their join (supervisor ruling on B4 D3), the write relation beside another
// relation (Q1), N7 decided by admission (R-D2-1, R-D2-2), the openness classifier (R4), declaration values (R-B4-5),
// receiver binders (R-B4-6) and the Host `any` literal refusal. Real TypeScript programs; published facts only.
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createSourceTypeFlowTestProgram } from "./type-flow-test-program.js";
import { sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure } from "./terms.js";
import { sourceTypeDescriptorOpenness } from "./uses.js";
import type { SourceTypeDescriptor } from "./types.js";

function fixture(text: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `export {};\n${text}` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(issue => issue !== undefined)));
  const source = createSourceTypeFlowTestProgram(checked);
  const facts = source.valueFacts;
  const { ast } = source;
  const nodes: Node[] = [];
  const pending: Node[] = [checked.getSourceFile("/src/index.ts")!];
  while (pending.length > 0) {
    const node = pending.pop()!;
    nodes.push(node);
    const children = ast.children(node);
    for (let index = children.length - 1; index >= 0; index -= 1) if (children[index] !== undefined) pending.push(children[index]!);
  }
  const find = (predicate: (node: Node) => boolean, label: string): Node => {
    const found = nodes.find(predicate);
    if (found === undefined) throw new Error(`The original ${label} is required.`);
    return found;
  };
  const named = (kind: string, name: string): Node => find(node => ast.kindName(node) === kind &&
    ast.name(node) !== undefined && ast.text(ast.name(node)!) === name, `${kind} ${name}`);
  const resolved = (node: Node): SourceTypeDescriptor => {
    const outcome = facts.values.type(node);
    if (outcome.kind === "refused") throw new Error(`Resolved ${ast.kindName(node)} required: ${outcome.reason}`);
    return outcome.type;
  };
  return { ast, facts, nodes, find, named, resolved };
}

test("an element read on an all-array union publishes each arm's element and their Host join", () => {
  const { ast, facts, find, resolved } = fixture(`function select(value: number[] | string[]) { return value[0]; }`);
  const access = find(node => ast.is.IsElementAccessExpression(node), "element read");
  const relation = facts.relations.at(access);
  assert.equal(relation?.kind, "per-arm");
  if (relation?.kind !== "per-arm") return;
  assert.deepEqual(relation.arms.map(arm => arm.type === undefined ? undefined : sourceTypeDescriptorStructure(arm.type).kind),
    ["primitive", "string"], "number element, then string element, in authored arm order");
  const joined = facts.sums.join(relation.arms.map(arm => arm.type!));
  assert.equal(joined !== undefined && sourceTypeDescriptorsEqual(joined, resolved(access)), true,
    "the join of the per-arm elements is the read's Host type");
  const same = facts.sums.join([relation.arms[0]!.type!, relation.arms[0]!.type!]);
  assert.equal(same, relation.arms[0]!.type, "equal components join to that component");
});

test("a member read on a union receiver publishes each arm's member type", () => {
  const { ast, facts, find } = fixture(`
interface A { readonly kind: "a"; readonly value: number }
interface B { readonly kind: "b"; readonly value: string }
function read(item: A | B) { return item.value; }`);
  const access = find(node => ast.is.IsPropertyAccessExpression(node) && ast.text(ast.name(node)!) === "value", "member read");
  const relation = facts.relations.at(access);
  assert.equal(relation?.kind, "per-arm");
  if (relation?.kind !== "per-arm") return;
  assert.equal(relation.arms.every(arm => arm.member !== undefined && arm.type !== undefined), true);
});

test("a narrowed read that is also written into a sum keeps both relations (Q1)", () => {
  const { ast, facts, find } = fixture(`
function f(value: string | number | boolean): string | number {
  if (typeof value === "boolean") return 0;
  const kept: string | number = value;
  return kept;
}`);
  const read = find(node => ast.is.IsIdentifier(node) && ast.text(node) === "value" &&
    ast.is.IsVariableDeclaration(ast.parent(node)!) && ast.name(ast.parent(node)!) !== node, "narrowed read");
  const at = facts.relations.at(read);
  const write = facts.relations.write(read);
  assert.equal(at?.kind, "map", "the narrowed read maps the declared sum onto the narrowed sum");
  assert.equal(write !== undefined && write.kind !== "refused", true, "the same node writes into the destination sum");
  assert.notEqual(at, write);
});

test("the write relation of a node with no other relation is the same record as at() (Q1)", () => {
  const { ast, facts, find } = fixture(`const n: number = 1; const u: string | number = n; void u;`);
  const read = find(node => ast.is.IsIdentifier(node) && ast.text(node) === "n" && ast.is.IsVariableDeclaration(ast.parent(node)!) &&
    ast.name(ast.parent(node)!) !== node, "write");
  assert.equal(facts.relations.write(read), facts.relations.at(read));
  assert.equal(facts.relations.at(read)?.kind, "select-arm");
});

test("a strict null or undefined test on an operand admitting both is undecided, not refused (R-D2-1)", () => {
  const { ast, facts, nodes } = fixture(`
function f(value: number | string | null | undefined): boolean { return value === null || value === undefined; }`);
  const tests = nodes.filter(node => ast.is.IsBinaryExpression(node) && ast.operatorKindName(node) === "KindEqualsEqualsEqualsToken");
  assert.equal(tests.length, 2);
  for (const node of tests) {
    const relation = facts.relations.at(node);
    assert.equal(relation?.kind, "test", "a test relation, never a refusal");
    if (relation?.kind === "test") assert.equal(relation.outcome, "undecided");
  }
  assert.equal(facts.refusals().some(refusal => tests.includes(refusal.site)), false);
});

// Signed by Claude (R-A9-4): TypeScript reduces `unknown | null | undefined` to `unknown`, so it must compile exactly like
// `unknown` (A9-D3; Q20; N7 refuses only a proven both-nullish operand; R11). Only `g` keeps the N7 refusal.
test("typeof 'undefined' on an operand admitting both is refused from the admission (R-D2-2)", () => {
  const { ast, facts, nodes } = fixture(`
function f(value: unknown | null | undefined): boolean { return typeof value === "undefined"; }
function g(value: number | null | undefined): boolean { return typeof value === "undefined"; }`);
  const tests = nodes.filter(node => ast.is.IsBinaryExpression(node) && ast.operatorKindName(node) === "KindEqualsEqualsEqualsToken");
  assert.equal(tests.length, 2);
  const [unknownTest, numberTest] = tests;
  const opaque = facts.relations.at(unknownTest!);
  assert.equal(opaque?.kind, "test", ast.text(unknownTest!));
  if (opaque?.kind === "test") assert.equal(opaque.outcome, "undecided");
  assert.equal(facts.relations.at(numberTest!)?.kind, "refused", ast.text(numberTest!));
});

test("the openness classifier separates top, type parameters and closed descriptors (R4)", () => {
  const { ast, named, resolved } = fixture(`
function f<T>(a: unknown, b: any, c: T, d: string | undefined, e: number) { void a; void b; void c; void d; void e; }`);
  const openness = (name: string) => sourceTypeDescriptorOpenness(ast, resolved(named("KindParameter", name)));
  assert.deepEqual(["a", "b", "c", "d", "e"].map(openness), ["top", "top", "type-parameter", "closed", "closed"]);
});

test("a test on a type-parameter arm is undecided (R4)", () => {
  const { ast, facts, find } = fixture(`function f<T>(value: T | string): boolean { return typeof value === "string"; }`);
  const comparison = find(node => ast.is.IsBinaryExpression(node), "typeof test");
  const relation = facts.relations.at(comparison);
  assert.equal(relation?.kind === "test" ? relation.outcome : relation?.kind, "undecided");
});

test("declarations that are not slots publish their declared value (R-B4-5)", () => {
  const { facts, named } = fixture(`
class Box { value = 1; get size(): number { return 1; } method(): string { return ""; } }
function make(): Box { return new Box(); }
void make;`);
  for (const [kind, name] of [["KindClassDeclaration", "Box"], ["KindFunctionDeclaration", "make"],
    ["KindMethodDeclaration", "method"], ["KindGetAccessor", "size"]] as const) {
    const declaration = named(kind, name);
    assert.equal(facts.values.has(declaration), true, `${name} is in the value domain`);
    assert.equal(facts.values.type(declaration).kind, "resolved", `${name} has a declared value`);
  }
  assert.equal(facts.values.callableReturn(named("KindGetAccessor", "size")).kind, "resolved");
});

test("a member call on a generic receiver binds the owner's binders from the receiver (R-B4-6)", () => {
  const { ast, facts, find } = fixture(`
class Bag<T> { items: T[] = []; add(item: T): void { this.items.push(item); } }
const bag = new Bag<string>();
bag.add("x");`);
  const call = find(node => ast.is.IsCallExpression(node) && ast.text(node).startsWith("bag.add"), "bag.add call");
  const instantiation = facts.instantiations.at(call);
  assert.equal(instantiation !== undefined && instantiation.kind !== "refused", true);
  if (instantiation === undefined || instantiation.kind === "refused") return;
  assert.deepEqual(instantiation.receiver.map(binding => sourceTypeDescriptorStructure(binding.type).kind), ["string"]);
  assert.deepEqual(instantiation.parameters.map(parameter => sourceTypeDescriptorStructure(parameter).kind), ["string"]);
});

test("an object literal whose Host type is any is a Host refusal; an any value elsewhere is not", () => {
  const { ast, facts, find } = fixture(`
declare function make(): any;
const literal: any = { a: 1 };
const observed: any = make();
void literal; void observed;`);
  const object = find(node => ast.is.IsObjectLiteralExpression(node), "object literal");
  const any = facts.refusals().filter(refusal => refusal.code === "TSONIC_ANY_UNSUPPORTED");
  assert.deepEqual(any.map(refusal => refusal.site), [object]);
  assert.equal(any[0]!.message, "'any' has no native representation. Declare the type, or use 'unknown' and narrow it.");
});
