import assert from "node:assert/strict";

import test from "node:test";

import { checked } from "../../../../test/target-api/fixtures/source-semantics/enum-numeric-uses-fixtures.mjs";

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
    assert.equal(source.enums.issues.length, 0, `${label}: use checked types, never operand spelling`);
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
    assert.equal(source.enums.issues.length, 1, `${label}: one actual unsupported enum projection`);
    assert.equal(source.enums.issues[0]?.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED",
      `${label}: the native absence observation never grants M5 numeric projection`);
  });
}

// R2 #47 (1): the string-key message follows the Host index the element selection chose (its descriptor key), not the
// `[k: string]` keyword spelling (baseline: the index keyType isStringLike).
for (const [label, body] of [
  ["Record string key", "export function use(values: Record<string, number>, key: Value): number { return values[key]; }"],
  ["aliased string key", "type Key = string; export function use(values: { [key: Key]: number }, key: Value): number { return values[key]; }"],
  ["mapped string key", "export function use(values: { [K in string]: number }, key: Value): number { return values[key]; }"],
] as const){
test(`enum string index through ${label} is a string conversion`, () => {
    const source = checked(`enum Value { First = 1, Second = 2 } ${body}`);
    assert.equal(source.enums.issues.length, 1, `${label}: one owning use`);
    assert.equal(source.enums.issues[0]?.message,
      "Enum value 'Value' is converted to a string; enum-to-string conversion is not supported yet.", `${label}: string message`);
  });
}
