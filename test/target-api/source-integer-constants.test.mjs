import assert from "node:assert/strict";
import test from "node:test";
import { sourceIntegerConstantValue } from "../../packages/target-api/dist/public/source.js";
import { checkedSource, namedVariable, projectSourceFile } from "../fixtures/source-navigation.mjs";

test("closed integer arithmetic preserves exact authored values without identifier or floating guesses", async () => {
  const expressions = [
    ["(64 * 1024) * 1024", 67108864n],
    ["9007199254740993 + 2", 9007199254740995n],
    ["18446744073709551615n - 1n", 18446744073709551614n],
    ["-(7 + 2)", -9n], ["7 / 2", 3n], ["-7 % 3", -1n],
    ["7 / 0", undefined], ["7 % 0", undefined], ["1.5 + 2", undefined],
    ["other + 2", undefined], ["other++", undefined], ["read() + 2", undefined],
    ["1 << 2", undefined], ["2 ** 3", undefined],
    ["340282366920938463463374607431768211455n * 340282366920938463463374607431768211455n", undefined],
  ];
  const source = await checkedSource("integer-constants", { "src/index.ts":
    "let other = 1; function read(): number { return 1; }\n" + expressions.map(([expression], index) =>
      `export const value${index} = ${expression};`).join("\n") });
  const file = projectSourceFile(source, "src/index.ts");
  for (const [index, [, expected]] of expressions.entries()) {
    const initializer = source.ast.as.AsVariableDeclaration(namedVariable(source.ast, file, `value${index}`))?.Initializer;
    assert.notEqual(initializer, undefined);
    assert.equal(sourceIntegerConstantValue(source.ast, initializer), expected, `constant ${index}`);
  }
});

test("integer constant accounting rejects cycles and excessive depth or node reservations", () => {
  const literal = { kind: "KindNumericLiteral", text: "1" };
  const ast = { kindName: node => node.kind, text: node => node.text,
    authoredRange: () => ({ kind: "synthetic" }), operatorKindName: node => node.operator,
    is: { IsParenthesizedExpression: node => node.kind === "KindParenthesizedExpression",
      IsPrefixUnaryExpression: () => false, IsBinaryExpression: node => node.kind === "KindBinaryExpression" },
    as: { AsParenthesizedExpression: node => ({ Expression: node.inner }),
      AsBinaryExpression: node => ({ Left: node.left, Right: node.right }) } };
  const cycle = { kind: "KindParenthesizedExpression" };
  cycle.inner = cycle;
  assert.equal(sourceIntegerConstantValue(ast, cycle), undefined);
  let deep = literal;
  for (let depth = 0; depth < 129; depth++) deep = { kind: "KindParenthesizedExpression", inner: deep };
  assert.equal(sourceIntegerConstantValue(ast, deep), undefined);
  let wide = literal;
  for (let depth = 0; depth < 12; depth++) wide = { kind: "KindBinaryExpression",
    operator: "KindPlusToken", left: wide, right: wide };
  assert.equal(sourceIntegerConstantValue(ast, wide), undefined);
  assert.equal(sourceIntegerConstantValue(ast, literal), 1n);
});
