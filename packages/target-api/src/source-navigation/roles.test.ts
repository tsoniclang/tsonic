// Host fact tests for the E13 role model (03-DATA-MODEL `SourceCallableRole`, 06-INTERFACES navigation facts):
// additive purposes, role-specific enclosing lookup, and the receiver binder as a separate question. Facts only.
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createHostSourceProgramFixture } from "../source-semantics/host-program-fixtures.js";
import { sourceEnclosing, sourceNodeRoleOrder, sourceNodeRoles } from "../source-model/callable-boundaries.js";

const sourceText = `export {};
function overloaded(value: string): string;
function overloaded(value: number): number;
function overloaded(value: string | number): string | number { return value; }
function identity<T>(value: T): T { return value; }
type Box<T> = { readonly value: T };
interface Shape<T> { read(): T; map<U>(mapper: (value: T) => U): U; }
declare function ambientOnly(): void;
let total = 0;
class Counter<T> {
  count = total;
  label = String(this.count);
  static created = 0;
  static { const seed = 1; this.created = seed; }
  constructor(public item: T) {
    const read = () => this.count;
    const later = function (): number { return 1; };
    const handlers = { run(): number { return 2; }, get size(): number { return 3; } };
    total = read() + later() + handlers.run() + handlers.size;
  }
  map<U>(mapper: (item: T) => U): U { return mapper(this.item); }
  plain(): number { return this.count; }
}
function host(): number {
  class Inner { static value = 0; static { Inner.value = 1; } }
  return Inner.value;
}
const box: Box<number> = { value: identity(1) };
const shape: Shape<number> | undefined = undefined;
void overloaded; void box; void shape; void host; void ambientOnly; void Counter;
`;

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": sourceText },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)));
  const host = createHostSourceProgramFixture(checked);
  const { ast } = host;
  const file = checked.getSourceFile("/src/index.ts")!;
  const nodes: Node[] = [];
  const visit = (node: Node): void => {
    nodes.push(node);
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const all = (predicate: (node: Node) => boolean): readonly Node[] => nodes.filter(predicate);
  const one = (predicate: (node: Node) => boolean, label: string, index = 0): Node => {
    const selected = all(predicate)[index];
    assert.equal(selected !== undefined, true, label);
    return selected!;
  };
  const named = (kind: string, name: string, index = 0): Node => one(node => ast.kindName(node) === kind &&
    ast.name(node) !== undefined && ast.text(ast.name(node)!) === name, `${kind} ${name}`, index);
  const within = (root: Node, predicate: (node: Node) => boolean, label: string): Node => one(node => {
    if (!predicate(node)) return false;
    for (let current = ast.parent(node); current !== undefined; current = ast.parent(current)) if (current === root) return true;
    return false;
  }, label);
  return { ast, file, nodes, scopes: host.facts.navigation.scopes, named, within, one };
}

const body = ["callable-body", "callable-signature", "execution-barrier"] as const;

test("the role model is the one classifier: roles and every enclosing walk agree with the free queries", () => {
  const { ast, nodes, scopes } = fixture();
  for (const node of nodes) {
    const roles = scopes.role(node);
    assert.deepEqual(roles, sourceNodeRoles(ast, node), ast.kindName(node));
    assert.equal(scopes.role(node), roles, "roles are memoized per program");
    assert.equal(Object.isFrozen(roles), true);
    for (const role of sourceNodeRoleOrder) {
      assert.equal(scopes.enclosing(node, role), sourceEnclosing(ast, node, role), `${ast.kindName(node)} ${role}`);
    }
  }
});

