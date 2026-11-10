import assert from "node:assert/strict";
import test from "node:test";
import {
  sourceBooleanLiteralDisposition, sourceFiniteLiteralDomain, sourceLiteralDomainIncludes,
  sourceLiteralDomainIntersection, sourceLiteralDomainUnion, sourceLiteralUnitsEqual, sourceOpenLiteralDomain,
  sourcePresenceLiteralDisposition, sourcePresentLiteralDomain, sourceUnreachableLiteralDomain,
} from "./domain.js";

test("literal domains distinguish open knowledge from unreachable execution", () => {
  assert.equal(sourceFiniteLiteralDomain([]).kind, "unreachable");
  assert.equal(sourceLiteralDomainUnion([sourceUnreachableLiteralDomain]).kind, "unreachable");
  assert.equal(sourceLiteralDomainUnion([sourceOpenLiteralDomain, sourceUnreachableLiteralDomain]).kind, "open");
  assert.equal(sourceLiteralDomainIncludes(sourceUnreachableLiteralDomain, { kind: "absence" }), false);
  assert.equal(sourceLiteralDomainIncludes(sourceOpenLiteralDomain, { kind: "absence" }), true);
});

test("literal domain intersections retain exact category-aware units and independently known presence", () => {
  const numeric = { kind: "number" as const, value: { kind: "integer" as const, value: 9007199254740993n } };
  const big = { kind: "bigint" as const, value: 9007199254740993n };
  const selected = sourceLiteralDomainIntersection([sourceFiniteLiteralDomain([numeric, big, { kind: "absence" }]),
    sourcePresentLiteralDomain, sourceFiniteLiteralDomain([numeric])]);
  assert.equal(selected.kind === "finite" && selected.values.length === 1 && sourceLiteralUnitsEqual(selected.values[0]!, numeric), true);
  assert.equal(sourceLiteralDomainIntersection([sourceOpenLiteralDomain, sourcePresentLiteralDomain]).kind, "open");
  assert.equal(sourcePresenceLiteralDisposition(sourceLiteralDomainIntersection([sourceOpenLiteralDomain, sourcePresentLiteralDomain])), "present");
  assert.equal(sourceLiteralDomainIntersection([sourceFiniteLiteralDomain([numeric]), sourceFiniteLiteralDomain([big])]).kind, "unreachable");
  assert.equal(sourceLiteralDomainIntersection([sourceOpenLiteralDomain, sourceUnreachableLiteralDomain]).kind, "unreachable");
});

test("literal control disposition is exact bool knowledge and never general truthiness", () => {
  assert.equal(sourceBooleanLiteralDisposition(sourceFiniteLiteralDomain([{ kind: "boolean", value: true }])), "true");
  assert.equal(sourceBooleanLiteralDisposition(sourceFiniteLiteralDomain([{ kind: "boolean", value: false }])), "false");
  assert.equal(sourceBooleanLiteralDisposition(sourceFiniteLiteralDomain([
    { kind: "boolean", value: true }, { kind: "boolean", value: false },
  ])), "dynamic");
  assert.equal(sourceBooleanLiteralDisposition(sourceFiniteLiteralDomain([{ kind: "string", value: "" }])), "dynamic");
  assert.equal(sourceBooleanLiteralDisposition(sourceOpenLiteralDomain), "dynamic");
});

test("absence knowledge never borrows a reference annotation or confuses present false zero and empty string", () => {
  assert.equal(sourcePresenceLiteralDisposition(sourceOpenLiteralDomain), "dynamic");
  assert.equal(sourcePresenceLiteralDisposition(sourceFiniteLiteralDomain([{ kind: "absence" }])), "absent");
  assert.equal(sourcePresenceLiteralDisposition(sourceFiniteLiteralDomain([
    { kind: "boolean", value: false }, { kind: "string", value: "" },
    { kind: "number", value: { kind: "integer", value: 0n } },
  ])), "present");
  assert.equal(sourcePresenceLiteralDisposition(sourceFiniteLiteralDomain([
    { kind: "absence" }, { kind: "boolean", value: false },
  ])), "dynamic");
  assert.equal(sourcePresenceLiteralDisposition(sourcePresentLiteralDomain), "present");
  assert.equal(sourceLiteralDomainIncludes(sourcePresentLiteralDomain, { kind: "absence" }), false);
  assert.equal(sourcePresenceLiteralDisposition(sourceLiteralDomainUnion([
    sourcePresentLiteralDomain, sourceFiniteLiteralDomain([{ kind: "absence" }]),
  ])), "dynamic");
});

test("literal numeric identity preserves category and arbitrary native integer precision", () => {
  const wide = 9007199254740993n;
  assert.equal(sourceLiteralUnitsEqual({ kind: "number", value: { kind: "integer", value: wide } },
    { kind: "number", value: { kind: "integer", value: wide + 1n } }), false);
  assert.equal(sourceLiteralUnitsEqual({ kind: "number", value: { kind: "integer", value: 1n } },
    { kind: "bigint", value: 1n }), false);
  assert.equal(sourceLiteralUnitsEqual({ kind: "number", value: { kind: "integer", value: 1n } },
    { kind: "number", value: { kind: "checked-float64", value: 1 } }), true);
});

test("numeric domains compare exact decimal and binary values without a rounding conversion", () => {
  const decimal = (coefficient: bigint, exponent: bigint) => ({ kind: "number" as const,
    value: { kind: "authored" as const, token: { coefficient, exponent, negative: false, decimalText: `${coefficient}e${exponent}` } } });
  assert.equal(sourceLiteralUnitsEqual(decimal(5n, -1n),
    { kind: "number", value: { kind: "checked-float64", value: 0.5 } }), true);
  assert.equal(sourceLiteralUnitsEqual(decimal(1n, -1n),
    { kind: "number", value: { kind: "checked-float64", value: 0.1 } }), false);
  assert.equal(sourceLiteralUnitsEqual(decimal(1n, 1000000000000000000n),
    decimal(10n, 999999999999999999n)), true);
});

test("published finite domains snapshot numeric facts without aliasing mutable input vectors", () => {
  const token = { coefficient: 1n, exponent: 0n, negative: false, decimalText: "1" };
  const domain = sourceFiniteLiteralDomain([{ kind: "number", value: { kind: "authored", token } }]);
  token.coefficient = 2n;
  assert.equal(sourceLiteralDomainIncludes(domain, { kind: "number", value: { kind: "integer", value: 1n } }), true);
  assert.equal(sourceLiteralDomainIncludes(domain, { kind: "number", value: { kind: "integer", value: 2n } }), false);
});
