import assert from "node:assert/strict";
import { test } from "node:test";
import { OpenedProgram } from "../../packages/host/dist/front/handles.js";
import { lowerSingleCheckedModule, captureSingleModule, loadFrontFixture } from "./fixtures/front/checked-module.mjs";

test("numeric declaration bounds keep the exact checker value apart from the authored rational", async () => {
  const fixture = await loadFrontFixture();
  const { convertRawType, createTypeConversion } = await import("../../packages/host/dist/front/type-conversion.js");
  const { resourceLimitDiagnostic } = await import("../../packages/host/dist/diag/index.js");
  const snapshot = fixture.projectSnapshot({
    sourceFiles: { "main.ts": "export const fraction = 0.1; export const integral = 9_007_199_254_740_993;" },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  });
  const { deps, captured, interner } = fixture.captureModulesOf(snapshot,
    snapshot.source.input.packages.modules.filter(row => row.id === snapshot.entryPoint));
  const { raw } = captured[0];
  const declarations = raw.tree.statements.nodes.map(statement => statement.declarationList.declarations.nodes[0]);
  const read = node => raw.checkerViews.find(view => view.node.node === node.id).read.value;
  const conversion = createTypeConversion(deps, raw);
  for (const [declaration, authored, checkerValue, checker] of [
    [declarations[0], [1n, 10n], 0.1, [3602879701896397n, 36028797018963968n]],
    [declarations[1], [9007199254740993n, 1n], 9007199254740992, [9007199254740992n, 1n]],
  ]) {
    const initializer = declaration.initializer;
    const authoredId = read(initializer);
    const checkerId = read(declaration);
    assert.deepEqual(raw.types.types[authoredId].literal.value,
      { kind: "number", value: { kind: "authored", literal: { token: initializer.text, origin: initializer.origin } } });
    assert.deepEqual(raw.types.types[checkerId].literal.value, { kind: "number", value: { kind: "checker-value", value: checkerValue } });
    const item = { module: raw.module, node: declaration.id };
    assert.deepEqual(raw.types.components[raw.types.types[checkerId].component].root, item);
    assert.equal(deps.sourceOccurrenceOf(item).origin === declaration.origin, true);
    for (const [id, [numerator, denominator]] of [[authoredId, authored], [checkerId, checker]]) {
      const result = convertRawType(conversion, id);
      assert.equal(result.kind, "complete");
      const term = fixture.types.readType(interner, result.value.type);
      assert.equal(term.kind, "literal");
      assert.deepEqual(term.value, { kind: "number", value: { numerator, denominator, negativeZero: false } });
    }
    assert.notEqual(conversion.convertedTypes.get(authoredId)?.type, conversion.convertedTypes.get(checkerId)?.type);
  }
  const [fraction] = declarations;
  for (const [field, limit] of [["maximumIntermediateBits", 55], ["maximumResultBits", 107], ["maximumArithmeticWork", 171]]) {
    const limited = createTypeConversion({ ...deps, literalCapture: { ...deps.literalCapture, [field]: limit } }, raw);
    const before = fixture.types.viewTypes(interner).terms.length;
    assert.deepEqual(convertRawType(limited, read(fraction)), {
      kind: "literal-limit", diagnostic: resourceLimitDiagnostic({ owner: "front", limit: `front.literalCapture.${field}`,
        maximum: limit, site: { kind: "source", origin: fraction.origin },
        unit: { request: { query: "lowerModule", key: raw.module }, position: { kind: "result" } } }),
    });
    assert.equal(limited.convertedTypes.size, 0);
    assert.equal(fixture.types.viewTypes(interner).terms.length, before);
  }
  const otherModule = fixture.moduleOf(fixture.packageOf("/project"), "src/foreign.ts");
  const crossed = createTypeConversion({ ...deps, sourceOccurrenceOf(reference) {
    const source = deps.sourceOccurrenceOf(reference);
    return { ...source, origin: { ...source.origin, module: otherModule } };
  } }, raw);
  assert.throws(() => convertRawType(crossed, read(fraction)), /checked numeric component requires its actual source origin/u);
  const lowered = lowerSingleCheckedModule(fixture.front, deps, raw);
  assert.equal(lowered.kind, "ok");
  for (const [index, authored] of [[0, { numerator: 1n, denominator: 10n, negativeZero: false }],
    [1, { numerator: 9007199254740993n, denominator: 1n, negativeZero: false }]]) {
    const declaration = lowered.value.tree.statements.nodes[index].declarationList.declarations.nodes[0];
    assert.deepEqual(declaration.initializer.tsonic.literal.value, authored);
    assert.equal(declaration.tsonic.inferredTypeBound.value, conversion.convertedTypes.get(read(declarations[index])).type);
  }
});

