import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import * as lexicalValues from "./lexical-value-creation.js";
import { sourceBindingScope, sourceLexicalCaptures } from "./lexical-captures.js";

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
  return { source, statements: source.ast.statements(source.ast.body(declarations.get("outer"))), select(name: string) {
    const declaration = declarations.get(name);
    assert.equal(declaration !== undefined, true);
    const scope = sourceBindingScope(declaration!, source.ast);
    const captures = sourceLexicalCaptures(declaration!, [declaration!], source.ast, source.navigation, "source");
    const references = source.navigation.declarationUseSummary(declaration!).uses.filter(use => use.kind === "first-class")
      .map(use => use.reference);
    return { declaration: declaration!, scope, captures, references };
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
    assert.equal(selected.scope === current.source.ast.parent(current.statements[index]!), true,
      "approved C-1388: the original evaluation statement and declaration keep their exact lexical scope");
    assert.equal(selected.references.every(reference =>
      current.source.navigation.sourceReferenceFor(reference)?.declaration === selected.declaration), true,
    "each original source read keeps the same declaration, not a caller-chosen creation");
    assert.equal(selected.captures.captures.length, index === 3 ? 1 : 0, "the declaration's own original captures");
    assert.equal("sourceLexicalFunctionValueCreation" in lexicalValues, false, "the removed activation API is absent");
  }
});

test("lexical creation follows named callers and literal capture creation without evaluating their bodies", () => {
  for (const [body, index] of [
    [`function read() { return 3; } function through() { return read; } if (flag) return; return through();`, 3],
    [`function read() { return 3; } if (flag) return; const callback = () => read; return callback;`, 2],
  ] as const) {
    const current = fixture(body);
    const selected = current.select("read");
    assert.equal(selected.scope === current.source.ast.parent(current.statements[index]!), true,
      "approved C-1388: the original caller statement does not select the earlier declaration's physical form");
    assert.equal(selected.captures.captures.length, 0, "the original source declaration has no captures");
    assert.equal(selected.references.every(reference =>
      current.source.navigation.sourceReferenceFor(reference)?.declaration === selected.declaration), true,
    "named callers and closures retain checked reference identity without creation scheduling");
  }
  const unused = fixture(`function read() { return 3; } function dormant() { return read; } return 0;`);
  assert.equal(unused.select("read").captures.captures.length, 0,
    "the dormant caller does not erase the original declaration or invent native work");
});

test("one non-repeated lexical value read constructs at its exact expression without eager conditional allocation", () => {
  const direct = fixture(`function read() { return 3; } return flag ? read : null;`).select("read");
  assert.equal(direct.references.length, 1, "the same one original conditional read remains checked");
  assert.equal(direct.captures.captures.length, 0, "the declaration itself has no capture or eager allocation decision");
  for (const body of [
    `function read() { return 3; } return () => read;`,
    `function read() { return 3; } function get() { return read; } return get;`,
    `function read() { return 3; } while (flag) { const value = read; return value; } return null;`,
    `function read() { return 3; } const first = read; return first === read;`,
  ]) {
    const current = fixture(body);
    const selected = current.select("read");
    assert.equal(selected.scope !== undefined && selected.references.length > 0, true,
      "approved C-1388: repeated/retained reads retain their original declaration and checked scope");
    assert.equal(selected.references.every(reference =>
      current.source.navigation.sourceReferenceFor(reference)?.declaration === selected.declaration), true,
    "no caller-selected inline or shared activation replaces the original callable identity");
    assert.equal(selected.captures.captures.length, 0, "no physical environment is inferred from later reads");
  }
});
