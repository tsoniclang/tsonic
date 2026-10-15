import assert from "node:assert/strict";
import test from "node:test";
import { createSourceIntegerConstantReader, sourceIntegerConstantValue, sourceIntegerLiteralValue } from "../../packages/target-api/dist/public/source.js";
import { checkedSource, namedVariable, projectSourceFile } from "../fixtures/source-navigation.mjs";

function integerAst(operatorRead = () => {}) {
  return { kindName: node => node.kind, text: node => node.text,
    authoredRange: () => ({ kind: "synthetic" }), operatorKindName(node) { operatorRead(node); return node.operator; },
    is: { IsParenthesizedExpression: node => node.kind === "KindParenthesizedExpression",
      IsPrefixUnaryExpression: node => node.kind === "KindPrefixUnaryExpression",
      IsBinaryExpression: node => node.kind === "KindBinaryExpression" },
    as: { AsParenthesizedExpression: node => ({ Expression: node.inner }),
      AsPrefixUnaryExpression: node => ({ Operand: node.inner }),
      AsBinaryExpression: node => ({ Left: node.left, Right: node.right }) } };
}

const integerLiteral = (text = "1") => ({ kind: text.endsWith("n") ? "KindBigIntLiteral" : "KindNumericLiteral", text });
const integerSum = (left, right) => ({ kind: "KindBinaryExpression", operator: "KindPlusToken", left, right });
const integerParentheses = inner => ({ kind: "KindParenthesizedExpression", inner });

function balancedIntegerSum(binaryCount) {
  if (binaryCount === 0) return integerLiteral();
  const leftCount = Math.floor((binaryCount - 1) / 2);
  return integerSum(balancedIntegerSum(leftCount), balancedIntegerSum(binaryCount - 1 - leftCount));
}

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
  const ast = integerAst();
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

for (const cachedFirst of [false, true]) {
  test(`integer reader retains depth accounting with ${cachedFirst ? "cached children" : "an interrupted parent first"}`, () => {
    const ast = integerAst();
    const expressions = [integerLiteral()];
    for (let depth = 0; depth < 129; depth++) expressions.push(integerSum(expressions.at(-1), integerLiteral()));
    const read = createSourceIntegerConstantReader(ast);
    if (cachedFirst) assert.equal(read(expressions[128]), 129n);
    assert.equal(read(expressions[129]), undefined);
    assert.equal(read(expressions[128]), 129n, "an ancestor's refusal cannot poison a valid child root");
    assert.equal(read(expressions[129]), undefined, "a cached child still carries its full relative depth");
    assert.equal(sourceIntegerConstantValue(ast, expressions[129]), undefined);
  });

  test(`integer reader charges every shared DAG edge with ${cachedFirst ? "cached children" : "an oversized root first"}`, () => {
    const ast = integerAst();
    const expressions = [integerLiteral()];
    for (let depth = 0; depth < 12; depth++) expressions.push(integerSum(expressions.at(-1), expressions.at(-1)));
    const read = createSourceIntegerConstantReader(ast);
    if (cachedFirst) assert.equal(read(expressions[10]), 1024n);
    assert.equal(read(expressions[11]), undefined, "6142 logical entries do not fit the4096-entry budget");
    assert.equal(read(expressions[10]), 1024n, "3070 logical entries still fit after a refused ancestor");
    assert.equal(read(expressions[12]), undefined);
    assert.equal(sourceIntegerConstantValue(ast, expressions[11]), undefined);
  });

  test(`integer reader charges finish entries in wrapped trees with ${cachedFirst ? "cached children" : "an interrupted parent first"}`, () => {
    const ast = integerAst();
    const expressions = [integerLiteral()];
    for (let depth = 0; depth < 10; depth++) expressions.push(integerParentheses(integerSum(expressions.at(-1), expressions.at(-1))));
    const read = createSourceIntegerConstantReader(ast);
    if (cachedFirst) assert.equal(read(expressions[9]), 512n);
    assert.equal(read(expressions[10]), undefined, "5116 expanded entries include every unary and binary finish");
    assert.equal(read(expressions[10].inner), undefined, "the5114-entry binary root is not negatively cached as completed");
    assert.equal(read(expressions[9]), 512n);
    assert.equal(sourceIntegerConstantValue(ast, expressions[10]), undefined);
  });
}