test("a checked numeric bound in a foreign type query retains the foreign site and the requesting unit", async () => {
  const fixture = await loadFrontFixture();
  const { convertRawType, createTypeConversion } = await import("../../packages/host/dist/front/type-conversion.js");
  const { resourceLimitDiagnostic } = await import("../../packages/host/dist/diag/index.js");
  const snapshot = fixture.projectSnapshot({
    sourceFiles: {
      "main.ts": "import { select } from './foreign.js'; export type Callable = typeof select;",
      "foreign.ts": "const exact = 0.1; export function select<T extends typeof exact = typeof exact>(value: T): T { return value; }",
    },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  });
  const { deps, captured, interner } = fixture.captureModulesOf(snapshot, snapshot.source.input.packages.modules.filter(row => row.path.endsWith(".ts")
    && !row.path.endsWith(".d.ts")));
  const { raw } = captured.find(row => row.module === snapshot.entryPoint);
  const foreign = captured.find(row => row.module !== snapshot.entryPoint).raw;
  const owner = foreign.tree.statements.nodes[1].typeParameters.nodes[0].constraint;
  const component = raw.types.components.find(row => row.root.module === foreign.module && row.root.node === owner.id);
  const bound = raw.types.types.find(row => row.component === component.id);
  assert.deepEqual(bound.literal.value, { kind: "number", value: { kind: "checker-value", value: 0.1 } });
  const limited = createTypeConversion({ ...deps, literalCapture: { ...deps.literalCapture, maximumResultBits: 107 } }, raw);
  const before = fixture.types.viewTypes(interner).terms.length;
  assert.deepEqual(convertRawType(limited, bound.id), {
    kind: "literal-limit", diagnostic: resourceLimitDiagnostic({ owner: "front", limit: "front.literalCapture.maximumResultBits",
      maximum: 107, site: { kind: "source", origin: owner.origin },
      unit: { request: { query: "lowerModule", key: raw.module }, position: { kind: "result" } } }),
  });
  assert.equal(fixture.types.viewTypes(interner).terms.length, before);
  assert.equal(limited.convertedTypes.size, 0);
});

