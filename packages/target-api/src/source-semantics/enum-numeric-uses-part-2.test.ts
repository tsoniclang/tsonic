import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../public/source.js";
import { checked, compositionPreservations, extraNumericRefusals, extraPreservations, stringRefusals, closedUseRefusals } from './enum-numeric-uses-fixtures.js';

for (const [label, body] of compositionPreservations) {
  test(`enum composition preserves ${label} without manufacturing a numeric use`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    assert.equal(source.semantics.enumConstants.issues.length, 0, `${label}: actual result identity and source effects remain unchanged`);
  });
}

for (const [label, body, expected] of extraNumericRefusals) {
  test(`enum boundary refuses ${label} before a target can lose the domain`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    const issues = source.semantics.enumConstants.issues;
    assert.equal(issues.length, expected, `${label}: exactly one precise issue per actual source use`);
    assert.equal(issues.every(issue => issue.code === "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED" && issue.message.includes("used as a number")), true,
      `${label}: no native fallback, missing-fact invariant or string conversion`);
  });
}

test("enum composition preserves every actual condition, call and operand identity", () => {
  const original = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
export enum Value { First = 1, Second = 2 }
function condition(flag: boolean): boolean { return flag; }
function touch(): void {}
export function use(left: Value, right: Value, flag: boolean): Value {
  const result = condition(flag) ? (touch(), ~left) : (touch(), ~right);
  return result;
}
` }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(original.diagnostics.length, 0, "the identity control is actual checked source");
  const nodes: import("@tsonic/tsts").Node[] = [];
  const remaining: (import("@tsonic/tsts").Node | undefined)[] = [...original.sourceFiles];
  while (remaining.length !== 0) {
    const node = remaining.pop();
    if (node === undefined) continue;
    nodes.push(node);
    original.ast.forEachChild(node, child => { if (child !== undefined) remaining.push(child); });
  }
  const calls = nodes.filter(node => original.ast.is.IsCallExpression(node));
  const conditional = nodes.find(node => original.ast.is.IsConditionalExpression(node));
  assert.equal(calls.length, 3, "one condition call and exactly one original call per branch");
  assert.equal(conditional !== undefined, true, "the actual conditional expression exists");
  const source = createTargetSourceProgram(original);
  assert.equal(source.semantics.enumConstants.issues.length, 0, "the same-enum effectful result stays admitted");
  assert.equal(source.sourceFiles.every((file, index) => file === original.sourceFiles[index]), true, "source file identities are unchanged");
  assert.equal(calls.every(call => nodes.includes(call) && source.ast.parent(call) === original.ast.parent(call)), true,
    "source analysis does not replace, copy or reorder a call node");
  assert.equal(source.ast.is.IsConditionalExpression(conditional), true, "the shared node retains its exact conditional kind");
  assert.equal(original.ast.is.IsConditionalExpression(conditional), true, "the original node has the same exact conditional kind");
  assert.equal(source.ast.as.AsConditionalExpression(conditional)?.WhenTrue === original.ast.as.AsConditionalExpression(conditional)?.WhenTrue &&
    source.ast.as.AsConditionalExpression(conditional)?.WhenFalse === original.ast.as.AsConditionalExpression(conditional)?.WhenFalse, true,
    "both exact actual branch expressions survive the shared query unchanged");
});

for (const [label, body] of extraPreservations) {
  test(`enum boundary preserves ${label}`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    assert.equal(source.semantics.enumConstants.issues.length, 0, `${label}: no implicit numeric projection is invented`);
  });
}

for (const [label, body] of stringRefusals) {
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
] as const) {
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

for (const [label, body] of closedUseRefusals) {
  test(`closed enum use refuses ${label} at one actual runtime boundary`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    const issues = source.semantics.enumConstants.issues;
    assert.equal(issues.length, 1, `${label}: composed operands are checked once at their use, not once per branch`);
    assert.equal(issues[0]?.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED", `${label}: shared pre-seal admission`);
    assert.equal(issues[0]?.message, "Enum value 'Value' is used as a number; enum-numeric operations are not supported yet. Use equality or bitwise operations within the same enum instead.", `${label}: no missing-fact or target-specific substitute`);
  });
}
