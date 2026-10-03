import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { createSourceSingleInvocationQuery, sourceEnclosingCallable } from "./callable-invocations.js";

function fixture(body: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export function outer(): number { ${body} }`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)));
  const source = createTargetSourceProgram(checked);
  const declarations = new Map<string, Node>();
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true);
  const visit = (node: Node): void => {
    if (source.ast.is.IsFunctionDeclaration(node)) declarations.set(source.ast.text(source.ast.name(node)), node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file!);
  const query = createSourceSingleInvocationQuery(source.ast, source.navigation);
  return { source, select(name: string) {
    const declaration = declarations.get(name);
    assert.equal(declaration !== undefined, true);
    return query(declaration!);
  } };
}

test("single lexical invocation proof retains hoisting and exact transitive callers", () => {
  const current = fixture(`const value = through();
function read(): number { return 3; }
function through(): number { return read(); }
return value;`);
  assert.equal(current.select("read"), true);
  assert.equal(current.select("through"), true);
  assert.equal(current.select("outer"), false);
  assert.equal(current.select("read"), true);
});

test("single lexical invocation rejects repeated, recursive, escaping and deferred activation", () => {
  for (const body of [
    `function read(): number { return 3; } return read() + read();`,
    `function read(): number { return 3; } for (let index = 0; index < 2; index++) { read(); } return 0;`,
    `function read(): number { return read(); } return read();`,
    `function read(): number { return through(); } function through(): number { return read(); } return 0;`,
    `function read(): number { return 3; } const callback = () => read(); return callback();`,
    `function read(): number { return 3; } const alias = read; return alias();`,
    `function read(): number { return 3; } function through(): number { return read(); } return through() + through();`,
  ]) assert.equal(fixture(body).select("read"), false, body);
});

test("single invocation navigation terminates cyclic and excessively deep ancestors", () => {
  const node = {} as Node;
  const ast = { parent: () => node, kindName: () => "KindBlock" } as unknown as Parameters<typeof sourceEnclosingCallable>[1];
  assert.equal(sourceEnclosingCallable(node, ast) === undefined, true);
  const nodes = Array.from({ length: 130 }, () => ({} as Node));
  const deep = { parent: (value: Node) => nodes[nodes.indexOf(value) + 1],
    kindName: (value: Node) => value === nodes[129] ? "KindFunctionDeclaration" : "KindBlock" } as unknown as Parameters<typeof sourceEnclosingCallable>[1];
  assert.equal(sourceEnclosingCallable(nodes[0], deep) === undefined, true);
});
