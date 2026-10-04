import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { sourceLexicalFunctionValueCreation } from "./lexical-value-creation.js";

function fixture(body: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export function outer(flag: boolean): unknown { ${body} }`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true);
  const declarations = new Map<string, Node>();
  const visit = (node: Node): void => {
    if (source.ast.is.IsFunctionDeclaration(node)) declarations.set(source.ast.text(source.ast.name(node)), node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file!);
  return { source, statements: source.ast.statements(source.ast.body(declarations.get("outer"))), select(name: string, runtime = true) {
    const declaration = declarations.get(name);
    assert.equal(declaration !== undefined, true);
    return sourceLexicalFunctionValueCreation(declaration!, source.ast, source.navigation, () => runtime);
  } };
}

test("lexical values initialize at their first evaluated statement, after unrelated exits and capture initializers", () => {
  for (const [body, index] of [
    [`if (flag) return; let count = 0; function next() { return ++count; } return next;`, 3],
    [`if (flag) return; return next; function next() { return 3; }`, 1],
    [`if (flag) return; function next() { return 3; } const left = next; return left === next;`, 2],
  ] as const) {
    const current = fixture(body);
    const selected = current.select("next");
    assert.equal(selected.kind, "resolved");
    if (selected.kind !== "resolved") return;
    assert.equal(selected.statement === current.statements[index], true, "exact first evaluated statement");
    assert.equal(current.select("next", false).kind, "unused");
  }
});

test("lexical creation follows named callers and literal capture creation without evaluating their bodies", () => {
  for (const [body, index] of [
    [`function read() { return 3; } function through() { return read; } if (flag) return; return through();`, 3],
    [`function read() { return 3; } if (flag) return; const callback = () => read; return callback;`, 2],
  ] as const) {
    const current = fixture(body);
    const selected = current.select("read");
    assert.equal(selected.kind, "resolved");
    if (selected.kind !== "resolved") return;
    assert.equal(selected.statement === current.statements[index], true, "exact caller or closure creation statement");
  }
  const unused = fixture(`function read() { return 3; } function dormant() { return read; } return 0;`);
  assert.equal(unused.select("read").kind, "unused");
});

test("one non-repeated lexical value read constructs at its exact expression without eager conditional allocation", () => {
  const direct = fixture(`function read() { return 3; } return flag ? read : null;`).select("read");
  assert.equal(direct.kind, "resolved");
  if (direct.kind !== "resolved") return;
  assert.equal(direct.inlineReference !== undefined, true, "one evaluated reference");
  for (const body of [
    `function read() { return 3; } return () => read;`,
    `function read() { return 3; } function get() { return read; } return get;`,
    `function read() { return 3; } while (flag) { const value = read; return value; } return null;`,
    `function read() { return 3; } const first = read; return first === read;`,
  ]) {
    const selected = fixture(body).select("read");
    assert.equal(selected.kind, "resolved");
    if (selected.kind !== "resolved") continue;
    assert.equal(selected.inlineReference === undefined, true, "retained or repeated use requires one stable activation handle");
  }
});
