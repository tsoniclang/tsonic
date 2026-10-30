import { AsVariableDeclaration } from "../source-navigation/checked-casts.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type AstReader, type Node } from "@tsonic/tsts";
import { analyzeSourceLiteralValues, compareSourceNumericLiteralMagnitude, createTargetSourceProgram } from "../public/source.js";
import { parseSourceNumericLiteral, sourceLiteralToken } from "./literal-token.js";
import { parseNativeIntegerLiteral } from "./integer-literal.js";

const float32Midpoint = (1n << 128n) - (1n << 103n);

test("numeric facts preserve authored midpoint neighbors, normalize native grammar and never reread after publication", () => {
  const spellings = [
    String(float32Midpoint - 1n), String(float32Midpoint), String(float32Midpoint + 1n),
    "3.40282356779733661637539395458142568447e38",
    "3.40282356779733661637539395458142568448e38",
    "3.40282356779733661637539395458142568449e38",
    "0xF_F", "0b10_01", "0o7_1", ".5", "1.", "1_2.3_4E+0_2", "1e-9999999999999999999999999", "0e9999999999999999999999999",
  ];
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": spellings.map((text, index) => `export const value${index} = ${text};`).join("\n"),
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const nodes: Node[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsNumericLiteral(node)) nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(nodes.length, spellings.length);
  const reads = new Map<Node, number>();
  let sealed = false;
  const ast: AstReader = { ...source.ast, authoredRange(node) {
    assert.equal(sealed, false, "published literal reads cannot query source provenance");
    if (node !== undefined) reads.set(node, (reads.get(node) ?? 0) + 1);
    return source.ast.authoredRange(node);
  } };
  const values = analyzeSourceLiteralValues(ast, [file]);
  sealed = true;
  for (const [index, node] of nodes.entries()) {
    const literal = values.literalValue.get(node);
    assert.equal(literal?.form, "numeric", `numeric fact ${index}`);
    assert.equal(literal?.numeric?.kind, "authored", `authored provenance ${index}`);
    if (literal?.numeric?.kind !== "authored") throw new Error("Missing authored token.");
    assert.equal(reads.get(node), 1, `one token read ${index}`);
    assert.equal(values.literalValue.get(node) === literal, true, `stable fact ${index}`);
    assert.equal(Object.isFrozen(literal.numeric.token), true);
    if (index < 6) assert.equal(compareSourceNumericLiteralMagnitude(literal.numeric.token, float32Midpoint), index % 3 - 1);
  }
  const tokens = nodes.map(node => {
    const numeric = values.literalValue.get(node)?.numeric;
    if (numeric?.kind !== "authored") throw new Error("Missing authored token.");
    return numeric.token;
  });
  assert.equal(tokens[6]?.decimalText, "255");
  assert.equal(tokens[7]?.decimalText, "9");
  assert.equal(tokens[8]?.decimalText, "57");
  assert.equal(tokens[9]?.decimalText, "0.5");
  assert.equal(tokens[10]?.decimalText, "1.");
  assert.equal(tokens[11]?.decimalText, "12.34e+2");
  assert.equal(compareSourceNumericLiteralMagnitude(tokens[12]!, 1n), -1);
  assert.equal(tokens[12]!.decimalText.length < 40, true, "huge negative exponent remains compact");
  assert.equal(tokens[13]?.decimalText, "0e+9999999999999999999999999");
});

test("unary signs and parentheses preserve exact provenance while casts and binary expressions do not invent it", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts":
    "export const negative = -((0)); export const positive = +(-(-.5)); export const binary = 1 + 2; export const cast = 1 as number;",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const initializers: Node[] = [];
  const visit = (node: Node): void => {
    const initializer = AsVariableDeclaration(source.ast, node)?.Initializer;
    if (initializer !== undefined) initializers.push(initializer);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const values = analyzeSourceLiteralValues(source.ast, [file]);
  const negative = values.literalValue.get(initializers[0]!)?.numeric;
  const positive = values.literalValue.get(initializers[1]!)?.numeric;
  assert.equal(negative?.kind, "authored");
  assert.equal(positive?.kind, "authored");
  if (negative?.kind !== "authored" || positive?.kind !== "authored") throw new Error("Missing numeric evidence.");
  assert.equal(negative.token.negative, true);
  assert.equal(negative.token.coefficient, 0n);
  assert.equal(Object.is(values.literalValue.get(initializers[0]!)?.number, -0), true);
  assert.equal(positive.token.negative, false);
  assert.equal(positive.token.coefficient, 5n);
  assert.equal(positive.token.exponent, -1n);
  assert.equal(values.literalValue.get(initializers[2]!)?.numeric === undefined, true, "binary constant has no authored token");
  assert.equal(values.literalValue.get(initializers[3]!)?.numeric === undefined, true, "cast does not retarget an authored token");
});