test("checker binary64 decoding reserves each exact limb before materializing it", async () => {
  const fixture = await loadFrontFixture();
  const { captureCheckerNumber } = await import("../../packages/host/dist/front/literals.js");
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const origin = { module, start: 0, length: 1, derived: [] };
  const scratch = { checkerNumberBits: null };
  for (const [input, numerator, denominator, negativeZero, intermediate, result, work] of [
    [0, 0n, 1n, false, 1, 1, 65], [-0, 0n, 1n, true, 1, 1, 65],
    [-0.5, -1n, 2n, false, 2, 3, 67],
    [0.1, 3602879701896397n, 36028797018963968n, false, 56, 108, 172],
    [Number.MIN_VALUE, 1n, 1n << 1074n, false, 1075, 1076, 1140],
    [Number.MAX_VALUE, ((1n << 53n) - 1n) << 971n, 1n, false, 1024, 1025, 1142],
  ]) {
    const limits = { maximumIntermediateBits: intermediate, maximumResultBits: result, maximumArithmeticWork: work };
    assert.deepEqual(captureCheckerNumber(limits, input, origin, module, scratch), {
      kind: "complete", value: { kind: "number", value: { numerator, denominator, negativeZero } },
    });
    for (const field of Object.keys(limits)) {
      const refused = captureCheckerNumber({ ...limits, [field]: limits[field] - 1 }, input, origin, module, scratch);
      assert.equal(refused.kind, "literal-limit");
      assert.deepEqual(refused.diagnostic.site, { kind: "source", origin });
      assert.equal(refused.diagnostic.arguments[0].value, `front.literalCapture.${field}`);
    }
  }
  const limits = { maximumIntermediateBits: 4096, maximumResultBits: 4096, maximumArithmeticWork: 4096 };
  for (const nonfinite of [NaN, Infinity, -Infinity])
    assert.throws(() => captureCheckerNumber(limits, nonfinite, origin, module, scratch), /nonfinite checked number/u);
  const unread = { checkerNumberBits: null };
  assert.equal(captureCheckerNumber({ ...limits, maximumArithmeticWork: 63 }, Number.MIN_VALUE, origin, module, unread).kind, "literal-limit");
  assert.equal(unread.checkerNumberBits, null);
});

test("raw optional-number calls retain the numeric source token, selected argument and actual contextual type independently", async () => {
  const fixture = await loadFrontFixture();
  for (const token of ["0", "0x0", "input"]) {
    const parameter = token === "input" ? "input: number" : "";
    const source = "\uFEFF// 😀\r\nexport function pass(value?: number): number | undefined { return value; }\r\n"
      + `export function call(${parameter}): number | undefined { return pass(${token}); }`;
    const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
      libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
    const { deps, program } = fixture.openAndCapture(snapshot);
    const checked = OpenedProgram.checked(program);
    const { file } = OpenedProgram.file(program, snapshot.entryPoint);
    const { ast, checker, typeShape } = checked.getSourceFileQueries(file);
    const statement = ast.statements(ast.body(ast.statements(file).at(-1)))[0];
    const liveCall = ast.children(statement).find(node => ast.kindName(node) === "KindCallExpression");
    const [liveArgument] = ast.arguments(liveCall);
    const native = checker.getResolvedCallInfo(liveCall);
    assert.equal(native.kind, "applicable");
    const [binding] = native.selection.arguments.values;
    assert.equal(native.selection.sourceArguments[0] === liveArgument && binding.sourceArgument === liveArgument
      && binding.effectiveArgument === liveArgument, true);
    const read = checker.getTypeAtLocation(liveArgument);
    const context = checker.getContextualType(liveArgument);
    assert.equal(read.cause, undefined);
    assert.equal(context.cause, undefined);
    assert.equal(context.type === binding.selectedParameterType, true);
    assert.equal(typeShape.getNumericLiteralTypeValue(read.type), token === "input" ? undefined : 0);
    assert.equal(typeShape.getNumericLiteralTypeValue(binding.selectedArgumentType), token === "input" ? undefined : 0);
    const base = typeShape.getBaseTypeOfLiteralType(read.type);
    assert.equal(typeShape.getBaseTypeOfLiteralType(binding.selectedArgumentType) === base, true);
    assert.equal(typeShape.isNumberLike(base), true);
    assert.equal(typeShape.getUnionOrIntersectionTypes(context.type).includes(base), true);
    assert.equal(snapshot.nativeFacts.floatingFormats.find(format => format.carrier === "float64").interchange, "ieee754-binary64");

    const result = captureSingleModule(fixture.front, deps, program, snapshot.entryPoint);
    assert.equal(result.kind, "ok");
    const raw = result.value;
    const argument = raw.tree.statements.nodes.at(-1).body.statements.nodes[0].expression.arguments.nodes[0];
    assert.equal(argument.kind, token === "input" ? "Identifier" : "NumericLiteral");
    assert.equal(argument.text, token);
    assert.deepEqual(argument.origin, { module: raw.module, start: source.lastIndexOf(token), length: token.length, derived: [] });
    const rawArgument = { module: raw.module, node: argument.id };
    const [invocation] = raw.calls;
    assert.equal(invocation.kind, "applicable");
    const [candidate] = raw.types.candidates[invocation.candidates].candidates;
    const [authored] = candidate.sourceArguments;
    const [selected] = candidate.arguments.value;
    assert.deepEqual(authored.occurrence, rawArgument);
    assert.deepEqual(selected.sourceArgument, rawArgument);
    assert.deepEqual(selected.effectiveArgument, rawArgument);
    const view = raw.checkerViews.find(row => row.node.node === argument.id);
    const types = raw.types.types;
    const [authoredType, selectedType] = [authored.component.value, selected.source.value]
      .map(component => types.find(row => row.component === component));
    const expected = token === "input" ? null : { kind: "number", value: { kind: "authored", literal: { token, origin: argument.origin } } };
    for (const row of [authoredType, selectedType, types[view.read.value]]) {
      assert.deepEqual(row.form, { kind: "available", value: { kind: "scalar", scalar: "number" } });
      assert.deepEqual(row.literal, { kind: "available", value: expected });
    }
    if (token !== "input") {
      const literal = authoredType.literal.value.value.literal;
      assert.equal(selectedType.literal.value.value.literal === literal, true);
      assert.equal(types[view.read.value].literal.value.value.literal === literal, true);
      assert.equal(literal.origin === argument.origin, true);
      assert.notEqual(argument.origin.start, Buffer.byteLength(source.slice(0, argument.origin.start), "utf8"));
    }
    const destination = types.find(row => row.component === selected.destination.value);
    for (const row of [destination, types[view.contextual.value]]) {
      assert.deepEqual(row.literal, { kind: "available", value: null });
      assert.equal(row.form.value.kind, "union");
      assert.deepEqual(row.form.value.members.map(member => types[member].form.value.scalar).sort(), ["number", "undefined"]);
    }
  }
});

