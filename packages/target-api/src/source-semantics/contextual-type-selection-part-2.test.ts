import assert from "node:assert/strict";
import test from "node:test";
import type { Node } from "@tsonic/tsts";
import { Node_Initializer } from "../source-navigation/ast.js";
import { fixture, propagatedDestinations } from './contextual-type-selection-fixtures.js';

for (const [name, sourceText, literalIndex] of propagatedDestinations) {
  test(`${name} retains its genuine checked destination`, () => {
    const { source, queries, literals } = fixture(sourceText);
    const literal = literals[literalIndex];
    if (literal === undefined) throw new Error("The actual authored contextual operand is required.");
    const contextual = queries.checker.getContextualType(literal);
    if (contextual === undefined) throw new Error(`${name}: the actual checker must supply a contextual destination.`);
    const candidates = queries.typeShape.isUnion(contextual)
      ? queries.typeShape.getUnionOrIntersectionTypes(contextual) : [contextual];
    const retained = candidates.filter(candidate => candidate !== undefined && !queries.typeShape.isNullish(candidate));
    const selection = source.semantics.forNode(literal).types.contextualValueSelection(literal);
    assert.equal(retained.length, 1, `${name}: one genuine non-nullish contextual destination is checked`);
    assert.equal(selection.kind === "selected" && selection.component.selectedType === retained[0], true,
      `${name}: skipping synthetic binding patterns preserves the actual destination identity`);
  });
}

test("a genuine ambiguous contextual callback default retains every checked destination", () => {
  const { source, queries, literal } = fixture(`
declare function apply(callback: (value?: { key: string } | { key: number }) => void): void;
apply(({ key } = { key: "a" }) => { void key; });
`);
  const contextual = queries.checker.getContextualType(literal);
  if (contextual === undefined) throw new Error("The actual callback parameter context is required.");
  const candidates = queries.typeShape.getUnionOrIntersectionTypes(contextual)
    .filter(candidate => candidate !== undefined && !queries.typeShape.isNullish(candidate));
  const selection = source.semantics.forNode(literal).types.contextualValueSelection(literal);
  assert.equal(candidates.length, 2, "the callback's actual optional parameter has two genuine value destinations");
  assert.equal(selection.kind === "ambiguous" && selection.types.length === candidates.length &&
    selection.types.every((candidate, index) => candidate === candidates[index]), true,
  "the checker flag does not discard contextual callback typing, reorder destinations or choose an arbitrary arm");
  assert.equal(selection.kind === "ambiguous" && Object.isFrozen(selection.types), true,
    "the actual ambiguous callback destination inventory is immutable");
});

test("const-asserted initializer fields keep their actual checked source declaration identity", () => {
  const { source, queries, literal } = fixture('const { key } = { key: "value" } as const;');
  const semantics = source.semantics.forNode(literal);
  const valueType = semantics.types.expressionType(literal);
  if (valueType === undefined) throw new Error("The actual checked initializer type is required.");
  const property = queries.checker.getPropertyOfType(valueType, "key");
  const declaration = source.ast.properties(literal)[0];
  if (property === undefined || declaration === undefined) throw new Error("The actual checked field and declaration are required.");
  assert.equal(semantics.types.contextualValueSelection(literal).kind, "unavailable", "the synthetic destructuring context is not selected");
  assert.equal(queries.checker.getSymbolDeclarations(property).includes(declaration), true,
    "the value field remains associated with its real authored property, not declaration-free contextual metadata");
});

