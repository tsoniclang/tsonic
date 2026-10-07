import assert from "node:assert/strict";
import test from "node:test";
import { createSourceProgramNavigation, sourceBindingCapturedBeforeInitialization } from "../../packages/target-api/dist/public/source.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile } from "../fixtures/source-navigation.mjs";

test("deferred capture storage follows binding activation and exact creation order", async () => {
  const source = await checkedSource("deferred-capture-order", { "src/index.ts": `
    function hold(callback: () => number): number { return 7; }
    export function self() { const value = hold(() => value); return value; }
    export function forward() { const read = () => value; const value = 7; return read; }
    export function initialized() { const value = 7; return () => value; }
    export function nested() { const read = () => () => value; const value = 7; return read; }
    export function methods() { const read = { get() { return value; } }; const value = 7; return read; }
    export function directAfter() { function read() { return value; } const value = 7; return read(); }
    export function directBefore() { const result = read(); const value = 7; function read() { return value; } return result; }
    export function cycleAfter() { const value = 7; function first(): number { return second(); } function second(): number { return value; } return first; }
    export function shadow() { const value = 7; const read = () => { const value = 9; return value; }; return read; }
    export function recursive() { const value = (depth: number): number => depth === 0 ? 0 : value(depth - 1); return value; }
    export function recursiveExpression() { const value = function (depth: number): number { return depth === 0 ? 0 : value(depth - 1); }; return value; }
    export function recursiveWrapped() { const value = ((depth: number): number => depth === 0 ? 0 : value(depth - 1)) satisfies ((depth: number) => number); return value; }
    export function recursiveEarly() { const read = () => value(0); const value = (depth: number): number => depth === 0 ? 0 : value(depth - 1); return read; }
    const globalRead = () => globalValue; const globalValue = 7;
  ` });
  const { ast } = source;
  const file = projectSourceFile(source, "src/index.ts");
  const navigation = createSourceProgramNavigation(source);
  for (const [name, expected] of [["self", true], ["forward", true], ["initialized", false], ["nested", true],
    ["methods", true], ["directAfter", false], ["directBefore", true], ["cycleAfter", false], ["shadow", false],
    ["recursive", false], ["recursiveExpression", false], ["recursiveWrapped", false], ["recursiveEarly", true]]) {
    assert.equal(sourceBindingCapturedBeforeInitialization(namedVariable(ast, namedDeclaration(ast, file, name), "value"), ast, navigation), expected, name);
  }
  assert.equal(sourceBindingCapturedBeforeInitialization(namedVariable(ast, file, "globalValue"), ast, navigation), false);
});
