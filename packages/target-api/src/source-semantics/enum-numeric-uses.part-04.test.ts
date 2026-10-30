import assert from "node:assert/strict";

import test from "node:test";

import { checked } from "./enum-numeric-uses-fixtures.js";

for (const absence of Array.from(["null", "undefined"] as const).slice(0, 1)){
for (const operator of ["===", "!==", "==", "!="] as const){
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

for (const absence of Array.from(["null", "undefined"] as const).slice(1, 2)){
for (const operator of Array.from(["===", "!==", "==", "!="] as const).slice(0, 1)){
for (const reversed of Array.from([false, true]).slice(0, 1)){
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

for (const reversed of Array.from([false, true]).slice(1, 2)){
for (const [label, setup, operand] of Array.from([
        ["nullable parameter", "", "value"],
        ["nullable choice", `const selected = flag ? value : ${absence};`, "selected"],
        ["immutable nullable copy", `const selected = flag ? value : ${absence}; const copied = selected;`, "copied"],
      ] as const).slice(0, 2)){
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
