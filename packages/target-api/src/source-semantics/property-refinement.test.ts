import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node, type ResolvedSourcePropertyAccessInfo } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";
import { selectRefinedSourcePropertyAccess } from "./property-refinement.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    interface Values { count: number; item: string; }
    interface Alternative { count: number; other: boolean; }
    declare function hasExtra(value: unknown): value is { count: number; extra: boolean; };
    declare function hasOne(value: unknown): value is { count: 1; extra: boolean; };
    function read(value: number | Values): number {
      if (typeof value === "number") return 0;
      if (hasExtra(value)) return value.count;
      return 0;
    }
    function ambiguous(value: number | Values | Alternative): number {
      if (typeof value === "number") return 0;
      if (hasExtra(value)) return value.count;
      return 0;
    }
    function additional(value: number | Values): boolean {
      if (typeof value === "number") return false;
      if (hasExtra(value)) return value.extra;
      return false;
    }
    function literal(value: number | Values): number {
      if (typeof value === "number") return 0;
      if (hasOne(value)) return value.count;
      return 0;
    }
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const queries = checked.getSourceFileQueries(file);
  const nodes = new Map<string, Node>();
  const visit = (node: Node, owner: string): void => {
    if (source.ast.is.IsFunctionDeclaration(node)) owner = source.ast.text(source.ast.name(node));
    if (source.ast.is.IsPropertyAccessExpression(node)) nodes.set(owner, node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child, owner); });
  };
  visit(file, "");
  const selection = (name: string) => {
    const node = nodes.get(name);
    assert.ok(node);
    const raw = queries.checker.getResolvedPropertyAccessInfo(node);
    assert.ok(raw);
    const refinement = source.semantics.selectValueTypeRefinement(raw.receiver.expression);
    return { node, raw, refinement, selected: source.semantics.forNode(node).operations.propertyAccess(node) };
  };
  return { source, queries, selection };
}

test("public property reads retain one checked refined declaration without replacing their original evidence", () => {
  const { queries, selection } = fixture();
  const { raw, selected } = selection("read");
  assert.equal(raw.selectedDeclaration, undefined);
  assert.ok(selected?.selectedDeclaration);
  assert.equal(selected.selectedReadDeclaration, selected.selectedDeclaration);
  assert.equal(selected.receiver, raw.receiver);
  assert.equal(selected.selectedSymbol, raw.selectedSymbol);
  assert.equal(selected.sourceReadType, raw.sourceReadType);
  assert.equal(selected.writable, raw.writable);
  const retained = queries.checker.getSymbolDeclarations(raw.selectedSymbol);
  assert.ok(retained.includes(selected.selectedDeclaration));
  assert.ok(Object.isFrozen(selected));
});

test("ambiguous, additional and incompatible refined properties retain the original checker selection", () => {
  const { selection } = fixture();
  for (const name of ["ambiguous", "additional", "literal"]) {
    const { raw, selected } = selection(name);
    assert.equal(selected, raw, name);
  }
});

test("refined property correspondence rejects stale types, missing declarations and wrong read types", () => {
  const { source, queries, selection } = fixture();
  const { raw, refinement } = selection("read");
  assert.ok(raw.accessMode === "read" && refinement.kind === "resolved" && refinement.refinement.kind === "members");
  const stale = { ...refinement, declaredType: refinement.selectedType };
  assert.equal(selectRefinedSourcePropertyAccess(raw, stale, queries.checker, queries.typeShape, source.sourceFacts), raw);
  const missing = { ...queries.checker, getRootSymbols: () => [],
    getSymbolDeclarations: (symbol: Parameters<typeof queries.checker.getSymbolDeclarations>[0]) =>
      symbol === raw.selectedSymbol ? [] : queries.checker.getSymbolDeclarations(symbol) };
  assert.equal(selectRefinedSourcePropertyAccess(raw, refinement, missing, queries.typeShape, source.sourceFacts), raw);
  const item = queries.checker.getPropertyOfType(refinement.refinement.types[0], "item");
  const itemType = queries.checker.getTypeOfSymbol(item);
  assert.ok(itemType);
  const wrong = { ...raw, sourceReadType: itemType };
  assert.equal(selectRefinedSourcePropertyAccess(wrong, refinement, queries.checker, queries.typeShape, source.sourceFacts), wrong);
});

test("property writes and read-write operations never acquire a read-only refinement", () => {
  const { source, queries, selection } = fixture();
  const { raw, refinement } = selection("read");
  assert.ok(raw.accessMode === "read");
  const write: ResolvedSourcePropertyAccessInfo = { ...raw, accessMode: "write", sourceReadType: undefined, sourceWriteType: raw.sourceReadType };
  const readWrite: ResolvedSourcePropertyAccessInfo = { ...raw, accessMode: "read-write", sourceWriteType: raw.sourceReadType };
  assert.equal(selectRefinedSourcePropertyAccess(write, refinement, queries.checker, queries.typeShape, source.sourceFacts), write);
  assert.equal(selectRefinedSourcePropertyAccess(readWrite, refinement, queries.checker, queries.typeShape, source.sourceFacts), readWrite);
});
