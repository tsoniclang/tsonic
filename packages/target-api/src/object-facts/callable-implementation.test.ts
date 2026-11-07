// Host fact test: `facts.objects.callableImplementation(contract)` maps a project callable contract to its
// implementation declaration (overloads, constructor overloads, method overloads), or "unrelated" when no declaration
// of the entity has a body (ambient, interface and abstract members) or the contract is not a callable declaration.
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createHostSourceProgramFixture } from "../source-semantics/host-program-fixtures.js";

const sourceText = `
export function overloaded(value: string): string;
export function overloaded(value: number): number;
export function overloaded(value: string | number): string | number { return value; }
export declare function ambient(value: string): void;
export declare function ambient(value: number): void;
interface Shape { area(): number; }
abstract class Base { abstract size(): number; }
export class Box extends Base implements Shape {
  constructor(value: string);
  constructor(value: number);
  constructor(readonly value: string | number) { super(); }
  area(): number;
  area(scale: number): number;
  area(scale = 1): number { return scale; }
  size(): number { return 1; }
}
export const arrow = (x: number) => x;
export const plain = 1;
`;

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": sourceText },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)));
  const host = createHostSourceProgramFixture(checked);
  const { ast } = host;
  const nodes: Node[] = [];
  const visit = (node: Node): void => {
    nodes.push(node);
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(checked.getSourceFile("/src/index.ts")!);
  const all = (kind: string, name?: string): readonly Node[] => nodes.filter(node => ast.kindName(node) === kind &&
    (name === undefined || ast.name(node) !== undefined && ast.text(ast.name(node)!) === name));
  return { facts: host.facts, ast, all };
}

test("overload signatures resolve to the one implementation; an implementation is its own", () => {
  const { facts, all } = fixture();
  const [first, second, implementation] = all("KindFunctionDeclaration", "overloaded");
  assert.equal(facts.objects.callableImplementation(first!), implementation);
  assert.equal(facts.objects.callableImplementation(second!), implementation);
  assert.equal(facts.objects.callableImplementation(implementation!), implementation);
});

test("constructor and method overloads resolve within their class", () => {
  const { facts, all } = fixture();
  const constructors = all("KindConstructor");
  assert.equal(constructors.length, 3);
  for (const contract of constructors) assert.equal(facts.objects.callableImplementation(contract), constructors[2]);
  const areas = all("KindMethodDeclaration", "area");
  assert.equal(areas.length, 3);
  for (const contract of areas) assert.equal(facts.objects.callableImplementation(contract), areas[2]);
  const [size] = all("KindMethodDeclaration", "size").filter(node => facts.navigation.scopes.role(node).includes("callable-body"));
  assert.equal(facts.objects.callableImplementation(size!), size);
});

test("contracts without an implementation, and non-callables, are unrelated without a refusal", () => {
  const { facts, all, ast } = fixture();
  for (const contract of all("KindFunctionDeclaration", "ambient")) {
    assert.equal(facts.objects.callableImplementation(contract), "unrelated");
  }
  const [interfaceArea] = all("KindMethodSignature", "area");
  assert.equal(facts.objects.callableImplementation(interfaceArea!), "unrelated", "interface member: no merged body");
  const [abstractSize] = all("KindMethodDeclaration", "size").filter(node => ast.body(node) === undefined);
  assert.equal(facts.objects.callableImplementation(abstractSize!), "unrelated", "abstract member: no body");
  const [plain] = all("KindVariableDeclaration", "plain");
  assert.equal(facts.objects.callableImplementation(plain!), "unrelated");
  assert.equal(facts.refusals().some(refusal => refusal.code === "TSONIC_SOURCE_CALLABLE_IMPLEMENTATION_UNRESOLVED"), false);
});

test("an arrow function with a body is its own implementation", () => {
  const { facts, all, ast } = fixture();
  const [declaration] = all("KindVariableDeclaration", "arrow");
  const arrow = ast.as.AsVariableDeclaration(declaration!)?.Initializer;
  assert.equal(arrow !== undefined && ast.is.IsArrowFunction(arrow), true);
  assert.equal(facts.objects.callableImplementation(arrow!), arrow);
});
