import assert from "node:assert/strict";
import test from "node:test";
import { type Node } from "@tsonic/tsts";
import { Node_Initializer, Node_Type } from "../source-navigation/ast.js";
import { fixture, unannotated, authoredDestinations, propagatedPatterns } from './contextual-type-selection-fixtures.js';

for (const [name, initializer] of [
  ["direct", "const typed: Callback<number> = value => value;"],
  ["parenthesized", "const typed: Callback<number> = ((value => value));"],
  ["asserted", "const typed = ((value => value) as Callback<number>);"],
  ["satisfies", "const typed = ((value => value) satisfies Callback<number>);"],
] as const) test(`contextual ${name} callable retains its exact authored destination occurrence`, () => {
  const { source, declarations } = fixture(`type Callback<Input, Output = Input> = (value: Input) => Output;
    const sentinel = {}; ${initializer}`);
  const declaration = declarations.find(node => source.ast.text(source.ast.name(node)) === "typed");
  assert.equal(declaration !== undefined, true, "the typed initializer is an original checked declaration");
  const arrows: Node[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsArrowFunction(node)) arrows.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(declaration!);
  assert.equal(arrows.length, 1, "one actual contextual callable occurrence");
  const arrow = arrows[0]!;
  const semantics = source.semantics.forNode(arrow);
  const component = semantics.types.contextualType(arrow);
  assert.equal(component !== undefined && component.authoredTypeNode !== undefined, true,
    "context includes the actual native source occurrence, not only a checker Type");
  assert.equal(source.ast.is.IsTypeReferenceNode(component!.authoredTypeNode), true,
    "the authored destination is the exact alias reference, not its expanded signature");
  const reference = source.ast.as.AsTypeReferenceNode(component!.authoredTypeNode!);
  assert.equal(source.ast.text(reference?.TypeName), "Callback", "the exact authored alias is retained");
  const arguments_ = source.ast.typeArguments(component!.authoredTypeNode);
  assert.equal(arguments_.length, 1, "the omitted default is not manufactured as an authored argument");
  assert.equal(source.ast.kindName(arguments_[0]), "KindNumberKeyword", "the authored argument is exactly number");
  assert.equal(Node_Type(source.ast, component!.declaration) === component!.authoredTypeNode, true,
    "the source component retains its own real annotation owner");
  const selected = semantics.types.contextualValueSelection(arrow);
  assert.equal(selected.kind === "selected" && selected.component.authoredTypeNode === component!.authoredTypeNode, true,
    "raw and non-nullish contextual selection share the identical authored occurrence");
  assert.equal(selected.kind === "selected" && selected.component.selectedType === component!.selectedType, true,
    "the original checker identity is unchanged");
  if (name === "direct" || name === "parenthesized")
    assert.equal(component!.declaration === declaration, true, "parentheses do not invent an annotation owner");
});

test("contextual nested callables do not borrow an enclosing declaration's annotation", () => {
  const { source, declarations } = fixture("const sentinel = {}; const typed: () => () => number = () => () => 1;");
  const declaration = declarations.find(node => source.ast.text(source.ast.name(node)) === "typed");
  const outer = Node_Initializer(source.ast, declaration);
  assert.equal(outer !== undefined && source.ast.is.IsArrowFunction(outer), true, "the outer callable is exact");
  const inner = source.ast.as.AsArrowFunction(outer!)?.Body;
  assert.equal(inner !== undefined && source.ast.is.IsArrowFunction(inner), true, "the inner callable is a distinct source occurrence");
  const context = source.semantics.forNode(inner!).types.contextualType(inner!);
  assert.equal(context !== undefined, true, "the actual checked return context remains available");
  assert.equal(context!.authoredTypeNode, undefined, "an enclosing declaration is not the inner callable's direct annotation");
  assert.equal(context!.declaration, undefined, "no unrelated source owner is manufactured");
});

for (const [name, sourceText] of unannotated) {
  test(`unannotated ${name} keeps its actual initializer rather than a synthetic contextual destination`, () => {
    const { source, literal, declarations } = fixture(sourceText);
    const declaration = declarations[0];
    if (declaration === undefined) throw new Error("An actual binding owner is required.");
    const initializer = Node_Initializer(source.ast, declaration);
    const selection = source.semantics.forNode(literal).types.contextualValueSelection(literal);
    assert.equal(selection.kind, "unavailable", `${name}: the unannotated pattern is not an authored destination`);
    assert.equal(Node_Initializer(source.ast, declaration) === initializer, true,
      `${name}: contextual classification does not replace or erase its actual initializer`);
    assert.equal(initializer !== undefined, true, `${name}: the initializer remains present`);
  });
}

for (const [name, sourceText] of authoredDestinations) {
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

for (const [name, sourceText, literalIndex] of propagatedPatterns) {
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
