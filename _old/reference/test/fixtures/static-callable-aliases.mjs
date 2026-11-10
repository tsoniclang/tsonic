export const staticCallableAliasFiles = {
  "predicates.ts": `
const selected = Array.isArray;
const predicate = (selected satisfies typeof Array.isArray);
const minimum = Math.min;
export function list(value: string | readonly number[]): boolean { return predicate(value); }
export function smallest(left: number, right: number): number { return minimum(left, right); }
`,
  "index.ts": `
import { list, smallest } from "./predicates.js";
export function run(): boolean {
  const initial = Array.isArray;
  const alias = initial;
  const minimum = Math.min;
  let calls = 0;
  const value = (): number[] => { calls++; return [3]; };
  const selected = (): boolean => alias(value());
  const result = selected();
  const count = calls;
  const nan = minimum(Number.NaN, 1);
  return result && count === 1 && alias([]) && !alias("text") && list([1, 2]) &&
    !list("text") && smallest(3, 2) === 2 && minimum(3, 1, 2) === 1 && Number.isNaN(nan);
}
`,
};

export const staticCallableAliasObjectFiles = {
  "index.ts": `
function make() {
  const predicate = Array.isArray;
  const minimum = Math.min;
  return {
    pick<Value>(value: Value): Value {
      if (predicate(3) || minimum(2, 1) !== 1) throw new Error("intrinsic alias capture");
      return value;
    },
  };
}
export function run(): boolean {
  const object = make();
  return object.pick(3) === 3 && object.pick("text") === "text";
}
`,
};
