import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { sourceCallableValueParameters } from "./callable-parameters.js";

test("only the checker's actual this parameter is erased from the value parameter vector", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "export function read(this: void, thisValue: number, value = 1, ...rest: number[]): number { return thisValue + value + rest.length; }",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the source has a checked callable contract");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts")!;
  const owner = source.ast.statements(file).find(node => node !== undefined && source.ast.is.IsFunctionDeclaration(node))!;
  const selected = sourceCallableValueParameters(source.ast, owner, source.semantics.forNode(owner));
  assert.equal(selected !== undefined, true, "the complete checked parameter vector is available");
  assert.deepEqual(selected!.map(parameter => source.ast.text(source.ast.name(parameter))), ["thisValue", "value", "rest"]);
  assert.equal(Object.isFrozen(selected), true, "the source parameter evidence is immutable");
  assert.equal(sourceCallableValueParameters(source.ast, file, source.semantics.forFile(file)), undefined,
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
    const source = createTargetSourceProgram(checked);
    const file = checked.getSourceFile("/src/index.ts")!;
    const calls: Node[] = [];
    const visit = (node: Node): void => {
      if (source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node)) calls.push(node);
      source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(file);
    assert.equal(calls.length, example.parameters.length, `${example.name} complete invocation count`);
    for (const [index, node] of calls.entries()) {
      const semantics = source.semantics.forNode(node);
      const call = semantics.operations.call(node);
      assert.equal(call?.sourceSelectedSignatureKind === "resolved", true, `${example.name} exact selected signature`);
      const selected = sourceCallableValueParameters(source.ast, node, semantics,
        { kind: "selected-invocation", signature: call!.selectedSignature });
      assert.equal(selected !== undefined, true, `${example.name} complete logical vector`);
      assert.deepEqual(selected!.map(parameter => source.ast.text(source.ast.name(parameter))), example.parameters[index],
        `${example.name} original checker parameter order`);
      const symbols = semantics.declarations.signatureParameters(call!.selectedSignature);
      assert.equal(selected!.length === symbols.length && selected!.every((parameter, position) =>
        parameter === semantics.declarations.primarySymbolDeclaration(symbols[position]!)), true,
      `${example.name} original symbol-owned identities rather than expanded native slots`);
      assert.equal(Object.isFrozen(selected), true, `${example.name} immutable source vector`);
    }
  });
}

test("declaration context never picks a public overload for a callable holder", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "declare function read(numeric: number): number; declare function read(textual: string): string; const alias = read;",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the overload holder is checked");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts")!;
  let holder: Node | undefined;
  const visit = (node: Node): void => {
    if (source.ast.is.IsVariableDeclaration(node)) holder = node;
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(holder !== undefined, true, "the actual variable declaration is retained");
  assert.equal(sourceCallableValueParameters(source.ast, holder!, source.semantics.forNode(holder!)) === undefined, true,
    "a holder without checked invocation selection does not choose its first overload");
});
