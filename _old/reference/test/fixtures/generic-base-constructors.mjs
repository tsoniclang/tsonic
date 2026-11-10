export const genericBaseConstructorFiles = Object.freeze({
  "base.ts": `
export abstract class Base<T> { abstract read(): T; }
export let initialized = 0;
function mark(): number { initialized += 1; return initialized; }
export abstract class InitializedBase<T> {
  order: number = mark();
  abstract read(): T;
}
`,
  "index.ts": `
import { Base as AliasedBase, InitializedBase, initialized } from "./base.js";
class NumberValue extends AliasedBase<number> {
  value: number;
  constructor(value: number) { super(); this.value = value; }
  read(): number { return this.value; }
}
class StringValue extends InitializedBase<string> {
  value: string;
  constructor(value: string) { super(); this.value = value; }
  read(): string { return this.value; }
}
export function run(): boolean {
  const number: AliasedBase<number> = new NumberValue(7);
  const first = new StringValue("first");
  const second = new StringValue("second");
  const text: InitializedBase<string> = second;
  return number.read() === 7 && text.read() === "second" && first.read() === "first" &&
    first.order === 1 && second.order === 2 && initialized === 2;
}
`,
});
