import assert from "node:assert/strict";

import test from "node:test";

import { createCompilerSessionFromFiles } from "@tsonic/tsts";

import { createTargetSourceProgram } from "../public/source.js";

import { checked, stringRefusals, closedUseRefusals } from "./enum-numeric-uses-fixtures.js";

for (const [label, body] of Array.from(stringRefusals).slice(7, 13)){
test(`enum string boundary refuses ${label} with string-specific wording`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    assert.equal(source.semantics.enumConstants.issues.length, 1, `${label}: one owning string projection`);
    assert.equal(source.semantics.enumConstants.issues[0]?.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED", `${label}: shared projection code`);
    assert.equal(source.semantics.enumConstants.issues[0]?.message,
      "Enum value 'Value' is converted to a string; enum-to-string conversion is not supported yet.", `${label}: no numeric wording or native Enum.ToString substitution`);
  });
}

for (const [label, body] of [
  ["module-local String", "function String(value: Value): string { return 'named'; } export function use(value: Value): string { return String(value); }"],
  ["shadowed String", "export function use(value: Value): string { function String(input: Value): string { return 'named'; } return String(value); }"],
  ["ordinary numeric String", "export function use(value: number): string { return String(value); }"],
  ["user enum formatting function", "function format(value: Value): string { return 'named'; } export function use(value: Value): string { return format(value); }"],
  ["checked object logical result", "export function use(value: Value, object: object): string { const result = object || ~value; return String(result); }"],
] as const){
test(`enum string boundary preserves ${label} by actual checked call identity`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    assert.equal(source.semantics.enumConstants.issues.length, 0, `${label}: a name or string return type is not proof of conversion`);
  });
}

test("erroneous immutable origin cycles terminate without manufacturing a native enum domain", () => {
  const source = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "export enum Value { First = 1 } export const first = second; export const second = first;",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(source.diagnostics.some(issue => issue?.category === 1), true, "the checked cycle remains a source error");
  const selected = createTargetSourceProgram(source);
  assert.equal(selected.semantics.enumConstants.issues.length, 0, "cycle termination does not invent an enum value or a second diagnostic");
});

for (const [label, body] of closedUseRefusals){
test(`closed enum use refuses ${label} at one actual runtime boundary`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    const issues = source.semantics.enumConstants.issues;
    assert.equal(issues.length, 1, `${label}: composed operands are checked once at their use, not once per branch`);
    assert.equal(issues[0]?.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED", `${label}: shared pre-seal admission`);
    assert.equal(issues[0]?.message, "Enum value 'Value' is used as a number; enum-numeric operations are not supported yet. Use equality or bitwise operations within the same enum instead.", `${label}: no missing-fact or target-specific substitute`);
  });
}
