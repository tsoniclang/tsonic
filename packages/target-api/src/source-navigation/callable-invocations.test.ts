import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { createSourceSingleInvocationQuery, sourceEnclosingCallable, sourceLexicalFunctionIsUnused } from "./callable-invocations.js";

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
  return { source, declaration(name: string) {
    const declaration = declarations.get(name);
    assert.equal(declaration !== undefined, true);
    return declaration!;
  }, unused(name: string) {
    const declaration = declarations.get(name);
    assert.equal(declaration !== undefined, true);
    return sourceLexicalFunctionIsUnused(declaration!, source.ast, source.navigation);
  }, select(name: string) {
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

test("unused lexical declarations retain every runtime use and module declaration", () => {
  const current = fixture(`
function dormant(): number { throw 3; }
function typed(): number { return 3; }
type Signature = typeof typed;
const value: Signature | undefined = undefined;
function called(): number { return 3; }
function escaped(): number { return 3; }
const alias = escaped;
function captured(): number { return 3; }
const callback = () => captured();
function compared(): number { return 3; }
return called() + alias() + callback() + (compared === compared ? 0 : 1) + (value === undefined ? 0 : 1);`);
  for (const name of ["dormant", "typed"]) assert.equal(current.unused(name), true, name);
  for (const name of ["outer", "called", "escaped", "captured", "compared"]) {
    assert.equal(current.unused(name), false, name);
  }
});

test("unused lexical omission rejects unclassified, exported and written summaries", () => {
  const current = fixture(`function read(): number { return 3; } return 0;`);
  const declaration = current.declaration("read");
  const summary = current.source.navigation.declarationUseSummary(declaration);
  for (const mutation of [{ exported: true }, { bindingWritten: true }, { hasUnclassifiedValueUse: true },
    { uses: [{ reference: declaration, kind: "source-linkage" as const, role: "source-linkage" as const, captured: false, throughMember: false }] },
  ]) assert.equal(sourceLexicalFunctionIsUnused(declaration, current.source.ast,
    { declarationUseSummary: () => ({ ...summary, ...mutation }) }), false);
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
