import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { Node_Initializer } from "../../source-navigation/ast.js";
import { createTargetSourceProgram } from "../target-source-program.js";
import { collectSourceTypeFlowSignatures } from "./signatures.js";
import { createSourceTypeFlowTerms } from "./terms.js";
import type {
  SourceTypeFlowAnalysisContext,
  SourceTypeFlowCall,
  SourceTypeFlowDerived,
  SourceTypeFlowGraph,
  SourceTypeFlowLink,
  SourceTypeFlowNode,
  SourceTypeFlowPathPart,
  SourceTypeFlowSignature,
  SourceTypeFlowVariable,
} from "./types.js";

function fixture(text: string) {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": text },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0,
    formatDiagnostics(checked.diagnostics.filter(issue => issue !== undefined)).slice(0, 2048));
  assert.equal(checked.extensionDiagnostics.length, 0, "the checked fixture has no extension refusal");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The original checked source file is required.");
  const nodes: Node[] = [];
  const preorder = new Map<Node, number>();
  const visit = (node: Node): void => {
    preorder.set(node, nodes.length);
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const context: SourceTypeFlowAnalysisContext = {
    source,
    describe: () => undefined,
    literal: () => undefined,
    order: node => ({ start: source.ast.pos(node), preorder: preorder.get(node)! }),
  };
  const find = (kind: string, name?: string, occurrence = 0): Node => {
    const candidates = nodes.filter(node => source.ast.kindName(node) === kind &&
      (name === undefined || source.ast.text(source.ast.name(node) ?? node) === name));
    const selected = candidates[occurrence < 0 ? candidates.length + occurrence : occurrence];
    if (selected === undefined) throw new Error(`The checked ${kind}/${name ?? ""}/${occurrence} is required.`);
    return selected;
  };
  return { source, context, find, nodes };
}

function variable(node: Node, path: readonly SourceTypeFlowPathPart[] = []): SourceTypeFlowVariable {
  return Object.freeze({ node, path: Object.freeze(path) });
}

function valueNode(
  node: Node,
  root: Node,
  options: Partial<Pick<SourceTypeFlowNode, "variable" | "initializer" | "declaration" | "term" | "kind" | "publish">> = {},
): SourceTypeFlowNode {
  return Object.freeze({ node, root, variable: variable(node), kind: "value", publish: true, ...options });
}

function graph(
  roots: readonly Node[],
  nodes: readonly SourceTypeFlowNode[],
  links: readonly SourceTypeFlowLink[] = [],
  derived: readonly SourceTypeFlowDerived[] = [],
  calls: readonly SourceTypeFlowCall[] = [],
): SourceTypeFlowGraph {
  return Object.freeze({ roots: Object.freeze(roots), nodes: Object.freeze(nodes),
    links: Object.freeze(links), derived: Object.freeze(derived), calls: Object.freeze(calls), refusals: Object.freeze([]) });
}

function sameVariable(left: SourceTypeFlowVariable, right: SourceTypeFlowVariable): boolean {
  return left.node === right.node && left.path.length === right.path.length && left.path.every((part, index) => {
    const other = right.path[index];
    return part.kind === "element" ? other?.kind === "element"
      : part.kind === "member" ? other?.kind === "member" && part.name === other.name
      : part.kind === "tuple" ? other?.kind === "tuple" && part.index === other.index
      : other?.kind === "binder" && part.declaration === other.declaration;
  });
}

function includes(signatures: readonly SourceTypeFlowSignature[], selected: SourceTypeFlowVariable): boolean {
  return signatures.some(signature => sameVariable(signature.variable, selected));
}

function collectEligibleMetadata(
  context: SourceTypeFlowAnalysisContext,
  input: SourceTypeFlowGraph,
): readonly SourceTypeFlowSignature[] {
  return collectSourceTypeFlowSignatures(context, input, () => true);
}

function collectInScope(
  context: SourceTypeFlowAnalysisContext,
  input: SourceTypeFlowGraph,
): readonly SourceTypeFlowSignature[] {
  const terms = createSourceTypeFlowTerms(context.source.ast, input);
  return collectSourceTypeFlowSignatures(context, input, terms.isInference);
}

