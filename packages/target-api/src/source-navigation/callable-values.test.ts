import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import type { Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { createSourceCallableValueQuery } from "./callable-values.js";

function fixture(body: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export {};
interface Operations { apply(value: object): object; }
declare const operations: Operations;
${body}`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true,
    formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  const source = createTargetSourceProgram(checked);
  const expressions = new Map<string, Node>();
  const visit = (node: Node): void => {
    if (source.ast.is.IsVariableDeclaration(node)) {
      const initializer = source.ast.as.AsVariableDeclaration(node)?.Initializer;
      if (initializer !== undefined) expressions.set(source.ast.text(source.ast.name(node)), initializer);
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true);
  visit(file!);
  const query = createSourceCallableValueQuery(source);
  return { source, select(name = "selected") {
    const expression = expressions.get(name);
    assert.equal(expression !== undefined, true, name);
    return query(expression!);
  } };
}

test("native callable value selection retains an actual receiver through immutable aliases", () => {
  const current = fixture(`const original = operations; const alias = original;
    const operation = alias.apply; const selected = (operation satisfies typeof operations.apply);`);
  const selected = current.select();
  assert.equal(selected !== undefined && selected.receiverDeclaration !== undefined, true);
  assert.equal(current.source.ast.text(current.source.ast.name(selected!.receiverDeclaration)), "operations");
  assert.equal(current.source.ast.kindName(selected!.selectedDeclaration), "KindMethodSignature");
  assert.equal(selected!.aliases.length, 3);
  assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected!.aliases), true);
});

test("general callable identity does not require invocation-only use", () => {
  const current = fixture(`const operation = operations.apply; export const selected = operation;
    export function retain(): typeof operations.apply { return operation; }`);
  const selected = current.select();
  assert.equal(selected !== undefined && selected.property !== undefined, true);
  assert.equal(current.source.ast.text(current.source.ast.name(selected!.receiverDeclaration)), "operations");
});

test("foreign callable and receiver parameters remain exact values, never signature declarations", () => {
  const current = fixture(`export function foreign(factory: Operations, operation: typeof operations.apply): void {
    const selected = factory.apply; const callable = operation;
  }`);
  const selected = current.select();
  const callable = current.select("callable");
  assert.equal(selected !== undefined && callable !== undefined, true);
  assert.equal(current.source.ast.kindName(selected!.receiverDeclaration), "KindParameter");
  assert.equal(current.source.ast.kindName(callable!.selectedDeclaration), "KindParameter");
  assert.equal(current.source.ast.text(current.source.ast.name(callable!.selectedDeclaration)), "operation");
});

test("mutable, evaluated and asserted callable origins cannot acquire immutable value authority", () => {
  for (const body of [
    `let alias = operations.apply; const selected = alias;`,
    `function obtain(): Operations { return operations; } const selected = obtain().apply;`,
    `const holder = { get apply(): typeof operations.apply { return operations.apply; } }; const selected = holder.apply;`,
    `const alias = operations.apply as typeof operations.apply; const selected = alias;`,
    `const selected = operations.apply; operations.apply = value => value;`,
    `const selected = operations.apply; operations["apply"] = value => value;`,
    `const key = "apply"; const selected = operations.apply; operations[key] = value => value;`,
    `interface Other { apply(value: object): object; }
      const other: Other = operations; other.apply = value => value; const selected = operations.apply;`,
    `interface Other { apply(value: object): object; }
      const alias = operations; const other: Other = alias;
      other["apply"] = value => value; const selected = operations.apply;`,
    `function replace(value: Operations): void { value.apply = input => input; }
      replace(operations); const selected = operations.apply;`,
    `let alias = operations; alias = operations; const selected = alias.apply;`,
  ]) assert.equal(fixture(body).select() === undefined, true, body);
});

test("early alias reads and excessive chains fail closed without an unbounded traversal", () => {
  const early = fixture(`invoke(); const operation = operations.apply;
    function invoke(): void { const selected = operation; }`);
  assert.equal(early.select() === undefined, true, "the actual reference is read before initialization");
  const declarations = ["const alias = operations.apply;"];
  for (let index = 0; index < 1_025; index += 1)
    declarations.push(`const alias${index} = ${index === 0 ? "alias" : `alias${index - 1}`};`);
  const large = fixture(declarations.join("\n") + "\nconst selected = alias1024;");
  assert.equal(large.select() === undefined, true, "one finite alias-chain bound");
});

test("checked indexed callable access shares the exact native member and receiver proof", () => {
  const current = fixture(`const key = "apply"; const selected = operations[key];`);
  const selected = current.select();
  assert.equal(selected !== undefined && selected.element !== undefined && selected.property === undefined, true);
  assert.equal(current.source.ast.text(current.source.ast.name(selected!.receiverDeclaration)), "operations");
  assert.equal(current.source.ast.kindName(selected!.selectedDeclaration), "KindMethodSignature");
});

test("separate ambient declarations do not certify physically disjoint callable slots", () => {
  const current = fixture(`declare const other: Operations; const selected = operations.apply;
    other.apply = value => value;`);
  assert.equal(current.select() === undefined, true, "two ambient values may alias the same physical receiver");
});

test("readonly structural aliases preserve callable selection without relying on member declaration equality", () => {
  const current = fixture(`interface Other { apply(value: object): object; }
    const other: Other = operations; const selected = other.apply;`);
  const selected = current.select();
  assert.equal(selected !== undefined && selected.receiverDeclaration !== undefined, true);
  assert.equal(current.source.ast.text(current.source.ast.name(selected!.receiverDeclaration)), "operations");
});
