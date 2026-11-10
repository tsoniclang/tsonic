import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { createSourceDeclarationMembership } from "./declaration-membership.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `class Outer {
  constructor(public value: number) {}
  run() { class Inner { value = 1; } return new Inner(); }
}
interface Shape { name: string; }
function first() { class Same { left = 1; } return Same; }
function second() { class Same { right = 2; } return Same; }
function outside(value: number) { return value; }`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts")!;
  const nodes: Node[] = [];
  const visit = (node: Node): void => {
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const declarations = nodes.filter(node => source.ast.is.IsClassDeclaration(node) || source.ast.is.IsInterfaceDeclaration(node));
  const definitions = new Map(declarations.map((declaration, index) => [declaration, Object.freeze({ declaration, index })]));
  return { source, file, nodes, declarations, definitions };
}

test("declaration membership is inclusive, nested and independent of source inventory order", () => {
  const { source, file, nodes, declarations, definitions } = fixture();
  const forward = createSourceDeclarationMembership(source.ast, nodes, definitions);
  const reverse = createSourceDeclarationMembership(source.ast, [...nodes].reverse(), definitions);
  for (const node of nodes) {
    let current: Node | undefined = node;
    while (current !== undefined && !definitions.has(current)) current = source.ast.parent(current);
    const expected = current === undefined ? undefined : definitions.get(current);
    assert.equal(forward.get(node) === expected, true, source.ast.kindName(node));
    assert.equal(reverse.get(node) === expected, true, `reverse ${source.ast.kindName(node)}`);
  }
  for (const declaration of declarations) {
    assert.equal(forward.get(declaration) === definitions.get(declaration), true, "the exact declaration contains itself");
  }
  assert.equal(forward.has(file), false, "source files do not invent a declaration owner");
  const parameter = nodes.find(node => source.ast.kindName(node) === "KindParameter" && source.ast.text(source.ast.name(node)) === "value");
  assert.equal(parameter !== undefined, true, "constructor parameter property exists");
  const outer = declarations.find(node => source.ast.text(source.ast.name(node)) === "Outer")!;
  assert.equal(forward.get(parameter!) === definitions.get(outer), true, "parameter property belongs to its class");
  const same = declarations.filter(node => source.ast.text(source.ast.name(node)) === "Same");
  assert.equal(same.length, 2);
  assert.equal(forward.get(same[0]!) === forward.get(same[1]!), false, "same spelling never merges opaque declaration identities");
});

test("unregistered wrappers preserve the nearest admitted declaration without inventing owners", () => {
  const { source, nodes, declarations, definitions } = fixture();
  const inner = declarations.find(node => source.ast.text(source.ast.name(node)) === "Inner")!;
  const outer = declarations.find(node => source.ast.text(source.ast.name(node)) === "Outer")!;
  const selected = new Map(definitions);
  selected.delete(inner);
  const membership = createSourceDeclarationMembership(source.ast, [...nodes].reverse(), selected);
  assert.equal(membership.get(inner) === definitions.get(outer), true, "an erased declaration is not a new owner");
  for (const node of nodes.filter(node => source.ast.parent(node) === inner)) {
    assert.equal(membership.get(node) === definitions.get(outer), true, source.ast.kindName(node));
  }
  const foreign = fixture();
  for (const declaration of foreign.declarations) {
    assert.equal(membership.has(declaration), false, "foreign checker declarations do not match by text");
  }
});

test("each ancestry edge is read once and sealed lookups never navigate or populate data", () => {
  const { source, nodes, definitions } = fixture();
  const reads = new Map<Node, number>();
  let sealed = false;
  const membership = createSourceDeclarationMembership({ parent(node) {
    assert.equal(sealed, false, "no source parent read after index construction");
    assert.ok(node !== undefined, "the index never requests the parent of an absent node");
    reads.set(node, (reads.get(node) ?? 0) + 1);
    return source.ast.parent(node);
  } }, [...nodes].reverse(), definitions);
  assert.equal([...reads.values()].every(count => count === 1), true, "positive and negative ancestry is memoized");
  assert.equal(reads.size <= nodes.length, true, "work is bounded by the checked node inventory");
  const before = [...membership.entries()];
  const readCount = reads.size;
  sealed = true;
  for (let repeat = 0; repeat < 5; repeat += 1) {
    for (const node of nodes) membership.get(node);
  }
  assert.equal(membership.size, before.length);
  assert.equal([...membership.entries()].every(([node, owner], index) =>
    node === before[index]?.[0] && owner === before[index]?.[1]), true, "reads do not mutate or replace owner rows");
  assert.equal(reads.size, readCount);
});

test("partial inventories share cached ancestors and false is a present definition", () => {
  const { source, nodes, declarations } = fixture();
  const outer = declarations.find(node => source.ast.text(source.ast.name(node)) === "Outer")!;
  const field = nodes.find(node => source.ast.kindName(node) === "KindParameter" && source.ast.parent(source.ast.parent(node)) === outer)!;
  assert.equal(field !== undefined, true, "constructor parameter exists");
  const membership = createSourceDeclarationMembership(source.ast, [field], new Map([[outer, false]]));
  assert.equal(membership.get(field), false);
  assert.equal(membership.get(outer), false, "registered definitions are inclusive even in partial input");
  assert.equal(membership.has(source.ast.parent(field)!), false, "memoized non-inventory ancestors are not published as requests");
});