for (const [label, text, ownerKind, ownerName, valueKind, valueName] of [
  ["function", "function makeValue() { const sourceValue = 1; return sourceValue; }",
    "KindFunctionDeclaration", "makeValue", "KindIdentifier", "sourceValue"],
  ["method", "class Holder { makeValue() { const sourceValue = 1; return sourceValue; } }",
    "KindMethodDeclaration", "makeValue", "KindIdentifier", "sourceValue"],
  ["getter", "class Holder { get value() { const sourceValue = 1; return sourceValue; } }",
    "KindGetAccessor", "value", "KindIdentifier", "sourceValue"],
  ["concise arrow", "function outer() { const makeValue = () => 1; void makeValue; }",
    "KindArrowFunction", undefined, "KindNumericLiteral", "1"],
  ["constructor", "class Holder { value = 1; constructor() { return this; } }",
    "KindConstructor", undefined, "KindThisKeyword", undefined],
] as const) {
  test(`signature ${label} retains its exact checked value, owner and site`, () => {
    const checked = fixture(text);
    const owner = checked.find(ownerKind, ownerName);
    const value = checked.find(valueKind, valueName, -1);
    const selected = variable(value);
    const result = collectEligibleMetadata(checked.context, graph([owner], [valueNode(value, owner, { variable: selected })]));
    assert.equal(result.length, 1, `${label}: one original value is declaration-typed`);
    assert.equal(result[0]!.owner === owner && result[0]!.variable === selected, true,
      `${label}: the actual checked owner and original variable are retained`);
    assert.equal(Object.isFrozen(result) && Object.isFrozen(result[0]), true,
      `${label}: publication markers are immutable`);
  });
}

for (const [label, text] of [
  ["ordinary", "function makeValue(): number { const sourceValue = 1; return sourceValue; }"],
  ["async awaited", "async function makeValue(): Promise<number> { const sourceValue = 1; return sourceValue; }"],
  ["generator", "function* makeValue(): Generator<number, void, unknown> { const sourceValue = 1; yield sourceValue; }"],
] as const) {
  test(`declared ${label} return remains a concrete use rather than an inferred signature`, () => {
    const checked = fixture(text);
    const owner = checked.find("KindFunctionDeclaration", "makeValue");
    const value = checked.find("KindIdentifier", "sourceValue", -1);
    assert.equal(collectEligibleMetadata(checked.context, graph([owner], [valueNode(value, owner)])).length, 0,
      "a declared result must be handled by the use collector's fill, not declaration-typing");
  });
}

for (const [label, text] of [
  ["async awaited", "async function makeValue() { const sourceValue = 1; return await ((sourceValue)!); }"],
  ["generator yield", "function* makeValue() { const sourceValue = 1; yield sourceValue; }"],
] as const) {
  test(`inferred ${label} preserves the declaration type through transparent values`, () => {
    const checked = fixture(text);
    const owner = checked.find("KindFunctionDeclaration", "makeValue");
    const value = checked.find("KindIdentifier", "sourceValue", -1);
    const result = collectEligibleMetadata(checked.context, graph([owner], [valueNode(value, owner)]));
    assert.equal(result.length, 1, "the original inferred result cannot be changed by a local use");
    assert.equal(result[0]!.owner === owner, true, "the original async or generator owner is retained");
  });
}

test("inferred return ownership does not borrow an enclosing function's declared return", () => {
  const checked = fixture("function outer(): number { function inner() { const sourceValue = 1; return sourceValue; } return inner(); }");
  const owner = checked.find("KindFunctionDeclaration", "inner");
  const value = checked.find("KindIdentifier", "sourceValue", -1);
  const result = collectEligibleMetadata(checked.context, graph([owner], [valueNode(value, owner)]));
  assert.equal(result.length === 1 && result[0]!.owner === owner, true,
    "the nearest original callable owns its own inferred signature");
});

test("unannotated fields and parameter defaults are signature roots; annotated ones are not", () => {
  const checked = fixture("class Holder { value = 1; typed: number = 2; } function read(value = 3, typed: number = 4) { void value; void typed; }");
  const owner = checked.find("KindFunctionDeclaration", "read");
  const declarations = [checked.find("KindPropertyDeclaration", "value"), checked.find("KindPropertyDeclaration", "typed"),
    checked.find("KindParameter", "value"), checked.find("KindParameter", "typed")];
  const nodes = declarations.map(declaration => valueNode(declaration, owner,
    { initializer: Node_Initializer(checked.source.ast, declaration), declaration }));
  const result = collectEligibleMetadata(checked.context, graph([owner], nodes));
  assert.equal(result.length, 2, "only the two genuinely unannotated declarations fix their initializers");
  assert.equal(result.every(signature => signature.site === signature.owner &&
    (signature.owner === declarations[0] || signature.owner === declarations[2])), true,
    "field/default origins retain their own checked declaration, never a synthetic enclosing owner");
});