test("context selection preserves the real initializer and effectful key refusal", () => {
  const { source, literal, declarations } = fixture(`
declare function readKey(): "value";
const { ...value } = { [readKey()]: 7 } as const;
`);
  const declaration = declarations.find(candidate => source.ast.is.IsVariableDeclaration(candidate));
  if (declaration === undefined) throw new Error("The actual initializer owner is required.");
  const initializer = Node_Initializer(source.ast, declaration);
  const semantics = source.semantics.forNode(literal);
  assert.equal(semantics.types.contextualValueSelection(literal).kind, "unavailable", "a const wrapper does not create a contextual field destination");
  assert.equal(Node_Initializer(source.ast, declaration) === initializer && initializer !== undefined, true,
    "no literal-type inference replaces or skips the actual source initializer");
  const property = source.ast.properties(literal)[0];
  const name = source.ast.name(property);
  if (name === undefined) throw new Error("The original computed property name is required.");
  const selected = semantics.propertyNames.get(name);
  assert.equal(selected?.kind === "rejected" && selected.reason.includes("retain its effects"), true,
    "a singleton return type cannot erase the real computed-key call");
});

test("const-asserted array context preserves exact source key metadata beyond 53 bits", () => {
  const { source, literal } = fixture(`
const [key] = [9007199254740994] as const;
export const value = { [key]: 7 };
`);
  const semantics = source.semantics.forNode(literal);
  assert.equal(semantics.types.contextualValueSelection(literal).kind, "unavailable", "the array pattern has no authored contextual target");
  const entry = semantics.propertyNames.entries.find(candidate => source.ast.is.IsComputedPropertyName(candidate.node));
  assert.equal(entry?.selection.kind === "resolved" && entry.selection.constant.kind === "numeric" &&
    entry.selection.constant.token.coefficient === 9007199254740994n, true,
  "the same canonical key owner retains the actual exact numeric token without a 53-bit cap or Number reconstruction");
});

for (const [name, declaration, invocation, explicit] of [
  ["concrete callback", "declare function apply(callback: () => number): number;", "apply(() => 1);", false],
  ["inferred generic callback", "declare function apply<Value>(callback: () => Value): Value;", "apply(() => 1);", false],
  ["explicit generic callback", "declare function apply<Value>(callback: () => Value): Value;", "apply<number>(() => 1);", true],
  ["parenthesized explicit callback", "declare function apply<Value>(callback: () => Value): Value;", "apply<number>(((() => 1)));", true],
] as const) {
  test(`contextual ${name} retains its exact checked invocation provenance`, () => {
    const { source, file } = fixture(`const sentinel = {}; ${declaration} ${invocation}`);
    const arrows: Node[] = [];
    const calls: Node[] = [];
    const visit = (node: Node): void => {
      if (source.ast.is.IsArrowFunction(node)) arrows.push(node);
      if (source.ast.is.IsCallExpression(node)) calls.push(node);
      source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(file);
    assert.equal(arrows.length === 1 && calls.length === 1, true, "one actual callback belongs to one checked invocation");
    const semantics = source.semantics.forNode(arrows[0]!);
    const component = semantics.types.contextualType(arrows[0]!);
    const call = semantics.operations.call(calls[0]!);
    assert.equal(component !== undefined && call !== undefined, true, "the checked context and selected invocation both exist");
    assert.equal(component !== undefined && "contextualCall" in component && component.contextualCall === call, true,
      "the shared contextual producer retains the original selected signature and argument bindings, not a guessed authored flag");
    assert.equal(component?.authoredTypeNode === undefined && component?.declaration === undefined, true,
      "a callback argument does not manufacture a variable annotation owner");
    assert.equal(call?.sourceSelectedSignatureKind, "resolved", "the final checked signature is authoritative");
    assert.equal(call?.sourceArgumentBindings.length, 1, "the exact direct argument has one checked parameter binding");
    const parameter = call?.sourceSelectedSignatureParameters[call.sourceArgumentBindings[0]!.sourceParameterIndex];
    assert.equal(parameter?.parameterDeclaration !== undefined && parameter.authoredTypeNode !== undefined, true,
      "the real declared callback parameter and its type node remain available");
    assert.equal(call?.sourceSelectedMethodTypeArguments?.some(argument => argument.explicitTypeNode !== undefined) === true, explicit,
      "authored generic arguments remain distinguishable from inferred substitutions");
  });
}
