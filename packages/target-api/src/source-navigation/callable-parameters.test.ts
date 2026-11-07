import { createHostSourceProgramFixture } from "../source-semantics/host-program-fixtures.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { sourceCallableValueParameters } from "./callable-parameters.js";

test("only the checker's actual this parameter is erased from the value parameter vector", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "export function read(this: void, thisValue: number, value = 1, ...rest: number[]): number { return thisValue + value + rest.length; }",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the source has a checked callable contract");
  const source = createHostSourceProgramFixture(checked);
  const file = checked.getSourceFile("/src/index.ts")!;
  const owner = source.ast.statements(file).find(node => node !== undefined && source.ast.is.IsFunctionDeclaration(node))!;
  const selected = sourceCallableValueParameters(source.ast, owner, source.navigation);
  assert.equal(selected !== undefined, true, "the complete checked parameter vector is available");
  assert.deepEqual(selected!.map(parameter => source.ast.text(source.ast.name(parameter))), ["thisValue", "value", "rest"]);
  assert.equal(Object.isFrozen(selected), true, "the source parameter evidence is immutable");
  assert.equal(sourceCallableValueParameters(source.ast, file, source.navigation), undefined,
    "a noncallable subject never fabricates a runtime parameter vector");
});

const checkedCallableCases = [
  { name: "function", source: "function read(value: number): number { return value; } read(1);", parameters: [["value"]] },
  { name: "method", source: "class Owner { read(value: number): number { return value; } } new Owner().read(1);", parameters: [["value"], []] },
  { name: "explicit constructor", source: "class Owner { constructor(value: number) {} } new Owner(1);", parameters: [["value"]] },
  { name: "implicit constructor", source: "class Owner {} new Owner();", parameters: [[]] },
  { name: "implicit class expression", source: "const Owner = class {}; new Owner();", parameters: [[]] },
  { name: "inherited constructor", source: "class Base { constructor(value: number) {} } class Owner extends Base {} new Owner(1);", parameters: [["value"]] },
  { name: "arrow variable", source: "const read = (value: number): number => value; read(1);", parameters: [["value"]] },
  { name: "function expression", source: "const read = function(value: number): number { return value; }; read(1);", parameters: [["value"]] },
  { name: "function field", source: "class Owner { read = (value: number): number => value; } new Owner().read(1);", parameters: [["value"], []] },
  { name: "typed property", source: "interface Owner { read: (value: number) => number; } declare const owner: Owner; owner.read(1);", parameters: [["value"]] },
  { name: "method signature", source: "interface Owner { read(value: number): number; } declare const owner: Owner; owner.read(1);", parameters: [["value"]] },
  { name: "function parameter", source: "function run(callback: (value: number) => number): number { return callback(1); } run(value => value);", parameters: [["value"], ["callback"]] },
  { name: "selected overload", source: "function read(numeric: number): number; function read(textual: string): string; function read(implementation: number | string): number | string { return implementation; } read('value');", parameters: [["textual"]] },
  { name: "callable getter", source: "class Owner { get read(): (value: number) => number { return value => value; } } new Owner().read(1);", parameters: [["value"], []] },
  { name: "callable interface", source: "interface Reader { (value: number): number; } declare const read: Reader; read(1);", parameters: [["value"]] },
  { name: "construct signature", source: "interface Factory { new (value: number): { value: number }; } declare const Owner: Factory; new Owner(1);", parameters: [["value"]] },
  { name: "pseudo this", source: "function read(this: void, thisValue: number): number { return thisValue; } read(1);", parameters: [["thisValue"]] },
  { name: "optional and tuple rest", source: "function read(first: number, ...values: [number, string?]): number { return first; } read(1, 2);", parameters: [["first", "values"]] },
  { name: "generic selected signature", source: "function read<Value>(value: Value): Value { return value; } read(1);", parameters: [["value"]] },
  { name: "narrowed optional callable", source: "declare const read: ((value: number) => number) | undefined; if (read !== undefined) read(1);", parameters: [["value"]] },
  { name: "union selected signature", source: "declare const read: ((first: number) => number) | ((second: number) => string); read(1);", parameters: [["first"]] },
];

