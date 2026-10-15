import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSourceLiteralValues } from "../../packages/target-api/dist/public/source.js";

function syntheticAst(touched) {
  const kinds = ["StringLiteral", "NoSubstitutionTemplateLiteral", "NumericLiteral", "BigIntLiteral", "PrefixUnaryExpression",
    "ParenthesizedExpression", "BinaryExpression", "ArrayLiteralExpression"];
  return {
    is: Object.fromEntries(kinds.map((kind) => [`Is${kind}`, (node) => {
      if (kind === "StringLiteral") touched?.push(node);
      return node.kind === kind;
    }])),
    as: {
      AsParenthesizedExpression: (node) => ({ Expression: node.expression }),
      AsPrefixUnaryExpression: (node) => ({ Operand: node.operand }),
      AsBinaryExpression: (node) => ({ Left: node.left, Right: node.right }),
    },
    kindName: (node) => `Kind${node.kind}`,
    operatorKindName: (node) => node.operator,
    authoredRange: () => ({ kind: "synthetic" }),
    text: (node) => node.text,
    elements: (node) => node.elements ?? [],
    forEachChild: (node, visit) => {
      for (const child of [...(node.children ?? []), node.operand, node.expression, node.left, node.right, ...(node.elements ?? [])]) {
        if (child !== undefined) visit(child);
      }
    },
  };
}

const numericNode = (text) => ({ kind: "NumericLiteral", text });

test("extraction walks iteratively in source post-order and extracts every node once", () => {
  const touched = [];
  const ast = syntheticAst(touched);
  const one = numericNode("1");
  const minus = { kind: "PrefixUnaryExpression", operator: "KindMinusToken", operand: numericNode("0") };
  const list = { kind: "ArrayLiteralExpression", elements: [one, undefined, minus] };
  const second = { kind: "StringLiteral", text: "x" };
  const files = [{ kind: "SourceFile", children: [list] }, { kind: "SourceFile", children: [second] }];
  const index = analyzeSourceLiteralValues(ast, files);
  const expected = [one, minus.operand, minus, list, files[0], second, files[1]];
  assert.equal(touched.length === expected.length && touched.every((node, position) => node === expected[position]), true,
    "children before parents, siblings and files in source order, each node once");
  const array = index.literalValue.get(list);
  assert.equal(array.form === "array" && array.elements.length === 3 && array.elements[1] === undefined &&
    array.elements[0] === index.literalValue.get(one) && array.elements[2] === index.literalValue.get(minus), true,
  "a sparse array keeps its hole and references each element datum");
  assert.equal(Object.is(index.literalValue.get(minus).number, -0) && index.literalValue.get(minus).integer === 0n, true,
    "signed zero survives the iterative walk");
  assert.equal(index.literalValue.get(files[0]) === undefined, true, "a source file has no datum");
});

test("extraction depth does not depend on the host call stack", () => {
  let node = numericNode("7");
  const leaf = node;
  for (let depth = 0; depth < 100_000; depth += 1) node = { kind: "ParenthesizedExpression", expression: node };
  const nested = { kind: "ArrayLiteralExpression", elements: [node] };
  const index = analyzeSourceLiteralValues(syntheticAst(), [{ kind: "SourceFile", children: [nested] }]);
  const outer = index.literalValue.get(node);
  assert.equal(outer?.form === "parenthesized" && outer.number === 7 && outer.integer === 7n, true,
    "the outermost of 100,000 nested parentheses carries the exact enclosed literal");
  assert.equal(index.literalValue.get(leaf)?.integer === 7n && index.literalValue.get(nested)?.elements[0] === outer, true,
    "the leaf and the enclosing array keep their data");
});