for (const [label, statement] of [
  ["arrow", "consume((sourceValue = 1) => sourceValue);"],
  ["parenthesized arrow", "consume((((sourceValue = 1) => sourceValue)));"],
  ["satisfies arrow", "consume(((sourceValue = 1) => sourceValue) satisfies ((value?: number) => number));"],
  ["asserted arrow", "consume(((sourceValue = 1) => sourceValue) as ((value?: number) => number));"],
  ["function expression", "consume(function(sourceValue = 1) { return sourceValue; });"],
] as const) {
  test(`direct-argument ${label} parameters and returns are not signatures`, () => {
    const checked = fixture(`declare function consume(callback: (value?: number) => number): void; function outer() { ${statement} }`);
    const owner = checked.find("KindFunctionDeclaration", "outer");
    const parameter = checked.find("KindParameter", "sourceValue");
    const returned = checked.find("KindIdentifier", "sourceValue", -1);
    const result = collectEligibleMetadata(checked.context, graph([owner], [
      valueNode(parameter, owner, { initializer: Node_Initializer(checked.source.ast, parameter) }), valueNode(returned, owner),
    ]));
    assert.equal(result.length, 0, "the actual C7 inline slots are joined by the generic edge collector instead");
  });
}

for (const [label, statement] of [
  ["stored", "const callback = (sourceValue = 1) => sourceValue; void callback;"],
  ["returned", "return (sourceValue = 1) => sourceValue;"],
] as const) {
  test(`${label} closures do not acquire the direct-argument exemption`, () => {
    const checked = fixture(`function outer() { ${statement} }`);
    const owner = checked.find("KindArrowFunction");
    const parameter = checked.find("KindParameter", "sourceValue");
    const returned = checked.find("KindIdentifier", "sourceValue", -1);
    const result = collectEligibleMetadata(checked.context, graph([owner], [
      valueNode(parameter, owner, { initializer: Node_Initializer(checked.source.ast, parameter) }), valueNode(returned, owner),
    ]));
    assert.equal(result.length, 2, "classification never silently admits a stored/returned closure as C7");
  });
}

for (const [label, text] of [
  ["modifier", "export const sourceValue = 1;"],
  ["named export", "const sourceValue = 1; export { sourceValue };"],
] as const) {
  test(`${label} uses the actual Host export summary`, () => {
    const checked = fixture(text);
    const declaration = checked.find("KindVariableDeclaration", "sourceValue");
    const result = collectEligibleMetadata(checked.context, graph([], [valueNode(declaration, declaration)]));
    assert.equal(result.length === 1 && result[0]!.owner === declaration, true,
      "the exact exported declaration keeps its own type even without a direct export modifier");
  });
}

test("C24 closes inferred signatures transitively through arithmetic-derived locals, never unrelated locals", () => {
  const checked = fixture("function makeValue() { const sourceValue = 1; const otherValue = 9; const first = sourceValue * 2; const second = first + 3; return second; }");
  const owner = checked.find("KindFunctionDeclaration", "makeValue");
  const source = variable(checked.find("KindVariableDeclaration", "sourceValue"));
  const other = variable(checked.find("KindVariableDeclaration", "otherValue"));
  const first = variable(checked.find("KindVariableDeclaration", "first"));
  const second = variable(checked.find("KindVariableDeclaration", "second"));
  const product = checked.find("KindBinaryExpression", undefined, 0);
  const addition = checked.find("KindBinaryExpression", undefined, 1);
  const productResult = variable(product);
  const additionResult = variable(addition);
  const returned = checked.find("KindIdentifier", "second", -1);
  const returnedValue = variable(returned);
  const links = [{ source: first, target: productResult, site: first.node },
    { source: second, target: additionResult, site: second.node }, { source: returnedValue, target: second, site: returned }];
  const derived: SourceTypeFlowDerived[] = [
    { node: product, result: productResult, operator: "multiply", operands: [source, variable(checked.find("KindNumericLiteral", "2"))], required: true },
    { node: addition, result: additionResult, operator: "add", operands: [first, variable(checked.find("KindNumericLiteral", "3"))], required: true },
  ];
  const selected = graph([owner], [source, other, first, second, returnedValue].map(value =>
    valueNode(value.node, owner, { variable: value })), links, derived);
  const result = collectEligibleMetadata(checked.context, selected);
  for (const value of [source, first, second, productResult, additionResult, returnedValue]) {
    assert.equal(includes(result, value), true, "every actual result dependency is declaration-typed");
  }
  assert.equal(includes(result, other), false, "a sibling local with no dependency is untouched");
  assert.equal(result.every(signature => signature.owner === owner &&
    signature.site === checked.find("KindReturnStatement")), true,
    "transitive marks retain the same original signature origin");
  assert.equal(selected.links.length === 3 && selected.derived.length === 2, true,
    "signature closure adds no arithmetic equality or concrete-fill edge");
});

