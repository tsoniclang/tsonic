import assert from "node:assert/strict";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";
import { sourceTypeFlowFixture as fixture } from "./fixtures/source-type-flow-fixture.mjs";
import { analyzeSourceLiteralValues } from "../../packages/target-api/dist/source-semantics/literal-values.js";
import { sourcePrimitiveOperatorLiteralFits } from "../../packages/target-api/dist/source-semantics/local-type-flow/operator-decisions.js";

function resolved(result, label) {
  assert.equal(result.kind, "resolved", label);
  return result.value;
}

test("a descending or non-unit-step counter is fixed without a counted-loop proof", () => {
  const current = fixture("function run(): void { for (let index = 8; index >= 0; index -= 2) {} }");
  const declaration = current.declaration("index");
  const value = current.slot("index");
  assert.equal(value.type.kind === "primitive" && value.type.primitive === "int64", true,
    "the original local retains its integer creation type without a counted-loop proof");
  const induction = resolved(current.source.facts.integers.induction(declaration), "the original loop proof query resolves");
  assert.equal(induction.kind, "none", "a descending non-unit loop has no fabricated counted-loop authority");
  assert.equal(Object.isFrozen(induction), true);
});

for (const selected of [{ annotation: "number", primitive: "float64" }, { annotation: "int32", primitive: "int32" }]) {
  test(`an annotated ${selected.annotation} counter and its reads never acquire loop-counter authority`, () => {
    const current = fixture(`function run(): void { for (let index: ${selected.annotation} = 0; index < 3; index++) { const value = index; } }`);
    const declaration = current.declaration("index");
    const { ast, facts } = current.source;
    const reads = facts.values.occurrences().filter(node => ast.is.IsIdentifier(node) &&
      facts.navigation.sourceReferenceFor(node)?.declaration === declaration);
    assert.equal(reads.length >= 3, true, "the exact original counter reads are retained");
    for (const node of [declaration, ...reads]) {
      assert.equal(resolved(facts.integers.induction(declaration),
        "an annotation excludes counter authority before reading").kind, "none");
      const value = node === declaration ? resolved(facts.values.declaredSlot(node), "the authored counter slot resolves").type
        : resolved(facts.values.type(node), "the exact annotated read is published");
      assert.equal(value.type.kind === "primitive" && value.type.primitive === selected.primitive, true,
        "the annotation, not a later induction question, owns the exact primitive");
      assert.equal(resolved(facts.integers.induction(declaration),
        "describing an annotated read does not create a counter receipt").kind, "none");
    }
  });
}

test("ordinary int64-compatible values do not acquire loop-counter authority", () => {
  const current = fixture("export const value = 8;");
  assert.equal(resolved(current.source.facts.integers.induction(current.declaration("value")),
    "the original non-counter proof query resolves").kind, "none");
});

test("range admission distinguishes signed, unsigned, floating and decimal domains", () => {
  const values = [2147483647n, 2147483648n, -1n, 18446744073709551615n, 18446744073709551616n,
    10n ** 40n, 10n ** 400n, 79228162514264337593543950336n];
  const current = fixture(values.map((value, index) => `const range${index} = ${value};`).join("\n"));
  const original = analyzeSourceLiteralValues(current.source.ast, current.source.sourceFiles).literalValue;
  const literals = values.map((_, index) => {
    const initializer = current.source.ast.as.AsVariableDeclaration(current.declaration(`range${index}`))?.Initializer;
    const literal = initializer === undefined ? undefined : original.get(initializer);
    if (literal === undefined) throw new Error("The original range-test Source literal receipt is required.");
    return literal;
  });
  assert.equal(sourcePrimitiveOperatorLiteralFits(literals[0], "int32"), true);
  assert.equal(sourcePrimitiveOperatorLiteralFits(literals[1], "int32"), false);
  assert.equal(sourcePrimitiveOperatorLiteralFits(literals[2], "uint32"), false);
  assert.equal(sourcePrimitiveOperatorLiteralFits(literals[3], "uint64"), true);
  assert.equal(sourcePrimitiveOperatorLiteralFits(literals[4], "uint64"), false);
  assert.equal(sourcePrimitiveOperatorLiteralFits(literals[5], "float32"), false);
  assert.equal(sourcePrimitiveOperatorLiteralFits(literals[6], "float64"), false);
  assert.equal(sourcePrimitiveOperatorLiteralFits(literals[7], "decimal"), false);
});

test("negative zero keeps the same integer creation default as ordinary zero", () => {
  const current = fixture("function run(): void { const negative = -0; const ordinary = 0; } export const exported = -0;");
  for (const name of ["negative", "exported"]) {
    assert.equal(isDeepStrictEqual(current.slot(name).type, { kind: "primitive", primitive: "int64" }), true, name);
  }
  assert.equal(isDeepStrictEqual(current.slot("ordinary").type, { kind: "primitive", primitive: "int64" }), true, "ordinary");
});

test("the one integer default owner retains signed 64-bit creation for local, module and exported literals", () => {
  const cases = [
    ["positive_boundary", "2147483647", "int64"],
    ["positive_overflow", "2147483648", "int64"],
    ["positive_above", "2147483649", "int64"],
    ["negative_boundary", "-2147483648", "int64"],
    ["negative_overflow", "-2147483649", "int64"],
    ["wrapped_overflow", "(2147483648)", "int64"],
    ["positive_zero", "0", "int64"],
    ["negative_zero", "-0", "int64"],
    ["fractional", "1.5", "float64"],
    ["exponent", "1e2", "float64"],
  ];
  const current = fixture(cases.map(([name, literal]) =>
    `const module_${name} = ${literal}; export const exported_${name} = ${literal};`
  ).join("\n") + `\nfunction run(): void { ${cases.map(([name, literal]) => `const local_${name} = ${literal};`).join("\n")} }`);
  for (const scope of ["local", "module", "exported"]) for (const [name, _literal, primitive] of cases) {
    const declaration = current.declaration(`${scope}_${name}`);
    const selected = current.slot(`${scope}_${name}`).type;
    assert.equal(selected?.kind === "primitive" && selected.primitive === primitive, true, `${scope}_${name}`);
  }
  assert.equal(current.source.facts.refusals().length, 0);
});

test("integer creation describes the signed whole minimum and refuses values beyond int64 without a float fallback", () => {
  const cases = [
    ["maximum", "9223372036854775807", true],
    ["minimum", "-9223372036854775808", true],
    ["wrapped_minimum", "-(9223372036854775808)", true],
    ["positive_overflow", "9223372036854775808", false],
    ["negative_overflow", "-9223372036854775809", false],
    ["transport_overflow", "1000000000000000000000000000000000000000000", false],
  ];
  const current = fixture(cases.map(([name, literal]) =>
    `const module_${name} = ${literal}; export const exported_${name} = ${literal};`
  ).join("\n") + `\nfunction run(): void { ${cases.map(([name, literal]) => `const local_${name} = ${literal};`).join("\n")} }`);
  for (const scope of ["local", "module", "exported"]) for (const [name, _literal, admitted] of cases) {
    const selected = current.source.facts.values.declaredSlot(current.declaration(`${scope}_${name}`));
    assert.equal(admitted ? selected.kind === "resolved" && selected.value.type.type.kind === "primitive" &&
      selected.value.type.type.primitive === "int64" : selected.kind === "refused", true,
      `${scope}_${name}: the exact whole literal owns its creation kind`);
  }
});
