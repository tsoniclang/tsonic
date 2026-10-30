import assert from "node:assert/strict";

import test from "node:test";

import { checked } from "./enum-numeric-uses-fixtures.js";

for (const absence of Array.from(["null", "undefined"] as const).slice(1, 2)){
for (const operator of Array.from(["===", "!==", "==", "!="] as const).slice(0, 1)){
for (const reversed of Array.from([false, true]).slice(1, 2)){
for (const [label, setup, operand] of Array.from([
        ["nullable parameter", "", "value"],
        ["nullable choice", `const selected = flag ? value : ${absence};`, "selected"],
        ["immutable nullable copy", `const selected = flag ? value : ${absence}; const copied = selected;`, "copied"],
      ] as const).slice(2, 3)){
const comparison = reversed ? `${absence} ${operator} ${operand}` : `${operand} ${operator} ${absence}`;

test(`enum absence ${label} preserves ${comparison}`, () => {
          const source = checked(`enum Value { First = 1, Second = 2 }
export function use(value: Value | null | undefined, flag: boolean): boolean { ${setup} return ${comparison}; }`);
          assert.equal(source.semantics.enumConstants.issues.length, 0,
            `${label}: observing canonical absence does not project an enum to a number`);
        });
}
}
}

for (const operator of Array.from(["===", "!==", "==", "!="] as const).slice(1, 4)){
for (const reversed of [false, true]){
for (const [label, setup, operand] of [
        ["nullable parameter", "", "value"],
        ["nullable choice", `const selected = flag ? value : ${absence};`, "selected"],
        ["immutable nullable copy", `const selected = flag ? value : ${absence}; const copied = selected;`, "copied"],
      ] as const){
const comparison = reversed ? `${absence} ${operator} ${operand}` : `${operand} ${operator} ${absence}`;

test(`enum absence ${label} preserves ${comparison}`, () => {
          const source = checked(`enum Value { First = 1, Second = 2 }
export function use(value: Value | null | undefined, flag: boolean): boolean { ${setup} return ${comparison}; }`);
          assert.equal(source.semantics.enumConstants.issues.length, 0,
            `${label}: observing canonical absence does not project an enum to a number`);
        });
}
}
}
}

for (const [label, body] of [
  ["call result", "function read(value: Value | undefined): Value | undefined { return value; } export function use(value: Value | undefined): boolean { return read(value) !== undefined; }"],
  ["nullable join", "export function use(flag: boolean): boolean { const selected = flag ? Value.First : null; return selected !== null; }"],
  ["nullish composition", "export function use(value: Value | undefined): boolean { return (value ?? Value.First) !== undefined; }"],
  ["comma composition", "function touch(): void {} export function use(value: Value | undefined): boolean { return (touch(), value) !== undefined; }"],
  ["absence alias", "export function use(value: Value | undefined): boolean { const absent: undefined = undefined; return absent === value; }"],
  ["absence union", "export function use(value: Value | null | undefined, absent: null | undefined): boolean { return value === absent; }"],
] as const){
test(`enum absence preserves actual ${label} evidence`, () => {
    const source = checked(`enum Value { First = 1, Second = 2 } ${body}`);
    assert.equal(source.semantics.enumConstants.issues.length, 0, `${label}: use checked types, never operand spelling`);
  });
}

for (const [label, body] of [
  ["nullable numeric peer", "export function use(value: Value | undefined, operand: number): boolean { return value === operand; }"],
  ["reversed nullable numeric peer", "export function use(value: Value | null, operand: number): boolean { return operand != value; }"],
  ["shadowed undefined", "export function use(value: Value, undefined: number): boolean { return value === undefined; }"],
  ["nullable arithmetic", "export function use(value: Value | undefined): number { return (value ?? Value.First) + 1; }"],
  ["explicit numeric destination", "export function use(value: Value | undefined): number | undefined { const selected: number | undefined = value; return selected; }"],
  ["explicit numeric assertion", "export function use(value: Value): boolean { return (value as number) === undefined; }"],
] as const){
test(`enum absence does not admit ${label}`, () => {
    const source = checked(`enum Value { First = 1, Second = 2 } ${body}`);
    assert.equal(source.semantics.enumConstants.issues.length, 1, `${label}: one actual unsupported enum projection`);
    assert.equal(source.semantics.enumConstants.issues[0]?.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED",
      `${label}: the native absence observation never grants M5 numeric projection`);
  });
}
