// Host fact tests for writer B1's share of SourceProgramFacts: the role model, object facts, selections, the
// assembled frozen fact object and the target handle (I1). Facts only; representation is proven by the targets.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createHostSourceProgramFixture, createTargetSourceProgramFixture } from "../source-semantics/host-program-fixtures.js";

function checkedProgram(body: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export {};\n${body}`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true,
    formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  return checked;
}

function nodesOfKind(host: { readonly ast: { kindName(node: Node): string } },
  _select: unknown, kind: string, nodes: readonly Node[] = currentNodes): readonly Node[] {
  return nodes.filter(node => host.ast.kindName(node) === kind);
}

let currentNodes: readonly Node[] = [];

function fixture(body: string) {
  const checked = checkedProgram(body);
  const host = createHostSourceProgramFixture(checked);
  const nodes: Node[] = [];
  const visit = (node: Node): void => {
    nodes.push(node);
    host.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(checked.getSourceFile("/src/index.ts")!);
  currentNodes = nodes;
  const select = (predicate: (node: Node) => boolean, label: string): Node => {
    const selected = nodes.find(predicate);
    assert.equal(selected !== undefined, true, label);
    return selected!;
  };
  const named = (kind: string, name: string): Node => select(node => host.ast.kindName(node) === kind &&
    host.ast.name(node) !== undefined && host.ast.text(host.ast.name(node)!) === name, `${kind} ${name}`);
  return { host, facts: host.facts, nodes, select, named };
}

test("the role model answers identity, writes, captures, suspension and this-binding by declaration", () => {
  const { host, facts, select, named } = fixture(`
function overloaded(value: string): string;
function overloaded(value: number): number;
function overloaded(value: string | number): string | number { return value; }
class Counter {
  count = 0;
  async tick(step: number): Promise<number> {
    let total = this.count;
    total += step;
    const read = () => total;
    await Promise.resolve();
    return read();
  }
}
overloaded(1);`);
  const roles = facts.navigation;
  const implementation = select(node => host.ast.is.IsFunctionDeclaration(node) && host.ast.body(node) !== undefined, "implementation");
  assert.equal(roles.identity.declarations(implementation).length, 3, "overloads merge under one entity");
  const call = select(node => host.ast.is.IsCallExpression(node) &&
    host.ast.text(host.ast.as.AsCallExpression(node)!.Expression!) === "overloaded", "call");
  const callee = host.ast.as.AsCallExpression(call)!.Expression!;
  assert.equal(roles.identity.target(callee)?.project, true);

  const tick = named("KindMethodDeclaration", "tick");
  const total = named("KindVariableDeclaration", "total");
  const writes = roles.uses.writesWithin(total, tick);
  assert.deepEqual(writes.map(write => write.compound), [true], "`total += step` is one compound write");
  assert.equal(roles.scopes.suspensions(tick).length, 1, "one await suspends tick");
  assert.deepEqual(roles.scopes.role(tick), ["callable-body", "callable-signature", "execution-barrier"]);
  const arrow = select(node => host.ast.is.IsArrowFunction(node), "arrow");
  assert.equal(roles.scopes.role(arrow).includes("deferred-execution"), true);
  assert.deepEqual(roles.scopes.captures(arrow).map(capture => capture.written), [true], "the arrow captures written total");
  const thisRead = select(node => host.ast.kindName(node) === "KindThisKeyword", "this");
  assert.equal(roles.scopes.thisBinder(thisRead), tick, "a method binds this");
  assert.equal(roles.scopes.bindingScope(total) !== undefined, true);
  assert.equal(Object.isFrozen(roles) && Object.isFrozen(roles.scopes), true);
});

test("object facts publish heritage, construction order, implementations and own keys", () => {
  const { facts, named, select, host } = fixture(`
interface Named<T> { name(): T }
class Base { base = 1; }
class Point extends Base implements Named<string> {
  y = 2;
  constructor(public x: number) { super(); }
  name(): string { return "p"; }
}
const literal = { b: 1, 2: true, a: "x", 1: null };
const point = new Point(1);
void literal; void point;`);
  const point = named("KindClassDeclaration", "Point");
  const heritage = facts.objects.heritage(point);
  assert.equal(Array.isArray(heritage), true, "Point heritage resolves");
  const edges = heritage as Exclude<typeof heritage, { readonly kind: "refused" }>;
  assert.deepEqual(edges.map(edge => edge.kind), ["extends", "implements"]);
  assert.deepEqual(edges[1]!.typeArguments.map(argument => argument.kind), ["string"],
    "implements Named<string> publishes its type argument as a descriptor");

  // Q101: SourceConstructFacts.initialization is deleted (no target reader); construction still resolves.
  const construction = facts.objects.construction(point);
  assert.equal("signatures" in construction, true, "Point construction resolves");

  const literal = select(node => host.ast.is.IsObjectLiteralExpression(node), "literal");
  assert.deepEqual(facts.objects.ownKeys(literal), [
    { kind: "string", value: "1" }, { kind: "string", value: "2" },
    { kind: "string", value: "b" }, { kind: "string", value: "a" },
  ], "integer keys first in ascending order, then insertion order");
  const allocation = select(node => host.ast.is.IsNewExpression(node), "new Point");
  assert.equal(facts.objects.ownKeys(allocation), "ambiguous", "a derived class instance's own keys depend on its base");

  const contract = named("KindMethodSignature", "name");
  const implementation = facts.objects.implementation(point, contract);
  assert.equal(typeof implementation === "object" && "implementation" in implementation
    && implementation.implementation === named("KindMethodDeclaration", "name"), true);
});

test("selections translate the checker witnesses into declarations and descriptors", () => {
  const { facts, host, select } = fixture(`
function pair(first: number, ...rest: string[]): number { return first + rest.length; }
const total = pair(1, "a", "b");
const values = [1, 2, 3];
for (const value of values) void value;
for (const character of "ab") void character;
void total;`);
  const call = select(node => host.ast.is.IsCallExpression(node), "pair call");
  const selection = facts.selections.call(call);
  assert.equal(selection !== undefined && selection.kind !== "refused", true);
  const selected = selection as Exclude<typeof selection, { readonly kind: "refused" } | undefined>;
  assert.equal(selected.kind, "call");
  assert.equal(selected.signature, select(node => host.ast.is.IsFunctionDeclaration(node), "pair"));
  assert.deepEqual(selected.arguments.map(argument => [argument.parameterIndex, argument.mode]),
    [[0, "positional"], [1, "rest-element"], [1, "rest-element"]]);
  assert.equal(Object.isFrozen(selected), true);

  const [arrayLoop, stringLoop] = [0, 1].map(index =>
    facts.selections.iteration(nodesOfKind(host, select, "KindForOfStatement")[index]!));
  assert.equal(arrayLoop !== undefined && "protocol" in arrayLoop ? arrayLoop.protocol : arrayLoop?.kind, "array");
  assert.equal(stringLoop !== undefined && "protocol" in stringLoop ? stringLoop.protocol : stringLoop?.kind, "string");
});

test("the target handle exposes facts and syntax only; the Host owner stays behind it", () => {
  const checked = checkedProgram("const value = 1; void value;");
  const target = createTargetSourceProgramFixture(checked);
  assert.deepEqual(Object.keys(target).sort(), ["documents", "facts", "sourceFacts", "sourceFiles", "syntax"]);
  assert.equal(Object.isFrozen(target) && Object.isFrozen(target.facts), true);
  // The target handle carries no Host owner: no hidden property opens the Host program (I2).
  assert.deepEqual(Object.getOwnPropertySymbols(target), []);
  assert.equal("semantics" in target || "navigation" in target, false);
  assert.equal(Array.isArray(target.facts.refusals()), true);
});

test("I1: the target-facing entry and contract import no checker Type, Signature, Symbol or Resolved*Info", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const sourceRoot = here.endsWith(`${path.sep}dist${path.sep}object-facts`)
    ? path.join(here, "..", "..", "src") : path.join(here, "..");
  const files = [path.join(sourceRoot, "public", "source.ts"),
    ...fs.readdirSync(path.join(sourceRoot, "public", "source")).filter(name => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map(name => path.join(sourceRoot, "public", "source", name))];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"@tsonic\/tsts"/g)) {
      const names = match[1]!.split(",").map(name => name.trim().replace(/^type\s+/, "")).filter(Boolean);
      assert.deepEqual(names.filter(name => /^(Type|Signature|Symbol|Resolved\w*Info)$/.test(name)), [], file);
    }
    assert.equal(/SourceFinalTypeQueries|SourceFileSemantics|SourceProgramNavigation|SourceProgramSemantics/.test(text), false,
      `${file} must not expose the checker services`);
  }
});

test("heritage and member contracts terminate on a cyclic direct <-> parent heritage pair (R-T6-3)", () => {
  // A cyclic interface `extends` pair is a checker error (TS2310), so the compiling cycle is an interface that extends
  // a class implementing it: Direct extends Parent, Parent implements Direct.
  const { facts, host, named } = fixture(`
class Parent implements Direct { inherited = 1; contractual = 2; }
interface Direct extends Parent { contractual: number }
class Holder implements Direct { contractual = 3; inherited = 4; direct = 5; }`);
  const parent = named("KindClassDeclaration", "Parent");
  const direct = named("KindInterfaceDeclaration", "Direct");
  const holder = named("KindClassDeclaration", "Holder");
  const edges = (declaration: Node) => {
    const heritage = facts.objects.heritage(declaration);
    assert.equal(Array.isArray(heritage), true, "heritage resolves");
    return heritage as Exclude<typeof heritage, { readonly kind: "refused" }>;
  };
  for (const [declaration, kind, target] of [[direct, "extends", parent], [parent, "implements", direct],
    [holder, "implements", direct]] as const) {
    const selected = edges(declaration);
    assert.equal(selected.length, 1);
    assert.equal(selected[0]!.kind, kind);
    assert.equal(selected[0]!.target, target, "the edge names its declared target, not a cycle-cut substitute");
    assert.equal(selected[0]!.type.kind === "declared" && selected[0]!.type.declaration === target, true,
      "the edge type is the Host descriptor of its target");
    assert.equal(facts.objects.heritage(declaration), selected, "one memoized answer per declaration");
  }
  const memberOf = (owner: Node, name: string): Node => {
    const selected = host.ast.members(owner).find(member => member !== undefined && host.ast.name(member) !== undefined &&
      host.ast.text(host.ast.name(member)!) === name);
    assert.equal(selected !== undefined, true, `${name} of its owner`);
    return selected!;
  };
  const contracts = (member: Node) => {
    const selected = facts.objects.contracts(member);
    assert.equal(Array.isArray(selected), true, "member contracts resolve over the cycle");
    return selected as readonly Node[];
  };
  const same = (actual: readonly Node[], expected: readonly Node[]): boolean =>
    actual.length === expected.length && actual.every((node, index) => node === expected[index]);
  assert.equal(same(contracts(memberOf(holder, "contractual")), [memberOf(direct, "contractual"), memberOf(parent, "contractual")]), true,
    "the direct contract, then the contract inherited through the cycle, each once");
  assert.equal(same(contracts(memberOf(holder, "inherited")), [memberOf(parent, "inherited")]), true, "the parent contract");
  assert.equal(contracts(memberOf(holder, "direct")).length, 0, "an own member names no contract");
});
