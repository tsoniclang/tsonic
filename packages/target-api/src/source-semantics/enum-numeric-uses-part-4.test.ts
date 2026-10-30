import assert from "node:assert/strict";

import test from "node:test";

import { checked, compositionRefusals } from "./enum-numeric-uses-fixtures.js";

test("a wide enum and neighboring checker-equal literal are refused before native operation selection", () => {
  const source = checked(`export enum High { Value = 9007199254740993 }
export function equal(): boolean { return High.Value === 9007199254740992; }`);
  assert.equal(source.semantics.enumConstants.entries[0]!.kind, "resolved", "the exact standalone enum remains native-valid");
  assert.equal(source.semantics.enumConstants.issues[0]?.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED",
    "the unsupported mixed comparison never reaches an internal missing-fact path");
});

test("checked provider enum identity is preserved even when its ambient constants are unknown", () => {
  const source = checked(`import { Value } from "./provider.js";
export function equal(value: Value, operand: number): boolean { return value === operand; }`,
  { "/src/provider.d.ts": "export declare enum Value { First, Second }" });
  assert.equal(source.semantics.enumConstants.issues.length, 1, "actual provider declaration identity owns the numeric use");
  assert.equal(source.semantics.enumConstants.issues[0]!.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED",
    "unknown provider values are not mistaken for non-enum operands");
});

test("same-enum equality, complement, bitwise, initializers and static keys retain their native domain", () => {
  const source = checked(`
export enum Value { First = 1, Second = First << 1 }
export function equal(left: Value, right: Value): boolean { return left === right; }
export function unequal(left: Value, right: Value): boolean { return left !== right; }
export function combine(left: Value, right: Value): Value { return left | right; }
export function mask(left: Value, right: Value): Value { return left & right; }
export function toggle(left: Value, right: Value): Value { return left ^ right; }
export function complement(value: Value): Value { return ~value; }
export function combinedComplement(left: Value, right: Value): Value { return ~left & right; }
export function copiedComplement(value: Value): Value { const result = ~value; const copy = result; return copy; }
export function copiedBitwise(left: Value, right: Value): Value { const result = left | right; const copy = result; return copy; }
export function comparedComplement(value: Value): boolean { const result = ~value; return result === value; }
export function combinedCopy(left: Value, right: Value): Value { const result = ~left; return result & right; }
export const object = { [Value.First]: 1 };
`);
  assert.equal(source.semantics.enumConstants.issues.length, 0, "no supported same-enum operation or compile-time key is reclassified as numeric");
  assert.equal(source.semantics.enumConstants.entries.every(entry => entry.kind === "resolved"), true,
    "constant initializer operators retain their existing exact evaluator");
});

test("enum domain follows actual checked const origins across project source files", () => {
  const source = checked(`import { copied } from "./value.js"; export function use(): number { return copied; }`,
    { "/src/value.ts": "export enum Value { First = 1 } const result = ~Value.First; export const copied = result;" });
  assert.equal(source.semantics.enumConstants.issues.length, 1, "the imported immutable origin retains its actual enum identity");
  assert.equal(source.semantics.enumConstants.issues[0]?.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED",
    "a module name or checker number does not hide the numeric return");
});

test("numeric and shadowed bindings do not inherit another declaration's enum domain", () => {
  const source = checked(`export enum Value { First = 1 }
export function normal(): number { const result = ~1; const copy = result; return copy; }
export function shadow(value: Value): number {
  const result = ~value;
  { const result = 1; return result + 1; }
}
`);
  assert.equal(source.semantics.enumConstants.issues.length, 0,
    "no spelling or ordinary numeric initializer becomes enum provenance");
});

test("explicit numeric source assertions are refused at the shared projection boundary", () => {
  const source = checked(`export enum Value { First = 1 }
export function convert(value: Value): number { const result = value as number; return result; }
`);
  assert.equal(source.semantics.enumConstants.issues.length, 1, "C-0124 refuses explicit numeric projection before either target implements M5");
  assert.equal(source.semantics.enumConstants.issues[0]?.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED", "the conversion has the same precise shared refusal");
  assert.equal(source.ast.is.IsAsExpression(source.semantics.enumConstants.issues[0]?.sourceNode), true,
    "the actual projection owns the refusal; a downstream numeric read is not a second enum use");
});

for (const [label, body] of compositionRefusals){
test(`enum composition refuses ${label} without losing a possible native enum`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    const issues = source.semantics.enumConstants.issues;
    assert.equal(issues.length, 1, `${label}: one actual use, not a diagnostic per operand`);
    assert.equal(issues[0]?.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED", `${label}: shared pre-seal code`);
    assert.equal(issues[0]?.message, "Enum value 'Value' is used as a number; enum-numeric operations are not supported yet. Use equality or bitwise operations within the same enum instead.", `${label}: no guessed enum identity`);
    assert.equal(Object.isFrozen(issues) && Object.isFrozen(issues[0]), true, `${label}: immutable issue`);
  });
}
