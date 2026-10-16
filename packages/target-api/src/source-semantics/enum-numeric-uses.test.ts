import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../public/source.js";

function checked(text: string, files: Readonly<Record<string, string>> = {}) {
  const source = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": text, ...files },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(source.diagnostics.length, 0, formatDiagnostics(source.diagnostics.filter(issue => issue !== undefined)));
  return createTargetSourceProgram(source);
}

const numericUses = [
  ["mixed equality", "export function use(value: Value, operand: number): boolean { return value === operand; }"],
  ["mixed inequality", "export function use(value: Value, operand: number): boolean { return value != operand; }"],
  ["same-enum ordering", "export function use(left: Value, right: Value): boolean { return left < right; }"],
  ["arithmetic", "export function use(value: Value): number { return value + 1; }"],
  ["unary minus", "export function use(value: Value): number { return -value; }"],
  ["unary plus", "export function use(value: Value): number { return +value; }"],
  ["increment", "export function use(value: Value): Value { value++; return value; }"],
  ["decrement", "export function use(value: Value): Value { --value; return value; }"],
  ["numeric local", "export function use(value: Value): number { const result: number = value; return result; }"],
  ["numeric return", "export function use(value: Value): number { return value; }"],
  ["numeric argument", "function consume(value: number): number { return value; } export function use(value: Value): number { return consume(value); }"],
  ["numeric assignment", "export function use(value: Value): number { let result = 0; result = value; return result; }"],
  ["mixed bitwise", "export function use(value: Value, operand: number): number { return value | operand; }"],
  ["shift", "export function use(value: Value): number { return value << 1; }"],
  ["complement numeric local", "export function use(value: Value): number { const result: number = ~value; return result; }"],
  ["complement arithmetic", "export function use(value: Value): number { return ~value + 1; }"],
  ["bitwise numeric return", "export function use(left: Value, right: Value): number { return left | right; }"],
] as const;

for (const [label, body] of numericUses) {
  test(`enum numeric admission refuses ${label} once before target analysis`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    const issues = source.semantics.enumConstants.issues;
    assert.equal(issues.length, 1, `${label} has one owning use, not one diagnostic per operand`);
    assert.equal(issues[0]!.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED", `${label} has the shared scope diagnostic`);
    assert.equal(issues[0]!.message, "Enum value 'Value' is used as a number; enum-numeric operations are not supported yet. Use equality or bitwise operations within the same enum instead.",
      `${label} uses the same target-neutral text`);
    assert.equal(Object.isFrozen(issues) && Object.isFrozen(issues[0]), true, `${label} publishes frozen issue data`);
  });
}

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
export const object = { [Value.First]: 1 };
`);
  assert.equal(source.semantics.enumConstants.issues.length, 0, "no supported same-enum operation or compile-time key is reclassified as numeric");
  assert.equal(source.semantics.enumConstants.entries.every(entry => entry.kind === "resolved"), true,
    "constant initializer operators retain their existing exact evaluator");
});