test("synthetic numeric facts are actual checked float64 values, never authored fallbacks", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts":
    `export const value = ${float32Midpoint};`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  let literal: Node | undefined;
  const visit = (node: Node): void => {
    if (source.ast.is.IsNumericLiteral(node)) literal = node;
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.ok(literal);
  const ast: AstReader = { ...source.ast, authoredRange: () => ({ kind: "synthetic" }),
    getSourceText() { throw new Error("Synthetic literal cannot read authored source."); } };
  const values = analyzeSourceLiteralValues(ast, [file]);
  const numeric = values.literalValue.get(literal)?.numeric;
  assert.equal(numeric?.kind, "checked-float64");
  if (numeric?.kind !== "checked-float64") throw new Error("Missing checked float64 evidence.");
  assert.equal(numeric.value, Number(float32Midpoint));
  assert.equal(values.literalValue.get(literal)?.integer === undefined, true, "synthetic float64 cannot invent exact unsafe integer evidence");
  assert.throws(() => sourceLiteralToken({ ...source.ast, authoredRange: () => ({ kind: "authored", start: -1, end: 1 }) }, literal!),
    /exact source token/u);
});

test("exact token comparisons and bounded integer facts share normalization without exponent expansion", () => {
  const rows = [ [".5", -1], ["1.", 0], ["10e-1", 0], ["1.01", 1], ["0xff", 1],
    ["1e9999999999999999999999", 1], ["1e-9999999999999999999999", -1] ] as const;
  for (const [text, expected] of rows) {
    const parsed = parseSourceNumericLiteral(text);
    assert.ok(parsed);
    const token = parsed.token;
    assert.equal(compareSourceNumericLiteralMagnitude(token, 1n), expected, text);
    assert.equal(token.decimalText.length <= text.length + 3, true, `bounded native spelling: ${text}`);
  }
  for (const text of ["1.5", "1e-9999999999999999999", "1e9999999999999999999", "0x1" + "0".repeat(33)]) {
    assert.equal(parseNativeIntegerLiteral(text), undefined, `no invalid bounded integer: ${text}`);
  }
  assert.equal(parseNativeIntegerLiteral("0e9999999999999999999"), 0n);
  assert.equal(parseNativeIntegerLiteral("1_000.00e-2"), 10n);
  assert.equal(parseNativeIntegerLiteral("9007199254740993n"), 9007199254740993n);
  assert.equal(parseNativeIntegerLiteral("1606938044258990275541962092341162602522202993782792835301376n"),
    1606938044258990275541962092341162602522202993782792835301376n, "a bigint literal keeps every digit");
  assert.equal(parseNativeIntegerLiteral("0x1" + "0".repeat(33) + "n"), 1n << 132n);
  assert.equal(parseNativeIntegerLiteral("1e5n"), undefined);
});

test("exact magnitude comparison accepts scaled coefficient evidence without a fabricated source token", () => {
  const maximum = (1n << 96n) - 1n;
  const midpointTwice = maximum * 2n + 1n;
  for (const [digit, expected] of [[4n, -1], [5n, 0], [6n, 1]] as const) {
    const magnitude = Object.freeze({ coefficient: (maximum * 10n + digit) * 2n, exponent: -1n });
    assert.equal(compareSourceNumericLiteralMagnitude(magnitude, midpointTwice), expected);
  }
  assert.equal(compareSourceNumericLiteralMagnitude({ coefficient: 2n, exponent: -9999999999999999999n }, 1n), -1);
});

test("neutral numeric spelling preserves authored decimal scale without forcing floating target grammar", () => {
  for (const [text, expected] of [["1", "1"], ["1.", "1."], ["1.0", "1.0"], ["1.00e1", "1.00e+1"],
    ["0", "0"], ["0.0", "0.0"], ["0.000", "0.000"], ["0e0", "0e+0"], ["0.000e2", "0.000e+2"],
    ["0e999999999999999999999", "0e+999999999999999999999"], ["0xff", "255"], ["1_0.0_0", "10.00"]] as const) {
    const parsed = parseSourceNumericLiteral(text);
    assert.equal(parsed?.token.decimalText, expected, text);
    if (text.startsWith("0") && !text.startsWith("0x")) {
      assert.equal(parsed?.token.coefficient, 0n, `zero magnitude ${text}`);
      assert.equal(parsed?.token.exponent, 0n, `zero comparison exponent ${text}`);
    }
  }
});