test("signature dependency traversal is directional and never types a derived result from an operand", () => {
  const checked = fixture("function makeValue() { const sourceValue = 1; const derivedValue = sourceValue * 2; return sourceValue; }");
  const owner = checked.find("KindFunctionDeclaration", "makeValue");
  const source = variable(checked.find("KindVariableDeclaration", "sourceValue"));
  const expression = checked.find("KindBinaryExpression");
  const derivedResult = variable(expression);
  const returned = checked.find("KindIdentifier", "sourceValue", -1);
  const result = collectEligibleMetadata(checked.context, graph([owner],
    [valueNode(source.node, owner, { variable: source }), valueNode(returned, owner)],
    [{ source: variable(returned), target: source, site: returned }],
    [{ node: expression, result: derivedResult, operator: "multiply", operands: [source], required: true }]));
  assert.equal(includes(result, source), true, "the returned operand is declaration-typed");
  assert.equal(includes(result, derivedResult), false, "no reverse derived dependency or backward demand is invented");
});

test("whole-container signatures close through shape and array terms to their original member groups", () => {
  const checked = fixture("function makeValue() { const sourceValue = 1; return { count: [sourceValue] }; }");
  const owner = checked.find("KindFunctionDeclaration", "makeValue");
  const source = variable(checked.find("KindVariableDeclaration", "sourceValue"));
  const literal = checked.find("KindObjectLiteralExpression");
  const array = checked.find("KindArrayLiteralExpression");
  const arrayValue = variable(array);
  const element = variable(array, [{ kind: "element" }]);
  const result = collectEligibleMetadata(checked.context, graph([owner], [
    valueNode(literal, owner, { term: { kind: "shape", site: literal, members: [{ name: "count", optional: false, variable: arrayValue }] } }),
    valueNode(array, owner, { variable: arrayValue, term: { kind: "array", site: array, element, readonly: false } }),
    valueNode(source.node, owner, { variable: source }),
  ], [{ source: element, target: source, site: array }]));
  assert.equal(includes(result, source) && includes(result, element) && includes(result, arrayValue), true,
    "the actual stored structure, not an AST-descendant heuristic, carries signature dependency");
});

test("a returned member does not fix the parent structure or unrelated members", () => {
  const checked = fixture("function makeValue() { const objectValue = { first: 1, second: 2 }; return objectValue.first; }");
  const owner = checked.find("KindFunctionDeclaration", "makeValue");
  const declaration = checked.find("KindVariableDeclaration", "objectValue");
  const first = variable(declaration, [{ kind: "member", name: "first" }]);
  const second = variable(declaration, [{ kind: "member", name: "second" }]);
  const returned = checked.find("KindPropertyAccessExpression");
  const result = collectEligibleMetadata(checked.context, graph([owner], [
    valueNode(declaration, owner, { term: { kind: "shape", site: declaration,
      members: [{ name: "first", optional: false, variable: first }, { name: "second", optional: false, variable: second }] } }), valueNode(returned, owner),
  ], [{ source: variable(returned), target: first, site: returned }]));
  assert.equal(includes(result, first), true, "the read's precise member group reaches the signature");
  assert.equal(includes(result, second) || includes(result, variable(declaration)), false,
    "member closure never flows backward to unrelated structure");
});