test("integer reader preserves the exact4096/4097 logical-entry boundary", () => {
  const ast = integerAst();
  const accepted = balancedIntegerSum(1365);
  const refused = integerParentheses(integerParentheses(balancedIntegerSum(1364)));
  const read = createSourceIntegerConstantReader(ast);
  assert.equal(read(accepted), 1366n);
  assert.equal(read(refused.inner.inner), 1365n, "pre-caching the4093-entry child cannot bypass two wrappers");
  assert.equal(read(refused), undefined);
  assert.equal(read(refused.inner), 1365n, "the4095-entry child still succeeds as its own root");
  assert.equal(read(refused), undefined);
  assert.equal(sourceIntegerConstantValue(ast, accepted), 1366n);
  assert.equal(sourceIntegerConstantValue(ast, refused), undefined);
});

for (const parentFirst of [false, true]) {
  test(`integer reader computes shared arithmetic once with ${parentFirst ? "parent-first" : "child-first"} queries`, () => {
    let operators = 0;
    let leaves = 0;
    const ast = integerAst(() => { operators++; });
    const expressions = [integerLiteral()];
    for (let depth = 0; depth < 128; depth++) expressions.push(integerSum(expressions.at(-1), integerLiteral()));
    const read = createSourceIntegerConstantReader(ast, node => { leaves++; return sourceIntegerLiteralValue(ast, node); });
    const order = parentFirst ? [...expressions].reverse() : expressions;
    for (const expression of order) assert.equal(read(expression), BigInt(expressions.indexOf(expression) + 1));
    assert.equal(operators, 128, "one real operator read per accepted arithmetic node, not one per root path");
    assert.equal(leaves, 129, "one leaf parse per exact source identity");
    for (const expression of order) assert.equal(read(expression), BigInt(expressions.indexOf(expression) + 1));
    assert.equal(operators, 128);
    assert.equal(leaves, 129);
  });
}

test("shared integer reader preserves authored precision, signed zero and each refusal", async () => {
  const maximum = (1n << 132n) - 1n;
  const expressions = [["9007199254740993 + 2", 9007199254740995n], ["-0", 0n],
    ["7 / 2", 3n], ["-7 % 3", -1n], ["7 / 0", undefined], ["7 % 0", undefined],
    ["1.5 + 2", undefined], ["other + 2", undefined], ["read() + 2", undefined],
    ["1 << 2", undefined], ["2 ** 3", undefined], [`${maximum}n`, maximum],
    [`-${maximum}n`, -maximum], [`${maximum}n + 1n`, undefined],
    [`(${maximum}n * 2n) * 0n`, undefined], [`(${maximum}n + 1n) - 1n`, undefined]];
  const source = await checkedSource("integer-reader-exact-values", { "src/index.ts":
    "let other = 1; function read(): number { return 1; }\n" + expressions.map(([expression], index) =>
      `export const value${index} = ${expression};`).join("\n") });
  const file = projectSourceFile(source, "src/index.ts");
  const read = createSourceIntegerConstantReader(source.ast);
  for (const [index, [, expected]] of expressions.entries()) {
    const initializer = source.ast.as.AsVariableDeclaration(namedVariable(source.ast, file, `value${index}`))?.Initializer;
    assert.equal(initializer !== undefined, true);
    assert.equal(read(initializer), expected, `reader constant ${index}`);
    assert.equal(read(initializer), expected, `cached constant ${index}`);
    assert.equal(sourceIntegerConstantValue(source.ast, initializer), expected, `scalar constant ${index}`);
  }
});

test("integer reader caches refused roots without poisoning completed descendants or unrelated roots", () => {
  let leaves = 0;
  const ast = integerAst();
  const read = createSourceIntegerConstantReader(ast, node => { leaves++; return sourceIntegerLiteralValue(ast, node); });
  const cycle = { kind: "KindParenthesizedExpression" };
  cycle.inner = cycle;
  assert.equal(read(cycle), undefined);
  assert.equal(read(cycle), undefined);
  const right = integerLiteral();
  const refused = integerSum({ kind: "KindCallExpression" }, right);
  assert.equal(read(refused), undefined);
  assert.equal(leaves, 1, "the original stack order visits the right child before the unsupported left child");
  assert.equal(read(refused), undefined);
  assert.equal(read(right), 1n);
  assert.equal(leaves, 1, "a refused root retains its completed child summary");
  assert.equal(read(integerLiteral("3")), 3n);
  assert.equal(leaves, 2);
});