test("integer constants come from one shared reader that reads each extracted leaf datum once", () => {
  const ast = syntheticAst();
  const textReads = new Map();
  const operatorReads = new Map();
  const counted = {
    ...ast,
    text: (node) => { textReads.set(node, (textReads.get(node) ?? 0) + 1); return ast.text(node); },
    operatorKindName: (node) => { operatorReads.set(node, (operatorReads.get(node) ?? 0) + 1); return ast.operatorKindName(node); },
  };
  const binary = (operator, left, right) => ({ kind: "BinaryExpression", operator, left, right });
  const group = (expression) => ({ kind: "ParenthesizedExpression", expression });
  const leaves = [numericNode("1"), numericNode("2"), numericNode("3"), numericNode("4")];
  const sum = binary("KindPlusToken", leaves[0], leaves[1]);
  const product = binary("KindAsteriskToken", group(sum), leaves[2]);
  const difference = binary("KindMinusToken", group(product), leaves[3]);
  const outer = group(difference);
  const name = { kind: "Identifier" };
  const refused = binary("KindPlusToken", name, numericNode("1"));
  const containing = binary("KindAsteriskToken", group(refused), numericNode("2"));
  const index = analyzeSourceLiteralValues(counted, [{ kind: "SourceFile", children: [outer, containing] }]);
  const constant = (node) => index.literalValue.get(node)?.integerConstant;
  assert.equal(constant(sum) === 3n && constant(product) === 9n && constant(difference) === 5n && constant(outer) === 5n, true,
    "every nested root keeps its exact integer constant");
  assert.equal(index.literalValue.get(refused) === undefined && index.literalValue.get(containing) === undefined &&
    index.literalValue.get(containing.left) === undefined, true,
  "a refused root and every root that contains it have no integer constant");
  assert.equal(leaves.every((leaf) => textReads.get(leaf) === 2), true,
    "each numeric leaf is read only by its own extraction, never again by an enclosing integer root");
  const roots = [sum, product.left, product, difference.left, difference, outer];
  assert.equal(roots.every((node) => operatorReads.get(node) === 1), true,
    "each operator and grouping node is evaluated once across all enclosing integer roots");
});

test("a prefix sign has a datum only when its operand is a numeric, bigint, signed or grouped literal", () => {
  const prefix = (operator, operand) => ({ kind: "PrefixUnaryExpression", operator, operand });
  const group = (expression) => ({ kind: "ParenthesizedExpression", expression });
  const name = () => ({ kind: "Identifier" });
  const sum = { kind: "BinaryExpression", operator: "KindPlusToken", left: numericNode("1"), right: numericNode("2") };
  const nonLiterals = [
    prefix("KindMinusToken", name()),
    prefix("KindPlusToken", name()),
    prefix("KindMinusToken", group(name())),
    prefix("KindMinusToken", prefix("KindMinusToken", name())),
    prefix("KindMinusToken", group(sum)),
    prefix("KindMinusToken", group(numericNode("1e400"))),
    prefix("KindMinusToken", { kind: "StringLiteral", text: "1" }),
    prefix("KindExclamationToken", name()),
    prefix("KindExclamationToken", numericNode("0")),
    prefix("KindTildeToken", numericNode("1")),
  ];
  const literals = [
    [prefix("KindMinusToken", numericNode("1.5")), -1.5, undefined],
    [prefix("KindPlusToken", numericNode("1")), 1, 1n],
    [prefix("KindMinusToken", { kind: "BigIntLiteral", text: "2n" }), undefined, -2n],
    [prefix("KindMinusToken", group(numericNode("1"))), -1, -1n],
    [prefix("KindMinusToken", prefix("KindMinusToken", numericNode("1"))), 1, 1n],
    [prefix("KindMinusToken", numericNode("0")), -0, 0n],
    [prefix("KindMinusToken", numericNode("1e400")), undefined, undefined],
    [prefix("KindMinusToken", prefix("KindMinusToken", numericNode("1e400"))), undefined, undefined],
  ];
  const index = analyzeSourceLiteralValues(syntheticAst(),
    [{ kind: "SourceFile", children: [...nonLiterals, ...literals.map(([node]) => node)] }]);
  assert.equal(nonLiterals.every((node) => index.literalValue.get(node) === undefined), true,
    "a sign over a name, a grouped name, a signed name, a grouped constant, a grouped non-finite literal or a string, " +
    "and every non-sign prefix operator, has no datum");
  assert.equal(index.literalValue.get(nonLiterals[3].operand) === undefined && index.literalValue.get(sum)?.integerConstant === 3n, true,
    "the inner sign of a signed name has no datum and the grouped constant keeps its own datum");
  assert.equal(literals.every(([node, number, integer]) => {
    const value = index.literalValue.get(node);
    return value?.form === "prefix-unary" && Object.is(value.number, number) && value.integer === integer;
  }), true, "a sign over a numeric, bigint, grouped or signed literal keeps its exact number and integer, " +
    "and a sign over a non-finite literal keeps a datum with neither");
});
