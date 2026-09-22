export const unionCallContractsFiles = Object.freeze({
  "receivers.ts": `
export class First {
  tag: number = 1;
  changed: number = 0;
  identity<T>(value: T): T { return value; }
  value(input: number = 5): number { return input + this.tag; }
  total(initial: number, ...rest: number[]): number {
    let result = initial + this.tag;
    for (const value of rest) result += value;
    return result;
  }
  change(value: number = 10): void { this.changed = value; }
  async read(value: number = 7): Promise<number> { return value + this.tag; }
}
export class Second {
  tag: number = 2;
  extra: boolean = true;
  changed: number = 0;
  identity<U>(value: U): U { return value; }
  value(input: number = 9): number { return input + this.tag; }
  total(initial: number, ...rest: number[]): number {
    let result = initial + this.tag;
    for (const value of rest) result += value;
    return result;
  }
  change(value: number = 20): void { this.changed = value; }
  async read(value: number = 8): Promise<number> {
    if (value < 0) throw new Error("chosen async arm");
    return value + this.tag;
  }
}
export type Receiver = First | Second;
export function identity<Value>(receiver: Receiver, value: Value): Value {
  return receiver.identity<Value>(value);
}
export function defaults(receiver: Receiver): number { return receiver.value(); }
export function rest(receiver: Receiver): number { return receiver.total(3, 4, 5); }
export function spread(receiver: Receiver, values: number[]): number { return receiver.total(3, ...values); }
export function emptyRest(receiver: Receiver): number { return receiver.total(3); }
export function mixedRest(receiver: Receiver, values: number[]): number { return receiver.total(3, 4, ...values, 6); }
export function change(receiver: Receiver): void { receiver.change(); }
export function future(receiver: Receiver, value: number): Promise<number> { return receiver.read(value); }
`,
  "index.ts": `
import { First, Second, identity, defaults, rest, spread, emptyRest, mixedRest, change, future } from "./receivers.js";
import type { Receiver } from "./receivers.js";
let order = "";
let selected: Receiver = new First();
function observed(): Receiver { order += "receiver"; return selected; }
async function argument(): Promise<number> { order += "argument"; return 4; }
function replace(): number { selected = new Second(); return 30; }
function chosen(value: Receiver): void { selected = value; }
function ordered(): string { return order; }
export async function run(): Promise<boolean> {
  const first = new First();
  const second = new Second();
  if (identity(first, "first") !== "first" || identity(second, 12) !== 12) return false;
  if (defaults(first) !== 6 || defaults(second) !== 11) return false;
  if (rest(first) !== 13 || rest(second) !== 14 || spread(second, [4, 5]) !== 14) return false;
  if (emptyRest(first) !== 4 || emptyRest(second) !== 5 || mixedRest(first, [5]) !== 19) return false;
  change(first); change(second);
  if (first.changed !== 10 || second.changed !== 20) return false;
  chosen(first);
  if (selected.value(replace()) !== 31) return false;
  chosen(first);
  if (await observed().read(await argument()) !== 5 || ordered() !== "receiverargument") return false;
  if (await future(second, 3) !== 5 || await future(first, 4) !== 5) return false;
  let caught = false;
  try { await future(second, -1); } catch { caught = true; }
  return caught;
}
`,
});

export const incompatibleUnionCalls = Object.freeze([
  `class Left { call(value: number): number { return value; } }
   class Right { call(value: string): string { return value; } }
   export function run(value: Left | Right): number { return value.call(1); }`,
  `class Left { call(value: number): number { return value; } }
   class Right { call(value: number): number { return value; } }
   export function run(value: Left | Right | undefined): number { return value.call(1); }`,
]);