test("B7 pair paths and nominal argument dependencies remain distinct", () => {
  const checked = fixture("class Pair<Left, Right> {} function makeValue() { const keyValue = 1; const itemValue = 2; return [keyValue, itemValue]; }");
  const owner = checked.find("KindFunctionDeclaration", "makeValue");
  const literal = checked.find("KindArrayLiteralExpression");
  const first = variable(literal, [{ kind: "tuple", index: 0 }]);
  const second = variable(literal, [{ kind: "tuple", index: 1 }]);
  const leftBinder = checked.find("KindTypeParameter", "Left");
  const rightBinder = checked.find("KindTypeParameter", "Right");
  const left = variable(literal, [{ kind: "binder", declaration: leftBinder }]);
  const right = variable(literal, [{ kind: "binder", declaration: rightBinder }]);
  const result = collectEligibleMetadata(checked.context, graph([owner], [
    valueNode(literal, owner, { term: { kind: "tuple", site: literal, elements: [first, second], readonly: true } }),
    valueNode(left.node, owner, { kind: "binder", variable: left, term: { kind: "declared", site: literal,
      declaration: checked.find("KindClassDeclaration", "Pair"), typeArguments: [right] } }),
  ], [{ source: first, target: left, site: literal }]));
  assert.equal([first, second, left, right].every(value => includes(result, value)), true,
    "the pair's positions and declared binder identities are four separate closure variables");
  assert.equal(result.filter(signature => signature.variable.node === literal).length, 5,
    "no tuple position or binder is collapsed into a guessed object member or another binder");
});

test("a signature of a declared call result does not include its argument merely because it is an AST descendant", () => {
  const checked = fixture("declare function consume(value: number): number; function makeValue() { const sourceValue = 1; return consume(sourceValue); }");
  const owner = checked.find("KindFunctionDeclaration", "makeValue");
  const argument = checked.find("KindIdentifier", "sourceValue", -1);
  const call = checked.find("KindCallExpression");
  const receipt = checked.source.semantics.forNode(call).operations.call(call);
  assert.equal(receipt !== undefined, true, "the original selected call is actual checked evidence");
  const result = collectEligibleMetadata(checked.context, graph([owner], [valueNode(argument, owner)], [], [],
    [{ node: call, source: receipt!, receiver: [], method: [], argumentPlaces: [], result: variable(call) }]));
  assert.equal(includes(result, variable(call)), true, "the declared result occurrence reaches the signature");
  assert.equal(includes(result, variable(argument)), false, "no unrecorded argument-to-result dependency is invented");
});

test("canonical variable paths and cyclic equality links are visited once without mutating the graph", () => {
  const checked = fixture("function makeValue() { const sourceValue = 1; return sourceValue; }");
  const owner = checked.find("KindFunctionDeclaration", "makeValue");
  const returned = checked.find("KindIdentifier", "sourceValue", -1);
  const declaration = checked.find("KindVariableDeclaration", "sourceValue");
  const read = variable(returned);
  const original = variable(declaration, [{ kind: "member", name: "nested" }, { kind: "element" }]);
  const same = variable(declaration, [{ kind: "member", name: "nested" }, { kind: "element" }]);
  const input = graph([owner], [valueNode(returned, owner, { variable: read })], [
    { source: read, target: original, site: returned }, { source: same, target: read, site: returned },
  ]);
  const result = collectEligibleMetadata(checked.context, input);
  assert.equal(result.length, 2, "cloned records of the same checked variable path are one closure entry");
  assert.equal(includes(result, original) && includes(result, same), true, "node/path identity is structural without AST serialization");
  assert.equal(input.links[0]!.target === original && input.links[1]!.source === same, true,
    "all original immutable link records remain unchanged");
});

