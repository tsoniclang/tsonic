import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";
import { createSourceDeclarationSymbolQuery } from "./declaration-symbol.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export {}; declare const external: { readonly token: {} };
      declare const other: { readonly value: number }; const alias = external; const selected = alias.token; const unrelated = other.value;`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "valid exact indexed declarations");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const declarations = new Map<string, Node>();
  const pending: Node[] = [file];
  while (pending.length !== 0) {
    const node = pending.pop()!;
    if (source.ast.is.IsVariableDeclaration(node)) declarations.set(source.ast.text(source.ast.name(node)), node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const external = declarations.get("external");
  const other = declarations.get("other");
  assert.ok(external && other);
  const checker = checked.getSourceFileQueries(file).checker;
  const expected = checker.getSymbolAtLocation(source.ast.name(external));
  assert.ok(expected);
  return { source, checker, external, other, expected };
}

test("materialized declaration symbols come from the existing exact checked reverse index", () => {
  const current = fixture();
  let reads = 0;
  const select = createSourceDeclarationSymbolQuery(current.source.ast, { ...current.checker,
    getSymbolAtLocation(node) { return node === current.source.ast.name(current.external) ? undefined : current.checker.getSymbolAtLocation(node); },
  }, { ...current.source.navigation, referencesToDeclaration(node) {
    reads += 1;
    return current.source.navigation.referencesToDeclaration(node);
  } });
  for (let repeat = 0; repeat < 32; repeat += 1) assert.equal(select(current.external) === current.expected, true);
  assert.equal(reads, 1, "one exact selection, no repeated source scan");
  const type = current.checker.getTypeOfSymbol(select(current.external));
  assert.equal(type === current.checker.getTypeOfSymbol(current.expected), true, "same checked type identity");
  assert.equal(select(current.other) === current.checker.getSymbolAtLocation(current.source.ast.name(current.other)), true);
  assert.equal(reads, 1, "ordinary declarations need no reverse lookup");
});

test("missing or foreign indexed references never invent a declaration symbol", () => {
  const current = fixture();
  const references = current.source.navigation.referencesToDeclaration(current.other);
  assert.equal(references.length > 0, true);
  for (const nodes of [[], references]) {
    let reads = 0;
    const select = createSourceDeclarationSymbolQuery(current.source.ast, { ...current.checker,
      getSymbolAtLocation: () => undefined,
    }, { ...current.source.navigation, referencesToDeclaration: () => { reads += 1; return nodes; } });
    assert.equal(select(current.external) === undefined, true, "exact declaration identity required");
    assert.equal(select(current.external) === undefined, true, "completed absence remains stable");
    assert.equal(reads, 1);
  }
});