test("a function with a body is both body owner and signature owner; an overload is a signature owner only", () => {
  const { ast, scopes, named, one } = fixture();
  const overloads = [0, 1, 2].map(index => named("KindFunctionDeclaration", "overloaded", index));
  const [first, second, implementation] = overloads as [Node, Node, Node];
  assert.deepEqual(scopes.role(implementation), body, "the implementation owns its body and declares its signature");
  assert.deepEqual(scopes.role(first), ["callable-signature"], "a bodyless overload declares a signature only");
  assert.deepEqual(scopes.role(second), ["callable-signature"]);
  const parameter = (owner: Node): Node => one(node => ast.is.IsParameterDeclaration(node) && ast.parent(node) === owner,
    "parameter");
  assert.equal(scopes.enclosing(parameter(first), "callable-signature"), first, "the overload owns its parameter's signature");
  assert.equal(scopes.enclosing(parameter(first), "callable-body"), undefined, "an overload owns no body");
  assert.equal(scopes.enclosing(parameter(first), "execution-barrier"), undefined);
  assert.equal(scopes.enclosing(parameter(implementation), "callable-body"), implementation);
  assert.equal(scopes.enclosing(parameter(implementation), "callable-signature"), implementation,
    "a body owner is also the signature owner");
  assert.equal(scopes.enclosing(implementation, "callable-body"), undefined, "enclosing is strict: never the node itself");
  const ambient = named("KindFunctionDeclaration", "ambientOnly");
  assert.deepEqual(scopes.role(ambient), ["callable-signature", "ambient"]);
});

test("a class static block is an execution barrier and not a body owner", () => {
  const { ast, scopes, named, one, within } = fixture();
  const counter = named("KindClassDeclaration", "Counter");
  const block = one(node => ast.kindName(node) === "KindClassStaticBlockDeclaration" && ast.parent(node) === counter, "static block");
  assert.deepEqual(scopes.role(block), ["execution-barrier"]);
  const seed = named("KindVariableDeclaration", "seed");
  assert.equal(scopes.enclosing(seed, "execution-barrier"), block, "the barrier stops at the static block");
  assert.equal(scopes.enclosing(seed, "callable-body"), undefined, "a module-level class static block has no body owner");
  assert.equal(scopes.enclosing(seed, "class-scope"), counter);

  const hostFunction = named("KindFunctionDeclaration", "host");
  const inner = named("KindClassDeclaration", "Inner");
  const innerBlock = one(node => ast.kindName(node) === "KindClassStaticBlockDeclaration" && ast.parent(node) === inner,
    "inner static block");
  const write = within(innerBlock, node => ast.is.IsBinaryExpression(node), "static write");
  assert.equal(scopes.enclosing(write, "execution-barrier"), innerBlock, "the static block is the nearest barrier");
  assert.equal(scopes.enclosing(write, "callable-body"), hostFunction, "the body-owner walk passes through the static block");
  assert.equal(scopes.enclosing(innerBlock, "execution-barrier"), hostFunction);
});

test("type-parameter owners are the declarations with type parameters", () => {
  const { ast, scopes, named, one } = fixture();
  const has = (node: Node) => scopes.role(node).includes("type-parameter-owner");
  const counter = named("KindClassDeclaration", "Counter");
  const map = named("KindMethodDeclaration", "map");
  const shape = named("KindInterfaceDeclaration", "Shape");
  const mapSignature = named("KindMethodSignature", "map");
  assert.deepEqual(scopes.role(counter), ["type-parameter-owner", "class-scope"], "generic class");
  assert.deepEqual(scopes.role(map), [...body, "type-parameter-owner"], "generic method");
  assert.deepEqual(scopes.role(named("KindFunctionDeclaration", "identity")), [...body, "type-parameter-owner"], "generic function");
  assert.deepEqual(scopes.role(named("KindTypeAliasDeclaration", "Box")), ["type-parameter-owner", "type-only"], "generic alias");
  assert.deepEqual(scopes.role(shape), ["type-parameter-owner", "type-only"], "generic interface");
  assert.deepEqual(scopes.role(mapSignature), ["callable-signature", "type-parameter-owner"], "generic method signature");
  assert.deepEqual(scopes.role(named("KindMethodSignature", "read")), ["callable-signature"], "a non-generic signature");
  assert.equal(has(named("KindMethodDeclaration", "plain")), false, "a non-generic method owns no type parameters");
  assert.equal(has(named("KindFunctionDeclaration", "host")), false);

  // Binder lookup by purpose: `T` in map's callback type passes the non-generic function type and the method that
  // declares only U, and reaches the class that declares T.
  const mapperType = one(node => ast.kindName(node) === "KindFunctionType" && ast.parent(ast.parent(node)!) === map, "mapper type");
  assert.deepEqual(scopes.role(mapperType), ["callable-signature", "type-only"], "a function type declares a signature");
  const item = one(node => ast.is.IsParameterDeclaration(node) && ast.parent(node) === mapperType, "item: T");
  const reference = ast.typeNode(item)!;
  assert.equal(ast.kindName(reference), "KindTypeReference");
  assert.equal(scopes.enclosing(reference, "callable-signature"), mapperType);
  assert.equal(scopes.enclosing(reference, "type-parameter-owner"), map);
  assert.equal(scopes.enclosing(map, "type-parameter-owner"), counter);
});

