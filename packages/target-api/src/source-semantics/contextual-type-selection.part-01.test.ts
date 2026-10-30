import assert from "node:assert/strict";

import test from "node:test";

import { fixture, authoredDestinations, propagatedPatterns } from "./contextual-type-selection-fixtures.js";

for (const [name, sourceText] of Array.from(authoredDestinations).slice(6, 10)){
test(`${name} retains its actual checked contextual destination`, () => {
    const { source, queries, literal } = fixture(sourceText);
    const contextual = queries.checker.getContextualType(literal);
    assert.equal(contextual !== undefined, true, `${name}: the real checker supplies the authored destination`);
    const selected = source.semantics.forNode(literal).types.contextualValueSelection(literal);
    assert.equal(selected.kind === "selected" && selected.component.selectedType === contextual, true,
      `${name}: const transparency cannot discard a real annotation or typed assertion`);
  });
}

test("unavailable contexts do not fabricate a destination", () => {
  const { source, queries, literal } = fixture('export const value = { key: "value" };');
  assert.equal(queries.checker.getContextualType(literal) === undefined, true, "the checked initializer has no authored contextual target");
  assert.equal(source.semantics.forNode(literal).types.contextualValueSelection(literal).kind, "unavailable",
    "the existing unavailable result is retained");
});

test("one non-nullish candidate retains its exact checked type identity", () => {
  const { source, queries, literal } = fixture(`
declare function consume(value: { key: string } | null | undefined): void;
consume({ key: "value" });
`);
  const contextual = queries.checker.getContextualType(literal);
  if (contextual === undefined) throw new Error("The nullable authored destination is required.");
  const candidates = queries.typeShape.isUnion(contextual)
    ? queries.typeShape.getUnionOrIntersectionTypes(contextual) : [contextual];
  const retained = candidates.filter(candidate => candidate !== undefined && !queries.typeShape.isNullish(candidate));
  const selected = source.semantics.forNode(literal).types.contextualValueSelection(literal);
  assert.equal(retained.length, 1, "the authored nullable union has exactly one native value candidate");
  assert.equal(selected.kind === "selected" && selected.component.selectedType === retained[0], true,
    "filtering source absence preserves the exact candidate, not a reconstructed object type");
});

test("multiple non-nullish candidates remain ambiguous with every checked identity", () => {
  const { source, queries, literal } = fixture(`
declare function consume(value: { key: string } | { key: number }): void;
consume({ key: "value" });
`);
  const contextual = queries.checker.getContextualType(literal);
  if (contextual === undefined) throw new Error("The ambiguous authored destination is required.");
  const candidates = queries.typeShape.getUnionOrIntersectionTypes(contextual);
  const selected = source.semantics.forNode(literal).types.contextualValueSelection(literal);
  assert.equal(selected.kind === "ambiguous" && selected.types.length === 2, true,
    "two genuine contextual destinations are not collapsed to the first one");
  assert.equal(selected.kind === "ambiguous" && selected.types.every((candidate, index) => candidate === candidates[index]), true,
    "every checked contextual candidate retains its original order and identity");
  assert.equal(selected.kind === "ambiguous" && Object.isFrozen(selected.types), true, "the ambiguous candidate list remains immutable");
});

for (const [name, sourceText, literalIndex] of propagatedPatterns){
test(`${name} does not select a synthetic pattern destination`, () => {
    const { source, literals } = fixture(sourceText);
    const literal = literals[literalIndex];
    if (literal === undefined) throw new Error("The actual contextual operand is required.");
    const parent = source.ast.parent(literal);
    assert.equal(source.semantics.forNode(literal).types.contextualValueSelection(literal).kind, "unavailable",
      `${name}: only the checker owns propagation and suppression of synthetic binding-pattern context`);
    assert.equal(source.ast.parent(literal) === parent && parent !== undefined, true,
      `${name}: classification does not rewrite the actual checked source operand or its initializer`);
  });
}