test("multiple signature origins use checked source order and AST preorder, independent of graph order", () => {
  const checked = fixture("function makeValue(flag: boolean) { const sourceValue = 1; if (flag) return sourceValue; return sourceValue; }");
  const owner = checked.find("KindFunctionDeclaration", "makeValue");
  const first = checked.find("KindIdentifier", "sourceValue", 1);
  const last = checked.find("KindIdentifier", "sourceValue", 2);
  const declaration = variable(checked.find("KindVariableDeclaration", "sourceValue"));
  const nodes = [valueNode(first, owner), valueNode(last, owner)];
  const links = [{ source: variable(first), target: declaration, site: first }, { source: variable(last), target: declaration, site: last }];
  const order = checked.context.order;
  const tied: SourceTypeFlowAnalysisContext = { ...checked.context, order: node => ({ ...order(node), start: 0 }) };
  const ordinary = collectEligibleMetadata(checked.context, graph([owner], nodes, links));
  const shuffled = collectEligibleMetadata(tied, graph([owner], [...nodes].reverse(), [...links].reverse()));
  assert.equal(ordinary.length === 3 && shuffled.length === ordinary.length, true, "shared dependencies are marked only once");
  assert.equal(ordinary.every(signature => signature.site === checked.find("KindReturnStatement", undefined, 0)) &&
    shuffled.every(signature => signature.site === checked.find("KindReturnStatement", undefined, 0)), true,
    "the earlier checked signature is retained even when offsets tie and inputs arrive reversed");
});

test("C24 declaration-types the consumed local through a directly returned arithmetic result", () => {
  const checked = fixture("declare function takeDouble(value: number): void; function makeValue() { const sourceValue = 1; takeDouble(sourceValue); return sourceValue + 1; }");
  const owner = checked.find("KindFunctionDeclaration", "makeValue");
  const declaration = variable(checked.find("KindVariableDeclaration", "sourceValue"));
  const consumed = checked.find("KindIdentifier", "sourceValue", 1);
  const operand = checked.find("KindIdentifier", "sourceValue", 2);
  const expression = checked.find("KindBinaryExpression");
  const result = collectEligibleMetadata(checked.context, graph([owner], [
    valueNode(declaration.node, owner, { kind: "open-local", variable: declaration }),
    valueNode(consumed, owner), valueNode(operand, owner),
  ], [{ source: variable(consumed), target: declaration, site: consumed },
    { source: variable(operand), target: declaration, site: operand }],
  [{ node: expression, result: variable(expression), operator: "add", operands: [variable(operand)], required: true }]));
  assert.equal(includes(result, declaration) && includes(result, variable(consumed)), true,
    "the solver receives a declaration-typed group before evaluating the conflicting concrete use");
  assert.equal(result.every(signature => signature.site === checked.find("KindReturnStatement") && signature.owner === owner), true,
    "the signature conflict can retain the actual inferred-return origin, not the takeDouble call");
});

test("default-export arithmetic retains the real export site through the same C24 closure", () => {
  const checked = fixture("const sourceValue = 1; export default sourceValue + 1;");
  const declaration = variable(checked.find("KindVariableDeclaration", "sourceValue"));
  const expression = checked.find("KindBinaryExpression");
  const owner = checked.find("KindExportAssignment");
  const result = collectEligibleMetadata(checked.context, graph([], [
    valueNode(declaration.node, owner, { kind: "fixed", variable: declaration }),
  ], [], [{ node: expression, result: variable(expression), operator: "add", operands: [declaration], required: true }]));
  assert.equal(includes(result, declaration), true, "the exported derived value keeps its declaration-typed dependency");
  assert.equal(result.every(signature => signature.site === owner && signature.owner === owner), true,
    "the exact default-export record owns the signature boundary");
});

test("only result-dependent method binders are signature roots at a returned generic call", () => {
  const checked = fixture("declare function selectResult<Argument, Result>(value: Argument): Result; function makeValue() { const sourceValue = 1; return selectResult<number, string>(sourceValue); }");
  const owner = checked.find("KindFunctionDeclaration", "makeValue");
  const call = checked.find("KindCallExpression");
  const receipt = checked.source.semantics.forNode(call).operations.call(call);
  const argumentDeclaration = checked.find("KindTypeParameter", "Argument");
  const resultDeclaration = checked.find("KindTypeParameter", "Result");
  const argumentBinder = variable(call, [{ kind: "binder", declaration: argumentDeclaration }]);
  const resultBinder = variable(call, [{ kind: "binder", declaration: resultDeclaration }]);
  const argument = checked.find("KindIdentifier", "sourceValue", -1);
  assert.equal(receipt !== undefined && receipt.sourceArgumentBindings[0] !== undefined &&
    receipt.sourceSelectedSignatureParameters[0] !== undefined, true, "the original checked binder places are available");
  const result = collectEligibleMetadata(checked.context, graph([owner], [
    valueNode(call, owner, { kind: "binder", variable: argumentBinder }),
    valueNode(call, owner, { kind: "binder", variable: resultBinder }), valueNode(argument, owner),
  ], [{ source: variable(call), target: resultBinder, site: call }], [], [{
    node: call, source: receipt!, receiver: [], method: [
      { declaration: argumentDeclaration, variable: argumentBinder }, { declaration: resultDeclaration, variable: resultBinder },
    ], argumentPlaces: [{ binding: receipt!.sourceArgumentBindings[0]!, parameter: receipt!.sourceSelectedSignatureParameters[0]!,
      binder: argumentDeclaration, value: variable(argument) }], result: variable(call),
  }]));
  assert.equal(includes(result, resultBinder), true, "the actual result's binder reaches the signature");
  assert.equal(includes(result, argumentBinder) || includes(result, variable(argument)), false,
    "sharing the call node never makes an unrelated binder or argument a signature dependency");
});