test("deferred execution marks closures, including closures created in a constructor; field initializers are not deferred", () => {
  const { ast, scopes, named, one, within } = fixture();
  const constructor = one(node => ast.is.IsConstructorDeclaration(node), "constructor");
  const read = one(node => ast.is.IsArrowFunction(node), "arrow");
  const later = one(node => ast.is.IsFunctionExpression(node), "function expression");
  const run = named("KindMethodDeclaration", "run");
  const size = named("KindGetAccessor", "size");
  for (const closure of [read, later, run, size]) {
    assert.deepEqual(scopes.role(closure), [...body, "deferred-execution"], ast.kindName(closure));
  }
  assert.deepEqual(scopes.role(constructor), body, "the constructor body runs during construction");
  assert.deepEqual(scopes.role(named("KindMethodDeclaration", "plain")), body, "a class method is not a created closure");
  assert.deepEqual(scopes.role(named("KindPropertyDeclaration", "count")), [], "a field initializer runs during construction");

  const deferredRead = within(read, node => ast.is.IsPropertyAccessExpression(node), "this.count in the arrow");
  assert.equal(scopes.enclosing(deferredRead, "deferred-execution"), read, "the read runs when the arrow is called");
  assert.equal(scopes.enclosing(deferredRead, "callable-body"), read);
  const constructionWrite = within(constructor, node => ast.is.IsBinaryExpression(node) &&
    ast.operatorKindName(node) === "KindEqualsToken", "total = ... in the constructor");
  assert.equal(scopes.enclosing(constructionWrite, "deferred-execution"), undefined, "the write runs during construction");
  assert.equal(scopes.enclosing(constructionWrite, "callable-body"), constructor);
});

test("the this-binder is separate from the callable purposes", () => {
  const { ast, file, scopes, named, one, within } = fixture();
  const constructor = one(node => ast.is.IsConstructorDeclaration(node), "constructor");
  const read = one(node => ast.is.IsArrowFunction(node), "arrow");
  const thisIn = (root: Node, label: string) => within(root, node => ast.kindName(node) === "KindThisKeyword", label);

  const arrowThis = thisIn(read, "this in the arrow");
  assert.equal(scopes.enclosing(arrowThis, "callable-body"), read, "the arrow owns the body around `this`");
  assert.equal(scopes.thisBinder(arrowThis), constructor, "but the constructor binds `this`; arrows never do");

  const counter = named("KindClassDeclaration", "Counter");
  const block = one(node => ast.kindName(node) === "KindClassStaticBlockDeclaration" && ast.parent(node) === counter, "static block");
  assert.equal(scopes.thisBinder(thisIn(block, "this in the static block")), block, "a static block binds `this`");

  const label = named("KindPropertyDeclaration", "label");
  const fieldThis = thisIn(label, "this in the field initializer");
  assert.equal(scopes.thisBinder(fieldThis), label, "a field initializer binds `this`");
  assert.equal(scopes.enclosing(fieldThis, "execution-barrier"), undefined, "while no callable purpose encloses it");

  const plain = named("KindMethodDeclaration", "plain");
  assert.equal(scopes.thisBinder(thisIn(plain, "this in plain")), plain);
  assert.equal(scopes.enclosing(named("KindVariableDeclaration", "total"), "module-scope"), file);
});