test("lowerModule admits authored numeric work and sizes the canonical rational separately", async suite => {
  const fixture = await loadFrontFixture();
  const { resourceLimitDiagnostic } = await import("../../packages/host/dist/diag/index.js");
  const ready = token => {
    const text = "\uFEFF// 😀\r\nexport function pass(value?: number): number | undefined { return value; }\r\n"
      + `export function call(): number | undefined { return pass(${token}); }`;
    const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": text },
      libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
    const { deps, captured } = fixture.captureModulesOf(snapshot, snapshot.source.input.packages.modules.filter(row => row.id === snapshot.entryPoint));
    const raw = captured[0].raw;
    const syntax = raw.tree.statements.nodes.at(-1).body.statements.nodes[0].expression.arguments.nodes[0];
    assert.equal(text.slice(syntax.origin.start, syntax.origin.start + syntax.origin.length), token);
    return { deps, raw, syntax };
  };
  const base = { maximumIntermediateBits: 256, maximumResultBits: 128, maximumArithmeticWork: 4096 };
  const refused = (entry, limits, field) => {
    const result = lowerSingleCheckedModule(fixture.front, { ...entry.deps, literalCapture: limits }, entry.raw);
    assert.equal(result.kind, "refused", `${entry.syntax.text}: ${field}`);
    assert.deepEqual(result.diagnostics, [
      resourceLimitDiagnostic({ owner: "front", limit: `front.literalCapture.${field}`, maximum: limits[field],
        site: { kind: "source", origin: entry.syntax.origin },
        unit: { request: { query: "lowerModule", key: entry.raw.module }, position: { kind: "result" } } }),
    ]);
  };
  const accepted = (entry, limits, numerator, denominator = 1n) => {
    const lower = lowerSingleCheckedModule(fixture.front, { ...entry.deps, literalCapture: limits }, entry.raw);
    assert.equal(lower.kind, "ok", entry.syntax.text);
    const selected = lower.value.tree.statements.nodes.at(-1).body.statements.nodes[0].expression.arguments.nodes[0];
    assert.deepEqual(selected.tsonic.literal, { kind: "number", token: entry.syntax.text,
      value: { numerator, denominator, negativeZero: false } });
  };
  await suite.test("equal binary, octal and hex magnitudes have equal temporary and result bounds", () => {
    for (const token of ["0b1", "0o1", "0x1"]) {
      const entry = ready(token);
      refused(entry, { ...base, maximumIntermediateBits: 0 }, "maximumIntermediateBits");
      refused(entry, { ...base, maximumResultBits: 1 }, "maximumResultBits");
      accepted(entry, { ...base, maximumIntermediateBits: 1, maximumResultBits: 2 }, 1n);
    }
    const hex = ready("0xff");
    refused(hex, { ...base, maximumResultBits: 8 }, "maximumResultBits");
    accepted(hex, { ...base, maximumIntermediateBits: 8, maximumResultBits: 9 }, 255n);
  });
  await suite.test("the result counts both reduced limbs, not their temporary widths", () => {
    const half = ready("0.50");
    refused(half, { ...base, maximumIntermediateBits: 3 }, "maximumIntermediateBits");
    refused(half, { ...base, maximumResultBits: 2 }, "maximumResultBits");
    accepted(half, { ...base, maximumIntermediateBits: 4, maximumResultBits: 3 }, 1n, 2n);
    const fraction = ready("1.25");
    refused(fraction, { ...base, maximumResultBits: 5 }, "maximumResultBits");
    accepted(fraction, { ...base, maximumResultBits: 6 }, 5n, 4n);
  });
  await suite.test("token, coefficient, power and reduction work stop at their actual allowance", () => {
    const radix = ready("0x1");
    refused(radix, { ...base, maximumArithmeticWork: 2 }, "maximumArithmeticWork");
    refused(radix, { ...base, maximumArithmeticWork: 3 }, "maximumArithmeticWork");
    accepted(radix, { ...base, maximumArithmeticWork: 4 }, 1n);
    const scaled = ready("999999e1");
    const scaledWork = 8 + 20 + 20 * 4;
    refused(scaled, { ...base, maximumArithmeticWork: scaledWork - 1 }, "maximumArithmeticWork");
    refused(scaled, { ...base, maximumIntermediateBits: 23 }, "maximumIntermediateBits");
    accepted(scaled, { ...base, maximumArithmeticWork: scaledWork, maximumIntermediateBits: 24, maximumResultBits: 25 }, 9999990n);
    const square = ready("9e2");
    const squareWork = 3 + 4 + 4 * 4 + 4 * 7;
    refused(square, { ...base, maximumArithmeticWork: squareWork - 1 }, "maximumArithmeticWork");
    accepted(square, { ...base, maximumArithmeticWork: squareWork }, 900n);
    const half = ready("0.50");
    const halfWork = 4 + 3 + 4 * 3 + 3 * 3 + 4 * 3;
    refused(half, { ...base, maximumArithmeticWork: halfWork - 1 }, "maximumArithmeticWork");
    accepted(half, { ...base, maximumArithmeticWork: halfWork }, 1n, 2n);
  });
  await suite.test("enormous exponents refuse at the original token and admitted coefficients stay exact", () => {
    for (const token of ["1e999999999", "1e-99999999999999999999999999"]) {
      refused(ready(token), base, "maximumIntermediateBits");
    }
    refused(ready("1e9007199254740991"), { ...base, maximumIntermediateBits: Number.MAX_SAFE_INTEGER }, "maximumIntermediateBits");
    const planned = ready("1e38");
    refused(planned, base, "maximumArithmeticWork");
    const power = { ...base, maximumArithmeticWork: 16_384 };
    refused(planned, { ...power, maximumResultBits: 127 }, "maximumResultBits");
    accepted(planned, { ...power, maximumResultBits: 128 }, 10n ** 38n);
    accepted(ready("9_007_199_254_740_993"), base, 9007199254740993n);
  });
});