test("construction positions sharing a returned occurrence are dependencies, never independent signature seeds", () => {
  const checked = fixture("function makeValue() { const objectValue = { first: 1, second: [2] }; return objectValue.first; }");
  const owner = checked.find("KindFunctionDeclaration", "makeValue");
  const returned = checked.find("KindPropertyAccessExpression");
  const first = variable(returned, [{ kind: "member", name: "first" }]);
  const second = variable(returned, [{ kind: "member", name: "second" }]);
  const element = variable(returned, [{ kind: "member", name: "second" }, { kind: "element" }]);
  const result = collectEligibleMetadata(checked.context, graph([owner], [
    valueNode(returned, owner), valueNode(returned, owner, { variable: first, publish: false }),
    valueNode(returned, owner, { variable: second, publish: false,
      term: { kind: "array", site: returned, element, readonly: false } }),
  ], [{ source: variable(returned), target: first, site: returned }]));
  assert.equal(result.length === 2 && includes(result, first), true,
    "only the published occurrence and its actual linked member reach the signature");
  assert.equal(includes(result, second) || includes(result, element), false,
    "a non-published structural position never inherits the shared node's syntactic return role");
});

test("a returned declared optional result retains its actual value dependency", () => {
  const checked = fixture("declare function readValue<Result>(): Result | undefined; function makeValue() { return readValue<number>(); }");
  const owner = checked.find("KindFunctionDeclaration", "makeValue");
  const call = checked.find("KindCallExpression");
  const declaration = checked.find("KindTypeParameter", "Result");
  const component = checked.source.semantics.forNode(call).operations.call(call);
  const binder = variable(call, [{ kind: "binder", declaration }]);
  assert.equal(component !== undefined, true, "the actual selected declared result is retained");
  const result = collectEligibleMetadata(checked.context, graph([owner], [
    valueNode(call, owner, { term: { kind: "optional", site: call, value: binder,
      source: { selectedType: component!.sourceResultType } } }),
    valueNode(call, owner, { kind: "binder", variable: binder, publish: false }),
  ]));
  assert.equal(result.length === 2 && includes(result, binder), true,
    "declared one-absence structure closes through its exact result binder, not a fabricated union");
});

for (const [label, text] of [
  ["module shorthand", 'const foo = "bar"; export const record: Record<string, string> = { foo };'],
  ["module exports", "export const plain = 7 / 2; export const typed: number = 7 / 2;"],
  ["declared union", "function read(value: number | string) { return value; }"],
] as const) {
  test(`C29 ${label} never starts a signature closure without an inference group`, () => {
    const checked = fixture(text);
    const root = checked.source.sourceFiles[0]!;
    const input = graph([root], checked.nodes.map(node => valueNode(node, root, { kind: "fixed" })));
    const terms = createSourceTypeFlowTerms(checked.source.ast, input);
    assert.equal(input.nodes.some(node => terms.isInference(node.variable)), false,
      "actual canonical terms contain no open-local or derived-local origin");
    assert.equal(collectSourceTypeFlowSignatures(checked.context, input, terms.isInference).length, 0,
      "never-open declarations keep their declared path, without signature marks or a second scope classifier");
  });
}

