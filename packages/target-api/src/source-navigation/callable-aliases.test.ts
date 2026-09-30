import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import type { Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { createSourceCallOnlyAliasQuery } from "./callable-aliases.js";

function fixture(body: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export {};
declare function operation(value: number): number;
declare function operation(value: string): string;
${body}`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  const source = createTargetSourceProgram(checked);
  const declarations = new Map<string, Node>();
  const visit = (node: Node): void => {
    if (source.ast.is.IsVariableDeclaration(node)) declarations.set(source.ast.text(source.ast.name(node)), node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  visit(file);
  const query = createSourceCallOnlyAliasQuery(source);
  return { source, select(name = "alias") {
    const declaration = declarations.get(name);
    assert.ok(declaration);
    return query(declaration);
  } };
}

test("call-only alias closure retains original overloads, transitive aliases and deferred calls", () => {
  const current = fixture(`const first = operation; const alias = (first satisfies typeof operation);
function invoke(): boolean { return (alias)(2) === 2 && alias("text") === "text"; }
invoke();`);
  const alias = current.select();
  assert.ok(alias);
  assert.equal(alias, current.select("first"));
  assert.equal(alias.declarations.length, 2);
  assert.equal(alias.calls.length, 2);
  assert.ok(Object.isFrozen(alias) && Object.isFrozen(alias.declarations) && Object.isFrozen(alias.calls));
  const selected = alias.calls.map(call => {
    const semantics = current.source.semantics.forNode(call);
    const info = semantics.operations.call(call);
    assert.ok(info);
    return semantics.declarations.signatureDeclaration(info.selectedSignature);
  });
  assert.notEqual(selected[0], selected[1]);
});

test("property origins retain exact receiver and method declarations without accessor evaluation", () => {
  const current = fixture(`interface Operations { execute(value: number): number; }
declare const operations: Operations;
const alias = operations.execute; alias(3);`);
  const alias = current.select();
  assert.ok(alias?.property);
  assert.equal(current.source.ast.kindName(alias.selectedDeclaration), "KindMethodSignature");
  assert.equal(current.source.ast.text(current.source.ast.name(alias.property.receiver.declaration)), "operations");
  for (const body of [
    "const holder = { get execute(): typeof operation { return operation; } }; const alias = holder.execute; alias(3);",
    "function holder(): { execute: typeof operation } { return { execute: operation }; } const alias = holder().execute; alias(3);",
  ]) assert.equal(fixture(body).select(), undefined, body);
});

test("aliases with storage mutation, identity, opaque casts or transport do not obtain an erasure proof", () => {
  for (const body of [
    "let alias = operation; alias(2);",
    "const first = operation; let alias = first; alias = operation; alias(2);",
    "const alias = operation; function escape() { return alias; } escape();",
    "const alias = operation; function use(value: typeof operation): void {} use(alias);",
    "const alias = operation; const same = alias === operation;",
    "const alias = operation as typeof operation; alias(2);",
    "const alias = operation!; alias(2);",
    "export const alias = operation; alias(2);",
    "const alias = operation; const holder = { alias };",
  ]) assert.equal(fixture(body).select(), undefined, body);
});

test("early deferred invocation and excessive alias closures fail closed", () => {
  assert.equal(fixture("invoke(); const alias = operation; function invoke(): number { return alias(2); }").select(), undefined);
  const declarations = ["const alias = operation;"];
  for (let index = 0; index < 1_025; index += 1) declarations.push(`const alias${index} = ${index === 0 ? "alias" : `alias${index - 1}`};`);
  assert.equal(fixture(declarations.join("\n") + "\nalias1024(2);").select(), undefined);
});

test("object-member alias initialization follows the factory activation, not an unrelated class contract", () => {
  for (const body of [
    "const alias = operation; const holder = { invoke() { return alias(3); } }; holder.invoke();",
    "create().invoke(); function create() { const alias = operation; return { invoke() { return alias(3); } }; }",
    "invoke(); function invoke(): number { const alias = operation; const read = () => alias(3); return read(); }",
  ]) assert.ok(fixture(body).select(), body);
  for (const body of [
    "create().invoke(); const alias = operation; function create() { return { invoke() { return alias(3); } }; }",
    "function create() { const result = read(); const alias = operation; function read() { return alias(3); } return result; } create();",
  ]) assert.equal(fixture(body).select(), undefined, body);
});
