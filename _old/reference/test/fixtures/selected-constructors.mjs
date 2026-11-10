export const selectedConstructorFiles = Object.freeze({
  "constructors.ts": `
import type { int32 } from "@tsonic/core/types.js";
export class Item {
  readonly value: int32;
  constructor(value: int32) { this.value = value; }
}
export type First = { new(value: int32): Item };
export type Second = { new(value: int32): Item };
export const first: First = Item;
export const second: Second = Item;
export function makeFirst(value: int32): Item { return new first(value); }
export function makeSecond(value: int32): Item { return new second(value); }
`,
  "aliases.ts": `
import type { First, Second, Item } from "./constructors.js";
import { first, second } from "./constructors.js";
import type { int32 } from "@tsonic/core/types.js";
const aliasSecond: Second = second;
const aliasFirst: First = first;
export function fromAliases(value: int32): Item {
  const selected: First = aliasSecond;
  const direct = new aliasFirst(value);
  return new selected(direct.value);
}
`,
  "index.ts": `
import { makeFirst, makeSecond, first, second } from "./constructors.js";
import { fromAliases } from "./aliases.js";
export function run(): boolean {
  return makeFirst(11).value === 11 && makeSecond(13).value === 13 &&
    new second(17).value === 17 && new first(19).value === 19 &&
    fromAliases(23).value === 23;
}
`,
});
