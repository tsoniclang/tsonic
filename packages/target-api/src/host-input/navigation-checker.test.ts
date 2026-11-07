import { createHostSourceProgramFixture } from "../source-semantics/host-program-fixtures.js";
// Moved from source-navigation/declaration-symbol.test.ts with the query (host-input owns checker symbols, I3).
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { createSourceDeclarationSymbolQuery } from "./navigation-checker.js";
import { createSourceNavigationInput } from "./navigation.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export {}; declare const external: { readonly token: {} };
      declare const other: { readonly value: number }; const alias = external; const selected = alias.token; const unrelated = other.value;`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "valid exact indexed declarations");
  const source = createHostSourceProgramFixture(checked);
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
  return { source, checked, checker, external, other, expected, file };
}

test("materialized declaration symbols come from the existing exact checked reverse index", () => {
  const current = fixture();
  let reads = 0;
  const select = createSourceDeclarationSymbolQuery({ ...current.checked, getSourceFileQueries(file) {
    return { ...current.checked.getSourceFileQueries(file), checker: { ...current.checker,
      getSymbolAtLocation(node) { return node === current.source.ast.name(current.external) ? undefined : current.checker.getSymbolAtLocation(node); },
    } };
  } }, node => {
    reads += 1;
    return current.source.navigation.referencesToDeclaration(node);
  });
  for (let repeat = 0; repeat < 32; repeat += 1) assert.equal(select(current.external, current.file) === current.expected, true);
  assert.equal(reads, 1, "one exact selection, no repeated source scan");
  const type = current.checker.getTypeOfSymbol(select(current.external, current.file));
  assert.equal(type === current.checker.getTypeOfSymbol(current.expected), true, "same checked type identity");
  assert.equal(select(current.other, current.file) === current.checker.getSymbolAtLocation(current.source.ast.name(current.other)), true);
  assert.equal(reads, 1, "ordinary declarations need no reverse lookup");
});

test("missing or foreign indexed references never invent a declaration symbol", () => {
  const current = fixture();
  const references = current.source.navigation.referencesToDeclaration(current.other);
  assert.equal(references.length > 0, true);
  for (const nodes of [[], references]) {
    let reads = 0;
    const select = createSourceDeclarationSymbolQuery({ ...current.checked, getSourceFileQueries(file) {
      return { ...current.checked.getSourceFileQueries(file), checker: { ...current.checker, getSymbolAtLocation: () => undefined } };
    } }, () => { reads += 1; return nodes; });
    assert.equal(select(current.external, current.file) === undefined, true, "exact declaration identity required");
    assert.equal(select(current.external, current.file) === undefined, true, "completed absence remains stable");
    assert.equal(reads, 1);
  }
});

test("declaration symbols refuse an unchecked consumer context", () => {
  const current = fixture();
  const foreign = fixture();
  const select = createSourceDeclarationSymbolQuery(current.checked, node => current.source.navigation.referencesToDeclaration(node));
  assert.equal(current.checked.containsSourceFile(foreign.file), false, "the checked source owner distinguishes the two actual programs");
  assert.equal(select(current.external, current.file) === current.expected, true);
  assert.equal(select(foreign.external, current.file) === undefined, true, "a declaration from another checked program has no symbol");
  assert.throws(() => select(current.external, foreign.file), /actual checked consumer context/u);
});

test("navigation input merges declarations of one entity and keys them by declaration", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export function f(value: number): number;
      export function f(value: string): string;
      export function f(value: number | string): number | string { return value; }
      export const g = 1;`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const input = createSourceNavigationInput(checked);
  const file = checked.getSourceFile("/src/index.ts")!;
  const functions = checked.ast.statements(file).filter((node): node is Node => node !== undefined && checked.ast.is.IsFunctionDeclaration(node));
  assert.equal(functions.length, 3);
  for (const declaration of functions) assert.deepEqual(input.mergedDeclarations(declaration), functions, "overloads and implementation");
  assert.equal(input.mergedDeclarations(functions[0]!) === input.mergedDeclarations(functions[0]!), true, "memoized per program");
  const implementation = functions[2]!;
  assert.deepEqual(input.declaredParameters(implementation), checked.ast.parameters(implementation), "declared signature parameters");
});