for (const example of checkedCallableCases) {
  test(`checked callable parameter context retains ${example.name}`, () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
      "/src/index.ts": example.source,
    }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, `${example.name} source is checked`);
    const source = createHostSourceProgramFixture(checked);
    const file = checked.getSourceFile("/src/index.ts")!;
    const calls: Node[] = [];
    const visit = (node: Node): void => {
      if (source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node)) calls.push(node);
      source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(file);
    assert.equal(calls.length, example.parameters.length, `${example.name} complete invocation count`);
    for (const [index, node] of calls.entries()) {
      const call = source.navigation.call(node);
      assert.equal(call?.selection === "resolved", true, `${example.name} exact selected signature`);
      const selected = sourceCallableValueParameters(source.ast, node, source.navigation, { kind: "selected-invocation", call: node });
      assert.equal(selected !== undefined, true, `${example.name} complete logical vector`);
      assert.deepEqual(selected!.map(parameter => source.ast.text(source.ast.name(parameter))), example.parameters[index],
        `${example.name} original checker parameter order`);
      assert.equal(selected!.length === call!.parameters.length && selected!.every((parameter, position) =>
        parameter === call!.parameters[position]!.parameterDeclaration), true,
      `${example.name} the selected signature's own parameter declarations rather than expanded native slots`);
      assert.equal(Object.isFrozen(selected), true, `${example.name} immutable source vector`);
    }
  });
}

test("declaration context never picks a public overload for a callable holder", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "declare function read(numeric: number): number; declare function read(textual: string): string; const alias = read;",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the overload holder is checked");
  const source = createHostSourceProgramFixture(checked);
  const file = checked.getSourceFile("/src/index.ts")!;
  let holder: Node | undefined;
  const visit = (node: Node): void => {
    if (source.ast.is.IsVariableDeclaration(node)) holder = node;
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(holder !== undefined, true, "the actual variable declaration is retained");
  assert.equal(sourceCallableValueParameters(source.ast, holder!, source.navigation) === undefined, true,
    "a holder without checked invocation selection does not choose its first overload");
});

const overloadedImplementationCases = [
  { name: "function", source: "function read(value: number): number; function read(value: number, delta: number): number; function read(value: number, delta?: number): number { return value + (delta ?? 0); } read(1);" },
  { name: "method", source: "class Owner { read(value: number): number; read(value: number, delta: number): number; read(value: number, delta?: number): number { return value + (delta ?? 0); } } new Owner().read(1);" },
  { name: "constructor", source: "class Owner { constructor(value: number); constructor(value: number, delta: number); constructor(value: number, delta?: number) {} } new Owner(1);" },
];

for (const example of overloadedImplementationCases) {
  test(`selected ${example.name} inputs stay distinct from its native implementation inputs`, () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
      "/src/index.ts": example.source,
    }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, `${example.name} overload correspondence is checked`);
    const source = createHostSourceProgramFixture(checked);
    const file = checked.getSourceFile("/src/index.ts")!;
    let implementation: Node | undefined;
    let invocation: Node | undefined;
    const visit = (node: Node): void => {
      if (source.ast.body(node) !== undefined && (source.ast.is.IsFunctionDeclaration(node) ||
        source.ast.is.IsMethodDeclaration(node) || source.ast.is.IsConstructorDeclaration(node))) implementation = node;
      if (example.name === "constructor" ? source.ast.is.IsNewExpression(node) : source.ast.is.IsCallExpression(node)) invocation = node;
      source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(file);
    assert.equal(implementation !== undefined && invocation !== undefined, true, "both actual checked contexts are retained");
    assert.equal(source.navigation.call(invocation!)?.selection === "resolved", true, "the public overload is selected");
    const logical = sourceCallableValueParameters(source.ast, implementation!, source.navigation,
      { kind: "selected-invocation", call: invocation! });
    const native = sourceCallableValueParameters(source.ast, implementation!, source.navigation, { kind: "declaration" });
    assert.equal(logical?.length, 1, "the selected public overload has one logical input");
    assert.equal(native?.length, 2, "the emitted implementation keeps its required and optional native inputs");
    assert.equal(native?.[1] === source.ast.parameters(implementation!)[1], true,
      "the native default slot retains its actual implementation parameter identity");
    assert.equal(Object.isFrozen(logical) && Object.isFrozen(native), true, "both distinct vectors are immutable");
  });
}