test("C24 uses the same canonical inference scope and never flows arithmetic openness backward", () => {
  const checked = fixture("function read(limit: number) { const sourceValue = 1; return sourceValue + limit; }");
  const owner = checked.find("KindFunctionDeclaration", "read");
  const source = variable(checked.find("KindVariableDeclaration", "sourceValue"));
  const read = variable(checked.find("KindIdentifier", "sourceValue", -1));
  const fixed = variable(checked.find("KindIdentifier", "limit", -1));
  const expression = checked.find("KindBinaryExpression");
  const input = graph([owner], [valueNode(source.node, owner, { kind: "open-local", variable: source }),
    valueNode(read.node, owner, { kind: "read", variable: read }),
    valueNode(fixed.node, owner, { kind: "fixed", variable: fixed })],
  [{ source, target: read, site: read.node }],
  [{ node: expression, result: variable(expression), operator: "add", operands: [read, fixed], required: true }]);
  const terms = createSourceTypeFlowTerms(checked.source.ast, input);
  const result = collectSourceTypeFlowSignatures(checked.context, input, terms.isInference);
  assert.equal(terms.isInference(variable(expression)) && terms.isInference(read), true,
    "canonical equality and operand-to-result propagation retain the actual open group");
  assert.equal(terms.isInference(fixed) || includes(result, fixed), false,
    "a declared operand is not made open or declaration-typed by an arithmetic dependent");
  assert.equal(includes(result, source) && includes(result, read) && includes(result, variable(expression)), true,
    "the same scoped predicate permits the complete original C24 dependency closure");
});

test("a never-open return cannot start closure into a separately inferred arithmetic dependent", () => {
  const checked = fixture("function read(limit: number) { const sourceValue = 1; const derivedValue = sourceValue + limit; return limit; }");
  const owner = checked.find("KindFunctionDeclaration", "read");
  const source = variable(checked.find("KindVariableDeclaration", "sourceValue"));
  const fixed = variable(checked.find("KindParameter", "limit"));
  const operand = variable(checked.find("KindIdentifier", "limit", 1));
  const returned = variable(checked.find("KindIdentifier", "limit", 2));
  const expression = checked.find("KindBinaryExpression");
  const input = graph([owner], [valueNode(source.node, owner, { kind: "open-local", variable: source }),
    valueNode(operand.node, owner, { kind: "fixed", variable: operand }),
    valueNode(returned.node, owner, { kind: "read", variable: returned })],
  [{ source: fixed, target: operand, site: operand.node }, { source: fixed, target: returned, site: returned.node }],
  [{ node: expression, result: variable(expression), operator: "add", operands: [source, operand], required: true }]);
  const terms = createSourceTypeFlowTerms(checked.source.ast, input);
  assert.equal(terms.isInference(variable(expression)) && !terms.isInference(returned), true,
    "the supplied scope distinguishes a genuine derived group from its declared operand");
  assert.equal(collectSourceTypeFlowSignatures(checked.context, input, terms.isInference).length, 0,
    "origin eligibility is checked before traversing a signature, not filtered after it");
});

test("the actual canonical scope retains structural containment without a second unifier", () => {
  const checked = fixture("function read() { const values = [1]; return values; }");
  const owner = checked.find("KindFunctionDeclaration", "read");
  const declaration = variable(checked.find("KindVariableDeclaration", "values"));
  const element = variable(declaration.node, [{ kind: "element" }]);
  const returned = variable(checked.find("KindIdentifier", "values", -1));
  const input = graph([owner], [valueNode(declaration.node, owner, { kind: "open-local", variable: declaration,
    term: { kind: "array", site: declaration.node, element, readonly: false } }),
  valueNode(returned.node, owner, { kind: "read", variable: returned })],
  [{ source: declaration, target: returned, site: returned.node }]);
  const result = collectInScope(checked.context, input);
  assert.equal(result.length === 3 && includes(result, declaration) && includes(result, element), true,
    "the shared terms instance, not a copied openness rule, covers the original element and container");
});

test("signature collection requires its supplied inference predicate and rejects the retired invocation", () => {
  const checked = fixture("function read() { const value = 1; return value; }");
  const owner = checked.find("KindFunctionDeclaration", "read");
  const returned = checked.find("KindIdentifier", "value", -1);
  const input = graph([owner], [valueNode(returned, owner)]);
  assert.equal(collectSourceTypeFlowSignatures.length, 3, "the current API has no optional scope argument");
  assert.throws(() => Reflect.apply(collectSourceTypeFlowSignatures, undefined, [checked.context, input]), TypeError,
    "the old unscoped signature cannot silently acquire a default or compatibility path");
});