for (const [label, text, count] of [
  ["declaration", "export function step(value: number): number { return value; }", 1],
  ["arrow", "export const step = (value: number): number => value;", 1],
  ["function expression", "export const step = function(value: number): number { return value; };", 1],
  ["destructuring/default/rest", "export function step({ value }: { value: number }, count = 1, ...rest: number[]): number { return value + count; }", 3],
  ["optional", "export function step(value?: number): number { return value ?? 7; }", 1],
  ["empty", "export function step(): number { return 7; }", 0],
] as const) {
  test(`${label} source formals are the declared signature's parameter declarations`, () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
      "/src/index.ts": text,
    }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, `${label}: checked source`);
    const source = createHostSourceProgramFixture(checked);
    let owner: Node | undefined;
    const visit = (node: Node): void => {
      if (source.ast.is.IsFunctionDeclaration(node) || source.ast.is.IsArrowFunction(node) ||
        source.ast.is.IsFunctionExpression(node)) owner = node;
      source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(checked.getSourceFile("/src/index.ts")!);
    assert.equal(owner !== undefined, true, `${label}: actual callable owner`);
    const original = source.ast.parameters(owner!);
    for (const context of [undefined, { kind: "declaration" } as const]) {
      const selected = sourceCallableValueParameters(source.ast, owner!, source.navigation, context);
      assert.equal(selected !== undefined && selected.length === count, true, `${label}: complete original input count`);
      assert.equal(selected?.every((parameter, index) => parameter === original[index]), true,
        `${label}: original checked parameter identities`);
      assert.equal(Object.isFrozen(selected), true, `${label}: immutable input evidence`);
    }
  });
}

test("selected invocation formals are the selected signature's parameter declarations", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "function read(value: number): number { return value; } read(1);",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the invocation is checked");
  const source = createHostSourceProgramFixture(checked);
  let invocation: Node | undefined;
  const visit = (node: Node): void => {
    if (source.ast.is.IsCallExpression(node)) invocation = node;
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(checked.getSourceFile("/src/index.ts")!);
  const call = source.navigation.call(invocation!);
  assert.equal(call?.selection === "resolved", true, "the actual invocation supplies a selected signature");
  const selected = sourceCallableValueParameters(source.ast, invocation!, source.navigation, { kind: "selected-invocation", call: invocation! });
  assert.equal(selected?.[0] === call!.parameters[0]?.parameterDeclaration, true,
    "selection retains the original checked parameter identity");
});

for (const [label, text, construction, count] of [
  ["callable holder", "const read: (value: number) => number = value => value;", false, 1],
  ["implicit constructor", "class Owner {}", true, 0],
] as const) {
  test(`${label} formals come from the authored annotation or the effective constructor`, () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
      "/src/index.ts": text,
    }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, `${label}: checked source`);
    const source = createHostSourceProgramFixture(checked);
    let holder: Node | undefined;
    const visit = (node: Node): void => {
      if (construction ? source.ast.is.IsClassDeclaration(node) : source.ast.is.IsVariableDeclaration(node)) holder = node;
      source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(checked.getSourceFile("/src/index.ts")!);
    const selected = sourceCallableValueParameters(source.ast, holder!, source.navigation);
    assert.equal(selected !== undefined && selected.length === count, true, `${label}: original checked input count`);
  });
}

// R2 #43: a holder annotated through a non-generic alias, interface or type literal naming one call signature answers its
// parameters in declaration mode, as at baseline (single call signature of the declared type); generic and multi-signature
// annotations stay undefined.
test("an aliased or interface callable annotation answers the parameters of its single call signature", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": [
      "type Handler = (value: number) => void;",
      "type Wrapped = (Handler);",
      "interface Reader { (text: string): number; }",
      "type Generic<T> = (item: T) => void;",
      "interface Twice { (a: number): void; (b: string): void; }",
      "export const aliased: Handler = value => {};",
      "export const wrapped: Wrapped = value => {};",
      "export const read: Reader = text => text.length;",
      "export const literal: { (key: string): void } = key => {};",
      "export const generic: Generic<number> = item => {};",
      "export const twice: Twice = (_: number | string) => {};",
    ].join("\n"),
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the source is checked");
  const source = createHostSourceProgramFixture(checked);
  const file = checked.getSourceFile("/src/index.ts")!;
  const holders = new Map<string, Node>();
  const visit = (node: Node): void => {
    if (source.ast.is.IsVariableDeclaration(node)) holders.set(source.ast.text(source.ast.name(node)!), node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const names = (holder: string) => sourceCallableValueParameters(source.ast, holders.get(holder)!, source.navigation)
    ?.map(parameter => source.ast.text(source.ast.name(parameter)));
  assert.deepEqual(names("aliased"), ["value"]);
  assert.deepEqual(names("wrapped"), ["value"]);
  assert.deepEqual(names("read"), ["text"]);
  assert.deepEqual(names("literal"), ["key"]);
  assert.equal(names("generic"), undefined, "a generic alias is not followed");
  assert.equal(names("twice"), undefined, "two call signatures name no single parameter vector");
});
